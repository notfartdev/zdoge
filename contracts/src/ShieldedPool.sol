// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IVerifier.sol";

/**
 * @title ShieldedPool
 * @notice Privacy pool for native DOGE with shielded transfers
 * @dev Enables three operations:
 *      1. Shield (t→z): Deposit public DOGE into a shielded note
 *      2. Transfer (z→z): Send shielded funds to another shielded address
 *      3. Unshield (z→t): Withdraw shielded funds to a public address
 * 
 * This is Zcash-style privacy where:
 * - Amounts are hidden (variable amounts supported)
 * - Sender is hidden
 * - Recipient is hidden
 * - Only commitments and nullifiers are visible on-chain
 */
contract ShieldedPool is MerkleTreeWithHistory, ReentrancyGuard {
    // ============ Verifiers ============
    
    /// @notice ZK verifier for shield proofs
    IVerifier public immutable shieldVerifier;
    
    /// @notice ZK verifier for transfer proofs
    IVerifier public immutable transferVerifier;
    
    /// @notice ZK verifier for unshield proofs
    IVerifier public immutable unshieldVerifier;

    // ============ State ============

    /// @notice Mapping of spent nullifier hashes (prevents double-spend)
    mapping(bytes32 => bool) public nullifierHashes;

    /// @notice Mapping of commitments (for UI/indexing only)
    mapping(bytes32 => bool) public commitments;

    /// @notice Total shielded balance in the pool
    uint256 public totalShieldedBalance;

    // ============ Events ============

    /// @notice Emitted when DOGE is shielded (t→z)
    event Shield(
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a shielded transfer occurs (z→z)
    /// @dev encryptedMemo contains note details encrypted for recipient
    event Transfer(
        bytes32 indexed nullifierHash,
        bytes32 outputCommitment1,
        bytes32 outputCommitment2,
        uint256 indexed leafIndex1,
        uint256 indexed leafIndex2,
        bytes encryptedMemo1,  // Encrypted note details for recipient
        bytes encryptedMemo2,  // Encrypted note details for sender (change)
        uint256 timestamp
    );

    /// @notice Emitted when DOGE is unshielded (z→t)
    event Unshield(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        uint256 amount,
        address relayer,
        uint256 fee,
        uint256 timestamp
    );

    // ============ Errors ============

    error InvalidProof();
    error NullifierAlreadySpent();
    error InvalidAmount();
    error InvalidRecipient();
    error TransferFailed();
    error CommitmentAlreadyExists();
    error InsufficientPoolBalance();

    // ============ Constructor ============

    /**
     * @param _hasher MiMC hasher contract
     * @param _shieldVerifier ZK verifier for shield proofs
     * @param _transferVerifier ZK verifier for transfer proofs
     * @param _unshieldVerifier ZK verifier for unshield proofs
     */
    constructor(
        address _hasher,
        address _shieldVerifier,
        address _transferVerifier,
        address _unshieldVerifier
    ) MerkleTreeWithHistory(_hasher) {
        shieldVerifier = IVerifier(_shieldVerifier);
        transferVerifier = IVerifier(_transferVerifier);
        unshieldVerifier = IVerifier(_unshieldVerifier);
    }

    // ============ Shield (t→z) ============

    /**
     * @notice Shield DOGE into the pool (public → shielded)
     * @dev User deposits native DOGE and creates a shielded note
     * @param _commitment The note commitment (computed off-chain)
     * @param _proof ZK proof that commitment is correctly formed
     * 
     * The proof verifies:
     * - commitment = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
     * - amount matches msg.value
     */
    function shield(
        bytes32 _commitment,
        uint256[8] calldata _proof
    ) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (commitments[_commitment]) revert CommitmentAlreadyExists();

        // Verify the shield proof
        // Public inputs: commitment, amount
        uint256[] memory publicInputs = new uint256[](2);
        publicInputs[0] = uint256(_commitment);
        publicInputs[1] = msg.value;

        if (!shieldVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }

        // Insert commitment into Merkle tree
        uint256 leafIndex = _insert(_commitment);
        commitments[_commitment] = true;
        totalShieldedBalance += msg.value;

        emit Shield(_commitment, leafIndex, msg.value, block.timestamp);
    }

    /**
     * @notice Shield without proof (for testing/MVP)
     * @dev WARNING: Less secure - use shield() with proof in production
     */
    function shieldSimple(bytes32 _commitment) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (commitments[_commitment]) revert CommitmentAlreadyExists();

        uint256 leafIndex = _insert(_commitment);
        commitments[_commitment] = true;
        totalShieldedBalance += msg.value;

        emit Shield(_commitment, leafIndex, msg.value, block.timestamp);
    }

    // ============ Transfer (z→z) ============

    /**
     * @notice Transfer shielded funds to another shielded address
     * @dev Spends one note and creates two new notes (recipient + change)
     * @param _proof ZK proof of valid transfer
     * @param _root Merkle root the proof is against
     * @param _nullifierHash Nullifier of spent note (prevents double-spend)
     * @param _outputCommitment1 New note for recipient
     * @param _outputCommitment2 Change note (back to sender, or zero)
     * @param _relayer Relayer address (or address(0))
     * @param _fee Relayer fee (or 0)
     * 
     * The proof verifies:
     * - Input note exists in Merkle tree
     * - Prover owns the input note (has spending key)
     * - Nullifier is correctly computed
     * - Output commitments are correctly formed
     * - Value conservation: input = output1 + output2 + fee
     */
    /**
     * @notice Transfer shielded funds to another shielded address
     * @dev Spends one note and creates two new notes (recipient + change)
     * @param _proof ZK proof of valid transfer
     * @param _root Merkle root the proof is against
     * @param _nullifierHash Nullifier of spent note (prevents double-spend)
     * @param _outputCommitment1 New note for recipient
     * @param _outputCommitment2 Change note (back to sender, or zero)
     * @param _relayer Relayer address (or address(0))
     * @param _fee Relayer fee (or 0)
     * @param _encryptedMemo1 Encrypted note details for recipient (enables auto-discovery)
     * @param _encryptedMemo2 Encrypted note details for sender's change
     */
    function transfer(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        bytes32 _outputCommitment1,
        bytes32 _outputCommitment2,
        address _relayer,
        uint256 _fee,
        bytes calldata _encryptedMemo1,
        bytes calldata _encryptedMemo2
    ) external nonReentrant {
        // Check nullifier hasn't been spent
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        
        // Check root is valid
        if (!isKnownRoot(_root)) revert InvalidProof();

        // Verify the transfer proof
        // Public inputs: root, nullifierHash, outputCommitment1, outputCommitment2, relayer, fee
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = uint256(_root);
        publicInputs[1] = uint256(_nullifierHash);
        publicInputs[2] = uint256(_outputCommitment1);
        publicInputs[3] = uint256(_outputCommitment2);
        publicInputs[4] = uint256(uint160(_relayer));
        publicInputs[5] = _fee;

        if (!transferVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifierHashes[_nullifierHash] = true;

        // Insert new commitments
        uint256 leafIndex1 = _insert(_outputCommitment1);
        commitments[_outputCommitment1] = true;

        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
            commitments[_outputCommitment2] = true;
        }

        // Pay relayer fee if applicable
        if (_fee > 0 && _relayer != address(0)) {
            // Fee is paid from the pool's balance
            // This works because the input note's value covers the fee
            if (address(this).balance < _fee) revert InsufficientPoolBalance();
            
            (bool success, ) = _relayer.call{value: _fee}("");
            if (!success) revert TransferFailed();
            
            totalShieldedBalance -= _fee;
        }

        emit Transfer(
            _nullifierHash,
            _outputCommitment1,
            _outputCommitment2,
            leafIndex1,
            leafIndex2,
            _encryptedMemo1,
            _encryptedMemo2,
            block.timestamp
        );
    }

    /**
     * @notice Transfer without memos (legacy/simple version)
     */
    function transferSimple(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        bytes32 _outputCommitment1,
        bytes32 _outputCommitment2,
        address _relayer,
        uint256 _fee
    ) external nonReentrant {
        // Check nullifier hasn't been spent
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        
        // Check root is valid
        if (!isKnownRoot(_root)) revert InvalidProof();

        // Verify the transfer proof
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = uint256(_root);
        publicInputs[1] = uint256(_nullifierHash);
        publicInputs[2] = uint256(_outputCommitment1);
        publicInputs[3] = uint256(_outputCommitment2);
        publicInputs[4] = uint256(uint160(_relayer));
        publicInputs[5] = _fee;

        if (!transferVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifierHashes[_nullifierHash] = true;

        // Insert new commitments
        uint256 leafIndex1 = _insert(_outputCommitment1);
        commitments[_outputCommitment1] = true;

        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
            commitments[_outputCommitment2] = true;
        }

        // Pay relayer fee if applicable
        if (_fee > 0 && _relayer != address(0)) {
            if (address(this).balance < _fee) revert InsufficientPoolBalance();
            
            (bool success, ) = _relayer.call{value: _fee}("");
            if (!success) revert TransferFailed();
            
            totalShieldedBalance -= _fee;
        }

        emit Transfer(
            _nullifierHash,
            _outputCommitment1,
            _outputCommitment2,
            leafIndex1,
            leafIndex2,
            "",  // Empty memo
            "",  // Empty memo
            block.timestamp
        );
    }

    // ============ Unshield (z→t) ============

    /**
     * @notice Unshield DOGE from the pool (shielded → public)
     * @dev Spends a shielded note and sends DOGE to a public address
     * @param _proof ZK proof of valid unshield
     * @param _root Merkle root the proof is against
     * @param _nullifierHash Nullifier of spent note
     * @param _recipient Public address to receive funds
     * @param _amount Amount to withdraw
     * @param _relayer Relayer address (or address(0))
     * @param _fee Relayer fee (or 0)
     * 
     * The proof verifies:
     * - Note exists in Merkle tree
     * - Prover owns the note (has spending key)
     * - Nullifier is correctly computed
     * - Amount + fee equals note value
     */
    function unshield(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        uint256 _amount,
        address _relayer,
        uint256 _fee
    ) external nonReentrant {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InvalidAmount();
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidProof();

        uint256 totalAmount = _amount + _fee;
        if (address(this).balance < totalAmount) revert InsufficientPoolBalance();

        // Verify the unshield proof
        // Public inputs: root, nullifierHash, recipient, amount, relayer, fee
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = uint256(_root);
        publicInputs[1] = uint256(_nullifierHash);
        publicInputs[2] = uint256(uint160(address(_recipient)));
        publicInputs[3] = _amount;
        publicInputs[4] = uint256(uint160(_relayer));
        publicInputs[5] = _fee;

        if (!unshieldVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifierHashes[_nullifierHash] = true;
        totalShieldedBalance -= totalAmount;

        // Send funds to recipient
        (bool success, ) = _recipient.call{value: _amount}("");
        if (!success) revert TransferFailed();

        // Pay relayer fee if applicable
        if (_fee > 0 && _relayer != address(0)) {
            (bool feeSuccess, ) = _relayer.call{value: _fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit Unshield(
            _nullifierHash,
            _recipient,
            _amount,
            _relayer,
            _fee,
            block.timestamp
        );
    }

    // ============ View Functions ============

    /**
     * @notice Check if a nullifier has been spent
     */
    function isSpent(bytes32 _nullifierHash) external view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    /**
     * @notice Check if a commitment exists
     */
    function commitmentExists(bytes32 _commitment) external view returns (bool) {
        return commitments[_commitment];
    }

    /**
     * @notice Get pool information
     */
    function getPoolInfo() external view returns (
        uint256 _totalShielded,
        uint256 _notesCount,
        bytes32 _currentRoot
    ) {
        return (
            totalShieldedBalance,
            nextLeafIndex,
            getLatestRoot()
        );
    }

    /**
     * @notice Get current balance of the pool
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ============ Receive ============

    /// @notice Allow receiving DOGE
    receive() external payable {}
}

