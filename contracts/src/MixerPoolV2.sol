// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IVerifier.sol";

/**
 * @title MixerPoolV2
 * @notice Privacy pool with optional timelock for enhanced privacy
 * @dev Adds two-step withdrawal with configurable delay:
 *      1. commitWithdrawal() - Verify proof, lock funds, set unlock time
 *      2. executeWithdrawal() - After delay, transfer funds
 * 
 * Users can choose:
 *   - Instant withdrawal (delay = 0) - Same as V1
 *   - Delayed withdrawal - Better privacy, funds locked until unlock time
 */
contract MixerPoolV2 is MerkleTreeWithHistory, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Maximum allowed delay (7 days)
    uint256 public constant MAX_DELAY = 7 days;

    /// @notice Minimum delay for scheduled withdrawals (1 hour)
    uint256 public constant MIN_DELAY = 1 hours;

    // ============ State Variables ============

    /// @notice The ERC20 token this pool accepts
    IERC20 public immutable token;

    /// @notice The ZK proof verifier contract
    IVerifierLegacy public immutable verifier;

    /// @notice Fixed denomination for this pool
    uint256 public immutable denomination;

    /// @notice Mapping of spent nullifier hashes
    mapping(bytes32 => bool) public nullifierHashes;

    /// @notice Mapping of commitments
    mapping(bytes32 => bool) public commitments;

    /// @notice Pending withdrawals (nullifierHash => PendingWithdrawal)
    mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;

    /// @notice Counter for total scheduled withdrawals
    uint256 public scheduledCount;

    // ============ Structs ============

    struct PendingWithdrawal {
        address recipient;
        address relayer;
        uint256 fee;
        uint256 unlockTime;
        bool executed;
        bool exists;
    }

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

    event WithdrawalScheduled(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        uint256 unlockTime,
        uint256 delay
    );

    event WithdrawalExecuted(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        address indexed executor,
        uint256 amount
    );

    event WithdrawalCancelled(
        bytes32 indexed nullifierHash,
        address indexed recipient
    );

    // ============ Errors ============

    error InvalidDenomination();
    error CommitmentAlreadyExists();
    error InvalidMerkleRoot();
    error NullifierAlreadySpent();
    error NullifierAlreadyPending();
    error InvalidProof();
    error InvalidFee();
    error InvalidDelay();
    error WithdrawalNotFound();
    error WithdrawalNotReady();
    error WithdrawalAlreadyExecuted();
    error TransferFailed();

    // ============ Constructor ============

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

    // ============ Deposit ============

    /**
     * @notice Deposit tokens into the mixer
     * @param commitment The commitment hash
     */
    function deposit(bytes32 commitment) external nonReentrant {
        if (commitments[commitment]) revert CommitmentAlreadyExists();

        uint256 leafIndex = _insert(commitment);
        commitments[commitment] = true;

        token.safeTransferFrom(msg.sender, address(this), denomination);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    // ============ Instant Withdrawal ============

    /**
     * @notice Withdraw tokens instantly (no delay)
     * @dev Same as V1 - for users who don't need enhanced privacy
     */
    function withdraw(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee
    ) external nonReentrant {
        _verifyAndMarkSpent(proof, root, nullifierHash, recipient, relayer, fee);
        _transferFunds(recipient, relayer, fee);
        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }

    // ============ Scheduled Withdrawal (Two-Step) ============

    /**
     * @notice Schedule a delayed withdrawal for enhanced privacy
     * @param proof ZK proof
     * @param root Merkle root
     * @param nullifierHash Nullifier hash
     * @param recipient Recipient address
     * @param relayer Relayer address
     * @param fee Relayer fee
     * @param delay Time delay in seconds (MIN_DELAY to MAX_DELAY)
     */
    function scheduleWithdrawal(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee,
        uint256 delay
    ) external nonReentrant {
        // Validate delay
        if (delay < MIN_DELAY || delay > MAX_DELAY) revert InvalidDelay();
        
        // Check not already pending
        if (pendingWithdrawals[nullifierHash].exists) revert NullifierAlreadyPending();

        // Verify proof and mark as pending (not spent yet)
        _verifyProof(proof, root, nullifierHash, recipient, relayer, fee);
        
        // Check nullifier not already spent
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadySpent();

        // Calculate unlock time
        uint256 unlockTime = block.timestamp + delay;

        // Store pending withdrawal
        pendingWithdrawals[nullifierHash] = PendingWithdrawal({
            recipient: recipient,
            relayer: relayer,
            fee: fee,
            unlockTime: unlockTime,
            executed: false,
            exists: true
        });

        // Mark nullifier as used (prevents double-scheduling)
        nullifierHashes[nullifierHash] = true;

        scheduledCount++;

        emit WithdrawalScheduled(nullifierHash, recipient, unlockTime, delay);
    }

    /**
     * @notice Execute a scheduled withdrawal after delay has passed
     * @param nullifierHash The nullifier hash of the scheduled withdrawal
     * @dev Anyone can call this - incentivized by potential tip or altruism
     */
    function executeScheduledWithdrawal(bytes32 nullifierHash) external nonReentrant {
        PendingWithdrawal storage pending = pendingWithdrawals[nullifierHash];
        
        if (!pending.exists) revert WithdrawalNotFound();
        if (pending.executed) revert WithdrawalAlreadyExecuted();
        if (block.timestamp < pending.unlockTime) revert WithdrawalNotReady();

        // Mark as executed
        pending.executed = true;

        // Transfer funds
        _transferFunds(pending.recipient, pending.relayer, pending.fee);

        emit WithdrawalExecuted(
            nullifierHash,
            pending.recipient,
            msg.sender,
            denomination - pending.fee
        );
    }

    /**
     * @notice Get time remaining until a scheduled withdrawal can be executed
     * @param nullifierHash The nullifier hash
     * @return timeRemaining Seconds until unlock (0 if ready)
     * @return unlockTime The unlock timestamp
     * @return isReady Whether it can be executed now
     */
    function getWithdrawalStatus(bytes32 nullifierHash) external view returns (
        uint256 timeRemaining,
        uint256 unlockTime,
        bool isReady,
        bool executed
    ) {
        PendingWithdrawal storage pending = pendingWithdrawals[nullifierHash];
        
        if (!pending.exists) {
            return (0, 0, false, false);
        }

        unlockTime = pending.unlockTime;
        executed = pending.executed;
        
        if (block.timestamp >= unlockTime) {
            timeRemaining = 0;
            isReady = !executed;
        } else {
            timeRemaining = unlockTime - block.timestamp;
            isReady = false;
        }
    }

    /**
     * @notice Get pending withdrawal details
     * @param nullifierHash The nullifier hash
     */
    function getPendingWithdrawal(bytes32 nullifierHash) external view returns (
        address recipient,
        address relayer,
        uint256 fee,
        uint256 unlockTime,
        bool executed,
        bool exists
    ) {
        PendingWithdrawal storage pending = pendingWithdrawals[nullifierHash];
        return (
            pending.recipient,
            pending.relayer,
            pending.fee,
            pending.unlockTime,
            pending.executed,
            pending.exists
        );
    }

    // ============ Internal Functions ============

    function _verifyProof(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee
    ) internal view {
        if (fee > denomination) revert InvalidFee();
        if (!isKnownRoot(root)) revert InvalidMerkleRoot();

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
    }

    function _verifyAndMarkSpent(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee
    ) internal {
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadySpent();
        
        _verifyProof(proof, root, nullifierHash, recipient, relayer, fee);
        
        nullifierHashes[nullifierHash] = true;
    }

    function _transferFunds(address recipient, address relayer, uint256 fee) internal {
        uint256 amountToRecipient = denomination - fee;
        token.safeTransfer(recipient, amountToRecipient);

        if (fee > 0 && relayer != address(0)) {
            token.safeTransfer(relayer, fee);
        }
    }

    // ============ View Functions ============

    function isSpent(bytes32 nullifierHash) external view returns (bool) {
        return nullifierHashes[nullifierHash];
    }

    function isDeposited(bytes32 commitment) external view returns (bool) {
        return commitments[commitment];
    }

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

    /**
     * @notice Get V2 specific info
     */
    function getPoolInfoV2() external view returns (
        address _token,
        uint256 _denomination,
        uint256 _depositsCount,
        uint256 _scheduledCount,
        bytes32 _root,
        uint256 _minDelay,
        uint256 _maxDelay
    ) {
        return (
            address(token),
            denomination,
            nextLeafIndex,
            scheduledCount,
            getLatestRoot(),
            MIN_DELAY,
            MAX_DELAY
        );
    }
}

