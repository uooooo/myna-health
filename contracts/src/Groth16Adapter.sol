// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMynaHealthVerifier} from "./MynaHealthGate.sol";
import {Groth16Verifier} from "./EligibilityVerifier.sol";

/// @notice Bridges the gate's stable byte-oriented verifier interface to snarkjs.
contract Groth16Adapter is IMynaHealthVerifier {
    Groth16Verifier public immutable verifier;

    constructor(address verifier_) {
        verifier = Groth16Verifier(verifier_);
    }

    function verify(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool) {
        if (proof.length != 256 || publicInputs.length != 11) return false;
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
            abi.decode(proof, (uint256[2], uint256[2][2], uint256[2]));
        uint256[11] memory fixedInputs;
        for (uint256 i; i < 11; ++i) fixedInputs[i] = publicInputs[i];
        return verifier.verifyProof(a, b, c, fixedInputs);
    }
}
