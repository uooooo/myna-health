import { buildEddsa, buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";

export const BN254_SCALAR_FIELD =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;
export const PUBLIC_SIGNAL_COUNT = 11;
export const PUBLIC_SIGNAL_NAMES = [
  "issuerAx",
  "issuerAy",
  "acceptedDrugCodes[0]",
  "acceptedDrugCodes[1]",
  "acceptedDrugCodes[2]",
  "acceptedDrugCodes[3]",
  "minDay",
  "maxDay",
  "context",
  "policyHash",
  "nullifier",
] as const;

const RECORD_DOMAIN = 1314214866n;
const POLICY_DOMAIN = 1347374937n;
const NULLIFIER_DOMAIN = 1314214990n;
const UINT32_MAX = 2n ** 32n - 1n;
const DEMO_ISSUER_KEY = Uint8Array.from(
  "2a134f916b2db6dfcfaf980ed0a4828cf0a57f1df9177c0e7139793aa211654f"
    .match(/.{2}/g)!
    .map((byte) => Number.parseInt(byte, 16)),
);

export type Field = string;
export type FourDrugCodes = [Field, Field, Field, Field];

export interface EligibilityPolicy {
  acceptedDrugCodes: FourDrugCodes;
  minDay: number;
  maxDay: number;
  /** Fixed campaign scope, already reduced to the BN254 scalar field. */
  context: Field;
}

export interface IssuerPublicKey {
  ax: Field;
  ay: Field;
}

export interface SignedRecord {
  drugCode: Field;
  dispensingDay: number;
  recordNonce: Field;
  signature: { r8x: Field; r8y: Field; s: Field };
}

export interface SyntheticFixture {
  source: "synthetic-demo-issuer";
  policy: EligibilityPolicy;
  issuerPublicKey: IssuerPublicKey;
  record: SignedRecord;
  holderSecret: Field;
}

export interface ProvingArtifacts {
  wasm: string;
  zkey: string;
}

export interface ProofBundle {
  proof: Record<string, unknown>;
  publicSignals: Field[];
}

let poseidonPromise: ReturnType<typeof buildPoseidon> | undefined;
let eddsaPromise: ReturnType<typeof buildEddsa> | undefined;

function poseidonInstance() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

function eddsaInstance() {
  eddsaPromise ??= buildEddsa();
  return eddsaPromise;
}

export function canonicalField(value: string | number | bigint, label = "field"): bigint {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new Error(`${label} must be an integer`);
  }
  if (parsed < 0n || parsed >= BN254_SCALAR_FIELD) {
    throw new Error(`${label} is outside the BN254 scalar field`);
  }
  return parsed;
}

function canonicalDay(value: number, label: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || BigInt(value) > UINT32_MAX) {
    throw new Error(`${label} must be an unsigned 32-bit epoch day`);
  }
  return BigInt(value);
}

function validatePolicy(policy: EligibilityPolicy) {
  if (!Array.isArray(policy.acceptedDrugCodes) || policy.acceptedDrugCodes.length !== 4) {
    throw new Error("acceptedDrugCodes must have exactly four entries");
  }
  const codes = policy.acceptedDrugCodes.map((code, i) => {
    const parsed = canonicalField(code, `acceptedDrugCodes[${i}]`);
    if (parsed > UINT32_MAX) throw new Error("drug code must fit in 32 bits");
    return parsed;
  });
  const nonzero = codes.filter((code) => code !== 0n);
  if (nonzero.length === 0 || new Set(nonzero.map(String)).size !== nonzero.length) {
    throw new Error("policy requires unique nonzero accepted drug codes; zero may pad the set");
  }
  const minDay = canonicalDay(policy.minDay, "minDay");
  const maxDay = canonicalDay(policy.maxDay, "maxDay");
  if (minDay > maxDay) throw new Error("minDay must not exceed maxDay");
  const context = canonicalField(policy.context, "context");
  return { codes, minDay, maxDay, context };
}

function hashToBigInt(poseidon: Awaited<ReturnType<typeof buildPoseidon>>, values: bigint[]) {
  return BigInt(poseidon.F.toObject(poseidon(values)).toString());
}

export async function policyHash(policy: EligibilityPolicy): Promise<Field> {
  const { codes, minDay, maxDay } = validatePolicy(policy);
  const poseidon = await poseidonInstance();
  return hashToBigInt(poseidon, [POLICY_DOMAIN, ...codes, minDay, maxDay]).toString();
}

export async function contextNullifier(holderSecret: Field, context: Field): Promise<Field> {
  const poseidon = await poseidonInstance();
  return hashToBigInt(poseidon, [
    NULLIFIER_DOMAIN,
    canonicalField(holderSecret, "holderSecret"),
    canonicalField(context, "context"),
  ]).toString();
}

