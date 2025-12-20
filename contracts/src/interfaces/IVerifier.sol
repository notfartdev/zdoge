// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IVerifier
 * @notice Interface for Groth16 ZK proof verifier
 */
interface IVerifier {
    /**
     * @notice Verify a Groth16 proof
     * @param proof The proof data [a, b, c]
     * @param input Public inputs to the circuit
     * @return True if the proof is valid
     */
    function verifyProof(
        uint256[8] calldata proof,
        uint256[6] calldata input
    ) external view returns (bool);
}

