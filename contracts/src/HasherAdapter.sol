// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title HasherAdapter
 * @notice Adapts circomlibjs MiMCSponge to our IHasher interface
 * @dev circomlibjs MiMCSponge: MiMCSponge(xL, xR, k) returns (xL_out, xR_out)
 *      Our interface: MiMCSponge(left, right) returns (result)
 */
interface IMiMCSponge {
    function MiMCSponge(uint256 xL_in, uint256 xR_in, uint256 k) 
        external pure returns (uint256 xL, uint256 xR);
}

contract HasherAdapter {
    IMiMCSponge public immutable mimcSponge;
    
    constructor(address _mimcSponge) {
        mimcSponge = IMiMCSponge(_mimcSponge);
    }
    
    // BN254 field size
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    /**
     * @notice Hash two field elements using MiMC sponge
     * @dev Matches circomlibjs's multiHash([left, right])
     *      multiHash absorbs each element sequentially into the sponge state
     */
    function MiMCSponge(uint256 left, uint256 right) external view returns (uint256) {
        uint256 k = 0;
        
        // Absorb first element
        (uint256 xL, uint256 xR) = mimcSponge.MiMCSponge(left, 0, k);
        
        // Absorb second element (add to state with modular arithmetic)
        (xL, ) = mimcSponge.MiMCSponge(addmod(right, xL, FIELD_SIZE), xR, k);
        
        return xL;
    }
    
    /**
     * @notice Hash a single value (for nullifier hash)
     * @dev Optimized to avoid external call overhead by directly calling mimcSponge
     */
    function hash(uint256 input) external view returns (uint256) {
        uint256 k = 0;
        
        // Absorb first element
        (uint256 xL, uint256 xR) = mimcSponge.MiMCSponge(input, 0, k);
        
        // Absorb second element (add to state with modular arithmetic)
        (xL, ) = mimcSponge.MiMCSponge(addmod(input, xL, FIELD_SIZE), xR, k);
        
        return xL;
    }
}

