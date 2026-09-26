import { ReclaimClient } from '@reclaimprotocol/zk-fetch';
import { getHttpProviderClaimParamsFromProof, hashProofClaimParams, verifyProof,
  type Proof, type HttpProviderClaimParams } from '@reclaimprotocol/js-sdk';

/** A public origin probe. It validates the zkTLS plumbing, not a patient record. */
export const PUBLIC_ORIGIN_PROBE = {
  url: 'https://www.mhlw.go.jp/stf/newpage_75649.html',
  method: 'GET',
  responseMatches: [{ type: 'contains' as const, value: 'YZK-IF-002', invert: false, isOptional: false }],
  responseRedactions: [],
} satisfies HttpProviderClaimParams;

function expectedHashes(params: HttpProviderClaimParams): string[] {
  const value = hashProofClaimParams(params);
  return Array.isArray(value) ? value : [value];
}

/** Fails closed unless the HTTPS request, match rule and witness signatures verify. */
export async function verifyPublicOriginProbe(proof: Proof): Promise<boolean> {
  if (proof.claimData.provider !== 'http') return false;
  let params: HttpProviderClaimParams;
  try { params = getHttpProviderClaimParamsFromProof(proof); }
  catch { return false; }
  if (params.url !== PUBLIC_ORIGIN_PROBE.url || params.method !== 'GET') return false;
  const result = await verifyProof(proof, { hashes: expectedHashes(PUBLIC_ORIGIN_PROBE) });
  return result.isVerified;
}

/** Requires RECLAIM_APP_ID and RECLAIM_APP_SECRET from the developer portal. */
export async function provePublicOriginProbe(credentials: { appId: string; appSecret: string }): Promise<Proof> {
  if (!credentials.appId || !credentials.appSecret) throw new Error('Reclaim app credentials are required');
  const client = new ReclaimClient(credentials.appId, credentials.appSecret);
  const proof = await client.zkFetch(PUBLIC_ORIGIN_PROBE.url,
    { method: 'GET', headers: { accept: 'text/html' } },
    { responseMatches: PUBLIC_ORIGIN_PROBE.responseMatches, responseRedactions: [] });
  if (!proof) throw new Error('Reclaim did not return a zkTLS proof');
  return proof as Proof;
}
