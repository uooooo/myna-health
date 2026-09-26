# MynaProof

**Prove the condition. Keep the record.**

MynaProof turns a private medical record into a verifiable answer. A browser generates a zero-knowledge proof that an issuer-signed dispensing record satisfies a policy, without sending the medication, date, or patient secret to the verifier.

Built for ETHGlobal Tokyo 2026 with Bun, Circom/Groth16, ENSv2, and World ID.

## The demo

1. Load a signed sample medical record.
2. Resolve an eligibility policy through ENSv2.
3. Generate a proof in the browser.
4. Verify the proof and consume its policy-scoped nullifier onchain.
5. Try an ineligible record or reuse a proof to see the gate reject it.

The sample issuer and records support a reproducible demonstration. The proof generation and verification are cryptographic; a MyNaPortal source adapter is a separate integration.

## Packages

- `prize-core/` — web experience, proof API, World ID integration, and ENS client.
- `proof-kernel/` — ZK circuit, browser artifacts, signed fixtures, and proof SDK.
- `contracts/` — ENS policy resolution, Groth16 verification, and nullifier consumption.

Implementation and demo instructions are being added alongside the running code.

