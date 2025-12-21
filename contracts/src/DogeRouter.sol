// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IWrappedDoge
 * @notice Interface for Wrapped DOGE (wDOGE) token
 */
interface IWrappedDoge {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title IMixerPool
 * @notice Interface for MixerPool contracts
 */
interface IMixerPool {
    function deposit(bytes32 commitment) external;
    function withdraw(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        address relayer,
        uint256 fee
    ) external;
    function denomination() external view returns (uint256);
    function token() external view returns (address);
}

/**
 * @title DogeRouter
 * @notice Router contract for depositing/withdrawing native DOGE to wDOGE mixer pools
 * @dev Automatically wraps DOGE to wDOGE on deposit and unwraps on withdrawal
 * 
 * This allows users to:
 * 1. Deposit native DOGE directly (auto-wrapped to wDOGE)
 * 2. Withdraw and receive native DOGE (auto-unwrapped from wDOGE)
 */
contract DogeRouter is ReentrancyGuard {
    
    // ============ State Variables ============
    
    /// @notice The wrapped DOGE token contract
    IWrappedDoge public immutable wdoge;
    
    /// @notice Mapping of pool address to whether it's a valid wDOGE pool
    mapping(address => bool) public validPools;
    
    /// @notice Owner for admin functions
    address public owner;
    
    // ============ Events ============
    
    event DepositDoge(
        address indexed pool,
        bytes32 indexed commitment,
        uint256 amount
    );
    
    event WithdrawDoge(
        address indexed pool,
        address indexed recipient,
        uint256 amount
    );
    
    event PoolAdded(address indexed pool);
    event PoolRemoved(address indexed pool);
    
    // ============ Errors ============
    
    error InvalidPool();
    error InvalidAmount();
    error WrapFailed();
    error UnwrapFailed();
    error TransferFailed();
    error NotOwner();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Create a new DogeRouter
     * @param _wdoge Address of the wrapped DOGE token
     * @param _pools Initial list of valid wDOGE pool addresses
     */
    constructor(address _wdoge, address[] memory _pools) {
        wdoge = IWrappedDoge(_wdoge);
        owner = msg.sender;
        
        for (uint256 i = 0; i < _pools.length; i++) {
            validPools[_pools[i]] = true;
            emit PoolAdded(_pools[i]);
        }
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Deposit native DOGE to a wDOGE mixer pool
     * @param pool Address of the wDOGE mixer pool
     * @param commitment The Pedersen commitment for the deposit
     * @dev User sends native DOGE with this call, router wraps and deposits
     * 
     * Flow:
     * 1. User sends exact denomination amount of native DOGE
     * 2. Router wraps DOGE to wDOGE
     * 3. Router approves and deposits wDOGE to mixer pool
     */
    function depositDoge(
        address pool,
        bytes32 commitment
    ) external payable nonReentrant {
        if (!validPools[pool]) revert InvalidPool();
        
        IMixerPool mixerPool = IMixerPool(pool);
        uint256 denomination = mixerPool.denomination();
        
        if (msg.value != denomination) revert InvalidAmount();
        
        // Wrap native DOGE to wDOGE
        wdoge.deposit{value: msg.value}();
        
        // Approve the pool to spend wDOGE
        wdoge.approve(pool, denomination);
        
        // Deposit to the mixer pool
        mixerPool.deposit(commitment);
        
        emit DepositDoge(pool, commitment, denomination);
    }
    
    /**
     * @notice Withdraw from a wDOGE mixer pool and receive native DOGE
     * @param pool Address of the wDOGE mixer pool
     * @param proof Groth16 proof data
     * @param root Merkle root
     * @param nullifierHash Nullifier hash
     * @param recipient Address to receive native DOGE
     * @param relayer Relayer address (or zero)
     * @param fee Relayer fee
     * @dev Withdraws wDOGE from pool, unwraps to native DOGE, sends to recipient
     * 
     * Flow:
     * 1. Router withdraws wDOGE from mixer pool (to itself)
     * 2. Router unwraps wDOGE to native DOGE
     * 3. Router sends native DOGE to recipient
     * 4. If relayer fee, sends fee portion to relayer
     */
    function withdrawDoge(
        address pool,
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address payable recipient,
        address payable relayer,
        uint256 fee
    ) external nonReentrant {
        if (!validPools[pool]) revert InvalidPool();
        
        IMixerPool mixerPool = IMixerPool(pool);
        
        // Get wDOGE balance before withdrawal
        uint256 balanceBefore = wdoge.balanceOf(address(this));
        
        // Withdraw wDOGE to this contract
        // Note: The proof must be generated with THIS CONTRACT as the recipient
        mixerPool.withdraw(
            proof,
            root,
            nullifierHash,
            address(this), // Withdraw to router first
            relayer,
            fee
        );
        
        // Calculate received amount
        uint256 balanceAfter = wdoge.balanceOf(address(this));
        uint256 received = balanceAfter - balanceBefore;
        
        // Unwrap wDOGE to native DOGE
        wdoge.withdraw(received);
        
        // Send native DOGE to recipient (minus fee if applicable)
        uint256 amountToRecipient = received - fee;
        (bool success, ) = recipient.call{value: amountToRecipient}("");
        if (!success) revert TransferFailed();
        
        // Pay relayer fee if applicable
        if (fee > 0 && relayer != address(0)) {
            (bool feeSuccess, ) = relayer.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }
        
        emit WithdrawDoge(pool, recipient, amountToRecipient);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add a valid wDOGE pool
     * @param pool Address of the pool to add
     */
    function addPool(address pool) external onlyOwner {
        validPools[pool] = true;
        emit PoolAdded(pool);
    }
    
    /**
     * @notice Remove a pool from valid list
     * @param pool Address of the pool to remove
     */
    function removePool(address pool) external onlyOwner {
        validPools[pool] = false;
        emit PoolRemoved(pool);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
    
    // ============ Receive Function ============
    
    /// @notice Allow receiving native DOGE (for unwrapping)
    receive() external payable {}
}