/** Generates an entirely synthetic credential. Never represents a MyNa export. */
export async function createSyntheticFixture(options: {
  policy?: EligibilityPolicy;
  drugCode?: Field;
  dispensingDay?: number;
  holderSecret?: Field;
  recordNonce?: Field;
} = {}): Promise<SyntheticFixture> {
  const policy: EligibilityPolicy = options.policy ?? {
    acceptedDrugCodes: ["100101001", "100101002", "100101003", "0"],
    minDay: 20500,
    maxDay: 21000,
    context: "2026092701",
  };
  validatePolicy(policy);
  const drugCode = canonicalField(options.drugCode ?? "100101001", "drugCode");
  if (drugCode > UINT32_MAX) throw new Error("drugCode must fit in 32 bits");
  const dispensingDay = canonicalDay(options.dispensingDay ?? 20700, "dispensingDay");
  const holderSecret = canonicalField(options.holderSecret ?? "9742813357642039", "holderSecret");
  const recordNonce = canonicalField(options.recordNonce ?? "870720261927", "recordNonce");
  const poseidon = await poseidonInstance();
  const eddsa = await eddsaInstance();
  const holderCommitment = hashToBigInt(poseidon, [RECORD_DOMAIN, holderSecret]);
  const message = poseidon([
    RECORD_DOMAIN,
    holderCommitment,
    drugCode,
    dispensingDay,
    recordNonce,
  ]);
  const signature = eddsa.signPoseidon(DEMO_ISSUER_KEY, message);
  const publicKey = eddsa.prv2pub(DEMO_ISSUER_KEY);
  const F = eddsa.babyJub.F;
  return {
    source: "synthetic-demo-issuer",
    policy,
    issuerPublicKey: {
      ax: F.toObject(publicKey[0]).toString(),
      ay: F.toObject(publicKey[1]).toString(),
    },
    record: {
      drugCode: drugCode.toString(),
      dispensingDay: Number(dispensingDay),
      recordNonce: recordNonce.toString(),
      signature: {
        r8x: F.toObject(signature.R8[0]).toString(),
        r8y: F.toObject(signature.R8[1]).toString(),
        s: signature.S.toString(),
      },
    },
    holderSecret: holderSecret.toString(),
  };
}

export async function proveEligibility(
  record: SignedRecord,
  policy: EligibilityPolicy,
  issuerPublicKey: IssuerPublicKey,
  holderSecret: Field,
  artifacts: ProvingArtifacts,
): Promise<ProofBundle> {
  const { codes, minDay, maxDay, context } = validatePolicy(policy);
  if (!artifacts.wasm || !artifacts.zkey) throw new Error("wasm and zkey are required");
  const witness = {
    issuerAx: canonicalField(issuerPublicKey.ax, "issuerAx").toString(),
    issuerAy: canonicalField(issuerPublicKey.ay, "issuerAy").toString(),
    acceptedDrugCodes: codes.map(String),
    minDay: minDay.toString(),
    maxDay: maxDay.toString(),
    context: context.toString(),
    policyHash: await policyHash(policy),
    nullifier: await contextNullifier(holderSecret, policy.context),
    holderSecret: canonicalField(holderSecret, "holderSecret").toString(),
    drugCode: canonicalField(record.drugCode, "drugCode").toString(),
    dispensingDay: canonicalDay(record.dispensingDay, "dispensingDay").toString(),
    recordNonce: canonicalField(record.recordNonce, "recordNonce").toString(),
    signatureR8x: canonicalField(record.signature.r8x, "signatureR8x").toString(),
    signatureR8y: canonicalField(record.signature.r8y, "signatureR8y").toString(),
    signatureS: canonicalField(record.signature.s, "signatureS").toString(),
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witness,
    artifacts.wasm,
    artifacts.zkey,
  );
  return { proof, publicSignals: publicSignals.map(String) };
}

/** Verifies the proof and pins every policy/issuer/context public signal. */
export async function verifyEligibility(
  bundle: ProofBundle,
  expectedPolicy: EligibilityPolicy,
  expectedIssuerPublicKey: IssuerPublicKey,
  verificationKey: Record<string, unknown>,
): Promise<boolean> {
  if (!bundle || !Array.isArray(bundle.publicSignals) || bundle.publicSignals.length !== PUBLIC_SIGNAL_COUNT) {
    return false;
  }
  try {
    const { codes, minDay, maxDay, context } = validatePolicy(expectedPolicy);
    const expected = [
      canonicalField(expectedIssuerPublicKey.ax, "issuerAx"),
      canonicalField(expectedIssuerPublicKey.ay, "issuerAy"),
      ...codes,
      minDay,
      maxDay,
      context,
      BigInt(await policyHash(expectedPolicy)),
    ];
    for (let i = 0; i < expected.length; i++) {
      if (canonicalField(bundle.publicSignals[i]!, PUBLIC_SIGNAL_NAMES[i]) !== expected[i]) return false;
    }
    canonicalField(bundle.publicSignals[10]!, "nullifier");
    return await snarkjs.groth16.verify(verificationKey, bundle.publicSignals, bundle.proof);
  } catch {
    return false;
  }
}

/** The generated verifier expects (a,b,c,input[11]) in this exact order. */
export async function toSolidityArgs(bundle: ProofBundle): Promise<[
  [string, string],
  [[string, string], [string, string]],
  [string, string],
  string[],
]> {
  const encoded = await snarkjs.groth16.exportSolidityCallData(bundle.proof, bundle.publicSignals);
  return JSON.parse(`[${encoded}]`);
}
