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
import rateLimit from 'express-rate-limit';
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
import { shieldedRelayerLogger } from '../utils/logger.js';
import { simulateTransaction } from './shielded-simulate.js';
import { createErrorResponse, ErrorCode, mapContractErrorToCode } from '../utils/error-schema.js';

export const shieldedRouter = Router();

// ============ Rate Limiting ============

/**
 * Rate limiter for relayer endpoints (prevents DoS attacks)
 * 
 * Limits:
 * - 10 requests per minute per IP for relayer endpoints
 * - 100 requests per minute per IP for read-only endpoints
 */
const relayerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again in a minute.',
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for localhost (development)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
});

const readOnlyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again in a minute.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
});

// ============ Request Deduplication ============

// Request deduplication: track recent batch unshield requests to prevent duplicates
const recentBatchUnshieldRequests = new Map<string, { txHash: string; timestamp: number }>();
const DEDUP_WINDOW_MS = 30 * 1000; // 30 seconds

function getRequestKey(req: Request): string {
  const body = req.body;
  // Create a unique key from request parameters
  const nullifiers = (body.nullifierHashes || []).join(',');
  const amounts = (body.amounts || []).join(',');
  return `${body.poolAddress}-${body.recipient}-${nullifiers}-${amounts}-${body.totalFee}`;
}

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
      { name: '_changeCommitment', type: 'bytes32' },  // V3: Change commitment (0 if no change)
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
      { name: '_changeCommitment', type: 'bytes32' },  // V3: Change commitment (0 if no change)
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
    name: 'unshieldVerifier',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'swapVerifier',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
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
  {
    type: 'function',
    name: 'swap',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_inputNullifier', type: 'bytes32' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_tokenIn', type: 'address' },
      { name: '_tokenOut', type: 'address' },
      { name: '_swapAmount', type: 'uint256' },
      { name: '_outputAmount', type: 'uint256' },
      { name: '_minAmountOut', type: 'uint256' },
      { name: '_encryptedMemo', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchTransfer',
    inputs: [
      { name: '_proofs', type: 'uint256[8][]' },
      { name: '_roots', type: 'bytes32[]' },
      { name: '_nullifierHashes', type: 'bytes32[]' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_token', type: 'address' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
      { name: '_encryptedMemo1', type: 'bytes' },
      { name: '_encryptedMemo2', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchUnshield',
    inputs: [
      { name: '_proofs', type: 'uint256[8][]' },
      { name: '_roots', type: 'bytes32[]' },
      { name: '_nullifierHashes', type: 'bytes32[]' },
      { name: '_recipient', type: 'address' },
      { name: '_token', type: 'address' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_changeCommitments', type: 'bytes32[]' },  // V3: Change commitments array
      { name: '_relayer', type: 'address' },
      { name: '_totalFee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferMulti',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_roots', type: 'bytes32[5]' },
      { name: '_nullifierHashes', type: 'bytes32[5]' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
      { name: '_numInputs', type: 'uint256' },
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
shieldedRouter.get('/pool/:address', readOnlyRateLimit, async (req: Request, res: Response) => {
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
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress'],
    }));
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
 * POST /api/shielded/relay/simulate
 * Simulate a transaction without submitting it
 * 
 * Pre-validates transactions before proof submission to prevent failures.
 * Returns: wouldPass, decodedError, estimatedFee, suggestion, checks
 */
shieldedRouter.post('/relay/simulate', readOnlyRateLimit, async (req: Request, res: Response) => {
  const requestId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    const { 
      operation, // 'transfer' | 'unshield' | 'swap'
      poolAddress,
      proof,
      root,
      nullifierHash,
      recipient,
      amount,
      fee,
      token,
      // Transfer-specific
      outputCommitment1,
      outputCommitment2,
      // Swap-specific
      tokenIn,
      tokenOut,
      swapAmount,
      outputAmount,
      platformFee,
      minAmountOut,
      encryptedMemo,
    } = req.body;

    console.log('[Simulate] Received request:', {
      operation,
      poolAddress,
      hasProof: !!proof,
      hasRoot: !!root,
      hasNullifierHash: !!nullifierHash,
      hasOutputCommitment1: !!outputCommitment1,
      hasOutputCommitment2: !!outputCommitment2,
      hasTokenIn: !!tokenIn,
      hasTokenOut: !!tokenOut,
      hasSwapAmount: !!swapAmount,
      hasOutputAmount: !!outputAmount,
      hasMinAmountOut: minAmountOut !== undefined,
    });

    if (!operation || !poolAddress) {
      return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
        required: ['operation', 'poolAddress'],
      }));
    }

    // Call simulation service
    const result = await simulateTransaction({
      operation,
      poolAddress,
      proof,
      root,
      nullifierHash,
      recipient,
      amount,
      fee,
      token,
      relayerAddress: relayerAddress || undefined,
      // Transfer-specific
      outputCommitment1,
      outputCommitment2,
      // Swap-specific
      tokenIn,
      tokenOut,
      swapAmount,
      outputAmount,
      platformFee,
      minAmountOut,
      encryptedMemo,
    });

    // Return simulation result
    console.log('[Simulate] Result:', {
      operation,
      wouldPass: result.wouldPass,
      errorCode: result.decodedError,
      suggestion: result.suggestion,
      checks: result.checks,
    });
    
    res.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(error.message || String(error));
    shieldedRelayerLogger.error('relay.simulate.error', 'Simulation failed', errorObj, {
      requestId,
    }, { requestId });

    res.status(500).json(createErrorResponse(ErrorCode.NETWORK_ERROR, {
      message: error.message,
    }));
  }
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
shieldedRouter.post('/relay/unshield', relayerRateLimit, async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json(createErrorResponse(ErrorCode.RELAYER_UNAVAILABLE));
  }
  
  // Structured logging
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  shieldedRelayerLogger.requestReceived('/api/shielded/relay/unshield', 'POST', {
    requestId,
    ip: req.ip || req.socket.remoteAddress,
    poolAddress: req.body.poolAddress,
  });
  
  // Log request details
  shieldedRelayerLogger.debug('relay.unshield.request', 'Processing unshield request', {
    poolAddress: req.body.poolAddress,
    hasProof: !!req.body.proof,
    proofLength: req.body.proof?.length,
    recipient: req.body.recipient,
    amount: req.body.amount,
    token: req.body.token,
  }, { requestId });
  
  const { 
    poolAddress, 
    proof, 
    root, 
    nullifierHash, 
    recipient, 
    amount, 
    changeCommitment,  // V3: Change commitment (optional, defaults to 0)
    fee: requestFee,
    token  // Optional token address (undefined = native DOGE)
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !root || !nullifierHash || !recipient || !amount) {
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress', 'proof', 'root', 'nullifierHash', 'recipient', 'amount'],
    }));
  }
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json(createErrorResponse(ErrorCode.PROOF_FORMAT_ERROR));
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
          (changeCommitment || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,  // V3: Change commitment
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
          (changeCommitment || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,  // V3: Change commitment
          relayerAddress!,
          fee,  // Relayer fee (paid in same token)
        ],
      });
    }
    
    shieldedRelayerLogger.transactionSubmitted(txHash, 'unshield', {
      requestId,
      poolAddress,
      recipient,
      token: tokenAddress,
      amount: amountBigInt.toString(),
      fee: fee.toString(),
    });
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1,
    });
    
    if (receipt.status === 'reverted') {
      shieldedRelayerLogger.transactionFailed(txHash, new Error('Transaction reverted'), {
        requestId,
        poolAddress,
      });
      return res.status(500).json(createErrorResponse(ErrorCode.INVALID_PROOF, {
        txHash,
        message: 'Transaction was reverted by the contract',
      }));
    }
    
    shieldedRelayerLogger.transactionConfirmed(txHash, Number(receipt.blockNumber), {
      requestId,
      poolAddress,
    });
    
    // V3: Extract change leaf index from LeafInserted event (if changeCommitment was inserted)
    let changeLeafIndex: number | null = null;
    if (changeCommitment && changeCommitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      // Parse LeafInserted event to get change leaf index
      // LeafInserted(bytes32 indexed leaf, uint256 indexed leafIndex, bytes32 newRoot)
      const changeCommitmentLower = changeCommitment.toLowerCase();
      for (const log of receipt.logs) {
        const logWithTopics = log as typeof log & { topics?: readonly `0x${string}`[]; data?: `0x${string}` };
        if (log.address.toLowerCase() === poolAddress.toLowerCase() && 
            logWithTopics.topics && 
            logWithTopics.topics.length >= 3) {
          const leafFromEvent = logWithTopics.topics[1];
          const leafIndex = parseInt(logWithTopics.topics[2] || '0', 16);
          
          if (leafFromEvent && leafFromEvent.toLowerCase() === changeCommitmentLower) {
            changeLeafIndex = leafIndex;
            console.log(`[ShieldedRelayer] Found change leaf index: ${changeLeafIndex}`);
            break;
          }
        }
      }
    }
    
    const duration = Date.now() - startTime;
    shieldedRelayerLogger.requestCompleted('/api/shielded/relay/unshield', 'POST', 200, duration, { requestId });
    
    res.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      recipient,
      token: tokenAddress,  // Token address (native = 0x0...0)
      amountReceived: amountBigInt.toString(),  // Recipient net amount
      fee: fee.toString(),  // Relayer fee
      relayer: relayerAddress,
      changeLeafIndex: changeLeafIndex ?? undefined,  // V3: Change leaf index (if change was inserted)
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    shieldedRelayerLogger.error('relay.unshield.error', 'Unshield transaction failed', error, {
      poolAddress: req.body.poolAddress,
      recipient: req.body.recipient,
    }, { requestId });
    
    // Parse common errors using structured error schema
    const errorMsg = error.message || String(error);
    
    // Handle network/timeout errors
    if (errorMsg.includes('took too long') || errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      return res.status(503).json({ 
        error: 'Network timeout',
        message: 'The RPC node took too long to respond. This is usually a temporary network issue. Please try again in a moment.',
      });
    }
    
    if (errorMsg.includes('InsufficientPoolBalance')) {
      return res.status(400).json({ 
        error: 'Insufficient liquidity', 
        message: 'The contract does not have enough tokens to fulfill this unshield. Someone must shield tokens first to provide liquidity.' 
      });
    }
    if (errorMsg.includes('SafeERC20FailedOperation') || errorMsg.includes('e450d38c')) {
      return res.status(400).json({ 
        error: 'Token transfer failed', 
        message: 'The contract does not have enough tokens to fulfill this unshield. This is likely due to insufficient liquidity in the contract.' 
      });
    }
    if (errorMsg.includes('UnsupportedToken')) {
      return res.status(400).json({ 
        error: 'Unsupported token', 
        message: 'This token is not supported by the pool' 
      });
    }
    if (errorMsg.includes('NullifierAlreadySpent')) {
      return res.status(400).json({ error: 'Already spent', message: 'This note has already been used' });
    }
    if (errorMsg.includes('insufficient funds')) {
      return res.status(503).json(createErrorResponse(ErrorCode.RELAYER_UNAVAILABLE, {
        reason: 'Insufficient gas funds',
      }));
    }
    
    // Parse other common errors using structured error schema
    const errorCode = mapContractErrorToCode(errorMsg);
    
    // For contract errors, use structured response
    if (errorCode !== ErrorCode.INVALID_PARAMS) {
      return res.status(400).json(createErrorResponse(errorCode, {
        originalError: errorMsg,
        poolAddress,
        recipient,
      }));
    }
    
    // Generic transaction failure
    res.status(500).json({ 
      error: 'Transaction failed',
      message: errorMsg.slice(0, 200),
    });
  }
});

