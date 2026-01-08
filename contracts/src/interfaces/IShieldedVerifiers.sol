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
 * @notice Interface for unshield circuit verifier (6 public signals)
 */
interface IUnshieldVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[6] calldata _pubSignals
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

