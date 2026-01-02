// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./interfaces/IVerifier.sol";

/**
 * @title Groth16Verifier
 * @notice Adapter that wraps the snarkjs-generated verifier to match our interface
 * @dev The snarkjs verifier expects separate proof components, but our MixerPool
 *      passes a flattened uint256[8] array. This adapter unpacks and converts.
 */

// Import the generated verifier (with dynamic array)
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[] calldata _pubSignals
    ) external view returns (bool);
}

contract VerifierAdapter is IVerifier {
    IGroth16Verifier public immutable groth16Verifier;

    constructor(address _groth16Verifier) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
    }

    /**
     * @notice Verify a Groth16 proof (snarkjs format)
     * @param _pA Proof point A
     * @param _pB Proof point B
     * @param _pC Proof point C
     * @param _pubSignals Public inputs to the circuit
     * @return True if the proof is valid
     */
    function verifyProof(
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[] memory _pubSignals
    ) external view override returns (bool) {
        // Convert memory to calldata-compatible format
        uint[2] memory pA = [_pA[0], _pA[1]];
        uint[2][2] memory pB = [
            [_pB[0][0], _pB[0][1]],
            [_pB[1][0], _pB[1][1]]
        ];
        uint[2] memory pC = [_pC[0], _pC[1]];

        return groth16Verifier.verifyProof(pA, pB, pC, _pubSignals);
    }
}

