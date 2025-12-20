// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IHasher
 * @notice Interface for MiMC hash function used in Merkle tree
 */
interface IHasher {
    /**
     * @notice Hash two 256-bit values using MiMC
     * @param left Left input
     * @param right Right input
     * @return result The hash result
     */
    function MiMCSponge(uint256 left, uint256 right) external view returns (uint256 result);
}

