pragma circom 2.2.2;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Demo-only issuer credential. A real MyNa export does not carry this signature.
template Eligibility() {
    signal input issuerAx;
    signal input issuerAy;
    signal input acceptedDrugCodes[4];
    signal input minDay;
    signal input maxDay;
    signal input context;
    signal input policyHash;
    signal input nullifier;

    signal input holderSecret;
    signal input drugCode;
    signal input dispensingDay;
    signal input recordNonce;
    signal input signatureR8x;
    signal input signatureR8y;
    signal input signatureS;

    // Unique numeric domain tags prevent accidental cross-protocol reuse.
    var RECORD_DOMAIN = 1314214866;
    var POLICY_DOMAIN = 1347374937;
    var NULLIFIER_DOMAIN = 1314214990;

    component holderHash = Poseidon(2);
    holderHash.inputs[0] <== RECORD_DOMAIN;
    holderHash.inputs[1] <== holderSecret;

    component recordHash = Poseidon(5);
    recordHash.inputs[0] <== RECORD_DOMAIN;
    recordHash.inputs[1] <== holderHash.out;
    recordHash.inputs[2] <== drugCode;
    recordHash.inputs[3] <== dispensingDay;
    recordHash.inputs[4] <== recordNonce;

    component issuerSignature = EdDSAPoseidonVerifier();
    issuerSignature.enabled <== 1;
    issuerSignature.Ax <== issuerAx;
    issuerSignature.Ay <== issuerAy;
    issuerSignature.R8x <== signatureR8x;
    issuerSignature.R8y <== signatureR8y;
    issuerSignature.S <== signatureS;
    issuerSignature.M <== recordHash.out;

    component policyCommitment = Poseidon(7);
    policyCommitment.inputs[0] <== POLICY_DOMAIN;
    for (var i = 0; i < 4; i++) {
        policyCommitment.inputs[i + 1] <== acceptedDrugCodes[i];
    }
    policyCommitment.inputs[5] <== minDay;
    policyCommitment.inputs[6] <== maxDay;
    policyHash === policyCommitment.out;

    component drugIsZero = IsZero();
    drugIsZero.in <== drugCode;
    drugIsZero.out === 0;

    component equalDrug[4];
    signal matches[5];
    matches[0] <== 0;
    for (var j = 0; j < 4; j++) {
        equalDrug[j] = IsEqual();
        equalDrug[j].in[0] <== drugCode;
        equalDrug[j].in[1] <== acceptedDrugCodes[j];
        matches[j + 1] <== matches[j] + equalDrug[j].out;
    }
    component noMatch = IsZero();
    noMatch.in <== matches[4];
    noMatch.out === 0;

    // Epoch days and policy endpoints are 32-bit integers, not field residues.
    component dayBits = Num2Bits(32);
    dayBits.in <== dispensingDay;
    component minBits = Num2Bits(32);
    minBits.in <== minDay;
    component maxBits = Num2Bits(32);
    maxBits.in <== maxDay;
    component lower = LessEqThan(32);
    lower.in[0] <== minDay;
    lower.in[1] <== dispensingDay;
    lower.out === 1;
    component upper = LessEqThan(32);
    upper.in[0] <== dispensingDay;
    upper.in[1] <== maxDay;
    upper.out === 1;

    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== NULLIFIER_DOMAIN;
    nullifierHash.inputs[1] <== holderSecret;
    nullifierHash.inputs[2] <== context;
    nullifier === nullifierHash.out;
}

component main {public [issuerAx, issuerAy, acceptedDrugCodes, minDay, maxDay, context, policyHash, nullifier]} = Eligibility();
