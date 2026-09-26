# MynaHealth proof kernel

Use Bun for dependency installation, scripts, and tests. Run Groth16 proof generation and verification with Node 24+ because snarkjs hangs under Bun 1.4.2 in this project. The browser prover runs under Vite.

The issuer and record fixture are synthetic. Never describe the fixture as a MyNaPortal-issued credential. The XML adapter is in `../mynaportal-adapter`; an imported XML file alone is not authenticated.

The circuit has 11 public signals in a fixed order. Keep the circuit, TypeScript SDK, generated verification key, Solidity verifier, and gate ABI aligned. If the circuit changes, rerun the local ceremony with `scripts/setup.sh` and regenerate browser artifacts. The current ceremony is demo-only and not production trusted setup.
