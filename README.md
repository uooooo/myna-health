# MynaHealth

**Prove the condition. Keep the record.**

MynaHealth turns a medical record into a **minimum-disclosure eligibility proof**. A service asks whether a treatment condition is met; the patient answers with a Groth16 proof while the medication, date, identity label, and issuer signature stay private. The proof is computed in the browser and checked by an independent server verifier.

The hack combines three lower-layer ideas: a signed-record eligibility circuit, an ENS-named policy and replay-protected Solidity gate, and a World ID action binding for one-person redemption. Japan's MyNaPortal medication-export format motivates a fourth piece: a private SHA-256 medication-code commitment circuit designed as the bridge to authenticated web data. The live demo uses synthetic records; the authenticated portal bridge is a next integration step.

**For judges and code-reading agents:** [Architecture, proof invariants, falsification paths, and code map](JUDGING.md).

## Working demo

1. Choose an eligible or ineligible synthetic case.
2. Generate the Groth16 proof in the browser. The exact drug code, dispensing date, patient label, and issuer signature remain private to the browser.
3. Verify the proof on the server against the displayed policy.
4. Open the World IDKit 4 Proof of Human flow. Its signal binds to the medical proof digest.
5. Inspect the ENS policy path and onchain gate, including replay protection in the Forge tests.

## Repository

- `apps/myna-health/`: application, API, World IDKit, ENS client.
- `packages/proof-kernel/`: Circom circuit, Groth16 artifacts, TypeScript SDK, synthetic issuer fixture.
- `packages/mynaportal-adapter/`: local YZK-IF-002 XML parser, synthetic XML, parser tests.
- `packages/zk-tls-source/`: medication-code commitment circuit, plus an experimental Reclaim public-origin probe.
- `contracts/`: ENS policy gate, Groth16 verifier adapter, replay protection, Forge tests.
- `docs/zk-tls-provenance.md`: source trust boundary and next integration path.

## Run

See [app instructions](apps/myna-health/README.md). Bun is the package manager and build/test runner; Node 24+ runs the API because of a snarkjs Bun runtime issue.

## Boundaries

- The medical proof is real Groth16. Its issuer and patient record are synthetic.
- The MyNaPortal XML parser is real but an imported file alone has no source authentication.
- The additional commitment circuit proves that a hidden nine-digit medication code is in a public set and hashes to a blinded SHA-256 commitment. This circuit is verified with a synthetic witness, but is **not yet connected to a TLSNotary session**.
- The Reclaim public-origin probe targets a public MHLW page, not a logged-in patient endpoint. The first live attestor attempt currently fails parameter validation.
- ENSv2 on Sepolia, live onchain redemption, and World simulator approval still require end-to-end verification. The public demo uses a temporary tunnel.
