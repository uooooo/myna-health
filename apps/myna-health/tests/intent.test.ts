import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIntent, assertPending, normalizeNullifier } from '../src/intent.ts';
import { IntentStore } from '../src/store.ts';

const base = { title: 'Approve', actorEns: 'alice.eth', operation: 'example-action', payloadDigest: `0x${'ab'.repeat(32)}` };

test('binding changes when request parameters change', () => {
  const a = makeIntent(base, 1_000);
  const b = makeIntent({ ...base, operation: 'different-action' }, 1_000);
  assert.notEqual(a.action, b.action);
  assert.match(a.action, /^approve-[0-9a-f]{32}$/);
});

test('expiration blocks approval', () => {
  const intent = makeIntent(base, 1_000);
  assert.throws(() => assertPending(intent, 1_600), /expired/);
});

test('World nullifier encodings normalize to the same value', () => {
  assert.equal(normalizeNullifier('0x01'), normalizeNullifier('0x1'));
  assert.throws(() => normalizeNullifier('1'), /Invalid/);
});

test('an approval can be consumed only once, and rejection cannot execute', () => {
  const store = new IntentStore(':memory:');
  try {
    const a = store.create(makeIntent(base));
    store.resolve(a.id, 'approved', '1');
    assert.throws(() => store.resolve(a.id, 'approved', '1'), /not pending/);
    store.execute(a.id);
    assert.throws(() => store.execute(a.id), /verified approval/);
    const b = store.create(makeIntent(base));
    store.resolve(b.id, 'rejected');
    assert.throws(() => store.execute(b.id), /verified approval/);
  } finally { store.close(); }
});
