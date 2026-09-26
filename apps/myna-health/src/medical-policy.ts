import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient, createWalletClient, decodeAbiParameters, encodeAbiParameters,
  encodeFunctionData, http, isAddress, parseAbi, parseAbiParameters,
  type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { namehash, normalize, packetToBytes } from 'viem/ens';

export const POLICY_KEY = 'mynahealth.policy.v1';
export const POLICY_SIGNAL_COUNT = 11;

export const policyParameters = parseAbiParameters(
  '(uint256 issuerAx, uint256 issuerAy, uint256[4] acceptedDrugCodes, uint32 minDay, uint32 maxDay, uint256 context, uint256 policyHash, uint64 receiptExpiry, address verifier, address consumer, uint64 epoch)'
);

export const ensv2PolicyAbi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes result, address resolver)',
  'function setData(bytes name, string key, bytes value)',
  'function grantSetterRoles(bytes setter, address account)',
  'function revokeRoles(uint256 resource, uint256 roleBitmap, address account)',
]);

export const gateAbi = parseAbi([
  'function accept(bytes ensName, bytes proof, uint256[] publicInputs)',
  'function spentNullifier(uint256 nullifier) view returns (bool)',
]);

export interface MedicalPolicy {
  issuerAx: bigint;
  issuerAy: bigint;
  acceptedDrugCodes: readonly [bigint, bigint, bigint, bigint];
  minDay: number;
  maxDay: number;
  context: bigint;
  policyHash: bigint;
  receiptExpiry: bigint;
  verifier: Address;
  consumer: Address;
  epoch: bigint;
}

export interface Deployment {
  chainId: number;
  rpcUrl: string;
  policyName: string;
  gate: Address;
  universalResolver: Address;
  resolver: Address;
  consumer: Address;
  verifier: Address;
  txHash?: Hex;
}

const deploymentPaths = {
  local: fileURLToPath(new URL('../../../contracts/deployments/local.json', import.meta.url)),
  sepolia: fileURLToPath(new URL('../../../contracts/deployments/sepolia.json', import.meta.url)),
};

function networkName(): 'local' | 'sepolia' {
  const value = process.env.MYNA_NETWORK ?? 'local';
  if (value !== 'local' && value !== 'sepolia') throw new Error('MYNA_NETWORK must be local or sepolia');
  return value;
}

export async function loadDeployment(network = networkName()): Promise<Deployment> {
  const data = JSON.parse(await readFile(deploymentPaths[network], 'utf8')) as Deployment;
  for (const key of ['gate', 'universalResolver', 'resolver', 'consumer', 'verifier'] as const) {
    if (!isAddress(data[key])) throw new Error(`Invalid deployment ${key}`);
  }
  if (network === 'sepolia' && data.chainId !== 11155111) throw new Error('Wrong Sepolia chain ID');
  if (network === 'local' && data.chainId !== 31337) throw new Error('Wrong local chain ID');
  return data;
}

function transportUrl(deployment: Deployment) {
  if (deployment.chainId === 11155111) return process.env.SEPOLIA_RPC_URL || deployment.rpcUrl;
  return process.env.LOCAL_RPC_URL || deployment.rpcUrl;
}

function policyNameBytes(name: string): Hex {
  return `0x${Buffer.from(packetToBytes(normalize(name))).toString('hex')}` as Hex;
}

export function encodePolicy(policy: MedicalPolicy): Hex {
  return encodeAbiParameters(policyParameters, [policy]);
}

export function decodePolicy(value: Hex): MedicalPolicy {
  const [policy] = decodeAbiParameters(policyParameters, value);
  return policy as MedicalPolicy;
}

export function policyPublicInputs(policy: MedicalPolicy, nullifier: bigint): bigint[] {
  return [
    policy.issuerAx, policy.issuerAy, ...policy.acceptedDrugCodes,
    BigInt(policy.minDay), BigInt(policy.maxDay), policy.context,
    policy.policyHash, nullifier,
  ];
}

export function assertPolicySignals(policy: MedicalPolicy, publicSignals: readonly (bigint | string | number)[]) {
  if (publicSignals.length !== POLICY_SIGNAL_COUNT) throw new Error('Expected exactly 11 public signals');
  const actual = publicSignals.map((value) => BigInt(value));
  const expected = policyPublicInputs(policy, actual[10]!);
  for (let i = 0; i < 10; i++) {
    if (actual[i] !== expected[i]) throw new Error(`Public signal ${i} does not match ENS policy`);
  }
  if (actual[10] === 0n) throw new Error('Nullifier must be nonzero');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const today = Math.floor(nowSeconds / 86400);
  if (today < policy.minDay || today > policy.maxDay || BigInt(nowSeconds) > policy.receiptExpiry) {
    throw new Error('ENS policy is outside its validity window');
  }
  return actual;
}

export async function getPolicy(name: string, deploymentInput?: Deployment) {
  const deployment = deploymentInput ?? await loadDeployment();
  const client = createPublicClient({ chain: deployment.chainId === 11155111 ? sepolia : undefined, transport: http(transportUrl(deployment)) });
  const dnsName = policyNameBytes(name);
  // The read profile has node bytes32(0). ENSv2 derives the actual node from
  // the DNS-encoded name and returns the ENSIP-24 byte-valued record.
  const dataProfile = encodeFunctionData({
    abi: parseAbi(['function data(bytes32 node, string key) view returns (bytes)']),
    functionName: 'data', args: [namehash(normalize(name)), POLICY_KEY],
  });
  const [answer, resolver] = await client.readContract({
    address: deployment.universalResolver,
    abi: ensv2PolicyAbi,
    functionName: 'resolve',
    args: [dnsName, dataProfile],
  });
  const [encodedPolicy] = decodeAbiParameters(parseAbiParameters('bytes'), answer);
  if (encodedPolicy === '0x') throw new Error(`ENS name ${name} has no ${POLICY_KEY} record`);
  return { name: normalize(name), dnsName, resolver, policy: decodePolicy(encodedPolicy) };
}

export async function submitProof(input: {
  proof: Hex;
  publicSignals: readonly (bigint | string | number)[];
  policyName: string;
}, deploymentInput?: Deployment) {
  const deployment = deploymentInput ?? await loadDeployment();
  const privateKey = process.env.MYNA_CONSUMER_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('MYNA_CONSUMER_PRIVATE_KEY is required');
  const account = privateKeyToAccount(privateKey as Hex);
  const resolved = await getPolicy(input.policyName, deployment);
  if (account.address.toLowerCase() !== resolved.policy.consumer.toLowerCase()) {
    throw new Error('Consumer wallet does not match ENS policy');
  }
  const signals = assertPolicySignals(resolved.policy, input.publicSignals);
  const chain = deployment.chainId === 11155111 ? sepolia : {
    id: 31337, name: 'Anvil', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [transportUrl(deployment)] } },
  } as const;
  const client = createPublicClient({ chain, transport: http(transportUrl(deployment)) });
  const wallet = createWalletClient({ chain, account, transport: http(transportUrl(deployment)) });
  const { request } = await client.simulateContract({
    address: deployment.gate, abi: gateAbi, account,
    functionName: 'accept', args: [resolved.dnsName, input.proof, signals],
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Proof transaction reverted: ${hash}`);
  return { hash, blockNumber: receipt.blockNumber.toString(), status: receipt.status };
}
