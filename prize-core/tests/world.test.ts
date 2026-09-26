import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIntent } from '../src/intent.ts';
import { verifyWorldProof, type WorldConfig } from '../src/world.ts';

const config: WorldConfig = { appId: 'app_test', rpId: 'rp_test', signingKey: '00'.repeat(32), environment: 'staging' };
const intent = { ...makeIntent({ title: 'Approve', actorEns: 'alice.eth', operation: 'test', payloadDigest: `0x${'aa'.repeat(32)}` }), rpNonce: 'nonce-1' };
const proof = { protocol_version: '4.0', action: intent.action, nonce: 'nonce-1', environment: 'staging', responses: [{ identifier: 'proof_of_human', nullifier: '0x01' }] };

test('a verified proof is bound to action and nonce', async () => {
  let calls = 0;
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    calls++;
    assert.equal(JSON.parse(String(init.body)).environment, 'staging');
    return new Response(JSON.stringify({ environment: 'staging' }), { status: 200 });
  }) as typeof fetch;
  assert.equal(await verifyWorldProof(intent, proof, config, fakeFetch), '1');
  assert.equal(calls, 1);
  await assert.rejects(verifyWorldProof(intent, { ...proof, action: 'other' }, config, fakeFetch), /different request/);
  await assert.rejects(verifyWorldProof(intent, { ...proof, nonce: 'wrong' }, config, fakeFetch), /different request/);
  await assert.rejects(verifyWorldProof(intent, { ...proof, responses: [{ identifier: 'passport', nullifier: '0x01' }] }, config, fakeFetch), /Proof of Human/);
  assert.equal(calls, 1);
});

test('verifier failure and environment mismatch fail closed', async () => {
  const failFetch = (async () => new Response('{}', { status: 400 })) as typeof fetch;
  await assert.rejects(verifyWorldProof(intent, proof, config, failFetch), /verification failed/);
  const wrongEnvironmentFetch = (async () => new Response(JSON.stringify({ environment: 'production' }), { status: 200 })) as typeof fetch;
  await assert.rejects(verifyWorldProof(intent, proof, config, wrongEnvironmentFetch), /environment mismatch/);
});
