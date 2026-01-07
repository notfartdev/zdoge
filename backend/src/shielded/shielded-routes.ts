/**
 * Shielded Pool API Routes
 * 
 * Endpoints for shielded transaction operations:
 * - Get pool info and statistics
 * - Get Merkle paths for proofs
 * - Get transfer memos for note discovery
 * - Check nullifier status
 * - Relay shielded transactions (AUTOMATIC - user never pays gas)
 */

import { Router, type Request, type Response } from 'express';
import { type Address, createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getShieldedPool,
  getShieldedMerklePath,
  getTransferMemos,
  getShieldedPoolStats,
  isNullifierSpent,
} from './shielded-indexer.js';
import { config, dogeosTestnet } from '../config.js';

export const shieldedRouter = Router();

// ============ Relayer Configuration ============

// Relayer fee: 0.5% of withdrawal amount (configurable)
const RELAYER_FEE_PERCENT = 0.5;
// Minimum fee in human-readable form (will be converted to token base units)
const MIN_RELAYER_FEE_HUMAN = '0.001'; // 0.001 tokens (DOGE, USDC, etc.)

// Helper to get token decimals (defaults to 18 for native DOGE and most tokens)
// For production, you might want to read this from the token contract
function getTokenDecimals(tokenAddress: Address, isNative: boolean): number {
  if (isNative) return 18; // Native DOGE uses 18 decimals
  
  // Token decimals mapping (should match frontend config)
  // For now, all tokens on DogeOS testnet use 18 decimals
  // If you have tokens with different decimals, add them here or read from contract
  const tokenDecimalsMap: Record<string, number> = {
    '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925': 18, // USDC
    '0xC81800b77D91391Ef03d7868cB81204E753093a9': 18, // USDT
    '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F': 18, // USD1
    '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000': 18, // WETH
    '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E': 18, // LBTC
  };
  
  return tokenDecimalsMap[tokenAddress.toLowerCase()] || 18;
}

// Get minimum fee in token base units
function getMinRelayerFee(tokenAddress: Address, isNative: boolean): bigint {
  const decimals = getTokenDecimals(tokenAddress, isNative);
  return parseUnits(MIN_RELAYER_FEE_HUMAN, decimals);
}

// Initialize relayer wallet
let relayerWallet: ReturnType<typeof createWalletClient> | null = null;
let relayerAddress: Address | null = null;
let relayerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

if (process.env.RELAYER_PRIVATE_KEY) {
  try {
    relayerAccount = privateKeyToAccount(`0x${process.env.RELAYER_PRIVATE_KEY.replace('0x', '')}`);
    relayerWallet = createWalletClient({
      account: relayerAccount,
      chain: dogeosTestnet,
      transport: http(config.rpcUrl),
    });
    relayerAddress = relayerAccount.address;
    console.log(`[ShieldedRelayer] Initialized: ${relayerAddress}`);
  } catch (error) {
    console.error('[ShieldedRelayer] Failed to initialize:', error);
  }
} else {
  console.warn('[ShieldedRelayer] RELAYER_PRIVATE_KEY not set - relay disabled');
}

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(config.rpcUrl),
});

