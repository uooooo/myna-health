# Medical transcript commitment experiment

The Circom circuit in `circuits/medication-commitment.circom` proves two statements about a private nine-digit medication code:

1. It equals one of four public allowed codes (a `0` entry pads a shorter list).
2. `SHA256(ASCII(code) || blinder[16])` equals the public 32-byte hash.

This is the hash layout used by the [TLSNotary ZK example](https://github.com/tlsnotary/tlsn/tree/main/crates/examples-zk). **The current proof is generated from synthetic inputs only.** A TLSNotary session must still authenticate the exact response span and bind its commitment to this public hash. Neither a downloaded XML file nor the public Reclaim probe proves a patient's record.

## Reproduce the circuit

With Bun, Circom 2.2.2, and Node 24+ installed:

```sh
bun install
circom circuits/medication-commitment.circom --r1cs --wasm --sym -o artifacts
bun run setup:commitment  # demo trusted setup; takes several minutes
node scripts/prove-commitment.ts
```

The final zkey, wasm and verification key are included so the last command works without rerunning setup. The script verifies the proof and confirms that changing the public hash invalidates it. The deterministic blinder and local two-contribution ceremony are test fixtures; they must not be used for production claims.

## Reclaim public-origin probe

`src/index.ts` separately attempts a zkFetch proof for the MHLW page that publishes the YZK-IF-002 XML layout. Supply `RECLAIM_APP_ID` and `RECLAIM_APP_SECRET` in an ignored `.env` and enable zkFetch for that developer application. The first live attempt reached the attestor but returned `Params validation failed`. The package dependency `@reclaimprotocol/tls@0.1.4` also ships JavaScript files with unresolved `.ts` imports, so the local attempt required patching its installed files. No Reclaim proof is claimed in this repository.

See [`docs/zk-tls-provenance.md`](../../docs/zk-tls-provenance.md) for the trust boundary and the remaining composition work.
