// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IShieldedVerifiers.sol";

/**
 * @title ShieldedPoolMultiTokenV3
 * @notice Privacy pool supporting multiple tokens with variable amounts
 * @dev V3 enhancements:
 *      - Partial unshield with change notes (z→t with change)
 *      - All V2 features (multi-note spending, batch transfers, etc.)
 *      - Emergency pause
 *      - Improved privacy (minimal event data)
 *      - Token blacklist
 *      - Batch operations
 *      - Gas optimizations
 * 
 * Deployed on DogeOS Chikyū Testnet
 * Chain ID: 6281971
 * RPC: https://rpc.testnet.dogeos.com
 */
contract ShieldedPoolMultiTokenV3 is MerkleTreeWithHistory, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    /// @notice Special address representing native DOGE (0xEeee... is standard for native tokens)
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    
    /// @notice Minimum shield amount to prevent dust attacks (0.001 DOGE)
    uint256 public constant MIN_SHIELD_AMOUNT = 0.001 ether;
    
    /// @notice Maximum encrypted memo size to prevent DoS (1 KB)
    uint256 public constant MAX_MEMO_SIZE = 1024;
    
    /// @notice Maximum relayer fee (0.5% = 50 basis points)
    uint256 public constant MAX_RELAYER_FEE_BPS = 50;
    
    /// @notice Maximum notes in batch operations
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    /// @notice Platform treasury address (receives platform fees from swaps)
    address public constant PLATFORM_TREASURY = 0xdFc15203f5397495Dada3D7257Eed1b00DCFF548;

    // ============ Verifiers ============
    
    IShieldVerifier public immutable shieldVerifier;
    ITransferVerifier public immutable transferVerifier;
    IUnshieldVerifier public immutable unshieldVerifier;
    ISwapVerifier public immutable swapVerifier;
    ITransferMultiVerifier public transferMultiVerifier;

    // ============ State ============
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Pending owner for two-step transfer
    address public pendingOwner;
    
    /// @notice DEX router for swaps (optional)
    address public dexRouter;

    /// @notice Spent nullifiers (prevents double-spend)
    mapping(bytes32 => bool) public nullifierHashes;

    /// @notice Total shielded balance per token
    mapping(address => uint256) public totalShieldedBalance;

    /// @notice Supported tokens whitelist
    mapping(address => bool) public supportedTokens;
    
    /// @notice Blacklisted tokens (scam tokens, fee-on-transfer, etc)
    mapping(address => bool) public blacklistedTokens;

    // ============ Events ============
    
    /// @notice Shield event - minimal data for privacy
    /// @dev Amount is NOT logged - it's private! Only commitment is public
    event Shield(
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        address indexed token,
        uint256 timestamp
    );
    
    /// @notice Transfer event - only encrypted memos
    event Transfer(
        bytes32 indexed nullifierHash,
        bytes32 outputCommitment1,
        bytes32 outputCommitment2,
        uint256 indexed leafIndex1,
        uint256 indexed leafIndex2,
        bytes encryptedMemo1,
        bytes encryptedMemo2,
        uint256 timestamp
    );
    
    /// @notice Batch transfer event
    event BatchTransfer(
        bytes32[] nullifierHashes,
        bytes32 outputCommitment1,
        bytes32 outputCommitment2,
        uint256 indexed leafIndex1,
        uint256 indexed leafIndex2,
        bytes encryptedMemo1,
        bytes encryptedMemo2,
        uint256 timestamp
    );

    /// @notice Unshield event - amount must be public (it's a public withdrawal)
    /// @dev V3: Added changeCommitment to support partial unshield
    event Unshield(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 changeCommitment,  // V3: Change note commitment (0 if no change)
        address relayer,
        uint256 fee,
        uint256 timestamp
    );
    
    /// @notice Batch unshield event
    event BatchUnshield(
        bytes32[] nullifierHashes,
        address indexed recipient,
        address indexed token,
        uint256 totalAmount,
        address relayer,
        uint256 totalFee,
        uint256 timestamp
    );

    /// @notice Swap event
    event Swap(
        bytes32 indexed inputNullifier,
        bytes32 outputCommitment1,
        bytes32 outputCommitment2,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 timestamp
    );

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event TokenBlacklistedEvent(address indexed token);
    event TokenUnblacklistedEvent(address indexed token);
    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error InvalidProof();
    error NullifierAlreadySpent();
    error InvalidAmount();
    error AmountTooSmall();
    error InvalidRecipient();
    error TransferFailed();
    error InsufficientPoolBalance();
    error UnsupportedToken();
    error TokenBlacklistedError();
    error Unauthorized();
    error InvalidSwapRate();
    error MemoTooLarge();
    error ExcessiveFee();
    error BatchSizeTooLarge();
    error BatchSizeMismatch();
    error InvalidCommitment();
    error InvalidParams();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _hasher,
        address _shieldVerifier,
        address _transferVerifier,
        address _unshieldVerifier,
        address _swapVerifier,
        address _transferMultiVerifier,
        address _dexRouter
    ) MerkleTreeWithHistory(_hasher) {
        shieldVerifier = IShieldVerifier(_shieldVerifier);
        transferVerifier = ITransferVerifier(_transferVerifier);
        unshieldVerifier = IUnshieldVerifier(_unshieldVerifier);
        swapVerifier = ISwapVerifier(_swapVerifier);
        transferMultiVerifier = ITransferMultiVerifier(_transferMultiVerifier);
        dexRouter = _dexRouter;
        owner = msg.sender;

        // Native DOGE is always supported (using standard 0xEeee... address)
        supportedTokens[NATIVE_TOKEN] = true;
    }

    // ============ Admin Functions ============

    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }

    function removeSupportedToken(address _token) external onlyOwner {
        if (_token == NATIVE_TOKEN) revert Unauthorized();
        supportedTokens[_token] = false;
        emit TokenRemoved(_token);
    }
    
    function blacklistToken(address _token) external onlyOwner {
        blacklistedTokens[_token] = true;
        emit TokenBlacklistedEvent(_token);
    }
    
    function unblacklistToken(address _token) external onlyOwner {
        blacklistedTokens[_token] = false;
        emit TokenUnblacklistedEvent(_token);
    }

    function updateDexRouter(address _newRouter) external onlyOwner {
        address old = dexRouter;
        dexRouter = _newRouter;
        emit DexRouterUpdated(old, _newRouter);
    }
    
    /// @notice Two-step ownership transfer for safety
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert Unauthorized();
        pendingOwner = _newOwner;
        emit OwnershipTransferStarted(owner, _newOwner);
    }
    
    /// @notice New owner must accept ownership
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }
    
    /// @notice Emergency pause (can only be called by owner)
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Shield (t→z) ============

    /**
     * @notice Shield native DOGE
     * @dev Amount is NOT emitted in event for privacy!
     */
    function shieldNative(bytes32 _commitment) external payable nonReentrant whenNotPaused {
        if (msg.value < MIN_SHIELD_AMOUNT) revert AmountTooSmall();
        if (_commitment == bytes32(0)) revert InvalidCommitment();

        uint256 leafIndex = _insert(_commitment);
        totalShieldedBalance[NATIVE_TOKEN] += msg.value;

        // Privacy: Amount is NOT logged! Only commitment + leafIndex
        emit Shield(_commitment, leafIndex, NATIVE_TOKEN, block.timestamp);
    }

    /**
     * @notice Shield ERC20 token
     * @dev Amount is NOT emitted in event for privacy!
     */
    function shieldToken(
        address _token,
        uint256 _amount,
        bytes32 _commitment
    ) external nonReentrant whenNotPaused {
        if (!supportedTokens[_token]) revert UnsupportedToken();
        if (blacklistedTokens[_token]) revert TokenBlacklistedError();
        if (_amount < MIN_SHIELD_AMOUNT) revert AmountTooSmall();
        if (_commitment == bytes32(0)) revert InvalidCommitment();

        // Transfer tokens from user
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 leafIndex = _insert(_commitment);
        totalShieldedBalance[_token] += _amount;

        // Privacy: Amount is NOT logged!
        emit Shield(_commitment, leafIndex, _token, block.timestamp);
    }

    // ============ Transfer (z→z) ============

    /**
     * @notice Private transfer between shielded addresses
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
    ) external nonReentrant whenNotPaused {
        // Validate memo sizes
        if (_encryptedMemo1.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        if (_encryptedMemo2.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidRoot();

        // Verify proof
        if (!transferVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            [
                uint256(_root),
                uint256(_nullifierHash),
                uint256(_outputCommitment1),
                uint256(_outputCommitment2),
                uint256(uint160(_relayer)),
                _fee
            ]
        )) {
            revert InvalidProof();
        }

        nullifierHashes[_nullifierHash] = true;

        // Insert new commitments
        uint256 leafIndex1 = _insert(_outputCommitment1);
        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
        }

        // Pay relayer
        if (_fee > 0 && _relayer != address(0)) {
            if (address(this).balance < _fee) revert InsufficientPoolBalance();
            (bool success, ) = _relayer.call{value: _fee}("");
            if (!success) revert TransferFailed();
            totalShieldedBalance[NATIVE_TOKEN] -= _fee;
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
     * @notice Multi-input transfer - spend multiple notes in one transaction with ONE proof
     * @dev Uses TransferMultiVerifier - true Zcash-style multi-input circuit
     * @param _proof Single groth16 proof for all inputs
     * @param _roots Merkle roots for each input (one per input note)
     * @param _nullifierHashes Nullifier hashes for each input (one per input note)
     * @param _outputCommitment1 New note for recipient
     * @param _outputCommitment2 Change note (back to sender)
     * @param _relayer Relayer address (or 0 for direct)
     * @param _fee Total relayer fee
     * @param _numInputs Number of actual input notes being spent (2-5)
     * @param _encryptedMemo1 Encrypted memo for recipient
     * @param _encryptedMemo2 Encrypted memo for change
     */
    function transferMulti(
        uint256[8] calldata _proof,
        bytes32[5] calldata _roots,        // Fixed size array (unused slots can be 0)
        bytes32[5] calldata _nullifierHashes, // Fixed size array
        bytes32 _outputCommitment1,
        bytes32 _outputCommitment2,
        address _relayer,
        uint256 _fee,
        uint256 _numInputs,
        bytes calldata _encryptedMemo1,
        bytes calldata _encryptedMemo2
    ) external nonReentrant whenNotPaused {
        // Validate inputs
        if (_numInputs < 2 || _numInputs > MAX_BATCH_SIZE) revert BatchSizeTooLarge();
        
        // Validate memo sizes
        if (_encryptedMemo1.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        if (_encryptedMemo2.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        
        // Validate nullifiers and roots for used inputs
        for (uint256 i = 0; i < _numInputs; i++) {
            if (nullifierHashes[_nullifierHashes[i]]) revert NullifierAlreadySpent();
            if (!isKnownRoot(_roots[i])) revert InvalidRoot();
        }
        
        // Build public inputs array for verifier
        // Public inputs order: roots[10], nullifierHashes[10], outputCommitment1, outputCommitment2, relayer, fee, numInputs
        // Total: 10 + 10 + 1 + 1 + 1 + 1 + 1 = 25 public inputs (as per interface)
        uint256[25] memory publicInputs;
        
        // Fill roots (up to 10 elements, pad with zeros)
        for (uint256 i = 0; i < 10; i++) {
            if (i < _roots.length) {
                publicInputs[i] = uint256(_roots[i]);
            } else {
                publicInputs[i] = 0; // Pad with zeros
            }
        }
        
        // Fill nullifier hashes (up to 10 elements, pad with zeros)
        for (uint256 i = 0; i < 10; i++) {
            if (i < _nullifierHashes.length) {
                publicInputs[10 + i] = uint256(_nullifierHashes[i]);
            } else {
                publicInputs[10 + i] = 0; // Pad with zeros
            }
        }
        
        // Fill other public inputs
        publicInputs[20] = uint256(_outputCommitment1);
        publicInputs[21] = uint256(_outputCommitment2);
        publicInputs[22] = uint256(uint160(_relayer));
        publicInputs[23] = _fee;
        publicInputs[24] = _numInputs;
        
        // Verify the multi-input proof
        if (!transferMultiVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }
        
        // Mark nullifiers as spent
        bytes32[] memory nullifiers = new bytes32[](_numInputs);
        for (uint256 i = 0; i < _numInputs; i++) {
            nullifierHashes[_nullifierHashes[i]] = true;
            nullifiers[i] = _nullifierHashes[i];
        }
        
        // Insert output commitments
        uint256 leafIndex1 = _insert(_outputCommitment1);
        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
        }
        
        // Pay relayer
        if (_fee > 0 && _relayer != address(0)) {
            if (address(this).balance < _fee) revert InsufficientPoolBalance();
            (bool success, ) = _relayer.call{value: _fee}("");
            if (!success) revert TransferFailed();
            totalShieldedBalance[NATIVE_TOKEN] -= _fee;
        }
        
        emit BatchTransfer(
            nullifiers,
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
     * @notice Batch transfer - spend multiple notes in one transaction with multiple proofs
     * @dev Each proof uses the same output commitments (recipient and change)
     * @param _proofs Array of groth16 proofs (one per input note)
     * @param _roots Array of Merkle roots (one per input note)
     * @param _nullifierHashes Array of nullifier hashes (one per input note)
     * @param _outputCommitment1 New note for recipient (shared across all proofs)
     * @param _outputCommitment2 Change note (shared across all proofs)
     * @param _relayer Relayer address (or 0 for direct)
     * @param _fee Total relayer fee
     * @param _encryptedMemo1 Encrypted memo for recipient
     * @param _encryptedMemo2 Encrypted memo for change
     */
    function batchTransfer(
        uint256[8][] calldata _proofs,
        bytes32[] calldata _roots,
        bytes32[] calldata _nullifierHashes,
        bytes32 _outputCommitment1,
        bytes32 _outputCommitment2,
        address _token,
        address _relayer,
        uint256 _fee,
        bytes calldata _encryptedMemo1,
        bytes calldata _encryptedMemo2
    ) external nonReentrant whenNotPaused {
        uint256 batchSize = _proofs.length;
        
        // Validate inputs
        if (batchSize == 0 || batchSize > MAX_BATCH_SIZE) revert BatchSizeTooLarge();
        if (_roots.length != batchSize) revert InvalidParams();
        if (_nullifierHashes.length != batchSize) revert InvalidParams();
        
        // Normalize token address: accept both zero address and NATIVE_TOKEN constant
        address token = (_token == address(0)) ? NATIVE_TOKEN : _token;
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        // Validate memo sizes
        if (_encryptedMemo1.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        if (_encryptedMemo2.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        
        // Validate and mark nullifiers as spent
        bytes32[] memory nullifiers = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            if (nullifierHashes[_nullifierHashes[i]]) revert NullifierAlreadySpent();
            if (!isKnownRoot(_roots[i])) revert InvalidRoot();
            nullifierHashes[_nullifierHashes[i]] = true;
            nullifiers[i] = _nullifierHashes[i];
        }
        
        // Calculate fee per proof (total fee divided by batch size)
        // Frontend generates proofs with feePerProof = totalFee / batchSize
        // So we verify each proof with the same feePerProof
        uint256 feePerProof = _fee / batchSize;
        
        // Ensure fee is evenly divisible (no precision loss)
        if (_fee % batchSize != 0) revert InvalidAmount();
        
        // Verify all proofs (all must use same output commitments)
        // Each proof uses feePerProof (total fee is split evenly)
        for (uint256 i = 0; i < batchSize; i++) {
            if (!transferVerifier.verifyProof(
                [_proofs[i][0], _proofs[i][1]],
                [[_proofs[i][2], _proofs[i][3]], [_proofs[i][4], _proofs[i][5]]],
                [_proofs[i][6], _proofs[i][7]],
                [
                    uint256(_roots[i]),
                    uint256(_nullifierHashes[i]),
                    uint256(_outputCommitment1),
                    uint256(_outputCommitment2),
                    uint256(uint160(_relayer)),
                    feePerProof
                ]
            )) {
                revert InvalidProof();
            }
        }
        
        // Insert output commitments (only once, shared across all proofs)
        uint256 leafIndex1 = _insert(_outputCommitment1);
        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
        }
        
        // Pay relayer (use same token as the notes being transferred)
        if (_fee > 0 && _relayer != address(0)) {
            totalShieldedBalance[token] -= _fee;
            if (token == NATIVE_TOKEN) {
                if (address(this).balance < _fee) revert InsufficientPoolBalance();
                (bool success, ) = _relayer.call{value: _fee}("");
                if (!success) revert TransferFailed();
            } else {
                uint256 contractBalance = IERC20(token).balanceOf(address(this));
                if (contractBalance < _fee) revert InsufficientPoolBalance();
                IERC20(token).safeTransfer(_relayer, _fee);
            }
        }
        
        emit BatchTransfer(
            nullifiers,
            _outputCommitment1,
            _outputCommitment2,
            leafIndex1,
            leafIndex2,
            _encryptedMemo1,
            _encryptedMemo2,
            block.timestamp
        );
    }

    // ============ Unshield (z→t) ============

    /**
     * @notice Unshield native DOGE
     * @dev V3: Added changeCommitment parameter for partial unshield support
     */
    function unshieldNative(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        uint256 _amount,
        bytes32 _changeCommitment,  // V3: Change commitment (0 if no change)
        address _relayer,
        uint256 _fee
    ) external nonReentrant whenNotPaused {
        _unshield(_proof, _root, _nullifierHash, _recipient, NATIVE_TOKEN, _amount, _changeCommitment, _relayer, _fee);
    }

    /**
     * @notice Unshield ERC20 token
     * @dev V3: Added changeCommitment parameter for partial unshield support
     */
    function unshieldToken(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address _recipient,
        address _token,
        uint256 _amount,
        bytes32 _changeCommitment,  // V3: Change commitment (0 if no change)
        address _relayer,
        uint256 _fee
    ) external nonReentrant whenNotPaused {
        if (!supportedTokens[_token]) revert UnsupportedToken();
        _unshield(_proof, _root, _nullifierHash, _recipient, _token, _amount, _changeCommitment, _relayer, _fee);
    }

    function _unshield(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address _recipient,
        address _token,
        uint256 _amount,
        bytes32 _changeCommitment,  // V3: Change commitment (0 if no change)
        address _relayer,
        uint256 _fee
    ) internal {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InvalidAmount();
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidRoot();

        // V3: Verify proof with 7 public inputs (added changeCommitment)
        if (!unshieldVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            [
                uint256(_root),
                uint256(_nullifierHash),
                uint256(uint160(_recipient)),
                _amount,
                uint256(_changeCommitment),  // V3: Change commitment
                uint256(uint160(_relayer)),
                _fee
            ]
        )) {
            revert InvalidProof();
        }

        nullifierHashes[_nullifierHash] = true;
        totalShieldedBalance[_token] -= (_amount + _fee);
        
        // V3: Insert change commitment into Merkle tree (if non-zero)
        if (_changeCommitment != bytes32(0)) {
            _insert(_changeCommitment);
        }

        // Transfer tokens
        if (_token == NATIVE_TOKEN) {
            if (address(this).balance < (_amount + _fee)) revert InsufficientPoolBalance();
            (bool success, ) = _recipient.call{value: _amount}("");
            if (!success) revert TransferFailed();
            
            if (_fee > 0 && _relayer != address(0)) {
                (bool feeSuccess, ) = _relayer.call{value: _fee}("");
                if (!feeSuccess) revert TransferFailed();
            }
        } else {
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            if (contractBalance < (_amount + _fee)) revert InsufficientPoolBalance();
            IERC20(_token).safeTransfer(_recipient, _amount);
            
            if (_fee > 0 && _relayer != address(0)) {
                IERC20(_token).safeTransfer(_relayer, _fee);
            }
        }

        emit Unshield(
            _nullifierHash,
            _recipient,
            _token,
            _amount,
            _changeCommitment,  // V3: Include change commitment in event
            _relayer,
            _fee,
            block.timestamp
        );
    }
    
    /**
     * @notice Batch unshield - unshield multiple notes to same recipient
     * @dev More gas-efficient than multiple individual unshields
     * @dev V3: Added changeCommitments array for partial unshield support
     */
    function batchUnshield(
        uint256[8][] calldata _proofs,
        bytes32[] calldata _roots,
        bytes32[] calldata _nullifierHashes,
        address _recipient,
        address _token,
        uint256[] calldata _amounts,
        bytes32[] calldata _changeCommitments,  // V3: Change commitments (can be zero)
        address _relayer,
        uint256 _totalFee
    ) external nonReentrant whenNotPaused {
        // Validate batch
        uint256 batchSize = _proofs.length;
        if (batchSize == 0 || batchSize > MAX_BATCH_SIZE) revert BatchSizeTooLarge();
        if (_roots.length != batchSize || _nullifierHashes.length != batchSize || _amounts.length != batchSize || _changeCommitments.length != batchSize) {
            revert BatchSizeMismatch();
        }
        if (_recipient == address(0)) revert InvalidRecipient();
        // Normalize token address: accept both zero address and NATIVE_TOKEN constant for native DOGE
        address token = (_token == address(0)) ? NATIVE_TOKEN : _token;
        if (!supportedTokens[token]) revert UnsupportedToken();
        
        // Calculate fee per proof (total fee divided by batch size)
        // Frontend generates proofs with feePerProof = totalFee / batchSize
        // Ensure fee is evenly divisible (no precision loss)
        if (_totalFee % batchSize != 0) revert InvalidAmount();
        uint256 feePerProof = _totalFee / batchSize;
        
        uint256 totalAmount = 0;
        
        // Verify all proofs
        for (uint256 i = 0; i < batchSize; i++) {
            if (_amounts[i] == 0) revert InvalidAmount();
            if (nullifierHashes[_nullifierHashes[i]]) revert NullifierAlreadySpent();
            if (!isKnownRoot(_roots[i])) revert InvalidRoot();
            
            // V3: Verify proof with 7 public inputs (added changeCommitment)
            if (!unshieldVerifier.verifyProof(
                [_proofs[i][0], _proofs[i][1]],
                [[_proofs[i][2], _proofs[i][3]], [_proofs[i][4], _proofs[i][5]]],
                [_proofs[i][6], _proofs[i][7]],
                [
                    uint256(_roots[i]),
                    uint256(_nullifierHashes[i]),
                    uint256(uint160(_recipient)),
                    _amounts[i],
                    uint256(_changeCommitments[i]),  // V3: Change commitment
                    uint256(uint160(_relayer)),
                    feePerProof
                ]
            )) {
                revert InvalidProof();
            }
            
            nullifierHashes[_nullifierHashes[i]] = true;
            totalAmount += _amounts[i];
            
            // V3: Insert change commitment into Merkle tree (if non-zero)
            if (_changeCommitments[i] != bytes32(0)) {
                _insert(_changeCommitments[i]);
            }
        }
        
        totalShieldedBalance[token] -= (totalAmount + _totalFee);
        
        // Transfer all at once (more gas efficient)
        if (token == NATIVE_TOKEN) {
            if (address(this).balance < (totalAmount + _totalFee)) revert InsufficientPoolBalance();
            (bool success, ) = _recipient.call{value: totalAmount}("");
            if (!success) revert TransferFailed();
            
            if (_totalFee > 0 && _relayer != address(0)) {
                (bool feeSuccess, ) = _relayer.call{value: _totalFee}("");
                if (!feeSuccess) revert TransferFailed();
            }
        } else {
            uint256 contractBalance = IERC20(token).balanceOf(address(this));
            if (contractBalance < (totalAmount + _totalFee)) revert InsufficientPoolBalance();
            IERC20(token).safeTransfer(_recipient, totalAmount);
            
            if (_totalFee > 0 && _relayer != address(0)) {
                IERC20(token).safeTransfer(_relayer, _totalFee);
            }
        }
        
        emit BatchUnshield(
            _nullifierHashes,
            _recipient,
            token,
            totalAmount,
            _relayer,
            _totalFee,
            block.timestamp
        );
    }

    // ============ Swap (z→z) ============

    /**
     * @notice Private swap between tokens
     * @dev Swap amounts are NOT logged for privacy (only token addresses)
     * @param _platformFee Platform fee to send to treasury (5 DOGE equivalent in output token)
     */
    function swap(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _inputNullifier,
        bytes32 _outputCommitment1,
        bytes32 _outputCommitment2,
        address _tokenIn,
        address _tokenOut,
        uint256 _swapAmount,
        uint256 _outputAmount,
        uint256 _platformFee,
        uint256 _minAmountOut,
        bytes calldata _encryptedMemo
    ) external nonReentrant whenNotPaused {
        // Normalize token addresses: accept both zero address and NATIVE_TOKEN constant for native DOGE
        address tokenIn = (_tokenIn == address(0)) ? NATIVE_TOKEN : _tokenIn;
        address tokenOut = (_tokenOut == address(0)) ? NATIVE_TOKEN : _tokenOut;
        
        if (!supportedTokens[tokenIn] || !supportedTokens[tokenOut]) revert UnsupportedToken();
        if (blacklistedTokens[tokenIn] || blacklistedTokens[tokenOut]) revert TokenBlacklistedError();
        if (_swapAmount == 0) revert InvalidAmount();
        if (nullifierHashes[_inputNullifier]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidRoot();
        if (_outputAmount < _minAmountOut) revert InvalidSwapRate();
        if (_encryptedMemo.length > MAX_MEMO_SIZE) revert MemoTooLarge();
        
        // Calculate total output needed (user's net amount + platform fee)
        uint256 totalOutputNeeded = _outputAmount + _platformFee;
        
        // Check liquidity (must have enough for user's net amount + platform fee)
        if (tokenOut == NATIVE_TOKEN) {
            if (address(this).balance < totalOutputNeeded) revert InsufficientPoolBalance();
        } else {
            uint256 availableBalance = IERC20(tokenOut).balanceOf(address(this));
            if (availableBalance < totalOutputNeeded) revert InsufficientPoolBalance();
        }

        // Verify swap proof
        uint256 tokenInUint = tokenIn == NATIVE_TOKEN ? 0 : uint256(uint160(tokenIn));
        uint256 tokenOutUint = tokenOut == NATIVE_TOKEN ? 0 : uint256(uint160(tokenOut));
        
        uint256[8] memory publicInputs = [
            uint256(_root),
            uint256(_inputNullifier),
            uint256(_outputCommitment1),
            uint256(_outputCommitment2),
            tokenInUint,
            tokenOutUint,
            _swapAmount,
            _outputAmount
        ];
        
        if (!swapVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            publicInputs
        )) {
            revert InvalidProof();
        }

        // Send platform fee to treasury (if > 0)
        if (_platformFee > 0) {
            if (tokenOut == NATIVE_TOKEN) {
                (bool success, ) = PLATFORM_TREASURY.call{value: _platformFee}("");
                if (!success) revert TransferFailed();
            } else {
                IERC20(tokenOut).safeTransfer(PLATFORM_TREASURY, _platformFee);
            }
        }
        
        // Update state
        nullifierHashes[_inputNullifier] = true;
        totalShieldedBalance[tokenIn] -= _swapAmount;
        totalShieldedBalance[tokenOut] += _outputAmount;  // Only add user's net amount (platform fee already sent to treasury)

        // Insert output commitments (user's net amount)
        uint256 leafIndex1 = _insert(_outputCommitment1);
        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
        }

        // Privacy: Amounts are NOT logged! Only token addresses
        emit Swap(
            _inputNullifier,
            _outputCommitment1,
            _outputCommitment2,
            tokenIn,
            tokenOut,
            block.timestamp
        );
    }

    // ============ View Functions ============

    function isSpent(bytes32 _nullifierHash) external view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    function getPoolInfo(address _token) external view returns (
        uint256 _totalShielded,
        uint256 _notesCount,
        bytes32 _currentRoot,
        bool _isSupported
    ) {
        return (
            totalShieldedBalance[_token],
            nextLeafIndex,
            getLatestRoot(),
            supportedTokens[_token]
        );
    }

    // ============ Receive ============

    receive() external payable {}
}
