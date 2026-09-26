# MynaHealth app

A browser proof experience for Japanese dispensing-record eligibility. Current records and issuer keys are synthetic. No real MyNaPortal login or patient data is used.

## Run

Bun 1.4+ manages dependencies, builds, and tests. Node 24+ runs the API: snarkjs Groth16 verification stalls on Bun 1.4.2 in our environment.

```bash
cd apps/myna-health
bun install --frozen-lockfile
cp .env.example .env
bun run build
bun run test
bun run dev:api
```

Open http://localhost:8787. Configure `WORLD_APP_ID`, `WORLD_RP_ID`, and `WORLD_SIGNING_KEY` in the ignored `.env` to test IDKit staging. The signer key must stay server-side.

## Working paths

- Eligible and ineligible synthetic records; browser witness generation and Groth16 proof creation.
- Server-side Groth16 verification against public policy inputs. The app falls back to a labeled synthetic policy when ENSv2 deployment is unavailable.
- Local YZK-IF-002 XML parsing. Imported XML cannot issue a proof because its origin is not attested.
- World IDKit 4 Proof of Human request, RP signature, signal binding to the medical proof digest, server-side World verification, nullifier replay guard. End-to-end simulator approval still needs verification.
- `/api/proofs/:id/redeem` checks a World-approved intent and submits the proof to `MynaHealthGate` only when a live ENSv2 policy deployment is configured. The demo fallback cannot redeem onchain.
- ENSv2 text-role grant/revoke CLI for names you control. Sepolia write requires a funded key and actual ENSv2 name.

## Research and constraints

See [zk-tls-provenance.md](../../docs/zk-tls-provenance.md) for the source-attestation plan, implemented probe, and remaining trust boundaries. A public-origin zkTLS probe is not a medical record proof.

## Sources

- [ETHGlobal Tokyo prizes](https://ethglobal.com/events/tokyo2026/prizes)
- [World IDKit](https://docs.world.org/world-id/idkit/integrate)
- [ENSv2](https://docs.ens.domains/ensv2/overview/)
