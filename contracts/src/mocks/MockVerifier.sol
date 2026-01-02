// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IVerifier.sol";

/**
 * @title MockVerifier
 * @notice Mock verifier for testing - ALWAYS returns true
 * @dev DO NOT USE IN PRODUCTION! Only for development/testing.
 */
contract MockVerifier is IVerifier {
    function verifyProof(
        uint256[2] memory,
        uint256[2][2] memory,
        uint256[2] memory,
        uint256[] memory
    ) external pure override returns (bool) {
        return true;
    }
}

