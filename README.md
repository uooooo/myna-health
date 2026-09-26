# MynaHealth

**Prove the condition. Keep the record.**

MynaHealth is an ETHGlobal Tokyo 2026 prototype for privacy-preserving eligibility claims from Japanese medical data. The working proof flow uses an issuer-signed **synthetic** dispensing record: the browser proves a hidden drug code and date satisfy a named policy, and the server checks the Groth16 proof. The source-provenance layer is being explored with ZK TLS; imported MyNaPortal-format XML is never treated as an authenticated claim.

## Working demo

1. Choose an eligible or ineligible synthetic case.
2. Generate the Groth16 proof in the browser. The exact drug code, dispensing date, patient label, and issuer signature remain private to the browser.
3. Verify the proof on the server against the displayed policy.
4. Open the World IDKit 4 Proof of Human flow. Its signal binds to the medical proof digest.
5. Where a real ENSv2 deployment exists, a verified World intent may redeem the proof through the onchain gate. The local synthetic fallback cannot redeem.

## Repository

- `apps/myna-health/`: application, API, World IDKit, ENS client.
- `packages/proof-kernel/`: Circom circuit, Groth16 artifacts, TypeScript SDK, synthetic issuer fixture.
- `packages/mynaportal-adapter/`: local YZK-IF-002 XML parser, synthetic XML, parser tests.
- `packages/zk-tls-source/`: Reclaim public-origin zkTLS probe (requires developer credentials).
- `contracts/`: ENS policy gate, Groth16 verifier adapter, replay protection, Forge tests.
- `docs/zk-tls-provenance.md`: source trust boundary and next integration path.

## Run

See [app instructions](apps/myna-health/README.md). Bun is the package manager and build/test runner; Node 24+ runs the API because of a snarkjs Bun runtime issue.

## Boundaries

- The medical proof is real Groth16. Its issuer and patient record are synthetic.
- The MyNaPortal XML parser is real but an imported file alone has no source authentication.
- The ZK TLS probe targets a public MHLW page, not a logged-in patient endpoint.
- ENSv2 on Sepolia, live onchain redemption, World simulator approval, and a public demo URL still require end-to-end verification. The GitHub repository remains private until the owner chooses to publish it.
