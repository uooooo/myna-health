import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256, toHex } from 'viem';
import { dnsName, resolverAbi, ROLE_SET_TEXT, textKeyResource, textSetterCalldata } from '../src/ens.ts';

test('ENSv2 delegation calldata scopes the text key', () => {
  const data = textSetterCalldata('care.status');
  const decoded = decodeFunctionData({ abi: resolverAbi, data });
  assert.equal(decoded.functionName, 'setText');
  assert.deepEqual(decoded.args, ['0x', 'care.status', '']);
  assert.equal(textKeyResource('care.status'), BigInt(keccak256(toHex('care.status'))));
  assert.equal(ROLE_SET_TEXT, 16n);
  assert.equal(dnsName('alice.eth'), toHex(new Uint8Array([5,97,108,105,99,101,3,101,116,104,0])));
});