/**
 * POST /api/shielded/relay/swap
 * Relay a private swap (z→z, different token) - USER PAYS NO GAS
 */
shieldedRouter.post('/relay/swap', relayerRateLimit, async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  // Log received body for debugging
  console.log('[ShieldedRelayer] Received swap request:', {
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    poolAddress: req.body?.poolAddress,
    hasProof: !!req.body?.proof && Array.isArray(req.body.proof),
    proofLength: req.body?.proof?.length,
    swapAmount: req.body?.swapAmount,
    outputAmount: req.body?.outputAmount,
    minAmountOut: req.body?.minAmountOut,
  });
  
  const { 
    poolAddress, 
    proof, 
    root, 
    inputNullifierHash,
    outputCommitment1,
    outputCommitment2,  // Change note commitment (can be 0x0 if no change)
    tokenIn,
    tokenOut,
    swapAmount,  // Amount being swapped (can be less than note amount)
    outputAmount,  // outputAmount from proof's public signals (net amount after fees)
    // platformFee removed - now calculated internally by contract
    minAmountOut,
    encryptedMemo,
  } = req.body;
  
  // Validate inputs with detailed error reporting
  const missingParams: string[] = [];
  if (!poolAddress) missingParams.push('poolAddress');
  if (!proof || !Array.isArray(proof) || proof.length !== 8) missingParams.push('proof (must be array of 8 elements)');
  if (!root) missingParams.push('root');
  if (!inputNullifierHash) missingParams.push('inputNullifierHash');
  if (!outputCommitment1) missingParams.push('outputCommitment1');
  if (!tokenIn) missingParams.push('tokenIn');
  if (!tokenOut) missingParams.push('tokenOut');
  // Convert to string and check - handle both string and number types
  const swapAmountStr = String(swapAmount || '');
  const outputAmountStr = String(outputAmount || '');
  const minAmountOutStr = String(minAmountOut || '');
  
  if (!swapAmount || swapAmountStr === '0' || swapAmountStr === '' || swapAmountStr === 'null' || swapAmountStr === 'undefined') {
    missingParams.push(`swapAmount (received: ${swapAmountStr}, type: ${typeof swapAmount})`);
  }
  if (!outputAmount || outputAmountStr === '0' || outputAmountStr === '' || outputAmountStr === 'null' || outputAmountStr === 'undefined') {
    missingParams.push(`outputAmount (received: ${outputAmountStr}, type: ${typeof outputAmount})`);
  }
  if (!minAmountOut || minAmountOutStr === '0' || minAmountOutStr === '' || minAmountOutStr === 'null' || minAmountOutStr === 'undefined') {
    missingParams.push(`minAmountOut (received: ${minAmountOutStr}, type: ${typeof minAmountOut})`);
  }
  
  if (missingParams.length > 0) {
    console.error('[ShieldedRelayer] Missing parameters:', missingParams);
    console.error('[ShieldedRelayer] Received body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ 
      error: 'Missing parameters',
      missing: missingParams,
      required: ['poolAddress', 'proof', 'root', 'inputNullifierHash', 'outputCommitment1', 'tokenIn', 'tokenOut', 'swapAmount', 'outputAmount', 'minAmountOut'],
    });
  }
  
  // outputCommitment2 can be 0x0 if no change (partial swap)
  const outputCommitment2Final = outputCommitment2 || '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json(createErrorResponse(ErrorCode.PROOF_FORMAT_ERROR));
  }
  
  // Validate memo size (privacy enhancement: cap memo size)
  // Using 1024 bytes for encrypted memos to account for encryption overhead and future fields
  // Increased from 512 to 1024 to handle edge cases and ensure reliability
  const MAX_ENCRYPTED_MEMO_BYTES = 1024;
  if (encryptedMemo) {
    const memoBytes = Buffer.from(encryptedMemo.startsWith('0x') ? encryptedMemo.slice(2) : encryptedMemo, 'hex');
    if (memoBytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memoBytes.length} bytes)`,
        maxSize: MAX_ENCRYPTED_MEMO_BYTES,
        actualSize: memoBytes.length,
      });
    }
  }
  
  console.log(`[ShieldedRelayer] Processing swap:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  TokenIn: ${tokenIn}, TokenOut: ${tokenOut}`);
  console.log(`  SwapAmount: ${swapAmount}, MinAmountOut: ${minAmountOut}`);
  console.log(`  OutputCommitment1: ${outputCommitment1.slice(0, 18)}...`);
  console.log(`  OutputCommitment2 (change): ${outputCommitment2Final.slice(0, 18)}...`);
  
  try {
    // Check relayer balance
    const relayerBalance = await publicClient.getBalance({ address: relayerAddress });
    if (relayerBalance < BigInt(0.01 * 1e18)) {
      return res.status(503).json({ 
        error: 'Relayer temporarily unavailable',
        message: 'Relayer needs more gas. Please try again later.',
      });
    }
    
    // Verify root is known on-chain
    try {
      const selector = '0x6d9833e3';
      const rootPadded = (root as string).slice(2).padStart(64, '0');
      const callData = `${selector}${rootPadded}` as `0x${string}`;
      const result = await publicClient.call({ to: poolAddress as Address, data: callData });
      const isRootKnown = result.data && result.data !== '0x' && result.data.endsWith('1');
      if (!isRootKnown) {
        return res.status(400).json({ error: 'Invalid root', message: 'Merkle root does not exist on-chain' });
      }
    } catch (rootCheckError: any) {
      console.warn('[ShieldedRelayer] Could not verify root:', rootCheckError.message);
    }
    
    // Convert proof and amounts
    const proofBigInts = proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    const memo = encryptedMemo ? (encryptedMemo.startsWith('0x') ? encryptedMemo : `0x${encryptedMemo}`) as `0x${string}` : '0x' as `0x${string}`;
    const swapAmountBigInt = BigInt(swapAmount);
    const outputAmountBigInt = BigInt(outputAmount);
    // Platform fee is now calculated internally by the contract - no longer passed as parameter
    const minAmountOutBigInt = BigInt(minAmountOut);
    
    // 🔍 DEBUG: Calculate what publicInputs the contract will construct
    // Contract code: tokenInUint = tokenIn == NATIVE_TOKEN ? 0 : uint256(uint160(tokenIn))
    const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const tokenInUint = (tokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() || tokenIn === '0x0000000000000000000000000000000000000000')
      ? 0n
      : BigInt(tokenIn);
    const tokenOutUint = (tokenOut.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() || tokenOut === '0x0000000000000000000000000000000000000000')
      ? 0n
      : BigInt(tokenOut);
    
    const contractPublicInputs = [
      BigInt(root),
      BigInt(inputNullifierHash),
      BigInt(outputCommitment1),
      BigInt(outputCommitment2Final),
      tokenInUint,
      tokenOutUint,
      swapAmountBigInt,
      outputAmountBigInt,
    ];
    
    console.log('[ShieldedRelayer] 🔍 DEBUG - Contract will construct publicInputs array:');
    console.log('  [0] root:', contractPublicInputs[0].toString());
    console.log('  [1] inputNullifier:', contractPublicInputs[1].toString());
    console.log('  [2] outputCommitment1:', contractPublicInputs[2].toString());
    console.log('  [3] outputCommitment2:', contractPublicInputs[3].toString());
    console.log('  [4] tokenInUint:', contractPublicInputs[4].toString(), `(tokenIn: ${tokenIn})`);
    console.log('  [5] tokenOutUint:', contractPublicInputs[5].toString(), `(tokenOut: ${tokenOut})`);
    console.log('  [6] swapAmount:', contractPublicInputs[6].toString());
    console.log('  [7] outputAmount:', contractPublicInputs[7].toString());
    
    // Note: SwapVerifier address is configured in the deployed pool contract
    // The contract uses the swapVerifier() function to get the verifier address
    // For debugging, you can check the contract on the block explorer:
    // FINAL: Pool address updated to 0x05D32B760ff49678FD833a4E2AbD516586362b17
    // https://blockscout.testnet.dogeos.com/address/0x05D32B760ff49678FD833a4E2AbD516586362b17
    console.log('[ShieldedRelayer] 🔍 SwapVerifier address is configured in the pool contract');
    console.log('[ShieldedRelayer] 🔍 If proofs fail, verify the verifier matches the zkey verification key');
    
    // Simulate transaction first to catch errors early
    try {
      await publicClient.simulateContract({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'swap',
        args: [
          proofBigInts,
          root as `0x${string}`,
          inputNullifierHash as `0x${string}`,
          outputCommitment1 as `0x${string}`,
          outputCommitment2Final as `0x${string}`,  // Change commitment (can be 0x0)
          tokenIn as Address,
          tokenOut as Address,
          swapAmountBigInt,  // Amount being swapped (can be less than note amount)
          outputAmountBigInt,  // outputAmount from proof (net amount after fees)
          minAmountOutBigInt,
          memo,
        ],
        account: relayerAccount!,
      });
    } catch (simError: any) {
      console.error('[ShieldedRelayer] Simulation error:', simError.message);
      
      // Safely serialize error (convert BigInt to string to avoid serialization error)
      try {
        const safeError = JSON.parse(JSON.stringify(simError, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
        console.error('[ShieldedRelayer] Full error:', JSON.stringify(safeError, null, 2));
      } catch (e) {
        // If serialization still fails, just log message
        console.error('[ShieldedRelayer] Error message:', simError.message);
        if (simError.shortMessage) console.error('[ShieldedRelayer] Short message:', simError.shortMessage);
      }
      
      // Extract revert reason if available
      let errorMsg = simError.message || 'Unknown error';
      if (simError.shortMessage) errorMsg = simError.shortMessage;
      
      // Try to decode custom error from multiple possible locations
      let errorData = null;
      if (simError.cause?.data) errorData = simError.cause.data;
      else if (simError.data) errorData = simError.data;
      else if (simError.reason) errorData = simError.reason;
      
      if (errorData) {
        try {
          // Handle string error data (error selector)
          if (typeof errorData === 'string' && errorData.startsWith('0x')) {
            const selector = errorData.slice(0, 10);
            console.log('[ShieldedRelayer] Error selector:', selector);
            
            if (selector === '0x815e1d64') errorMsg = 'InvalidProof: ZK proof verification failed or Merkle root not known';
            else if (selector === '0x5e0d443f') errorMsg = 'NullifierAlreadySpent: This note has already been used';
            else if (selector === '0x4e7b11b8') errorMsg = 'UnsupportedToken: Token not supported';
            else if (selector === '0x2fb15b83') errorMsg = 'InvalidSwapRate: Swap rate check failed. The deployed contract may need to be updated with the swap rate fix.';
            else if (selector === '0x82b42900') errorMsg = 'InvalidAmount: Amount is zero or invalid';
            else if (selector === '0x9e5d7727') errorMsg = 'InsufficientPoolBalance: Contract does not have enough liquidity for the output token';
            else {
              errorMsg = `Contract reverted with selector ${selector}. This may indicate the contract needs redeployment with updated swap logic.`;
            }
          }
          // Handle error object
          else if (typeof errorData === 'object') {
            if (errorData.errorName) {
              // Safely stringify error args (convert BigInt to string)
              const errorArgs = errorData.errorArgs?.map((arg: any) => 
                typeof arg === 'bigint' ? arg.toString() : String(arg)
              ).join(', ') || '';
              errorMsg = `${errorData.errorName}: ${errorArgs}`;
            }
          }
        } catch (decodeError) {
          console.error('[ShieldedRelayer] Error decoding failed:', decodeError);
        }
      }
      
      // Check error message for known patterns
      if (errorMsg.includes('InvalidSwapRate') || errorMsg.includes('0x2fb15b83')) {
        return res.status(400).json({ 
          error: 'InvalidSwapRate', 
          message: 'The contract rejected the swap rate. This usually means the deployed contract has old swap logic that checks mock rates. The contract needs to be redeployed with the updated swap fix that trusts the proof\'s outputAmount.',
          details: 'See docs/SWAP_RATE_FIX.md for details on the fix.'
        });
      }
      if (errorMsg.includes('InsufficientPoolBalance') || errorMsg.includes('0x9e5d7727')) {
        return res.status(400).json({ 
          error: 'Insufficient liquidity', 
          message: 'The contract does not have enough tokens to fulfill this swap. Someone must shield the output token first to provide liquidity.' 
        });
      }
      
      // Ensure errorMsg is a string (no BigInt values) - handle InvalidProof specially
      if (errorMsg.includes('InvalidProof') || errorMsg.includes('0x815e1d64')) {
        return res.status(400).json({ 
          error: 'InvalidProof', 
          message: 'ZK proof verification failed. This could mean: (1) The circuit WASM/zkey files are out of sync with the contract verifier, (2) The Merkle root is stale, or (3) The proof generation had an error. Please ensure the frontend has the latest circuit files.'
        });
      }
      
      const safeErrorMessage = String(errorMsg).slice(0, 500);
      return res.status(400).json({ error: 'Transaction simulation failed', message: safeErrorMessage });
    }
    
    // Submit transaction
    const txHash = await relayerWallet.writeContract({
      chain: dogeosTestnet,
      account: relayerAccount!,
      address: poolAddress as Address,
      abi: ShieldedPoolABI,
      functionName: 'swap',
      args: [
        proofBigInts,
        root as `0x${string}`,
        inputNullifierHash as `0x${string}`,
        outputCommitment1 as `0x${string}`,
        outputCommitment2Final as `0x${string}`,  // Change commitment (can be 0x0)
        tokenIn as Address,
        tokenOut as Address,
        swapAmountBigInt,  // Amount being swapped (can be less than note amount)
        outputAmountBigInt,  // outputAmount from proof (net amount after fees)
        minAmountOutBigInt,
        memo,
      ],
    });
    
    const requestId = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    shieldedRelayerLogger.transactionSubmitted(txHash, 'swap', {
      requestId,
      poolAddress: req.body.poolAddress,
      tokenIn: req.body.tokenIn,
      tokenOut: req.body.tokenOut,
      swapAmount: req.body.swapAmount,
      outputAmount: req.body.outputAmount,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    
    if (receipt.status === 'reverted') {
      // Try to get revert reason from receipt
      let revertReason = 'Swap was rejected by contract';
      try {
        // Try to decode revert reason from transaction call
        const tx = await publicClient.getTransaction({ hash: txHash });
        const callResult = await publicClient.call({
          to: poolAddress as Address,
          data: tx.input,
        });
        if (callResult.data) {
          revertReason = `Transaction reverted. The deployed contract may need to be updated. Current error: ${callResult.data}`;
        }
      } catch (e) {
        console.warn('[ShieldedRelayer] Could not decode revert reason:', e);
      }
      return res.status(500).json({ 
        error: 'Transaction reverted', 
        message: revertReason,
        hint: 'This usually indicates the contract has old swap logic. Redeploy with the swap rate fix.'
      });
    }
    
    // Parse LeafInserted event to get output leaf index
    // LeafInserted(bytes32 indexed leaf, uint256 indexed leafIndex, bytes32 newRoot)
    // Event signature: keccak256("LeafInserted(bytes32,uint256,bytes32)")
    let outputLeafIndex: number | null = null;
    for (const log of receipt.logs) {
      const logWithTopics = log as typeof log & { topics?: readonly `0x${string}`[]; data?: `0x${string}` };
      if (log.address.toLowerCase() === poolAddress.toLowerCase() && 
          logWithTopics.topics && 
          logWithTopics.topics.length >= 3) {
        // Check if this is LeafInserted event (topic[0] = event signature, topic[1] = leaf (commitment), topic[2] = leafIndex)
        const leafFromEvent = logWithTopics.topics[1];
        const leafIndex = parseInt(logWithTopics.topics[2] || '0', 16);
        
        // Check for outputCommitment1 (swapped token note)
        if (leafFromEvent && leafFromEvent.toLowerCase() === outputCommitment1.toLowerCase()) {
          outputLeafIndex = leafIndex;
          console.log(`[ShieldedRelayer] Found output leaf index 1: ${outputLeafIndex}`);
          break;
        }
      }
    }
    
    // Also check for change note leaf index
    let outputLeafIndex2: number | null = null;
    if (outputCommitment2Final !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      for (const log of receipt.logs) {
        const logWithTopics = log as typeof log & { topics?: readonly `0x${string}`[]; data?: `0x${string}` };
        if (log.address.toLowerCase() === poolAddress.toLowerCase() && 
            logWithTopics.topics && 
            logWithTopics.topics.length >= 3) {
          const leafFromEvent = logWithTopics.topics[1];
          const leafIndex = parseInt(logWithTopics.topics[2] || '0', 16);
          if (leafFromEvent && leafFromEvent.toLowerCase() === outputCommitment2Final.toLowerCase()) {
            outputLeafIndex2 = leafIndex;
            console.log(`[ShieldedRelayer] Found output leaf index 2 (change): ${outputLeafIndex2}`);
            break;
          }
        }
      }
    }
    
    res.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      tokenIn,
      tokenOut,
      swapAmount: swapAmountBigInt.toString(),
      minAmountOut: minAmountOutBigInt.toString(),
      outputLeafIndex1: outputLeafIndex,  // Swapped token note leaf index
      outputLeafIndex2,  // Change note leaf index (null if no change)
      outputLeafIndex,  // Legacy field (for backwards compatibility)
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Swap Error:', error.message);
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json({ error: 'Invalid proof', message: 'ZK proof verification failed' });
    }
    if (errorMsg.includes('NullifierAlreadySpent')) {
      return res.status(400).json({ error: 'Already spent', message: 'This note has already been used' });
    }
    if (errorMsg.includes('InvalidSwapRate') || errorMsg.includes('slippage') || errorMsg.includes('0x2fb15b83')) {
      return res.status(400).json({ 
        error: 'InvalidSwapRate', 
        message: 'The contract rejected the swap rate. The deployed contract likely has old swap logic. Redeploy with the swap rate fix that trusts the proof\'s outputAmount.',
        hint: 'See docs/SWAP_RATE_FIX.md for the fix details.'
      });
    }
    if (errorMsg.includes('InsufficientPoolBalance') || errorMsg.includes('0x9e5d7727')) {
      return res.status(400).json({ 
        error: 'Insufficient liquidity', 
        message: 'The contract does not have enough tokens to fulfill this swap. Someone must shield the output token first.' 
      });
    }
    
    // Ensure errorMsg is a string (convert BigInt to string if needed)
    const safeErrorMessage = String(errorMsg).slice(0, 200);
    res.status(500).json({ error: 'Transaction failed', message: safeErrorMessage });
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
shieldedRouter.post('/relay/transfer', relayerRateLimit, async (req: Request, res: Response) => {
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
    fee: requestFee,
    relayer: requestRelayer, // Optional: relayer address used in proof
    publicInputs // Optional: full public inputs array from proof (for debugging/verification)
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !root || !nullifierHash || !outputCommitment1 || !outputCommitment2) {
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress', 'proof', 'root', 'nullifierHash', 'outputCommitment1', 'outputCommitment2'],
    }));
  }
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json(createErrorResponse(ErrorCode.PROOF_FORMAT_ERROR));
  }
  
  // Validate memo sizes (privacy enhancement: cap memo size)
  // Using 1024 bytes for encrypted memos to account for encryption overhead and future fields
  // Still provides DoS protection while being practical
  // Increased from 512 to 1024 to handle edge cases and ensure reliability
  const MAX_ENCRYPTED_MEMO_BYTES = 1024;
  if (encryptedMemo1) {
    const memo1Bytes = Buffer.from(encryptedMemo1.startsWith('0x') ? encryptedMemo1.slice(2) : encryptedMemo1, 'hex');
    if (memo1Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo1 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo1Bytes.length} bytes)`,
        maxSize: MAX_ENCRYPTED_MEMO_BYTES,
        actualSize: memo1Bytes.length,
      });
    }
  }
  if (encryptedMemo2) {
    const memo2Bytes = Buffer.from(encryptedMemo2.startsWith('0x') ? encryptedMemo2.slice(2) : encryptedMemo2, 'hex');
    if (memo2Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo2 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo2Bytes.length} bytes)`,
        maxSize: MAX_ENCRYPTED_MEMO_BYTES,
        actualSize: memo2Bytes.length,
      });
    }
  }
  
  // Use fee from request (must match proof!)
  const fee = requestFee !== undefined ? BigInt(requestFee) : 0n;
  
  // Extract relayer address from proof's public signals if available, otherwise use request or backend's relayer
  // The proof's public signals are: [root, nullifierHash, outputCommitment1, outputCommitment2, relayer, fee]
  // We need to use the exact relayer address that was used in proof generation
  let relayerForContract: Address;
  
  // Try to extract from public inputs first (most reliable)
  if (publicInputs && Array.isArray(publicInputs) && publicInputs.length >= 6) {
    // Public signal at index 4 is the relayer (as bigint)
    const relayerBigInt = BigInt(publicInputs[4]);
    // Convert bigint to address (pad to 40 hex chars = 20 bytes)
    const relayerHex = relayerBigInt.toString(16).padStart(40, '0');
    relayerForContract = `0x${relayerHex}` as Address;
    console.log(`[ShieldedRelayer] Extracted relayer from public inputs: ${relayerForContract}`);
  } else if (requestRelayer) {
    // Use relayer from request (frontend should send the one used in proof)
    relayerForContract = requestRelayer as Address;
  } else if (relayerAddress) {
    // Fall back to backend's relayer
    relayerForContract = relayerAddress;
  } else {
    // Last resort: zero address
    relayerForContract = '0x0000000000000000000000000000000000000000' as Address;
  }
  
  console.log(`[ShieldedRelayer] Processing transfer:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Root: ${root.slice(0, 18)}...`);
  console.log(`  Nullifier: ${nullifierHash.slice(0, 18)}...`);
  console.log(`  Output1: ${outputCommitment1.slice(0, 18)}...`);
  console.log(`  Output2: ${outputCommitment2.slice(0, 18)}...`);
  console.log(`  Fee: ${Number(fee) / 1e18} DOGE`);
  console.log(`  Request relayer: ${requestRelayer || 'not provided'}`);
  console.log(`  Backend relayer: ${relayerAddress || 'not configured'}`);
  console.log(`  Using relayer: ${relayerForContract}`);
  
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
    
    // Debug: Log what we're sending to the contract vs what the proof expects
    if (publicInputs && Array.isArray(publicInputs) && publicInputs.length >= 6) {
      console.log(`[ShieldedRelayer] Proof public signals:`);
      console.log(`  [0] root: ${publicInputs[0]}`);
      console.log(`  [1] nullifierHash: ${publicInputs[1]}`);
      console.log(`  [2] outputCommitment1: ${publicInputs[2]}`);
      console.log(`  [3] outputCommitment2: ${publicInputs[3]}`);
      console.log(`  [4] relayer: ${publicInputs[4]}`);
      console.log(`  [5] fee: ${publicInputs[5]}`);
      console.log(`[ShieldedRelayer] Contract will receive:`);
      console.log(`  root: ${BigInt(root).toString()}`);
      console.log(`  nullifierHash: ${BigInt(nullifierHash).toString()}`);
      console.log(`  outputCommitment1: ${BigInt(outputCommitment1).toString()}`);
      console.log(`  outputCommitment2: ${BigInt(outputCommitment2).toString()}`);
      console.log(`  relayer: ${BigInt(relayerForContract).toString()}`);
      console.log(`  fee: ${fee.toString()}`);
      
      // Check for mismatches
      if (publicInputs[0] !== BigInt(root).toString()) {
        console.error(`[ShieldedRelayer] ❌ ROOT MISMATCH! Proof: ${publicInputs[0]}, Contract: ${BigInt(root).toString()}`);
      }
      if (publicInputs[1] !== BigInt(nullifierHash).toString()) {
        console.error(`[ShieldedRelayer] ❌ NULLIFIER MISMATCH! Proof: ${publicInputs[1]}, Contract: ${BigInt(nullifierHash).toString()}`);
      }
      if (publicInputs[2] !== BigInt(outputCommitment1).toString()) {
        console.error(`[ShieldedRelayer] ❌ OUTPUT1 MISMATCH! Proof: ${publicInputs[2]}, Contract: ${BigInt(outputCommitment1).toString()}`);
      }
      if (publicInputs[3] !== BigInt(outputCommitment2).toString()) {
        console.error(`[ShieldedRelayer] ❌ OUTPUT2 MISMATCH! Proof: ${publicInputs[3]}, Contract: ${BigInt(outputCommitment2).toString()}`);
      }
      if (publicInputs[4] !== BigInt(relayerForContract).toString()) {
        console.error(`[ShieldedRelayer] ❌ RELAYER MISMATCH! Proof: ${publicInputs[4]}, Contract: ${BigInt(relayerForContract).toString()}`);
      }
      if (publicInputs[5] !== fee.toString()) {
        console.error(`[ShieldedRelayer] ❌ FEE MISMATCH! Proof: ${publicInputs[5]}, Contract: ${fee.toString()}`);
      }
    }
    
    // CRITICAL: Use the exact values from the proof's public signals to ensure they match
    // The contract verifier will compare these against the proof's public signals
    let finalRoot = root as `0x${string}`;
    let finalNullifierHash = nullifierHash as `0x${string}`;
    let finalOutputCommitment1 = outputCommitment1 as `0x${string}`;
    let finalOutputCommitment2 = outputCommitment2 as `0x${string}`;
    
    // If we have public inputs, verify and use them to ensure exact match
    if (publicInputs && Array.isArray(publicInputs) && publicInputs.length >= 6) {
      // Convert proof's public signal root (bigint string) back to bytes32
      const proofRootBigInt = BigInt(publicInputs[0]);
      const proofRootHex = proofRootBigInt.toString(16).padStart(64, '0');
      finalRoot = `0x${proofRootHex}` as `0x${string}`;
      
      // Convert proof's nullifier hash
      const proofNullifierBigInt = BigInt(publicInputs[1]);
      const proofNullifierHex = proofNullifierBigInt.toString(16).padStart(64, '0');
      finalNullifierHash = `0x${proofNullifierHex}` as `0x${string}`;
      
      // Convert proof's output commitments
      const proofOutput1BigInt = BigInt(publicInputs[2]);
      const proofOutput1Hex = proofOutput1BigInt.toString(16).padStart(64, '0');
      finalOutputCommitment1 = `0x${proofOutput1Hex}` as `0x${string}`;
      
      const proofOutput2BigInt = BigInt(publicInputs[3]);
      const proofOutput2Hex = proofOutput2BigInt.toString(16).padStart(64, '0');
      finalOutputCommitment2 = `0x${proofOutput2Hex}` as `0x${string}`;
      
      console.log(`[ShieldedRelayer] Using values from proof's public signals:`);
      console.log(`  Root: ${finalRoot}`);
      console.log(`  Nullifier: ${finalNullifierHash}`);
      console.log(`  Output1: ${finalOutputCommitment1}`);
      console.log(`  Output2: ${finalOutputCommitment2}`);
    }
    
    // Submit transaction
    const txHash = await relayerWallet.writeContract({
      chain: dogeosTestnet,
      account: relayerAccount!,
      address: poolAddress as Address,
      abi: ShieldedPoolABI,
      functionName: 'transfer',
      args: [
        proofBigInts,
        finalRoot,
        finalNullifierHash,
        finalOutputCommitment1,
        finalOutputCommitment2,
        relayerForContract,
        fee,
        memo1,
        memo2,
      ],
    });
    
    const requestId = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    shieldedRelayerLogger.transactionSubmitted(txHash, 'transfer', {
      requestId,
      poolAddress: req.body.poolAddress,
    });
    
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
        // Safely serialize error (convert BigInt to string to avoid serialization error)
        try {
          const safeError = JSON.parse(JSON.stringify(error, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          ));
          console.error('[ShieldedRelayer] Full error object:', JSON.stringify(safeError, null, 2));
        } catch (e) {
          // If serialization still fails, just log message
          console.error('[ShieldedRelayer] Error message:', error.message);
          if (error.shortMessage) console.error('[ShieldedRelayer] Short message:', error.shortMessage);
        }
    
    // Log the actual contract call that failed
    if (error.cause) {
      console.error('[ShieldedRelayer] Error cause:', error.cause);
    }
    if (error.data) {
      console.error('[ShieldedRelayer] Error data:', error.data);
    }
    if (error.shortMessage) {
      console.error('[ShieldedRelayer] Short message:', error.shortMessage);
    }
    
    const errorMsg = error.message || String(error);
    const errorCode = mapContractErrorToCode(errorMsg);
    
    return res.status(400).json(createErrorResponse(errorCode, {
      originalError: errorMsg,
      poolAddress: req.body.poolAddress,
      details: error.shortMessage || error.cause?.message || 'No additional details',
    }));
    
    res.status(500).json({ 
      error: 'Transaction failed',
      message: errorMsg.slice(0, 200),
    });
  }
});

