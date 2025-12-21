// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IVerifier.sol";

/**
 * @title MixerPoolNative
 * @notice Privacy mixer pool for native DOGE (similar to Tornado Cash ETH pool)
 * @dev Uses Merkle tree + ZK proofs for anonymous transactions
 * 
 * How it works:
 * 1. User deposits exact denomination of native DOGE with a commitment
 * 2. Commitment is added to Merkle tree
 * 3. User can later withdraw to any address using ZK proof
 * 4. Proof verifies: user knows the secret, nullifier hasn't been used
 */
contract MixerPoolNative is MerkleTreeWithHistory, ReentrancyGuard {
    
    // ============ Immutable State ============
    
    IVerifier public immutable verifier;
    uint256 public immutable denomination;
    
    // ============ State Variables ============
    
    // Nullifier tracking
    mapping(bytes32 => bool) public nullifierHashes;
    
    // Commitment tracking
    mapping(bytes32 => bool) public commitments;
    
    // ============ Events ============
    
    event Deposit(
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        uint256 timestamp
    );
    
    event Withdrawal(
        address indexed recipient,
        bytes32 indexed nullifierHash,
        address indexed relayer,
        uint256 fee
    );
    
    // ============ Errors ============
    
    error InvalidDenomination();
    error CommitmentAlreadyUsed();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error TransferFailed();
    error InvalidFee();
    error InvalidMerkleRoot();
    
    // ============ Constructor ============
    
    /**
     * @notice Create a new native DOGE mixer pool
     * @param _verifier Address of the Groth16 verifier contract
     * @param _hasher Address of the MiMC hasher contract
     * @param _denomination Amount of native DOGE required for deposit (in wei)
     */
    constructor(
        address _verifier,
        address _hasher,
        uint256 _denomination
    ) MerkleTreeWithHistory(_hasher) {
        if (_denomination == 0) revert InvalidDenomination();
        
        verifier = IVerifier(_verifier);
        denomination = _denomination;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Deposit native DOGE into the mixer
     * @param commitment The Pedersen commitment for this deposit
     * @dev User must send exact denomination amount of native DOGE
     */
    function deposit(bytes32 commitment) external payable nonReentrant {
        if (msg.value != denomination) revert InvalidDenomination();
        if (commitments[commitment]) revert CommitmentAlreadyUsed();
        
        uint256 leafIndex = _insert(commitment);
        commitments[commitment] = true;
        
        emit Deposit(commitment, leafIndex, block.timestamp);
    }
    
    /**
     * @notice Withdraw native DOGE from the mixer
     * @param proof Groth16 proof data [a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]
     * @param root Merkle root the proof was generated against
     * @param nullifierHash Hash of the nullifier to prevent double-spending
     * @param recipient Address to receive the native DOGE
     * @param relayer Address of the relayer (or zero address)
     * @param fee Fee to pay the relayer (must be less than denomination)
     */
    function withdraw(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address payable recipient,
        address payable relayer,
        uint256 fee
    ) external nonReentrant {
        if (fee > denomination) revert InvalidFee();
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadyUsed();
        if (!isKnownRoot(root)) revert InvalidMerkleRoot();
        
        // Build public inputs for verifier
        uint256[6] memory publicInputs = [
            uint256(root),
            uint256(nullifierHash),
            uint256(uint160(address(recipient))),
            uint256(uint160(address(relayer))),
            fee,
            denomination
        ];
        
        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();
        
        // Mark nullifier as used
        nullifierHashes[nullifierHash] = true;
        
        // Send native DOGE to recipient
        uint256 amountToRecipient = denomination - fee;
        (bool success, ) = recipient.call{value: amountToRecipient}("");
        if (!success) revert TransferFailed();
        
        // Pay relayer fee if applicable
        if (fee > 0 && relayer != address(0)) {
            (bool feeSuccess, ) = relayer.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }
        
        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a nullifier has been used
     */
    function isSpent(bytes32 nullifierHash) public view returns (bool) {
        return nullifierHashes[nullifierHash];
    }
    
    /**
     * @notice Check if a commitment exists
     */
    function isDeposited(bytes32 commitment) public view returns (bool) {
        return commitments[commitment];
    }
    
    /**
     * @notice Get pool information
     */
    function getPoolInfo() external view returns (
        uint256 _denomination,
        uint256 _depositsCount,
        bytes32 _root
    ) {
        return (denomination, nextLeafIndex, getLatestRoot());
    }
    
    // ============ Receive Function ============
    
    /// @notice Reject direct DOGE transfers (must use deposit function)
    receive() external payable {
        revert("Use deposit() function");
    }
}
