// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./interfaces/IVerifier.sol";

/**
 * @title Groth16Verifier
 * @notice Adapter that wraps the snarkjs-generated verifier to match our interface
 * @dev The snarkjs verifier expects separate proof components, but our MixerPool
 *      passes a flattened uint256[8] array. This adapter unpacks and converts.
 */

// Import the generated verifier
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[6] calldata _pubSignals
    ) external view returns (bool);
}

contract VerifierAdapter is IVerifier {
    IGroth16Verifier public immutable groth16Verifier;

    constructor(address _groth16Verifier) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
    }

    /**
     * @notice Verify a Groth16 proof
     * @param proof Flattened proof [a.x, a.y, b.x[0], b.x[1], b.y[0], b.y[1], c.x, c.y]
     * @param input Public inputs [root, nullifierHash, recipient, relayer, fee, denomination]
     * @return True if the proof is valid
     */
    function verifyProof(
        uint256[8] calldata proof,
        uint256[6] calldata input
    ) external view override returns (bool) {
        // Unpack the flattened proof array
        // proof[0:2] = pA (G1 point)
        // proof[2:6] = pB (G2 point - note: nested array order is [x1, x0], [y1, y0])
        // proof[6:8] = pC (G1 point)
        
        uint[2] memory pA = [proof[0], proof[1]];
        
        // For BN254 G2 points, the order is [x1, x0], [y1, y0]
        // snarkjs expects: [[x0, x1], [y0, y1]]
        uint[2][2] memory pB = [
            [proof[2], proof[3]],
            [proof[4], proof[5]]
        ];
        
        uint[2] memory pC = [proof[6], proof[7]];

        // Convert input to uint[6]
        uint[6] memory pubSignals;
        for (uint i = 0; i < 6; i++) {
            pubSignals[i] = input[i];
        }

        return groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
    }
}

