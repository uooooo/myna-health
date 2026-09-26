import { provePublicOriginProbe, verifyPublicOriginProbe } from '../src/index.ts';

const appId = process.env.RECLAIM_APP_ID ?? '';
const appSecret = process.env.RECLAIM_APP_SECRET ?? '';
if (!appId || !appSecret) {
  console.error('Set RECLAIM_APP_ID and RECLAIM_APP_SECRET in your environment. No request was sent.');
  process.exit(2);
}
const proof = await provePublicOriginProbe({ appId, appSecret });
const valid = await verifyPublicOriginProbe(proof);
if (!valid) throw new Error('zkTLS proof verification failed');
console.log(JSON.stringify({ valid, origin: 'www.mhlw.go.jp', claim: 'YZK-IF-002 appears on the official XML layout page',
  proofIdentifier: proof.identifier, proofBytes: JSON.stringify(proof).length }, null, 2));
