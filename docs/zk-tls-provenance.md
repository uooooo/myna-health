# ZK TLS source provenance for MynaHealth

Status: 2026-09-27. The blinded commitment circuit works with a synthetic witness. The TLS session is not yet linked to it. This is **not** a verified MyNaPortal patient claim.

## Why this layer exists

The Groth16 circuit proves that a private drug code and dispensing date satisfy a public policy **and** were signed by the configured issuer. The current issuer is synthetic. A user-downloaded XML file has no cryptographic provenance merely because it parses as YZK-IF-002. Without an authenticated source, a user can edit the XML and still submit it to a permissive issuer. This is the main trust boundary.

ZK TLS can establish that selected bytes were returned by a specific HTTPS origin while keeping cookies and unrelated response fields hidden. It does **not** automatically link the TLS claim to the private witness in our current Circom circuit, establish that the response belongs to the same person who holds a wallet, or prove that the website data is medically correct.

## Implemented

- `packages/mynaportal-adapter`: local XML parser for the Ministry of Health, Labour and Welfare YZK-IF-002 medication layout. It extracts `DrugC`, `DiDate`, `DrugN` and facility fields, validates date/code format, and marks every imported record `unverified-user-import`. The UI disables ZK proof issuance from imported XML.
- `packages/zk-tls-source`: Circom/SHA-256 Groth16 circuit proves that private nine-digit `DrugC` is in a public allowed set and that `SHA256(ASCII(DrugC) || 16-byte blinder)` equals a public commitment. A synthetic proof verified; modifying the hash invalidated it. The blinder is deterministic only in this test fixture.
- `packages/zk-tls-source`: Reclaim zkFetch probe against the **public** MHLW page listing YZK-IF-002. It pins HTTPS URL, method, and matching rule, then calls Reclaim proof verification. The first live run reached the attestor but failed `Params validation failed`; no origin proof was obtained.
- The official TLSNotary local fixture's notarize → redacted presentation → verification example was run successfully on 2026-09-27. This was a reference test outside this repository and did not use medical data.
- `packages/proof-kernel`: browser-generated Groth16 proof against an independently signed synthetic dispensing entry; proof verification runs on Node 24. The synthetic issuer never represents MyNaPortal.

## Intended claim bridge

1. The person logs into MyNaPortal on their own device. A TLSNotary plugin or Reclaim provider targets an exact medication response from `myna.go.jp` or a documented API endpoint, with request path, method, response fields and freshness pinned. Credentials remain secret.
2. A verifier checks the zkTLS proof and receives the **minimum** disclosed fields: an exact 9-digit `DrugC`, `DiDate`, a pseudonymous holder binding, and a source response identifier. The response identifier prevents replay. The attestor should see no name, insurer number, unrelated drugs, or full record.
3. A bridge service signs the canonical `(drugCode, dispensingDay, holderCommitment, sourceNonce)` as an issuer record. Our Groth16 circuit then proves policy eligibility while hiding the exact code and date from the final verifier. This bridge is a trusted issuer and sees the selected fields. It is not an end-to-end zero-knowledge composition.
4. Stronger construction under test: use TLSNotary's authenticated SHA-256 commitment to the exact `DrugC` transcript span. Its hash commitment uses a random 16-byte blinder appended to the transcript bytes. Our medication circuit follows this encoding and proves the private code matches the commitment and allowed set. The verifier must independently validate TLSNotary's signed transcript, origin, status, response context, commitment index and hash, and pass that exact hash to the Groth16 verifier. The full composition and MyNaPortal response parsing have not yet been implemented. A public code set also leaks membership in that set; it must contain enough codes for the intended privacy level.

## What is untested

- A real logged-in MyNaPortal response. We have not used anyone's My Number Card, cookies, medical records or API credentials.
- Whether the MyNaPortal web response can be intercepted and proved by Reclaim/TLSNotary. Its login flow and response format could make this impractical.
- A successful Reclaim origin probe. A developer app was configured locally, but the first attestor request was rejected with `Params validation failed`.
- Direct onchain verification of a TLS attestation. Current onchain gate only verifies Groth16 and ENS policy.

## Sources

- [Digital Agency medical insurance information API](https://developers.digital.go.jp/documents/mynaportal-api/specification/medicalexaminfo/) — reviewed September 2026; API access requires application, meeting, review and approval.
- [MHLW YZK-IF-002 XML layouts](https://www.mhlw.go.jp/stf/newpage_75649.html) and [layout PDF](https://www.mhlw.go.jp/content/12403550/001743062.pdf).
- [Reclaim zkFetch](https://github.com/reclaimprotocol/zk-fetch) and [verification SDK](https://github.com/reclaimprotocol/reclaim-js-sdk).
- [TLSNotary verification model](https://tlsnotary.org/docs/protocol/verification/) and [plugin system](https://tlsnotary.org/docs/extension/plugins/).
- [TLSNotary `HASH` handler example](https://github.com/tlsnotary/tlsn-extension/blob/main/packages/plugins/src/swissbank_hash.plugin.ts).
- [TLSNotary official ZK age proof example](https://github.com/tlsnotary/tlsn/tree/main/crates/examples-zk) — its Rust prover computes `SHA256(transcript field || blinder)` and the verifier checks the public hash against the TLS commitment.
