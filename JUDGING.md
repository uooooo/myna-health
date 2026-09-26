# MynaHealth — technical guide for judges

## The primitive

**A person should be able to prove a medical condition without distributing their medical record.** MynaHealth makes the relying party's question a public policy and the issuer-signed dispensing record a private witness. The output is a verifiable, narrow eligibility receipt. Japan's MyNaPortal export format provides a concrete data source target rather than a generic health-data story.

This is infrastructure for eligibility checks in care, benefits, and online health services. Onchain policy naming and one-time redemption matter because multiple independent institutions can verify the same rule without receiving or maintaining a copy of the patient's record.

## What is executable now

| Component | Invariant | Where to look |
| --- | --- | --- |
| Medical Groth16 circuit | A hidden issuer-signed drug code and dispensing date satisfy public policy inputs; private patient fields are not public signals | [`packages/proof-kernel/circuits/`](packages/proof-kernel/circuits/) and [`packages/proof-kernel/src/`](packages/proof-kernel/src/) |
| Browser + server proof flow | The browser creates the witness and proof; the server independently verifies before issuing a receipt | [`apps/myna-health/src/`](apps/myna-health/src/) |
| World action binding | RP-signed IDKit request binds a personhood proof to the medical proof digest; backend verification and nullifier checks protect redemption | [`apps/myna-health/src/world.ts`](apps/myna-health/src/world.ts), [`apps/myna-health/src/intent.ts`](apps/myna-health/src/intent.ts) |
| ENS policy gate | ENS-resolved policy fields are checked against public proof inputs; nullifiers cannot be spent twice | [`contracts/src/MynaHealthGate.sol`](contracts/src/MynaHealthGate.sol), [`contracts/test/MynaHealthGate.t.sol`](contracts/test/MynaHealthGate.t.sol) |
| MyNaPortal source adapter | Local YZK-IF-002 medication XML parsing without treating an imported file as an authenticated claim | [`packages/mynaportal-adapter/`](packages/mynaportal-adapter/) |
| Medication commitment circuit | A hidden nine-digit code is in an allowlist and matches `SHA256(code || 16-byte blinder)` | [`packages/zk-tls-source/circuits/`](packages/zk-tls-source/circuits/), [`packages/zk-tls-source/scripts/prove-commitment.ts`](packages/zk-tls-source/scripts/prove-commitment.ts) |

## Fast falsification

1. In the web demo, generate an eligible proof, then switch to an ineligible treatment. The invalid witness fails the cryptographic condition.
2. Run `bun test` in `apps/myna-health` to check World proof binding, expiration, replay, and ENS delegation calldata.
3. Run `forge test` in `contracts` to check policy mismatch and replay rejection.
4. In `packages/zk-tls-source`, run `node scripts/prove-commitment.ts` with Node 24+. It verifies a real Groth16 proof, rejects an altered public hash, and keeps the medication code in the private witness.

## Integration frontier

The working medical proof uses a **synthetic issuer and synthetic record**. The XML adapter reads a real export schema, but a downloaded XML file is not automatically authenticated. TLSNotary was independently exercised with its official local fixture; the private commitment circuit is compiled and verified separately. Binding a live authenticated MyNaPortal response to that circuit remains to be built. World IDKit and server verification are implemented, while simulator approval is not yet demonstrated end to end. ENSv2 testnet deployment is pending. These boundaries are explicit so the executable cryptography can be evaluated on its own merits.
