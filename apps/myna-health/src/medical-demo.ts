import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { keccak256, toBytes } from 'viem';
import { encodeAbiParameters, parseAbiParameters, type Hex } from 'viem';
import * as snarkjs from 'snarkjs';
import { createSyntheticFixture, policyHash, verifyEligibility, type ProofBundle, type SyntheticFixture } from '../../../packages/proof-kernel/src/index.ts';
import { assertPolicySignals, getPolicy, loadDeployment, submitProof } from './medical-policy.ts';

const fixturePath = fileURLToPath(new URL('../../../packages/proof-kernel/artifacts/synthetic-fixture.json', import.meta.url));
const vkPath = fileURLToPath(new URL('../../../packages/proof-kernel/artifacts/verification_key.json', import.meta.url));
export const DEMO_POLICY_NAME = 'care.mynahealth.eth';
type StoredProof = { id: string; bundle: ProofBundle; policyName: string; digest: string; status: 'submitted' | 'verified' };
const proofs = new Map<string, StoredProof>();

export async function fixture(): Promise<SyntheticFixture> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as SyntheticFixture;
}

export async function demoCases() {
  const base = await fixture();
  const wrong = await createSyntheticFixture({
    policy: base.policy, drugCode: '987654321', holderSecret: '9742813357642040', recordNonce: '870720261928',
  });
  return [
    { id: 'eligible', label: 'Eligible treatment', note: 'An issuer-signed dispensing entry satisfies the named policy.', ...base,
      record: { ...base.record, patient: '山田 花子', ageBand: '30代', medicine: '処方薬 A',
        medicineCode: base.record.drugCode, dispensedAt: new Date(base.record.dispensingDay * 86400000).toISOString().slice(0, 10),
        facility: '架空みなと薬局', recordId: base.record.recordNonce } },
    { id: 'ineligible', label: 'Wrong medication', note: 'The signature is valid, but the medicine does not match the policy.', ...wrong,
      record: { ...wrong.record, patient: '佐藤 次郎', ageBand: '40代', medicine: '処方薬 B',
        medicineCode: wrong.record.drugCode, dispensedAt: new Date(wrong.record.dispensingDay * 86400000).toISOString().slice(0, 10),
        facility: '架空みなと薬局', recordId: wrong.record.recordNonce } },
  ];
}

export async function resolvedPolicy(name: string) {
  if (name !== DEMO_POLICY_NAME) throw new Error('This demo supports care.mynahealth.eth only');
  try {
    const deployment = await loadDeployment();
    const result = await getPolicy(name, deployment);
    return { name, chain: deployment.chainId === 11155111 ? 'sepolia' : 'anvil',
      source: 'ENSv2', resolver: result.resolver, recordId: 'mynahealth.policy.v1',
      policy: { acceptedDrugCodes: result.policy.acceptedDrugCodes.map(String) as [string,string,string,string],
        minDay: result.policy.minDay, maxDay: result.policy.maxDay, context: String(result.policy.context) },
      issuerPublicKey: { ax: String(result.policy.issuerAx), ay: String(result.policy.issuerAy) } };
  } catch (error) {
    if (process.env.MYNA_NETWORK === 'sepolia') throw error;
    const sample = await fixture();
    return { name, chain: 'demo', source: 'synthetic policy fixture', resolver: null,
      recordId: 'mynahealth.policy.v1', policy: sample.policy, issuerPublicKey: sample.issuerPublicKey };
  }
}

export function getStoredProof(id: string) {
  const proof = proofs.get(id);
  if (!proof) throw new Error('Proof not found');
  return proof;
}

export function publicProof(stored: StoredProof) {
  return { id: stored.id, status: stored.status, proof: stored.bundle.proof,
    publicSignals: stored.bundle.publicSignals, digest: stored.digest,
    hiddenFields: ['patient name', 'medicine code', 'dispensing date', 'record nonce', 'signature'] };
}

export async function saveProof(input: { proof: Record<string, unknown>; publicSignals: string[]; policyName: string }) {
  if (!input?.proof || !Array.isArray(input.publicSignals)) throw new Error('Groth16 proof and public signals required');
  if (input.publicSignals.length !== 11) throw new Error('Expected 11 public signals');
  await resolvedPolicy(input.policyName);
  const bundle = { proof: input.proof, publicSignals: input.publicSignals.map(String) };
  const stored: StoredProof = { id: randomUUID(), bundle, policyName: input.policyName,
    digest: keccak256(toBytes(JSON.stringify(bundle))), status: 'submitted' };
  proofs.set(stored.id, stored);
  return publicProof(stored);
}

export async function verifyStoredProof(id: string) {
  const stored = getStoredProof(id);
  const named = await resolvedPolicy(stored.policyName);
  const vk = JSON.parse(await readFile(vkPath, 'utf8')) as Record<string, unknown>;
  let policyMatches = true;
  if (named.source === 'ENSv2') {
    const live = await getPolicy(stored.policyName);
    try { assertPolicySignals(live.policy, stored.bundle.publicSignals); }
    catch { policyMatches = false; }
  } else {
    policyMatches = String(stored.bundle.publicSignals[9]) === await policyHash(named.policy);
  }
  const valid = policyMatches && await verifyEligibility(stored.bundle, named.policy, named.issuerPublicKey, vk);
  if (valid) stored.status = 'verified';
  return { valid, reason: valid ? undefined : 'The proof does not satisfy the current named policy.',
    method: 'Groth16 / BN254',
    verifiedFacts: valid ? ['Issuer-signed dispensing record', 'Accepted treatment and date window', 'Unique holder context'] : [] };
}

export async function redeemStoredProof(id: string) {
  const stored = getStoredProof(id);
  if (stored.status !== 'verified') throw new Error('Verify medical proof first');
  const named = await resolvedPolicy(stored.policyName);
  if (named.source !== 'ENSv2') throw new Error('Live ENSv2 deployment is required for on-chain redemption');
  const [a, b, c] = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(stored.bundle.proof, stored.bundle.publicSignals)}]`) as [string[], string[][], string[]];
  const proof = encodeAbiParameters(parseAbiParameters('uint256[2], uint256[2][2], uint256[2]'), [
    a.map(BigInt) as [bigint, bigint], b.map(row => row.map(BigInt)) as [[bigint, bigint], [bigint, bigint]], c.map(BigInt) as [bigint, bigint],
  ]) as Hex;
  const result = await submitProof({ proof, publicSignals: stored.bundle.publicSignals, policyName: stored.policyName });
  return { status: 'redeemed' as const, txHash: result.hash, chain: named.chain, blockNumber: result.blockNumber };
}
