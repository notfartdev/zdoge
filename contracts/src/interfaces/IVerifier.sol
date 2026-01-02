// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVerifier
 * @notice Interface for Groth16 ZK proof verifier (snarkjs format)
 */
interface IVerifier {
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
    ) external view returns (bool);
}

/**
 * @title IVerifierLegacy
 * @notice Legacy interface for MixerPool contracts (fixed-size arrays)
 */
interface IVerifierLegacy {
    function verifyProof(
        uint256[8] calldata proof,
        uint256[6] calldata input
    ) external view returns (bool);
}

