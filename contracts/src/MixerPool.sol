// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IVerifier.sol";

/**
 * @title MixerPool
 * @notice Privacy pool for fixed-denomination ERC20 token mixing
 * @dev Tornado Cash-style mixer for DogeOS with ZK proof verification
 * 
 * Users deposit a fixed amount of tokens and receive a secret note.
 * Later, they can withdraw to any address using a ZK proof without
 * revealing the link between deposit and withdrawal.
 */
contract MixerPool is MerkleTreeWithHistory, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The ERC20 token this pool accepts
    IERC20 public immutable token;

    /// @notice The ZK proof verifier contract
    IVerifierLegacy public immutable verifier;

    /// @notice Fixed denomination for this pool (e.g., 100 USDC = 100 * 10^6)
    uint256 public immutable denomination;

    /// @notice Mapping of spent nullifier hashes to prevent double-spending
    mapping(bytes32 => bool) public nullifierHashes;

    /// @notice Mapping of commitments to check for duplicates
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
    error CommitmentAlreadyExists();
    error InvalidMerkleRoot();
    error NullifierAlreadySpent();
    error InvalidProof();
    error InvalidFee();
    error TransferFailed();

    // ============ Constructor ============

    /**
     * @notice Create a new MixerPool
     * @param _verifier Address of the Groth16 verifier contract
     * @param _hasher Address of the MiMC hasher contract
     * @param _token Address of the ERC20 token
     * @param _denomination Fixed deposit amount (in token's smallest unit)
     */
    constructor(
        address _verifier,
        address _hasher,
        address _token,
        uint256 _denomination
    ) MerkleTreeWithHistory(_hasher) {
        if (_denomination == 0) revert InvalidDenomination();
        
        verifier = IVerifierLegacy(_verifier);
        token = IERC20(_token);
        denomination = _denomination;
    }

    // ============ External Functions ============

    /**
     * @notice Deposit tokens into the mixer
     * @param commitment The Pedersen commitment (hash of secret and nullifier)
     * @dev User must approve this contract to spend `denomination` tokens first
     * 
     * The commitment is computed client-side as:
     *   commitment = MiMC(secret, nullifier)
     * 
     * The user must save their secret note containing:
     *   - secret (random 31 bytes)
     *   - nullifier (random 31 bytes)
     */
    function deposit(bytes32 commitment) external nonReentrant {
        if (commitments[commitment]) revert CommitmentAlreadyExists();

        // Insert commitment into Merkle tree
        uint256 leafIndex = _insert(commitment);
        commitments[commitment] = true;

        // Transfer tokens from user to this contract
        token.safeTransferFrom(msg.sender, address(this), denomination);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    /**
     * @notice Withdraw tokens from the mixer using a ZK proof
     * @param proof Groth16 proof data [a.x, a.y, b.x[0], b.x[1], b.y[0], b.y[1], c.x, c.y]
     * @param root Merkle root the proof was generated against
     * @param nullifierHash Hash of the nullifier to prevent double-spending
     * @param recipient Address to receive the tokens
     * @param relayer Address of the relayer (or zero address for self-relay)
     * @param fee Fee to pay the relayer (deducted from denomination)
     * 
     * @dev The ZK proof proves:
     *   1. The user knows a (secret, nullifier) pair such that:
     *      commitment = MiMC(secret, nullifier) exists in the Merkle tree
     *   2. The nullifierHash = MiMC(nullifier, nullifier) matches
     *   3. The recipient and relayer are correctly bound to the proof
     */
    function withdraw(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee
    ) external nonReentrant {
        // Validate inputs
        if (fee > denomination) revert InvalidFee();
        if (!isKnownRoot(root)) revert InvalidMerkleRoot();
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadySpent();

        // Verify ZK proof
        // Public inputs: [root, nullifierHash, recipient, relayer, fee, denomination]
        uint256[6] memory publicInputs = [
            uint256(root),
            uint256(nullifierHash),
            uint256(uint160(recipient)),
            uint256(uint160(relayer)),
            fee,
            denomination
        ];

        if (!verifier.verifyProof(proof, publicInputs)) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifierHashes[nullifierHash] = true;

        // Transfer tokens
        uint256 amountToRecipient = denomination - fee;
        token.safeTransfer(recipient, amountToRecipient);

        // Pay relayer fee if applicable
        if (fee > 0 && relayer != address(0)) {
            token.safeTransfer(relayer, fee);
        }

        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }

    // ============ View Functions ============

    /**
     * @notice Check if a nullifier has been spent
     * @param nullifierHash The nullifier hash to check
     * @return True if already withdrawn
     */
    function isSpent(bytes32 nullifierHash) external view returns (bool) {
        return nullifierHashes[nullifierHash];
    }

    /**
     * @notice Check if a commitment exists
     * @param commitment The commitment to check
     * @return True if already deposited
     */
    function isDeposited(bytes32 commitment) external view returns (bool) {
        return commitments[commitment];
    }

    /**
     * @notice Get pool information
     * @return _token Token address
     * @return _denomination Deposit amount
     * @return _depositsCount Number of deposits
     * @return _root Current Merkle root
     */
    function getPoolInfo() external view returns (
        address _token,
        uint256 _denomination,
        uint256 _depositsCount,
        bytes32 _root
    ) {
        return (
            address(token),
            denomination,
            nextLeafIndex,
            getLatestRoot()
        );
    }
}

