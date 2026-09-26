import { signRequest } from '@worldcoin/idkit-core/signing';
import type { Intent } from './intent.ts';
import { assertPending, normalizeNullifier } from './intent.ts';

export interface WorldConfig {
  appId: string;
  rpId: string;
  signingKey: string;
  environment: 'staging' | 'production';
}

export function worldConfigFromEnv(): WorldConfig | null {
  const { WORLD_APP_ID: appId, WORLD_RP_ID: rpId, WORLD_SIGNING_KEY: signingKey } = process.env;
  if (!appId || !rpId || !signingKey) return null;
  const environment = process.env.WORLD_ENVIRONMENT === 'production' ? 'production' : 'staging';
  return { appId, rpId, signingKey, environment };
}

export function issueRpSignature(intent: Intent, config: WorldConfig) {
  assertPending(intent);
  const signed = signRequest({ signingKeyHex: config.signingKey, action: intent.action });
  return {
    app_id: config.appId,
    action: intent.action,
    environment: config.environment,
    rp_context: {
      rp_id: config.rpId,
      nonce: signed.nonce,
      created_at: signed.createdAt,
      expires_at: signed.expiresAt,
      signature: signed.sig,
    },
  };
}

export interface WorldProof {
  protocol_version?: unknown;
  action?: unknown;
  nonce?: unknown;
  environment?: unknown;
  responses?: unknown;
  [key: string]: unknown;
}

export async function verifyWorldProof(
  intent: Intent,
  proof: WorldProof,
  config: WorldConfig,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  assertPending(intent);
  if (!intent.rpNonce) throw new Error('World request has not been issued');
  if (proof.action !== intent.action || proof.nonce !== intent.rpNonce) throw new Error('World proof is for a different request');
  if (proof.environment !== config.environment) throw new Error('World environment mismatch');
  if (proof.protocol_version !== '4.0') throw new Error('World ID 4.0 proof is required');
  const responses = proof.responses;
  if (!Array.isArray(responses) || responses.length !== 1) throw new Error('Expected one World response');
  if ((responses[0] as { identifier?: unknown }).identifier !== 'proof_of_human') {
    throw new Error('Proof of Human credential is required');
  }
  const nullifier = normalizeNullifier((responses[0] as { nullifier?: unknown }).nullifier);

  const response = await fetcher(`https://developer.world.org/api/v4/verify/${encodeURIComponent(config.rpId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...proof, environment: config.environment }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`World verification failed (${response.status})`);
  const verified = await response.json() as { environment?: string };
  if (verified.environment !== config.environment) throw new Error('Verifier environment mismatch');
  return nullifier;
}
