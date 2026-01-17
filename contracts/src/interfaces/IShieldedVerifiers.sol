// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IShieldVerifier
 * @notice Interface for shield circuit verifier (2 public signals)
 */
interface IShieldVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title ITransferVerifier
 * @notice Interface for transfer circuit verifier (6 public signals)
 */
interface ITransferVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[6] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title IUnshieldVerifier
 * @notice Interface for unshield circuit verifier (7 public signals for V3 with change support)
 * @dev V3: Added changeCommitment to support partial unshield
 * Public signals: [root, nullifierHash, recipient, amount, changeCommitment, relayer, fee]
 */
interface IUnshieldVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[7] calldata _pubSignals  // V3: Changed from 6 to 7
    ) external view returns (bool);
}

/**
 * @title ISwapVerifier
 * @notice Interface for swap circuit verifier (7 public signals)
 */
interface ISwapVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[8] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title ITransferMultiVerifier
 * @notice Interface for multi-input transfer circuit verifier (25 public signals)
 * @dev Public inputs: roots[10], nullifierHashes[10], outputCommitment1, outputCommitment2, relayer, fee, numInputs
 */
interface ITransferMultiVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[25] calldata _pubSignals
    ) external view returns (bool);
}
