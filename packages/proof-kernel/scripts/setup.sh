#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p artifacts
circom circuits/eligibility.circom --r1cs --wasm --sym -o artifacts
SNARKJS_NODE="${SNARKJS_NODE:-node}"
SNARKJS_CLI="node_modules/snarkjs/build/cli.cjs"

# This local single-contributor ceremony is for a hackathon demo only.
"$SNARKJS_NODE" "$SNARKJS_CLI" powersoftau new bn128 14 artifacts/pot14_0000.ptau
"$SNARKJS_NODE" "$SNARKJS_CLI" powersoftau contribute artifacts/pot14_0000.ptau artifacts/pot14_0001.ptau --name="MynaHealth local demo phase 1" -e="$(openssl rand -hex 32)"
"$SNARKJS_NODE" "$SNARKJS_CLI" powersoftau prepare phase2 artifacts/pot14_0001.ptau artifacts/pot14_final.ptau
"$SNARKJS_NODE" "$SNARKJS_CLI" groth16 setup artifacts/eligibility.r1cs artifacts/pot14_final.ptau artifacts/eligibility_0000.zkey
"$SNARKJS_NODE" "$SNARKJS_CLI" zkey contribute artifacts/eligibility_0000.zkey artifacts/eligibility_final.zkey --name="MynaHealth local demo phase 2" -e="$(openssl rand -hex 32)"
"$SNARKJS_NODE" "$SNARKJS_CLI" zkey export verificationkey artifacts/eligibility_final.zkey artifacts/verification_key.json
"$SNARKJS_NODE" "$SNARKJS_CLI" zkey export solidityverifier artifacts/eligibility_final.zkey artifacts/EligibilityVerifier.sol

rm -f artifacts/pot14_0000.ptau artifacts/pot14_0001.ptau artifacts/pot14_final.ptau artifacts/eligibility_0000.zkey
