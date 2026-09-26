pragma circom 2.2.2;

include "../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Bridge between a TLSNotary SHA256 commitment and a private medication-code predicate.
// Source authentication is external: a verifier MUST validate the TLSNotary
// transcript, origin, response status and commitment before trusting hashLimb.
template MedicationCommitment() {
    signal input hashLimb[8];
    signal input acceptedCode[4];
    signal input digits[9];
    signal input blinder[16];

    component sha = Sha256(200);
    signal codeAcc[10];
    codeAcc[0] <== 0;
    component firstDigitZero = IsZero();
    firstDigitZero.in <== digits[0];
    firstDigitZero.out === 0;
    component digitBits[9];
    component digitRange[9];
    component asciiBits[9];
    for (var i = 0; i < 9; i++) {
        digitBits[i] = Num2Bits(4);
        digitBits[i].in <== digits[i];
        digitRange[i] = LessThan(4);
        digitRange[i].in[0] <== digits[i];
        digitRange[i].in[1] <== 10;
        digitRange[i].out === 1;
        asciiBits[i] = Num2Bits(8);
        asciiBits[i].in <== digits[i] + 48;
        for (var k = 0; k < 8; k++) {
            sha.in[i * 8 + k] <== asciiBits[i].out[7 - k];
        }
        codeAcc[i + 1] <== codeAcc[i] * 10 + digits[i];
    }

    // TLSNotary's Hash commitment is SHA256(transcript bytes || 16-byte blinder).
    component blinderBits[16];
    for (var b = 0; b < 16; b++) {
        blinderBits[b] = Num2Bits(8);
        blinderBits[b].in <== blinder[b];
        for (var j = 0; j < 8; j++) {
            sha.in[72 + b * 8 + j] <== blinderBits[b].out[7 - j];
        }
    }

    component matchCode[4];
    signal matchAcc[5];
    matchAcc[0] <== 0;
    for (var c = 0; c < 4; c++) {
        matchCode[c] = IsEqual();
        matchCode[c].in[0] <== codeAcc[9];
        matchCode[c].in[1] <== acceptedCode[c];
        matchAcc[c + 1] <== matchAcc[c] + matchCode[c].out;
    }
    component noMatch = IsZero();
    noMatch.in <== matchAcc[4];
    noMatch.out === 0;

    for (var limb = 0; limb < 8; limb++) {
        var weight = 1;
        var lc = 0;
        for (var bit = 31; bit >= 0; bit--) {
            lc += sha.out[limb * 32 + bit] * weight;
            weight *= 2;
        }
        hashLimb[limb] === lc;
    }
}

component main {public [hashLimb, acceptedCode]} = MedicationCommitment();
