import { randomUUID } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import { normalize } from 'viem/ens';

export type IntentStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';

export interface Intent {
  id: string;
  title: string;
  actorEns: string;
  operation: string;
  payloadDigest: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  action: string;
  status: IntentStatus;
  rpNonce?: string;
  nullifier?: string;
}

export function makeIntent(input: {
  title: string;
  actorEns: string;
  operation: string;
  payloadDigest: string;
  ttlSeconds?: number;
}, now = Math.floor(Date.now() / 1000)): Intent {
  const title = input.title.trim();
  const actorEnsInput = input.actorEns.trim();
  if (!actorEnsInput.includes('.')) throw new Error('A full ENS name is required');
  const actorEns = normalize(actorEnsInput);
  const operation = input.operation.trim();
  const payloadDigest = input.payloadDigest.trim().toLowerCase();
  if (!title || title.length > 120) throw new Error('Title must be 1–120 characters');
  if (!actorEns || actorEns.length > 253) throw new Error('ENS name is required');
  if (!operation || operation.length > 80) throw new Error('Operation must be 1–80 characters');
  if (!/^0x[0-9a-f]{64}$/.test(payloadDigest)) throw new Error('payloadDigest must be a 32-byte hex digest');
  const ttl = input.ttlSeconds ?? 600;
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) throw new Error('TTL must be 60–3600 seconds');

  const id = randomUUID();
  const expiresAt = now + ttl;
  // Action commits to the complete request. No clinical or personal data is placed in World or ENS.
  const binding = keccak256(toBytes(JSON.stringify({ id, actorEns, operation, payloadDigest, expiresAt })));
  return {
    id, title, actorEns, operation,
    payloadDigest: payloadDigest as `0x${string}`,
    createdAt: now, expiresAt,
    action: `approve-${binding.slice(2, 34)}`,
    status: 'pending',
  };
}

export function assertPending(intent: Intent, now = Math.floor(Date.now() / 1000)): void {
  if (intent.status !== 'pending') throw new Error(`Intent is ${intent.status}`);
  if (now >= intent.expiresAt) throw new Error('Intent has expired');
}

export function normalizeNullifier(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error('Invalid World nullifier');
  }
  return BigInt(value).toString(10);
}
