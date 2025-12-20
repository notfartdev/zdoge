// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title Hasher
 * @notice MiMC Sponge hash function implementation for ZK-friendly hashing
 * @dev This is a simplified MiMC implementation for development.
 *      For production, use the generated MiMC contract from circomlibjs.
 * 
 * MiMC is a ZK-friendly hash function that can be efficiently proven
 * inside a Groth16 circuit, unlike keccak256.
 */
contract Hasher {
    // BN254 curve field size
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    // Number of rounds for MiMC (220 rounds for 128-bit security)
    uint256 constant NUM_ROUNDS = 220;

    // Round constants (derived from sha256 of round index)
    // For production, these should be generated deterministically
    uint256[220] internal roundConstants;

    constructor() {
        // Generate round constants deterministically
        for (uint256 i = 0; i < NUM_ROUNDS; i++) {
            roundConstants[i] = uint256(keccak256(abi.encodePacked("dogenado_mimc", i))) % FIELD_SIZE;
        }
    }

    /**
     * @notice MiMC Sponge hash of two field elements
     * @param left First input
     * @param right Second input
     * @return result The hash output
     */
    function MiMCSponge(uint256 left, uint256 right) external view returns (uint256 result) {
        uint256 k = 0;
        uint256 t;
        uint256 currentState = left;

        // First absorption
        for (uint256 i = 0; i < NUM_ROUNDS; i++) {
            t = addmod(addmod(currentState, roundConstants[i], FIELD_SIZE), k, FIELD_SIZE);
            // x^5 is the S-box for MiMC (x^7 is also common)
            t = mulmod(t, t, FIELD_SIZE); // t^2
            t = mulmod(t, t, FIELD_SIZE); // t^4
            currentState = mulmod(t, addmod(addmod(currentState, roundConstants[i], FIELD_SIZE), k, FIELD_SIZE), FIELD_SIZE); // t^5
        }
        currentState = addmod(currentState, k, FIELD_SIZE);

        // XOR with right input for second absorption
        currentState = addmod(currentState, right, FIELD_SIZE);

        // Second permutation
        for (uint256 i = 0; i < NUM_ROUNDS; i++) {
            t = addmod(addmod(currentState, roundConstants[i], FIELD_SIZE), k, FIELD_SIZE);
            t = mulmod(t, t, FIELD_SIZE);
            t = mulmod(t, t, FIELD_SIZE);
            currentState = mulmod(t, addmod(addmod(currentState, roundConstants[i], FIELD_SIZE), k, FIELD_SIZE), FIELD_SIZE);
        }

        result = addmod(currentState, k, FIELD_SIZE);
    }

    /**
     * @notice Hash a single value (for nullifier hash)
     * @param input The input value
     * @return result The hash output
     */
    function hash(uint256 input) external view returns (uint256 result) {
        return this.MiMCSponge(input, input);
    }
}

