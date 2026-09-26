#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
NODE_BIN="${SNARKJS_NODE:-node}"
CLI="node_modules/snarkjs/build/cli.cjs"
if [[ -f artifacts/medication-commitment_final.zkey && -f artifacts/medication-commitment_verification_key.json ]]; then
  echo "Demo proving key already exists. Remove the final zkey and verification key to regenerate."
  exit 0
fi
"$NODE_BIN" "$CLI" powersoftau new bn128 15 artifacts/pot15_0000.ptau
"$NODE_BIN" "$CLI" powersoftau contribute artifacts/pot15_0000.ptau artifacts/pot15_0001.ptau --name="MynaHealth TLS commitment demo phase 1" -e="$(openssl rand -hex 32)"
"$NODE_BIN" "$CLI" powersoftau prepare phase2 artifacts/pot15_0001.ptau artifacts/pot15_final.ptau
"$NODE_BIN" "$CLI" groth16 setup artifacts/medication-commitment.r1cs artifacts/pot15_final.ptau artifacts/medication-commitment_0000.zkey
"$NODE_BIN" "$CLI" zkey contribute artifacts/medication-commitment_0000.zkey artifacts/medication-commitment_final.zkey --name="MynaHealth TLS commitment demo phase 2" -e="$(openssl rand -hex 32)"
"$NODE_BIN" "$CLI" zkey export verificationkey artifacts/medication-commitment_final.zkey artifacts/medication-commitment_verification_key.json