// ShieldedPoolMultiToken ABI for relayer functions
const ShieldedPoolABI = [
  // Functions
  {
    type: 'function',
    name: 'unshieldNative',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_recipient', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unshieldToken',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_recipient', type: 'address' },
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportedTokens',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
      { name: '_encryptedMemo1', type: 'bytes' },
      { name: '_encryptedMemo2', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Custom Errors
  { type: 'error', name: 'InvalidProof', inputs: [] },
  { type: 'error', name: 'NullifierAlreadySpent', inputs: [] },
  { type: 'error', name: 'InvalidAmount', inputs: [] },
  { type: 'error', name: 'InvalidRecipient', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  { type: 'error', name: 'CommitmentAlreadyExists', inputs: [] },
  { type: 'error', name: 'InsufficientPoolBalance', inputs: [] },
  { type: 'error', name: 'UnsupportedToken', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'InvalidSwapRate', inputs: [] },
] as const;

/**
 * GET /api/shielded/pool/:address
 * Get shielded pool info
 */
shieldedRouter.get('/pool/:address', async (req: Request, res: Response) => {
  const address = req.params.address;
  const stats = getShieldedPoolStats(address);
  
  if (!stats) {
    return res.status(404).json({ error: 'Shielded pool not found' });
  }
  
  res.json({
    address,
    ...stats,
    features: {
      multiToken: true,
      variableAmounts: true,
      privateTransfers: true,
      privateSwaps: true,
    },
  });
});

/**
 * GET /api/shielded/pool/:address/root
 * Get current Merkle root
 */
shieldedRouter.get('/pool/:address/root', async (req: Request, res: Response) => {
  const pool = getShieldedPool(req.params.address);
  
  if (!pool) {
    return res.status(404).json({ error: 'Shielded pool not found' });
  }
  
  res.json({
    root: '0x' + pool.tree.getRoot().toString(16).padStart(64, '0'),
    totalCommitments: pool.tree.getLeafCount(),
  });
});

/**
 * GET /api/shielded/pool/:address/path/:leafIndex
 * Get Merkle path for a commitment
 */
shieldedRouter.get('/pool/:address/path/:leafIndex', async (req: Request, res: Response) => {
  const leafIndex = parseInt(req.params.leafIndex);
  
  if (isNaN(leafIndex) || leafIndex < 0) {
    return res.status(400).json({ error: 'Invalid leaf index' });
  }
  
  const path = await getShieldedMerklePath(req.params.address, leafIndex);
  
  if (!path) {
    return res.status(404).json({ error: 'Path not found' });
  }
  
  res.json(path);
});

/**
 * GET /api/shielded/pool/:address/memos
 * Get transfer memos for note discovery
 * 
 * Query params:
 * - since: Timestamp to fetch memos since (optional)
 */
shieldedRouter.get('/pool/:address/memos', async (req: Request, res: Response) => {
  const sinceTimestamp = req.query.since ? parseInt(req.query.since as string) : undefined;
  const memos = getTransferMemos(req.params.address, sinceTimestamp);
  
  res.json({
    count: memos.length,
    memos,
  });
});

/**
 * GET /api/shielded/pool/:address/nullifier/:hash
 * Check if a nullifier has been spent
 */
shieldedRouter.get('/pool/:address/nullifier/:hash', async (req: Request, res: Response) => {
  const isSpent = isNullifierSpent(req.params.address, req.params.hash);
  
  res.json({
    nullifierHash: req.params.hash,
    isSpent,
  });
});

/**
 * GET /api/shielded/pool/:address/commitment/:commitment
 * Get commitment info
 */
shieldedRouter.get('/pool/:address/commitment/:commitment', async (req: Request, res: Response) => {
  const pool = getShieldedPool(req.params.address);
  
  if (!pool) {
    return res.status(404).json({ error: 'Shielded pool not found' });
  }
  
  const commitment = req.params.commitment.toLowerCase();
  const info = pool.commitments.get(commitment) || 
               pool.commitments.get('0x' + commitment.replace('0x', ''));
  
  if (!info) {
    return res.status(404).json({ error: 'Commitment not found' });
  }
  
  res.json(info);
});

/**
 * POST /api/shielded/pool/:address/sync
 * Force sync the pool
 */
shieldedRouter.post('/pool/:address/sync', async (req: Request, res: Response) => {
  // This will be called from main index.ts with the public client
  res.json({ message: 'Use main sync endpoint' });
});

/**
 * GET /api/shielded/discover
 * Discover notes for a viewing key
 * 
 * POST body:
 * - poolAddress: Pool to scan
 * - sinceBlock: Block to start scanning from
 * - limit: Max memos to return (default 100)
 */
shieldedRouter.post('/discover', async (req: Request, res: Response) => {
  const { poolAddress, sinceTimestamp, limit = 100 } = req.body;
  
  if (!poolAddress) {
    return res.status(400).json({ error: 'Missing poolAddress' });
  }
  
  const memos = getTransferMemos(poolAddress, sinceTimestamp);
  const limitedMemos = memos.slice(0, limit);
  
  res.json({
    count: limitedMemos.length,
    hasMore: memos.length > limit,
    memos: limitedMemos,
  });
});

/**
 * GET /api/shielded/stats
 * Get overall shielded pool statistics
 */
shieldedRouter.get('/stats', async (req: Request, res: Response) => {
  // Aggregate stats from all pools
  // For now, return placeholder
  res.json({
    totalPools: 1,
    supportedTokens: ['DOGE', 'USDC', 'USDT', 'WETH', 'LBTC', 'USD1'],
    features: {
      shield: 'Deposit public tokens to shielded pool',
      transfer: 'Private transfer to another shielded address',
      unshield: 'Withdraw shielded tokens to public address',
      swap: 'Exchange shielded tokens privately',
    },
  });
});

// ============ RELAYER ENDPOINTS ============

/**
 * GET /api/shielded/relay/info
 * Get relayer information (address, fee, availability)
 */
shieldedRouter.get('/relay/info', async (req: Request, res: Response) => {
  let relayerBalance = '0';
  let isAvailable = false;
  
  if (relayerAddress) {
    try {
      const balance = await publicClient.getBalance({ address: relayerAddress });
      relayerBalance = (Number(balance) / 1e18).toFixed(4);
      isAvailable = balance >= BigInt(0.01 * 1e18); // Need at least 0.01 DOGE for gas
    } catch (error) {
      console.error('[ShieldedRelayer] Failed to get balance:', error);
    }
  }
  
  res.json({
    available: isAvailable,
    address: relayerAddress || null,
    balance: relayerBalance,
    feePercent: RELAYER_FEE_PERCENT,
    minFee: MIN_RELAYER_FEE_HUMAN, // Human-readable form (0.001 tokens)
    supportedTokens: ['DOGE'], // Native DOGE for now
  });
});

/**
 * POST /api/shielded/relay/unshield
 * Relay an unshield transaction (USER PAYS NO GAS)
 * 
 * Body:
 * - poolAddress: ShieldedPool contract address
 * - proof: uint256[8] ZK proof
 * - root: bytes32 Merkle root
 * - nullifierHash: bytes32 nullifier
 * - recipient: address to receive funds
 * - amount: total amount being withdrawn (fee will be deducted)
 */
shieldedRouter.post('/relay/unshield', async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  // Log the raw request body for debugging
  console.log(`[ShieldedRelayer] Raw request body:`, {
    poolAddress: req.body.poolAddress,
    hasProof: !!req.body.proof,
    proofLength: req.body.proof?.length,
    root: req.body.root,
    nullifierHash: req.body.nullifierHash,
    recipient: req.body.recipient,
    amount: req.body.amount,
    fee: req.body.fee,
    token: req.body.token,  // This is the critical field
    tokenType: typeof req.body.token,
    tokenIsUndefined: req.body.token === undefined,
    tokenIsNull: req.body.token === null,
    tokenIsEmpty: req.body.token === '',
  });
  
  const { 
    poolAddress, 
    proof, 
    root, 
    nullifierHash, 
    recipient, 
    amount, 
    fee: requestFee,
    token  // Optional token address (undefined = native DOGE)
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !root || !nullifierHash || !recipient || !amount) {
    return res.status(400).json({ 
      error: 'Missing parameters',
      required: ['poolAddress', 'proof', 'root', 'nullifierHash', 'recipient', 'amount'],
    });
  }
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json({ error: 'Proof must be array of 8 elements' });
  }
  
  // Determine if native or ERC20 token
  // Amount semantics: amount = recipient net amount (already has fee subtracted by frontend)
  // Fee is separate parameter
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
  
  // Log the received token parameter for debugging
  console.log(`[ShieldedRelayer] Received token parameter:`, token);
  console.log(`[ShieldedRelayer] Token type check:`, {
    token,
    isUndefined: token === undefined,
    isNull: token === null,
    isEmpty: token === '',
    isNativeToken: token === NATIVE_TOKEN,
  });
  
  // Check if token is missing, null, empty string, or native token address
  const isNative = !token || token === '' || token === NATIVE_TOKEN || token.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  const tokenAddress = isNative ? NATIVE_TOKEN : (token as Address);
  
  console.log(`[ShieldedRelayer] Token determination:`, {
    isNative,
    tokenAddress,
    originalToken: token,
  });
  
  const amountBigInt = BigInt(amount);
  
  // Use fee from request (proof was generated with this fee!)
  // Amount is already net (recipient amount), fee is separate
  let fee: bigint;
  if (requestFee !== undefined && requestFee !== null) {
    fee = BigInt(requestFee);
  } else {
    // Fallback: calculate fee (may not match proof!)
    console.warn('[ShieldedRelayer] No fee in request, calculating (may cause InvalidProof!)');
    const feePercent = BigInt(Math.floor(RELAYER_FEE_PERCENT * 100));
    fee = (amountBigInt * feePercent) / 10000n;
    // Use token-aware minimum fee
    const minFee = getMinRelayerFee(tokenAddress, isNative);
    if (fee < minFee) {
      fee = minFee;
    }
  }
  
  // Validate: amount must be > 0 (recipient receives this)
  if (amountBigInt <= 0n) {
    return res.status(400).json({ 
      error: 'Invalid amount',
      message: 'Amount must be greater than zero',
    });
  }
  
  // Validate: fee must be >= 0
  if (fee < 0n) {
    return res.status(400).json({ 
      error: 'Invalid fee',
      message: 'Fee cannot be negative',
    });
  }
  
  // Skip pre-validation for ERC20 tokens
  // DogeOS RPC rejects readContract calls with authorizationList for view functions
  // The contract will validate the token and revert with UnsupportedToken if invalid
  // We already handle UnsupportedToken errors in the catch block below
  if (!isNative) {
    console.log(`[ShieldedRelayer] ERC20 token ${tokenAddress} - validation will be done by contract`);
  }
  
  console.log(`[ShieldedRelayer] Processing unshield:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Token: ${isNative ? 'Native DOGE' : tokenAddress}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Amount (recipient receives): ${amountBigInt.toString()}`);
  console.log(`  Fee (relayer receives): ${fee.toString()}`);
  
  try {
    // Check relayer balance
    const relayerBalance = await publicClient.getBalance({ address: relayerAddress });
    if (relayerBalance < BigInt(0.01 * 1e18)) {
      console.error('[ShieldedRelayer] Insufficient gas balance');
      return res.status(503).json({ 
        error: 'Relayer temporarily unavailable',
        message: 'Relayer needs more gas. Please try again later.',
      });
    }
    
    // Convert proof strings to bigints
    const proofBigInts = proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    
    // Submit transaction - route to correct function based on token type
    // Amount semantics: amountBigInt = recipient net amount, fee = relayer fee
    // Contract transfers: amount to recipient, fee to relayer
    let txHash: `0x${string}`;
    
    if (isNative) {
      // Native DOGE unshield
      console.log(`[ShieldedRelayer] Calling unshieldNative()`);
      txHash = await relayerWallet.writeContract({
        chain: dogeosTestnet,
        account: relayerAccount!,
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldNative',
        args: [
          proofBigInts,
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          recipient as Address,
          amountBigInt,  // Recipient net amount
          relayerAddress!,
          fee,  // Relayer fee
        ],
      });
    } else {
      // ERC20 token unshield
      console.log(`[ShieldedRelayer] Calling unshieldToken() for ${tokenAddress}`);
      txHash = await relayerWallet.writeContract({
        chain: dogeosTestnet,
        account: relayerAccount!,
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldToken',
        args: [
          proofBigInts,
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          recipient as Address,
          tokenAddress as Address,  // Token address parameter
          amountBigInt,  // Recipient net amount
          relayerAddress!,
          fee,  // Relayer fee (paid in same token)
        ],
      });
    }
    
    console.log(`[ShieldedRelayer] TX submitted: ${txHash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1,
    });
    
    if (receipt.status === 'reverted') {
      console.error('[ShieldedRelayer] TX reverted');
      return res.status(500).json({ 
        error: 'Transaction reverted',
        message: 'The unshield transaction was rejected by the contract. Proof may be invalid.',
      });
    }
    
    console.log(`[ShieldedRelayer] TX confirmed in block ${receipt.blockNumber}`);
    
    res.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      recipient,
      token: tokenAddress,  // Token address (native = 0x0...0)
      amountReceived: amountBigInt.toString(),  // Recipient net amount
      fee: fee.toString(),  // Relayer fee
      relayer: relayerAddress,
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Error:', error.message);
    
    // Parse common errors
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json({ error: 'Invalid proof', message: 'ZK proof verification failed' });
    }
    if (errorMsg.includes('UnknownRoot') || errorMsg.includes('InvalidMerkleRoot')) {
      return res.status(400).json({ error: 'Invalid root', message: 'Merkle root not recognized' });
    }
    if (errorMsg.includes('NullifierAlreadySpent') || errorMsg.includes('already spent')) {
      return res.status(400).json({ error: 'Already spent', message: 'This note has already been withdrawn' });
    }
    if (errorMsg.includes('UnsupportedToken')) {
      return res.status(400).json({ 
        error: 'Unsupported token', 
        message: 'This token is not supported by the pool' 
      });
    }
    if (errorMsg.includes('insufficient funds')) {
      return res.status(503).json({ error: 'Relayer out of gas', message: 'Please try again later' });
    }
    
    res.status(500).json({ 
      error: 'Transaction failed',
      message: errorMsg.slice(0, 200),
    });
  }
});

/**
 * POST /api/shielded/relay/transfer
 * Relay a private transfer (z→z) - USER PAYS NO GAS
 * 
 * Body:
 * - poolAddress: ShieldedPool contract address
 * - proof: uint256[8] ZK proof
 * - root: bytes32 Merkle root
 * - nullifierHash: bytes32 nullifier
 * - outputCommitment1: bytes32 recipient commitment
 * - outputCommitment2: bytes32 change commitment
 * - encryptedMemo1: hex string encrypted note for recipient
 * - encryptedMemo2: hex string encrypted note for sender (change)
 * - fee: relayer fee (must match what was used in proof)
 */
shieldedRouter.post('/relay/transfer', async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  const { 
    poolAddress, 
    proof, 
    root, 
    nullifierHash, 
    outputCommitment1,
    outputCommitment2,
    encryptedMemo1,
    encryptedMemo2,
    fee: requestFee 
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !root || !nullifierHash || !outputCommitment1 || !outputCommitment2) {
    return res.status(400).json({ 
      error: 'Missing parameters',
      required: ['poolAddress', 'proof', 'root', 'nullifierHash', 'outputCommitment1', 'outputCommitment2'],
    });
  }
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json({ error: 'Proof must be array of 8 elements' });
  }
  
  // Use fee from request (must match proof!)
  const fee = requestFee !== undefined ? BigInt(requestFee) : 0n;
  
  console.log(`[ShieldedRelayer] Processing transfer:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Root: ${root.slice(0, 18)}...`);
  console.log(`  Nullifier: ${nullifierHash.slice(0, 18)}...`);
  console.log(`  Output1: ${outputCommitment1.slice(0, 18)}...`);
  console.log(`  Output2: ${outputCommitment2.slice(0, 18)}...`);
  console.log(`  Fee: ${Number(fee) / 1e18} DOGE`);
  
  try {
    // Check relayer balance
    const relayerBalance = await publicClient.getBalance({ address: relayerAddress });
    if (relayerBalance < BigInt(0.01 * 1e18)) {
      console.error('[ShieldedRelayer] Insufficient gas balance');
      return res.status(503).json({ 
        error: 'Relayer temporarily unavailable',
        message: 'Relayer needs more gas. Please try again later.',
      });
    }
    
    // Verify root is known on-chain BEFORE submitting
    try {
      // isKnownRoot(bytes32) = 0x6d9833e3
      const selector = '0x6d9833e3';
      const rootPadded = (root as string).slice(2).padStart(64, '0');
      const callData = `${selector}${rootPadded}` as `0x${string}`;
      
      const result = await publicClient.call({
        to: poolAddress as Address,
        data: callData,
      });
      
      // Result is a bool encoded as bytes32 (last byte is 0x01 for true)
      const isRootKnown = result.data && result.data !== '0x' && 
        result.data.endsWith('1');
      console.log(`[ShieldedRelayer] Root known on-chain: ${isRootKnown} (raw: ${result.data})`);
      
      if (!isRootKnown) {
        console.error('[ShieldedRelayer] ❌ Root NOT known on-chain!');
        return res.status(400).json({
          error: 'Invalid root',
          message: 'The Merkle root does not exist on-chain. Tree may be out of sync.',
          providedRoot: root,
        });
      }
    } catch (rootCheckError: any) {
      console.warn('[ShieldedRelayer] Could not verify root:', rootCheckError.message);
      // Continue anyway - let the contract decide
    }
    
    // Convert proof strings to bigints
    const proofBigInts = proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    
    // Prepare memos (empty if not provided)
    const memo1 = encryptedMemo1 ? (encryptedMemo1.startsWith('0x') ? encryptedMemo1 : `0x${encryptedMemo1}`) as `0x${string}` : '0x' as `0x${string}`;
    const memo2 = encryptedMemo2 ? (encryptedMemo2.startsWith('0x') ? encryptedMemo2 : `0x${encryptedMemo2}`) as `0x${string}` : '0x' as `0x${string}`;
    
    // Submit transaction
    const txHash = await relayerWallet.writeContract({
      chain: dogeosTestnet,
      account: relayerAccount!,
      address: poolAddress as Address,
      abi: ShieldedPoolABI,
      functionName: 'transfer',
      args: [
        proofBigInts,
        root as `0x${string}`,
        nullifierHash as `0x${string}`,
        outputCommitment1 as `0x${string}`,
        outputCommitment2 as `0x${string}`,
        relayerAddress!,
        fee,
        memo1,
        memo2,
      ],
    });
    
    console.log(`[ShieldedRelayer] Transfer TX submitted: ${txHash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1,
    });
    
    if (receipt.status === 'reverted') {
      console.error('[ShieldedRelayer] Transfer TX reverted');
      return res.status(500).json({ 
        error: 'Transaction reverted',
        message: 'The transfer transaction was rejected by the contract. Proof may be invalid.',
      });
    }
    
    console.log(`[ShieldedRelayer] Transfer TX confirmed in block ${receipt.blockNumber}`);
    
    // Extract leaf indices from Transfer event
    let leafIndex1: number | null = null;
    let leafIndex2: number | null = null;
    
    for (const log of receipt.logs) {
      const logWithTopics = log as typeof log & { topics?: readonly `0x${string}`[] };
      if (log.address.toLowerCase() === poolAddress.toLowerCase() && logWithTopics.topics && logWithTopics.topics.length >= 4) {
        // Transfer event has indexed nullifierHash, leafIndex1, leafIndex2
        leafIndex1 = parseInt(logWithTopics.topics[2] || '0', 16);
        leafIndex2 = parseInt(logWithTopics.topics[3] || '0', 16);
        break;
      }
    }
    
    res.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      leafIndex1,
      leafIndex2,
      fee: fee.toString(),
      relayer: relayerAddress,
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Transfer Error:', error.message);
    
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json({ error: 'Invalid proof', message: 'ZK proof verification failed' });
    }
    if (errorMsg.includes('UnknownRoot') || errorMsg.includes('InvalidMerkleRoot')) {
      return res.status(400).json({ error: 'Invalid root', message: 'Merkle root not recognized' });
    }
    if (errorMsg.includes('NullifierAlreadySpent') || errorMsg.includes('already spent')) {
      return res.status(400).json({ error: 'Already spent', message: 'This note has already been used' });
    }
    if (errorMsg.includes('insufficient funds')) {
      return res.status(503).json({ error: 'Relayer out of gas', message: 'Please try again later' });
    }
    
    res.status(500).json({ 
      error: 'Transaction failed',
      message: errorMsg.slice(0, 200),
    });
  }
});


