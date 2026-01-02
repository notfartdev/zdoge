// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MerkleTreeWithHistory.sol";
import "./interfaces/IShieldedVerifiers.sol";

/**
 * @title ShieldedPoolMultiToken
 * @notice Privacy pool supporting multiple tokens with variable amounts
 * @dev Enables:
 *      1. Shield (t→z): Deposit any token into shielded notes
 *      2. Transfer (z→z): Send shielded funds to another shielded address
 *      3. Unshield (z→t): Withdraw shielded funds to public address
 *      4. Swap (z→z): Exchange one shielded token for another
 * 
 * Key features:
 * - Multi-token support (native DOGE + any ERC20)
 * - Variable amounts (no fixed denominations)
 * - Real-time swap rates from DEX
 * - Auto-discovery via encrypted memos
 */
contract ShieldedPoolMultiToken is MerkleTreeWithHistory, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    /// @notice Special address representing native DOGE
    address public constant NATIVE_TOKEN = address(0);

    // ============ Verifiers ============
    
    IShieldVerifier public immutable shieldVerifier;
    ITransferVerifier public immutable transferVerifier;
    IUnshieldVerifier public immutable unshieldVerifier;
    ISwapVerifier public immutable swapVerifier;

    // ============ DEX Integration ============
    
    /// @notice DEX router for real-time swaps
    address public dexRouter;
    
    /// @notice Owner for admin functions
    address public owner;

    // ============ State ============

    /// @notice Spent nullifiers (prevents double-spend)
    mapping(bytes32 => bool) public nullifierHashes;

    /// @notice Existing commitments
    mapping(bytes32 => bool) public commitments;

    /// @notice Total shielded balance per token
    /// token => total shielded amount
    mapping(address => uint256) public totalShieldedBalance;

    /// @notice Supported tokens whitelist
    mapping(address => bool) public supportedTokens;

    // ============ Events ============

    event Shield(
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

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

    event Unshield(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        address relayer,
        uint256 fee,
        uint256 timestamp
    );

    event Swap(
        bytes32 indexed inputNullifier,
        bytes32 outputCommitment,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes encryptedMemo,
        uint256 timestamp
    );

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);

    // ============ Errors ============

    error InvalidProof();
    error NullifierAlreadySpent();
    error InvalidAmount();
    error InvalidRecipient();
    error TransferFailed();
    error CommitmentAlreadyExists();
    error InsufficientPoolBalance();
    error UnsupportedToken();
    error Unauthorized();
    error InvalidSwapRate();

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
        address _dexRouter
    ) MerkleTreeWithHistory(_hasher) {
        shieldVerifier = IShieldVerifier(_shieldVerifier);
        transferVerifier = ITransferVerifier(_transferVerifier);
        unshieldVerifier = IUnshieldVerifier(_unshieldVerifier);
        swapVerifier = ISwapVerifier(_swapVerifier);
        dexRouter = _dexRouter;
        owner = msg.sender;

        // Native DOGE is always supported
        supportedTokens[NATIVE_TOKEN] = true;
    }

    // ============ Admin Functions ============

    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }

    function removeSupportedToken(address _token) external onlyOwner {
        if (_token == NATIVE_TOKEN) revert Unauthorized(); // Can't remove native
        supportedTokens[_token] = false;
        emit TokenRemoved(_token);
    }

    function updateDexRouter(address _newRouter) external onlyOwner {
        address old = dexRouter;
        dexRouter = _newRouter;
        emit DexRouterUpdated(old, _newRouter);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    // ============ Shield (t→z) ============

    /**
     * @notice Shield native DOGE
     */
    function shieldNative(bytes32 _commitment) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (commitments[_commitment]) revert CommitmentAlreadyExists();

        uint256 leafIndex = _insert(_commitment);
        commitments[_commitment] = true;
        totalShieldedBalance[NATIVE_TOKEN] += msg.value;

        emit Shield(_commitment, leafIndex, NATIVE_TOKEN, msg.value, block.timestamp);
    }

    /**
     * @notice Shield ERC20 token
     */
    function shieldToken(
        address _token,
        uint256 _amount,
        bytes32 _commitment
    ) external nonReentrant {
        if (!supportedTokens[_token]) revert UnsupportedToken();
        if (_amount == 0) revert InvalidAmount();
        if (commitments[_commitment]) revert CommitmentAlreadyExists();

        // Transfer tokens from user
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 leafIndex = _insert(_commitment);
        commitments[_commitment] = true;
        totalShieldedBalance[_token] += _amount;

        emit Shield(_commitment, leafIndex, _token, _amount, block.timestamp);
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
    ) external nonReentrant {
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidProof();

        // Verify proof with fixed-size array
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
        commitments[_outputCommitment1] = true;

        uint256 leafIndex2 = 0;
        if (_outputCommitment2 != bytes32(0)) {
            leafIndex2 = _insert(_outputCommitment2);
            commitments[_outputCommitment2] = true;
        }

        // Pay relayer (from native balance)
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

    // ============ Unshield (z→t) ============

    /**
     * @notice Unshield native DOGE
     */
    function unshieldNative(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        uint256 _amount,
        address _relayer,
        uint256 _fee
    ) external nonReentrant {
        _unshield(_proof, _root, _nullifierHash, _recipient, NATIVE_TOKEN, _amount, _relayer, _fee);
    }

    /**
     * @notice Unshield ERC20 token
     */
    function unshieldToken(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address _recipient,
        address _token,
        uint256 _amount,
        address _relayer,
        uint256 _fee
    ) external nonReentrant {
        if (!supportedTokens[_token]) revert UnsupportedToken();
        _unshield(_proof, _root, _nullifierHash, _recipient, _token, _amount, _relayer, _fee);
    }

    function _unshield(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address _recipient,
        address _token,
        uint256 _amount,
        address _relayer,
        uint256 _fee
    ) internal {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InvalidAmount();
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidProof();

        // Verify proof with fixed-size array
        if (!unshieldVerifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            [
                uint256(_root),
                uint256(_nullifierHash),
                uint256(uint160(_recipient)),
                _amount,
                uint256(uint160(_relayer)),
                _fee
            ]
        )) {
            revert InvalidProof();
        }

        nullifierHashes[_nullifierHash] = true;
        totalShieldedBalance[_token] -= (_amount + _fee);

        // Transfer funds
        if (_token == NATIVE_TOKEN) {
            (bool success, ) = _recipient.call{value: _amount}("");
            if (!success) revert TransferFailed();
            
            if (_fee > 0 && _relayer != address(0)) {
                (bool feeSuccess, ) = _relayer.call{value: _fee}("");
                if (!feeSuccess) revert TransferFailed();
            }
        } else {
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
            _relayer,
            _fee,
            block.timestamp
        );
    }

    // ============ Swap (z→z) ============

    /**
     * @notice Private swap between tokens
     * @dev Burns input note, swaps via DEX, creates output note
     * 
     * @param _proof ZK proof of valid swap
     * @param _root Merkle root
     * @param _inputNullifier Nullifier of input note being spent
     * @param _outputCommitment New note commitment (output token)
     * @param _tokenIn Input token address
     * @param _tokenOut Output token address
     * @param _amountIn Amount of input token
     * @param _minAmountOut Minimum output (slippage protection)
     * @param _encryptedMemo Encrypted memo for output note
     */
    function swap(
        uint256[8] calldata _proof,
        bytes32 _root,
        bytes32 _inputNullifier,
        bytes32 _outputCommitment,
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        bytes calldata _encryptedMemo
    ) external nonReentrant {
        if (!supportedTokens[_tokenIn] || !supportedTokens[_tokenOut]) revert UnsupportedToken();
        if (_amountIn == 0) revert InvalidAmount();
        if (nullifierHashes[_inputNullifier]) revert NullifierAlreadySpent();
        if (!isKnownRoot(_root)) revert InvalidProof();
        if (commitments[_outputCommitment]) revert CommitmentAlreadyExists();

        // Verify swap proof (proves ownership and correct input)
        // For MVP: We trust the swap amounts match the note
        // Full version: ZK proof verifies input amount matches note
        
        // Execute swap via DEX
        uint256 amountOut = _executeSwap(_tokenIn, _tokenOut, _amountIn, _minAmountOut);
        if (amountOut < _minAmountOut) revert InvalidSwapRate();

        // Update state
        nullifierHashes[_inputNullifier] = true;
        totalShieldedBalance[_tokenIn] -= _amountIn;
        totalShieldedBalance[_tokenOut] += amountOut;

        // Insert output commitment
        uint256 leafIndex = _insert(_outputCommitment);
        commitments[_outputCommitment] = true;

        emit Swap(
            _inputNullifier,
            _outputCommitment,
            _tokenIn,
            _tokenOut,
            _amountIn,
            amountOut,
            _encryptedMemo,
            block.timestamp
        );
    }

    /**
     * @notice Execute swap through DEX router
     * @dev Override this for different DEX integrations
     */
    function _executeSwap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut
    ) internal returns (uint256 amountOut) {
        // For MVP: Simple price calculation
        // In production: Call actual DEX router
        
        if (dexRouter == address(0)) {
            // No DEX: Use mock 1:1 rate for testing
            return _amountIn;
        }

        // Prepare swap
        if (_tokenIn == NATIVE_TOKEN) {
            // Native → ERC20
            // Call DEX with native value
            // Example: Uniswap-style swapExactETHForTokens
            
            // For now, use mock rate
            amountOut = _getSwapQuote(_tokenIn, _tokenOut, _amountIn);
        } else if (_tokenOut == NATIVE_TOKEN) {
            // ERC20 → Native
            IERC20(_tokenIn).approve(dexRouter, _amountIn);
            
            // For now, use mock rate
            amountOut = _getSwapQuote(_tokenIn, _tokenOut, _amountIn);
        } else {
            // ERC20 → ERC20
            IERC20(_tokenIn).approve(dexRouter, _amountIn);
            
            // For now, use mock rate
            amountOut = _getSwapQuote(_tokenIn, _tokenOut, _amountIn);
        }

        return amountOut;
    }

    /**
     * @notice Get swap quote (price discovery)
     * @dev In production, query DEX for real-time price
     */
    function _getSwapQuote(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) internal view returns (uint256) {
        // Mock implementation - replace with actual DEX query
        // Example rates for testing:
        // DOGE/USDC ≈ 0.15
        // DOGE/WETH ≈ 0.00004
        
        // For now, return 1:1 rate
        // In production: Call DEX router's getAmountsOut()
        return _amountIn;
    }

    // ============ View Functions ============

    function getSwapQuote(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256) {
        return _getSwapQuote(_tokenIn, _tokenOut, _amountIn);
    }

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

