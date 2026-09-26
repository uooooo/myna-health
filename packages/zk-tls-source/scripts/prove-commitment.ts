import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as snarkjs from 'snarkjs';

const drugCode = '100101001'; // fictional 9-digit code
const blinder = Uint8Array.from({ length: 16 }, (_, i) => i + 1); // deterministic test fixture
const digest = createHash('sha256').update(drugCode, 'ascii').update(blinder).digest();
const hashLimb = Array.from({ length: 8 }, (_, i) => digest.readUInt32BE(i * 4).toString());
const acceptedCode = ['100101001', '100101002', '100101003', '0'];
const witness = {
  hashLimb, acceptedCode, digits: [...drugCode].map(Number), blinder: [...blinder],
};
const artifacts = new URL('../artifacts/', import.meta.url);
const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness,
  new URL('medication-commitment_js/medication-commitment.wasm', artifacts).pathname,
  new URL('medication-commitment_final.zkey', artifacts).pathname);
const verificationKey = JSON.parse(await readFile(new URL('medication-commitment_verification_key.json', artifacts), 'utf8'));
const valid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
const modifiedSignals = [...publicSignals];
modifiedSignals[0] = (BigInt(modifiedSignals[0]) + 1n).toString();
const alteredHashRejected = !(await snarkjs.groth16.verify(verificationKey, modifiedSignals, proof));
if (!valid || !alteredHashRejected) throw new Error('TLS commitment circuit verification failed');
console.log(JSON.stringify({ valid, alteredHashRejected,
  privateCodeWitness: true,
  publicHash: digest.toString('hex'),
  publicSignalCount: publicSignals.length }, null, 2));
process.exit(0); // snarkjs keeps worker threads alive after verification on Node.