/**
 * POST /api/shielded/relay/batch-transfer
 * Relay a batch transfer (multiple notes → one recipient + change)
 * 
 * Body:
 * - poolAddress: ShieldedPool contract address
 * - proofs: uint256[8][] array of ZK proofs
 * - roots: bytes32[] array of Merkle roots
 * - nullifierHashes: bytes32[] array of nullifiers
 * - outputCommitment1: bytes32 recipient commitment (shared)
 * - outputCommitment2: bytes32 change commitment (shared)
 * - encryptedMemo1: hex string encrypted note for recipient
 * - encryptedMemo2: hex string encrypted note for sender (change)
 * - fee: total relayer fee (split across all proofs)
 */
shieldedRouter.post('/relay/batch-transfer', relayerRateLimit, async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  const { 
    poolAddress, 
    proofs, 
    roots, 
    nullifierHashes, 
    outputCommitment1,
    outputCommitment2,
    encryptedMemo1,
    encryptedMemo2,
    fee: requestFee 
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proofs || !roots || !nullifierHashes || !outputCommitment1 || !outputCommitment2) {
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress', 'proofs', 'roots', 'nullifierHashes', 'outputCommitment1', 'outputCommitment2'],
    }));
  }
  
  if (!Array.isArray(proofs) || proofs.length === 0 || proofs.length > 100) {
    return res.status(400).json({ 
      error: 'Invalid batch size',
      message: 'Batch size must be between 1 and 100',
    });
  }
  
  if (!Array.isArray(roots) || roots.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'roots.length must match proofs.length',
    });
  }
  
  if (!Array.isArray(nullifierHashes) || nullifierHashes.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'nullifierHashes.length must match proofs.length',
    });
  }
  
  // Validate each proof is correct format
  for (let i = 0; i < proofs.length; i++) {
    if (!Array.isArray(proofs[i]) || proofs[i].length !== 8) {
      return res.status(400).json({ 
        error: 'Invalid proof format',
        message: `Proof at index ${i} must be an array of 8 elements`,
      });
    }
  }
  
  // Validate memo sizes
  const MAX_ENCRYPTED_MEMO_BYTES = 1024;
  if (encryptedMemo1) {
    const memo1Bytes = Buffer.from(encryptedMemo1.startsWith('0x') ? encryptedMemo1.slice(2) : encryptedMemo1, 'hex');
    if (memo1Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo1 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes`,
      });
    }
  }
  if (encryptedMemo2) {
    const memo2Bytes = Buffer.from(encryptedMemo2.startsWith('0x') ? encryptedMemo2.slice(2) : encryptedMemo2, 'hex');
    if (memo2Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo2 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes`,
      });
    }
  }
  
  const fee = requestFee !== undefined ? BigInt(requestFee) : 0n;
  
  // Extract token from request body (required for batch transfer)
  const { token } = req.body;
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
  const isNative = !token || token === '' || token === NATIVE_TOKEN || token.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  const tokenAddress = isNative ? NATIVE_TOKEN : (token as Address);
  
  console.log(`[ShieldedRelayer] Processing batch transfer:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Batch size: ${proofs.length} notes`);
  console.log(`  Token: ${isNative ? 'Native DOGE' : tokenAddress}`);
  console.log(`  Output1: ${outputCommitment1.slice(0, 18)}...`);
  console.log(`  Output2: ${outputCommitment2.slice(0, 18)}...`);
  console.log(`  Total Fee: ${Number(fee) / 1e18} DOGE`);
  
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
    
    // Convert proofs to correct format
    const proofsFormatted = proofs.map((proof: string[]) => 
      proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    );
    
    // Prepare memos
    const memo1 = encryptedMemo1 ? (encryptedMemo1.startsWith('0x') ? encryptedMemo1 : `0x${encryptedMemo1}`) as `0x${string}` : '0x' as `0x${string}`;
    const memo2 = encryptedMemo2 ? (encryptedMemo2.startsWith('0x') ? encryptedMemo2 : `0x${encryptedMemo2}`) as `0x${string}` : '0x' as `0x${string}`;
    
    // Convert roots and nullifiers
    const rootsFormatted = roots.map((r: string) => r as `0x${string}`);
    const nullifiersFormatted = nullifierHashes.map((n: string) => n as `0x${string}`);
    
    // Submit transaction
    console.log('[ShieldedRelayer] Submitting batch transfer to contract...');
    const txHash = await relayerWallet.writeContract({
      chain: dogeosTestnet,
      account: relayerAccount!,
      address: poolAddress as Address,
      abi: ShieldedPoolABI,
      functionName: 'batchTransfer',
      args: [
        proofsFormatted,                     // uint256[8][]
        rootsFormatted,                      // bytes32[]
        nullifiersFormatted,                 // bytes32[]
        outputCommitment1 as `0x${string}`,  // bytes32 _outputCommitment1
        outputCommitment2 as `0x${string}`,  // bytes32 _outputCommitment2
        tokenAddress as Address,             // address _token
        relayerAddress! as Address,          // address _relayer
        fee as bigint,                       // uint256 _fee
        memo1 as `0x${string}`,             // bytes _encryptedMemo1
        memo2 as `0x${string}`,             // bytes _encryptedMemo2
      ],
    });
    
    console.log('[ShieldedRelayer] ✅ Batch transfer relayed!');
    console.log(`  Tx hash: ${txHash}`);
    console.log(`  Explorer: https://blockscout.testnet.dogeos.com/tx/${txHash}`);
    
    return res.status(200).json({
      success: true,
      txHash,
      explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${txHash}`,
      batchSize: proofs.length,
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Batch transfer failed:', error);
    
    // Map contract errors - convert error to string first
    const errorMessage = typeof error === 'string' 
      ? error 
      : error?.message || error?.shortMessage || error?.toString() || 'Unknown error';
    const errorCode = mapContractErrorToCode(errorMessage);
    
    return res.status(400).json(createErrorResponse(errorCode, {
      message: errorMessage,
      details: error?.shortMessage || error?.message || errorMessage,
    }));
  }
});

/**
 * POST /api/shielded/relay/transfer-multi
 * Relay a multi-input transfer using the new multi-input circuit
 * 
 * This is the TRUE Zcash-style multi-input transfer:
 * - ONE proof for ALL input notes (not multiple proofs)
 * - Much more gas-efficient
 * - Proper value conservation across all inputs
 * 
 * Body:
 * - poolAddress: ShieldedPool contract address
 * - proof: uint256[8] SINGLE ZK proof for all inputs
 * - roots: bytes32[5] fixed array of Merkle roots (unused slots = 0)
 * - nullifierHashes: bytes32[5] fixed array of nullifiers (unused slots = 0)
 * - outputCommitment1: bytes32 recipient commitment
 * - outputCommitment2: bytes32 change commitment
 * - encryptedMemo1: hex string encrypted note for recipient
 * - encryptedMemo2: hex string encrypted note for sender (change)
 * - fee: total relayer fee
 * - numInputs: number of actual inputs (2-5)
 */
shieldedRouter.post('/relay/transfer-multi', relayerRateLimit, async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  const { 
    poolAddress, 
    proof, 
    roots, 
    nullifierHashes, 
    outputCommitment1,
    outputCommitment2,
    encryptedMemo1,
    encryptedMemo2,
    fee: requestFee,
    numInputs
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !roots || !nullifierHashes || !outputCommitment1 || !outputCommitment2 || numInputs === undefined) {
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress', 'proof', 'roots', 'nullifierHashes', 'outputCommitment1', 'outputCommitment2', 'numInputs'],
    }));
  }
  
  // Validate proof format (single proof, not array)
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json({ 
      error: 'Invalid proof format',
      message: 'Proof must be an array of 8 elements',
    });
  }
  
  // Validate roots and nullifierHashes are arrays of 5
  if (!Array.isArray(roots) || roots.length !== 5) {
    return res.status(400).json({ 
      error: 'Invalid roots format',
      message: 'roots must be an array of exactly 5 elements',
    });
  }
  
  if (!Array.isArray(nullifierHashes) || nullifierHashes.length !== 5) {
    return res.status(400).json({ 
      error: 'Invalid nullifierHashes format',
      message: 'nullifierHashes must be an array of exactly 5 elements',
    });
  }
  
  // Validate numInputs
  const numInputsNum = Number(numInputs);
  if (numInputsNum < 2 || numInputsNum > 5) {
    return res.status(400).json({ 
      error: 'Invalid numInputs',
      message: 'numInputs must be between 2 and 5',
    });
  }
  
  // Validate memo sizes
  const MAX_ENCRYPTED_MEMO_BYTES = 1024;
  if (encryptedMemo1) {
    const memo1Bytes = Buffer.from(encryptedMemo1.startsWith('0x') ? encryptedMemo1.slice(2) : encryptedMemo1, 'hex');
    if (memo1Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo1 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes`,
      });
    }
  }
  if (encryptedMemo2) {
    const memo2Bytes = Buffer.from(encryptedMemo2.startsWith('0x') ? encryptedMemo2.slice(2) : encryptedMemo2, 'hex');
    if (memo2Bytes.length > MAX_ENCRYPTED_MEMO_BYTES) {
      return res.status(400).json({ 
        error: 'Memo too large',
        message: `encryptedMemo2 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes`,
      });
    }
  }
  
  const fee = requestFee !== undefined ? BigInt(requestFee) : 0n;
  
  console.log(`[ShieldedRelayer] Processing multi-input transfer:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Num inputs: ${numInputsNum}`);
  console.log(`  Output1: ${outputCommitment1.slice(0, 18)}...`);
  console.log(`  Output2: ${outputCommitment2.slice(0, 18)}...`);
  console.log(`  Total Fee: ${Number(fee) / 1e18} DOGE`);
  
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
    
    // Convert proof to correct format
    const proofFormatted = proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    
    // Prepare memos
    const memo1 = encryptedMemo1 ? (encryptedMemo1.startsWith('0x') ? encryptedMemo1 : `0x${encryptedMemo1}`) as `0x${string}` : '0x' as `0x${string}`;
    const memo2 = encryptedMemo2 ? (encryptedMemo2.startsWith('0x') ? encryptedMemo2 : `0x${encryptedMemo2}`) as `0x${string}` : '0x' as `0x${string}`;
    
    // Convert roots and nullifiers to fixed size tuples (5 elements as per contract)
    // We've already validated that arrays have exactly 5 elements above
    const rootsFormatted: readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] = [
      roots[0] as `0x${string}`,
      roots[1] as `0x${string}`,
      roots[2] as `0x${string}`,
      roots[3] as `0x${string}`,
      roots[4] as `0x${string}`,
    ];
    const nullifiersFormatted: readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] = [
      nullifierHashes[0] as `0x${string}`,
      nullifierHashes[1] as `0x${string}`,
      nullifierHashes[2] as `0x${string}`,
      nullifierHashes[3] as `0x${string}`,
      nullifierHashes[4] as `0x${string}`,
    ];
    
    // Submit transaction to transferMulti
    console.log('[ShieldedRelayer] Submitting multi-input transfer to contract...');
    const txHash = await relayerWallet.writeContract({
      chain: dogeosTestnet,
      account: relayerAccount!,
      address: poolAddress as Address,
      abi: ShieldedPoolABI,
      functionName: 'transferMulti',
      args: [
        proofFormatted,
        rootsFormatted,
        nullifiersFormatted,
        outputCommitment1 as `0x${string}`,
        outputCommitment2 as `0x${string}`,
        relayerAddress!,
        fee,
        BigInt(numInputsNum),
        memo1,
        memo2,
      ],
    });
    
    console.log('[ShieldedRelayer] ✅ Multi-input transfer relayed!');
    console.log(`  Tx hash: ${txHash}`);
    console.log(`  Explorer: https://blockscout.testnet.dogeos.com/tx/${txHash}`);
    
    return res.status(200).json({
      success: true,
      txHash,
      explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${txHash}`,
      numInputs: numInputsNum,
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Multi-input transfer failed:', error);
    
    // Map contract errors
    const errorCode = mapContractErrorToCode(error);
    
    return res.status(400).json(createErrorResponse(errorCode, {
      message: error.message || 'Multi-input transfer failed',
      details: error.shortMessage || error.message,
    }));
  }
});

/**
 * POST /api/shielded/relay/batch-unshield
 * Relay a batch unshield (multiple notes → one recipient)
 * 
 * Body:
 * - poolAddress: ShieldedPool contract address
 * - proofs: uint256[8][] array of ZK proofs
 * - roots: bytes32[] array of Merkle roots
 * - nullifierHashes: bytes32[] array of nullifiers
 * - recipient: public address to receive funds
 * - token: token address (or null/undefined for native DOGE)
 * - amounts: uint256[] array of amounts per note (net after fees)
 * - totalFee: total relayer fee
 */
shieldedRouter.post('/relay/batch-unshield', relayerRateLimit, async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  // Check for duplicate requests
  const requestKey = getRequestKey(req);
  const now = Date.now();
  const recentRequest = recentBatchUnshieldRequests.get(requestKey);
  
  if (recentRequest && (now - recentRequest.timestamp) < DEDUP_WINDOW_MS) {
    console.log(`[ShieldedRelayer] Duplicate batch unshield request detected (within ${DEDUP_WINDOW_MS}ms), returning previous result`);
    return res.status(200).json({
      success: true,
      txHash: recentRequest.txHash,
      explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${recentRequest.txHash}`,
      batchSize: req.body.proofs?.length || 0,
      totalAmount: req.body.amounts?.reduce((sum: string, amt: string) => (BigInt(sum) + BigInt(amt)).toString(), '0') || '0',
      duplicate: true, // Flag to indicate this is a duplicate response
    });
  }
  
  const {
    poolAddress,
    proofs,
    roots,
    nullifierHashes,
    recipient,
    token,
    amounts,
    changeCommitments,  // V3: Change commitments array (optional, defaults to all zeros)
    totalFee: requestFee,
    publicInputs  // Optional: Public signals from proof generation (for debugging)
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proofs || !roots || !nullifierHashes || !recipient || !amounts) {
    return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAMS, {
      required: ['poolAddress', 'proofs', 'roots', 'nullifierHashes', 'recipient', 'amounts'],
    }));
  }
  
  // V3: Validate changeCommitments (if provided, must match batch size)
  // If not provided, default to all zeros (batch unshield unshields entire notes)
  const changeCommitmentsFinal = changeCommitments || Array(proofs.length).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
  if (changeCommitmentsFinal.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'changeCommitments.length must match proofs.length',
    });
  }
  
  if (!Array.isArray(proofs) || proofs.length === 0 || proofs.length > 100) {
    return res.status(400).json({ 
      error: 'Invalid batch size',
      message: 'Batch size must be between 1 and 100',
    });
  }
  
  if (!Array.isArray(roots) || roots.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'roots.length must match proofs.length',
    });
  }
  
  if (!Array.isArray(nullifierHashes) || nullifierHashes.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'nullifierHashes.length must match proofs.length',
    });
  }
  
  if (!Array.isArray(amounts) || amounts.length !== proofs.length) {
    return res.status(400).json({ 
      error: 'Array length mismatch',
      message: 'amounts.length must match proofs.length',
    });
  }
  
  // Validate each proof
  for (let i = 0; i < proofs.length; i++) {
    if (!Array.isArray(proofs[i]) || proofs[i].length !== 8) {
      return res.status(400).json({ 
        error: 'Invalid proof format',
        message: `Proof at index ${i} must be an array of 8 elements`,
      });
    }
  }
  
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
  const isNative = !token || token === '' || token === NATIVE_TOKEN || token.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  const tokenAddress = isNative ? NATIVE_TOKEN : (token as Address);
  
  const totalFee = requestFee !== undefined ? BigInt(requestFee) : 0n;
  const amountsBigInt = amounts.map((a: string) => BigInt(a));
  const totalAmount = amountsBigInt.reduce((sum: bigint, amt: bigint) => sum + amt, 0n);
  
  console.log(`[ShieldedRelayer] Processing batch unshield:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Batch size: ${proofs.length} notes`);
  console.log(`  Token: ${isNative ? 'Native DOGE' : tokenAddress}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Total amount: ${Number(totalAmount) / 1e18}`);
  console.log(`  Total fee: ${Number(totalFee) / 1e18}`);
  
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
    
    // Convert proofs to correct format
    const proofsFormatted = proofs.map((proof: string[]) => 
      proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    );
    
    // Convert roots and nullifiers
    const rootsFormatted = roots.map((r: string) => r as `0x${string}`);
    const nullifiersFormatted = nullifierHashes.map((n: string) => n as `0x${string}`);
    
    // DEBUG: Log what we're sending to the contract
    console.log('[ShieldedRelayer] DEBUG - Batch unshield parameters:');
    console.log(`  Pool: ${poolAddress}`);
    console.log(`  Batch size: ${proofs.length}`);
    console.log(`  Recipient: ${recipient}`);
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Total amount: ${Number(totalAmount) / 1e18} DOGE`);
    console.log(`  Total fee: ${Number(totalFee) / 1e18} DOGE`);
    console.log(`  Relayer: ${relayerAddress}`);
    console.log(`  Roots: ${rootsFormatted.map(r => r.slice(0, 10) + '...').join(', ')}`);
    console.log(`  Nullifiers: ${nullifiersFormatted.map(n => n.slice(0, 10) + '...').join(', ')}`);
    console.log(`  Change commitments: ${changeCommitmentsFinal.map(c => c.slice(0, 10) + '...').join(', ')}`);
    console.log(`  Amounts: ${amountsBigInt.map(a => Number(a) / 1e18).join(', ')} DOGE`);
    
    // Calculate what public signals the contract will construct
    const feePerProof = totalFee / BigInt(proofs.length);
    console.log('[ShieldedRelayer] DEBUG - Public signals that contract will pass to verifier:');
    for (let i = 0; i < proofs.length; i++) {
      const rootAsUint = BigInt(rootsFormatted[i]);
      const nullifierAsUint = BigInt(nullifiersFormatted[i]);
      const recipientAsUint = BigInt(recipient); // address as uint160 (same as uint256 for valid addresses)
      const amountAsUint = amountsBigInt[i];
      const changeCommitmentAsUint = BigInt(changeCommitmentsFinal[i]);
      const relayerAsUint = BigInt(relayerAddress!); // address as uint160
      
      const contractPublicSignals = [
        rootAsUint.toString(),
        nullifierAsUint.toString(),
        recipientAsUint.toString(),
        amountAsUint.toString(),
        changeCommitmentAsUint.toString(),
        relayerAsUint.toString(),
        feePerProof.toString(),
      ];
      
      console.log(`  Proof ${i} public signals (contract will use):`);
      contractPublicSignals.forEach((sig, idx) => {
        console.log(`    [${idx}] ${['root', 'nullifierHash', 'recipient', 'amount', 'changeCommitment', 'relayer', 'fee'][idx]}: ${sig}`);
      });
      
      // Compare with proof's public signals if provided
      if (publicInputs && Array.isArray(publicInputs) && publicInputs[i]) {
        const proofPublicSignals = publicInputs[i];
        console.log(`  Proof ${i} public signals (from circuit):`);
        if (Array.isArray(proofPublicSignals)) {
          proofPublicSignals.forEach((sig, idx) => {
            console.log(`    [${idx}] ${['root', 'nullifierHash', 'recipient', 'amount', 'changeCommitment', 'relayer', 'fee'][idx]}: ${sig}`);
            if (idx < contractPublicSignals.length) {
              const matches = sig === contractPublicSignals[idx];
              if (!matches) {
                console.error(`    ❌ MISMATCH at index ${idx}! Circuit: ${sig}, Contract will use: ${contractPublicSignals[idx]}`);
              } else {
                console.log(`    ✓ Match`);
              }
            }
          });
        }
      }
    }
    
    // Verify verifier address matches expected (optional check)
    try {
      const actualVerifierAddress = await (publicClient.readContract as any)({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldVerifier',
      });
      console.log('[ShieldedRelayer] Actual verifier address from contract:', actualVerifierAddress);
      // Note: The expected verifier address should match what's deployed in the contract
      // If proofs fail, verify the verifier matches the zkey verification key
      // The deployed verifier address is: 0x7DFEa7a81B6f7098DB4a973b052A08899865b60b (current)
      // If this doesn't match the zkey, we need to redeploy with a new verifier
    } catch (verifierCheckError) {
      // Silently skip if we can't check (not critical)
      console.log('[ShieldedRelayer] Could not verify verifier address (non-critical):', (verifierCheckError as Error).message);
    }
    
    // Submit transaction
    console.log('[ShieldedRelayer] Submitting batch unshield to contract...');
    console.log('[ShieldedRelayer] Contract address:', poolAddress);
    console.log('[ShieldedRelayer] ⚠️  If proofs fail, verify the UnshieldVerifier matches the unshield zkey verification key');
    console.log('[ShieldedRelayer] First proof (first 2 elements):', proofsFormatted[0]?.slice(0, 2).map(p => p.toString().slice(0, 20) + '...'));
    console.log('[ShieldedRelayer] First root:', rootsFormatted[0]);
    console.log('[ShieldedRelayer] First nullifier:', nullifiersFormatted[0]);
    console.log('[ShieldedRelayer] First amount:', amountsBigInt[0]?.toString());
    console.log('[ShieldedRelayer] First changeCommitment:', changeCommitmentsFinal[0]);
    console.log('[ShieldedRelayer] Fee per proof:', feePerProof.toString());
    
    let txHash: `0x${string}`;
    try {
      // Try batchUnshield first (if available in contract)
      txHash = await relayerWallet.writeContract({
        chain: dogeosTestnet,
        account: relayerAccount!,
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'batchUnshield',
        args: [
          proofsFormatted,
          rootsFormatted,
          nullifiersFormatted,
          recipient as Address,
          tokenAddress as Address,
          amountsBigInt,
          changeCommitmentsFinal.map((c: string) => c as `0x${string}`),  // V3: Change commitments array
          relayerAddress!,
          totalFee,
        ],
      });
      
      console.log('[ShieldedRelayer] ✅ Batch unshield relayed!');
      console.log(`  Tx hash: ${txHash}`);
      console.log(`  Explorer: https://blockscout.testnet.dogeos.com/tx/${txHash}`);
      
      // Store successful request for deduplication
      recentBatchUnshieldRequests.set(requestKey, {
        txHash,
        timestamp: now,
      });
      
      // Clean up old entries (older than dedup window)
      for (const [key, value] of recentBatchUnshieldRequests.entries()) {
        if (now - value.timestamp > DEDUP_WINDOW_MS) {
          recentBatchUnshieldRequests.delete(key);
        }
      }
      
      return res.status(200).json({
        success: true,
        txHash,
        explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${txHash}`,
        batchSize: proofs.length,
        totalAmount: totalAmount.toString(),
      });
    } catch (writeError: any) {
      // Check if batchUnshield function doesn't exist (V4 doesn't have it)
      const errorMsg = writeError?.message || writeError?.shortMessage || '';
      const errorDetails = writeError?.details || writeError?.cause?.details || '';
      
      // Check for function not found or execution reverted (likely function doesn't exist)
      const isFunctionNotFound = 
        errorMsg.includes('function') && errorMsg.includes('not found') ||
        errorMsg.includes('Execution reverted') ||
        errorDetails === 'execution reverted';
      
      if (isFunctionNotFound && proofs.length > 0) {
        console.warn('[ShieldedRelayer] batchUnshield not available, falling back to individual unshieldNative calls');
        console.log(`[ShieldedRelayer] Processing ${proofs.length} individual unshield operations...`);
        
        // Fallback: Use individual unshieldNative calls
        const txHashes: string[] = [];
        for (let i = 0; i < proofs.length; i++) {
          try {
            // unshieldNative: (_proof, _root, _nullifierHash, _recipient, _amount, _changeCommitment, _relayer, _fee)
            // unshieldToken: (_proof, _root, _nullifierHash, _recipient, _token, _amount, _changeCommitment, _relayer, _fee)
            const args = isNative 
              ? [
                  proofsFormatted[i],
                  rootsFormatted[i],
                  nullifiersFormatted[i],
                  recipient as Address,
                  amountsBigInt[i],
                  changeCommitmentsFinal[i] as `0x${string}`,
                  relayerAddress!,
                  feePerProof,
                ]
              : [
                  proofsFormatted[i],
                  rootsFormatted[i],
                  nullifiersFormatted[i],
                  recipient as Address,
                  tokenAddress as Address,
                  amountsBigInt[i],
                  changeCommitmentsFinal[i] as `0x${string}`,
                  relayerAddress!,
                  feePerProof,
                ];
            
            const individualTxHash = await relayerWallet.writeContract({
              chain: dogeosTestnet,
              account: relayerAccount!,
              address: poolAddress as Address,
              abi: ShieldedPoolABI,
              functionName: isNative ? 'unshieldNative' : 'unshieldToken',
              args: args as any,
            });
            txHashes.push(individualTxHash);
            console.log(`[ShieldedRelayer] ✓ Unshield ${i + 1}/${proofs.length} submitted: ${individualTxHash}`);
          } catch (individualError: any) {
            console.error(`[ShieldedRelayer] Failed to submit unshield ${i + 1}/${proofs.length}:`, individualError.message);
            throw individualError; // Fail fast if any individual call fails
          }
        }
        
        // Return the first transaction hash (or all of them)
        txHash = txHashes[0] as `0x${string}`;
        console.log(`[ShieldedRelayer] ✅ All ${proofs.length} individual unshields submitted!`);
        console.log(`[ShieldedRelayer] First tx hash: ${txHash}`);
        console.log(`[ShieldedRelayer] All tx hashes: ${txHashes.join(', ')}`);
        
        // Store successful request for deduplication
        recentBatchUnshieldRequests.set(requestKey, {
          txHash,
          timestamp: now,
        });
        
        return res.status(200).json({
          success: true,
          txHash,
          explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${txHash}`,
          batchSize: proofs.length,
          totalAmount: totalAmount.toString(),
          individualTxs: txHashes,
          fallback: true,
          message: 'Used individual unshield calls (batchUnshield not available in V4)',
        });
      }
      
      // Check if this is a "replacement transaction underpriced" error
      // This means the transaction was likely already sent successfully
      if (errorDetails === 'replacement transaction underpriced' || 
          errorMsg.toLowerCase().includes('replacement transaction underpriced')) {
        console.warn('[ShieldedRelayer] Replacement transaction underpriced - transaction may have already been sent');
        console.warn('[ShieldedRelayer] This usually means a previous transaction with the same nonce succeeded.');
        
        // Check if we have a recent successful transaction for this request
        const recentRequest = recentBatchUnshieldRequests.get(requestKey);
        if (recentRequest) {
          console.log('[ShieldedRelayer] Returning previous successful transaction hash:', recentRequest.txHash);
          return res.status(200).json({
            success: true,
            txHash: recentRequest.txHash,
            explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${recentRequest.txHash}`,
            batchSize: proofs.length,
            totalAmount: totalAmount.toString(),
            duplicate: true,
            message: 'Transaction was already submitted successfully',
          });
        }
        
        // If no recent request found, this is a genuine error
        throw new Error('Transaction may have already been submitted. Please check your transaction history.');
      }
      
      // Re-throw other errors
      throw writeError;
    }
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Batch unshield failed:', error);
    
    // Try to decode the actual revert reason
    let decodedError = '';
    try {
      // Use viem's decodeErrorResult for proper error decoding
      const { decodeErrorResult } = await import('viem');
      const ShieldedPoolABI = require('../config.js').ShieldedPoolABI;
      
      // Check multiple possible error data locations
      const errorData = error?.cause?.data || error?.data || error?.cause?.cause?.data || error?.cause?.cause?.cause?.data;
      
      if (errorData && typeof errorData === 'string' && errorData.startsWith('0x') && errorData.length > 10) {
        try {
          const decoded = decodeErrorResult({
            abi: ShieldedPoolABI,
            data: errorData as `0x${string}`,
          });
          decodedError = decoded.errorName || '';
          console.log(`[ShieldedRelayer] ✅ Decoded error: ${decodedError}`);
          if (decoded.args && decoded.args.length > 0) {
            console.log(`[ShieldedRelayer] Error args:`, decoded.args);
          }
        } catch (decodeErr: any) {
          // Fallback to manual selector matching
          const errorSelectors: Record<string, string> = {
            '0x9e5d7727': 'InsufficientPoolBalance',
            '0x8da5cb5b': 'InvalidProof',
            '0x4e69c0d4': 'NullifierAlreadySpent',
            '0x7b3c3d68': 'InvalidRoot',
            '0x2c5211c6': 'InvalidAmount',
            '0x5c60da1b': 'InvalidRecipient',
            '0x90b8ec18': 'TransferFailed',
            '0x4b5c4277': 'UnsupportedToken',
          };
          
          const selector = errorData.slice(0, 10);
          if (errorSelectors[selector]) {
            decodedError = errorSelectors[selector];
            console.log(`[ShieldedRelayer] Decoded error (fallback): ${decodedError}`);
          } else {
            console.log(`[ShieldedRelayer] Unknown error selector: ${selector}`);
            console.log(`[ShieldedRelayer] Full error data: ${errorData.slice(0, 100)}...`);
          }
        }
      } else {
        console.log(`[ShieldedRelayer] No error data found or invalid format`);
        console.log(`[ShieldedRelayer] Error structure:`, {
          hasCause: !!error?.cause,
          hasData: !!error?.data,
          errorType: error?.constructor?.name,
        });
      }
    } catch (decodeError) {
      console.warn('[ShieldedRelayer] Error decoding failed:', (decodeError as Error).message);
    }
    
    // Log the required amount for debugging
    const requiredAmount = totalAmount + totalFee;
    console.log(`[ShieldedRelayer] Required USDC amount: ${Number(requiredAmount) / 1e18} USDC`);
    console.log(`[ShieldedRelayer] Amount: ${Number(totalAmount) / 1e18} USDC`);
    console.log(`[ShieldedRelayer] Fee: ${Number(totalFee) / 1e18} USDC`);
    
    // If we decoded InsufficientPoolBalance, provide helpful message
    if (decodedError === 'InsufficientPoolBalance') {
      console.error(`[ShieldedRelayer] Contract has insufficient USDC balance!`);
      console.error(`[ShieldedRelayer] The contract needs ${Number(requiredAmount) / 1e18} USDC but doesn't have enough.`);
      console.error(`[ShieldedRelayer] Someone must shield USDC first to provide liquidity.`);
    }
    
    // Check if this is a "replacement transaction underpriced" error
    // This usually means the transaction was already sent successfully
    const errorDetails = error?.details || error?.cause?.details || '';
    const errorMessage = typeof error === 'string' 
      ? error 
      : error?.message || error?.shortMessage || error?.toString() || 'Unknown error';
    
    if (errorDetails === 'replacement transaction underpriced' || 
        errorMessage.toLowerCase().includes('replacement transaction underpriced')) {
      console.warn('[ShieldedRelayer] Replacement transaction underpriced - transaction may have already been sent');
      console.warn('[ShieldedRelayer] This usually means the first transaction succeeded. Checking recent transactions...');
      
      // Check if we have a recent successful transaction for this request
      let recentRequest = recentBatchUnshieldRequests.get(requestKey);
      if (!recentRequest) {
        // If requestKey doesn't match, check ALL recent transactions (within dedup window)
        // "replacement transaction underpriced" means a transaction with the same nonce already succeeded
        // Take the most recent transaction (most likely the one that succeeded)
        let mostRecent: { txHash: string; timestamp: number } | null = null;
        for (const [key, value] of recentBatchUnshieldRequests.entries()) {
          if ((now - value.timestamp) < DEDUP_WINDOW_MS) {
            if (!mostRecent || value.timestamp > mostRecent.timestamp) {
              mostRecent = value;
            }
          }
        }
        if (mostRecent) {
          recentRequest = mostRecent;
          console.log('[ShieldedRelayer] Found most recent successful transaction (different requestKey):', recentRequest.txHash);
        }
      }
      
      if (recentRequest) {
        console.log('[ShieldedRelayer] Found previous successful transaction, returning it:', recentRequest.txHash);
        return res.status(200).json({
          success: true,
          txHash: recentRequest.txHash,
          explorerUrl: `https://blockscout.testnet.dogeos.com/tx/${recentRequest.txHash}`,
          batchSize: req.body.proofs?.length || 0,
          totalAmount: req.body.amounts?.reduce((sum: string, amt: string) => (BigInt(sum) + BigInt(amt)).toString(), '0') || '0',
          duplicate: true,
          message: 'Transaction was already submitted successfully',
        });
      }
      
      // If no recent request found, return helpful error
      return res.status(400).json(createErrorResponse(ErrorCode.INVALID_PARAMS, {
        message: 'Transaction may have already been submitted. Please check your transaction history.',
        details: 'A transaction with the same parameters was likely already sent successfully. The "replacement transaction underpriced" error indicates the first transaction succeeded.',
        suggestion: 'Check your transaction history or wait a moment and try again if the transaction is still pending.',
      }));
    }
    
    // Check if decoded error indicates insufficient balance
    if (decodedError === 'InsufficientPoolBalance') {
      return res.status(400).json(createErrorResponse(ErrorCode.INSUFFICIENT_POOL_LIQUIDITY, {
        message: 'Insufficient pool liquidity',
        details: 'The contract does not have enough USDC tokens to fulfill this unshield. Someone must shield USDC first to provide liquidity.',
        suggestion: 'The pool needs more USDC liquidity. Please shield USDC tokens first, or try unshielding a smaller amount.',
      }));
    }
    
    // Map contract errors - convert error to string first
    const errorCode = mapContractErrorToCode(errorMessage || decodedError);
    
    return res.status(400).json(createErrorResponse(errorCode, {
      message: decodedError || errorMessage,
      details: error?.shortMessage || error?.message || errorMessage || decodedError,
    }));
  }
});


