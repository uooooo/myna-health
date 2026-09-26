import {
  createPublicClient, createWalletClient, encodeFunctionData, http, isAddress,
  keccak256, parseAbi, toHex,
  type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { namehash, normalize, packetToBytes } from 'viem/ens';

export const resolverAbi = parseAbi([
  'function getRecordId(bytes32 node) view returns (uint256)',
  'function grantSetterRoles(bytes setter, address account)',
  'function revokeRoles(uint256 resource, uint256 roleBitmap, address account)',
  'function setText(bytes name, string key, string value)',
]);

export const ROLE_SET_TEXT = 1n << 4n;

export function ensClient(rpcUrl = process.env.SEPOLIA_RPC_URL) {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl || undefined) });
}

export async function inspectEns(nameInput: string, key = 'description') {
  const name = normalize(nameInput);
  const client = ensClient();
  const [resolver, address, text] = await Promise.all([
    client.getEnsResolver({ name }),
    client.getEnsAddress({ name }),
    client.getEnsText({ name, key }),
  ]);
  let recordId: string | null = null;
  if (resolver) {
    try {
      recordId = (await client.readContract({
        address: resolver,
        abi: resolverAbi,
        functionName: 'getRecordId',
        args: [namehash(name)],
      })).toString();
    } catch { /* Legacy or non-Permissioned Resolver. */ }
  }
  return { chain: 'sepolia', name, resolver, address, key, text, recordId };
}

export function textSetterCalldata(key: string): Hex {
  if (!key || key.length > 80) throw new Error('Text key must be 1–80 characters');
  return encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: ['0x', key, ''] });
}

export function textKeyResource(key: string): bigint {
  if (!key || key.length > 80) throw new Error('Text key must be 1–80 characters');
  return BigInt(keccak256(toHex(key)));
}

export async function changeTextRole(input: {
  name: string; key: string; delegate: string; mode: 'grant' | 'revoke'; privateKey: Hex;
}) {
  if (!isAddress(input.delegate)) throw new Error('delegate must be an Ethereum address');
  const name = normalize(input.name);
  const client = ensClient();
  // Always resolve the current resolver; ENSv2 can move records to another instance.
  const resolver = await client.getEnsResolver({ name });
  if (!resolver) throw new Error('Name has no resolver');
  await client.readContract({ address: resolver, abi: resolverAbi, functionName: 'getRecordId', args: [namehash(name)] });
  const account = privateKeyToAccount(input.privateKey);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || undefined) });
  const delegate = input.delegate as Address;
  const hash = input.mode === 'grant'
    ? await wallet.writeContract((await client.simulateContract({
        address: resolver, abi: resolverAbi, account,
        functionName: 'grantSetterRoles', args: [textSetterCalldata(input.key), delegate],
      })).request)
    : await wallet.writeContract((await client.simulateContract({
        address: resolver, abi: resolverAbi, account,
        functionName: 'revokeRoles', args: [textKeyResource(input.key), ROLE_SET_TEXT, delegate],
      })).request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
  return { name, resolver, key: input.key, delegate, mode: input.mode, hash, blockNumber: receipt.blockNumber.toString() };
}

export function dnsName(name: string): Hex {
  return toHex(packetToBytes(normalize(name)));
}
