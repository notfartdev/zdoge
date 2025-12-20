// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./interfaces/IHasher.sol";

/**
 * @title MerkleTreeWithHistory
 * @notice Merkle tree implementation with root history for privacy pool
 * @dev Stores last ROOT_HISTORY_SIZE roots for delayed withdrawal validation
 */
contract MerkleTreeWithHistory {
    // Merkle tree depth (2^20 = ~1M leaves)
    uint256 public constant TREE_DEPTH = 20;
    
    // Number of historical roots to keep
    uint256 public constant ROOT_HISTORY_SIZE = 30;

    // Hasher contract for MiMC
    IHasher public immutable hasher;

    // Current number of leaves inserted
    uint256 public nextLeafIndex;

    // Merkle tree levels storage
    mapping(uint256 => bytes32) public filledSubtrees;
    
    // Historical roots circular buffer
    bytes32[ROOT_HISTORY_SIZE] public roots;
    uint256 public currentRootIndex;

    // Zero values for each level (precomputed)
    bytes32[TREE_DEPTH] public zeros;

    event LeafInserted(bytes32 indexed leaf, uint256 indexed leafIndex, bytes32 newRoot);

    error MerkleTreeFull();
    error InvalidRoot();

    constructor(address _hasher) {
        hasher = IHasher(_hasher);
        
        // Initialize zero values for empty tree
        // zeros[0] = keccak256("dogenado") as starting point
        bytes32 currentZero = bytes32(uint256(keccak256("dogenado")) % FIELD_SIZE);
        zeros[0] = currentZero;
        filledSubtrees[0] = currentZero;

        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            currentZero = _hashLeftRight(currentZero, currentZero);
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
        }

        // Set initial root
        roots[0] = _hashLeftRight(currentZero, currentZero);
    }

    // Field size for BN254 curve
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /**
     * @notice Insert a new leaf into the Merkle tree
     * @param leaf The commitment to insert
     * @return leafIndex The index of the inserted leaf
     */
    function _insert(bytes32 leaf) internal returns (uint256 leafIndex) {
        uint256 _nextLeafIndex = nextLeafIndex;
        
        if (_nextLeafIndex >= 2 ** TREE_DEPTH) {
            revert MerkleTreeFull();
        }

        uint256 currentIndex = _nextLeafIndex;
        bytes32 currentLevelHash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = _hashLeftRight(left, right);
            currentIndex /= 2;
        }

        // Update root history
        uint256 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[newRootIndex] = currentLevelHash;
        currentRootIndex = newRootIndex;

        nextLeafIndex = _nextLeafIndex + 1;
        leafIndex = _nextLeafIndex;

        emit LeafInserted(leaf, leafIndex, currentLevelHash);
    }

    /**
     * @notice Hash two values using MiMC
     * @param left Left input
     * @param right Right input
     * @return Hash result
     */
    function _hashLeftRight(bytes32 left, bytes32 right) internal view returns (bytes32) {
        return bytes32(hasher.MiMCSponge(uint256(left), uint256(right)));
    }

    /**
     * @notice Check if a root is known (current or historical)
     * @param root The root to check
     * @return True if root is known
     */
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) {
            return false;
        }

        uint256 i = currentRootIndex;
        do {
            if (root == roots[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE - 1;
            } else {
                i--;
            }
        } while (i != currentRootIndex);

        return false;
    }

    /**
     * @notice Get the latest Merkle root
     * @return The current root
     */
    function getLatestRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
}

