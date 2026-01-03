// @ts-nocheck
/**
 * Dogenado Backend - Combined Entry Point
 * 
 * Runs both indexer and relayer in a single process.
 * For production, run them separately for better reliability.
 */

import { createPublicClient, createWalletClient, http, webSocket, type Address, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import express from 'express';
import cors from 'cors';
import { config, MixerPoolABI, dogeosTestnet } from './config.js';
import { MerkleTree } from './merkle/MerkleTree.js';
import { 
  createSecureWallet, 
  createErrorResponse, 
  getSecurityWarnings,
  ERROR_CODES,
  type SecureWallet,
  type TransactionResult 
} from './utils/secure-wallet.js';
import {
  saveWalletDeposits,
  loadWalletDeposits,
  saveSyncState,
  loadSyncState,
  saveNullifiers,
  loadNullifiers,
  type WalletDepositMapping,
} from './utils/persistence.js';
import { 
  getMetrics, 
  recordTransaction, 
  updateRelayerBalance, 
  runHealthCheck 
} from './utils/monitoring.js';
import { 
  getBestRpcUrl, 
  getEndpointStatus, 
  withFallback 
} from './utils/rpc-fallback.js';
import { getGasPrice, getEIP1559GasPrice } from './utils/gas-manager.js';
import { initStorage } from './database/storage.js';
import { shieldedRouter } from './shielded/shielded-routes.js';
import { 
  initializeShieldedPool, 
  syncShieldedPool, 
  watchShieldedPool,
  getShieldedPool,
} from './shielded/shielded-indexer.js';

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██████╗  ██████╗  ██████╗ ███████╗███╗   ██╗ █████╗ ██████╗ ██████╗ ║
║     ██╔══██╗██╔═══██╗██╔════╝ ██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔═══██╗║
║     ██║  ██║██║   ██║██║  ███╗█████╗  ██╔██╗ ██║███████║██║  ██║██║   ██║║
║     ██║  ██║██║   ██║██║   ██║██╔══╝  ██║╚██╗██║██╔══██║██║  ██║██║   ██║║
║     ██████╔╝╚██████╔╝╚██████╔╝███████╗██║ ╚████║██║  ██║██████╔╝╚██████╔╝║
║     ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ║
║                                                               ║
║                  Privacy Pool for DogeOS                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// App setup
const app = express();

// CORS configuration - allow frontend domains
const allowedOrigins = [
  'https://dogenado.cash',
  'https://www.dogenado.cash',
  'http://localhost:3000', // Development
  'http://localhost:3001', // Development
];

// Allow all Vercel preview URLs
const isVercelPreview = (origin: string) => 
  origin.includes('.vercel.app') || 
  origin.includes('vercel.app');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow all listed origins and Vercel previews
    if (allowedOrigins.includes(origin) || isVercelPreview(origin)) {
      callback(null, true);
    } else {
      // Still allow but log for monitoring
      console.log(`[CORS] Allowing unlisted origin: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use(express.json());

// ============ Rate Limiting ============

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limit store (use Redis for production with multiple instances)
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Rate limit configuration per endpoint type
const RATE_LIMITS = {
  relay: { maxRequests: 5, windowMs: 60000 },      // 5 requests per minute for relay
  schedule: { maxRequests: 10, windowMs: 60000 },  // 10 requests per minute for scheduling
  api: { maxRequests: 100, windowMs: 60000 },      // 100 requests per minute for general API
  health: { maxRequests: 1000, windowMs: 60000 },  // 1000 requests per minute for health checks
};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Rate limiting middleware factory
function createRateLimiter(type: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[type];
  
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Get client identifier (IP + endpoint for more granular limiting)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Skip rate limiting for localhost (development)
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      return next();
    }
    
    const key = `${type}:${clientIp}`;
    
    const now = Date.now();
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = { count: 1, resetTime: now + config.windowMs };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
    
    if (entry.count > config.maxRequests) {
      console.warn(`[RateLimit] ${type} limit exceeded for ${clientIp}`);
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }
    
    next();
  };
}

// Create rate limiters
const relayLimiter = createRateLimiter('relay');
const scheduleLimiter = createRateLimiter('schedule');
const apiLimiter = createRateLimiter('api');
const healthLimiter = createRateLimiter('health');

// State
interface DepositInfo {
  leafIndex: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  depositor?: string; // Wallet address that made the deposit
}

// Track deposits by wallet address
const walletDeposits: Map<string, Array<{ poolAddress: string; commitment: string; info: DepositInfo }>> = new Map();

// Track scheduled withdrawals by wallet
interface ScheduledWithdrawalInfo {
  nullifierHash: string;
  poolAddress: string;
  recipient: string;
  relayer: string;
  fee: string;
  unlockTime: number;
  status: 'pending' | 'executed';
  scheduledTxHash?: string;
  executedTxHash?: string;
}
const walletScheduledWithdrawals: Map<string, ScheduledWithdrawalInfo[]> = new Map();

// Track instant withdrawals by recipient address
interface WithdrawalRecord {
  poolAddress: string;
  recipient: string;
  nullifierHash: string;
  relayer: string;
  fee: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}
const walletWithdrawals: Map<string, WithdrawalRecord[]> = new Map();

interface PoolState {
  address: string;
  tree: MerkleTree;
  deposits: Map<string, DepositInfo>; // commitment -> info
  nullifiers: Set<string>;
  lastSyncBlock: number;
}

const pools: Map<string, PoolState> = new Map();

// Create viem client (HTTP for regular calls)
const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(config.rpcUrl),
});

// Create WebSocket client for real-time event watching (faster than HTTP polling)
let wsClient: ReturnType<typeof createPublicClient> | null = null;
try {
  if (config.wsRpcUrl) {
    wsClient = createPublicClient({
      chain: dogeosTestnet,
      transport: webSocket(config.wsRpcUrl),
    });
    console.log('[Indexer] WebSocket client initialized for real-time events');
  }
} catch (error) {
  console.warn('[Indexer] WebSocket initialization failed, falling back to HTTP polling:', error);
}

// Create secure wallet for relayer (with retry logic and nonce management)
let secureWallet: SecureWallet | null = null;
let relayerAddress: Address | null = null;

// Legacy wallet client for compatibility (will be phased out)
let walletClient: ReturnType<typeof createWalletClient> | null = null;

if (process.env.RELAYER_PRIVATE_KEY) {
  // Initialize secure wallet with retry logic
  secureWallet = createSecureWallet(config.rpcUrl);
  
  if (secureWallet) {
    relayerAddress = secureWallet.address;
    console.log(`[Relayer] Secure wallet initialized: ${relayerAddress}`);
    
    // Also create legacy wallet client for backward compatibility
    const account = privateKeyToAccount(`0x${process.env.RELAYER_PRIVATE_KEY.replace('0x', '')}`);
    walletClient = createWalletClient({
      account,
      chain: dogeosTestnet,
      transport: http(config.rpcUrl),
    });
  }
  
  // Log security warnings
  const warnings = getSecurityWarnings();
  if (warnings.length > 0) {
    console.log('\n⚠️  SECURITY WARNINGS:');
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }
} else {
  console.warn('⚠️  RELAYER_PRIVATE_KEY not set - relayer functionality disabled');
}

// ============ Event ABI ============

const DepositEventABI = parseAbiItem('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)');
const WithdrawalEventABI = parseAbiItem('event Withdrawal(address indexed recipient, bytes32 indexed nullifierHash, address indexed relayer, uint256 fee)');

// ============ Pool Management ============

async function initializePool(address: string): Promise<PoolState> {
  const tree = new MerkleTree(config.merkleTreeDepth);
  await tree.initialize();
  
  const state: PoolState = {
    address,
    tree,
    deposits: new Map(),
    nullifiers: new Set(),
    lastSyncBlock: 0,
  };
  pools.set(address.toLowerCase(), state);
  console.log(`[Indexer] Initialized pool: ${address}`);
  return state;
}

async function syncPoolFromChain(pool: PoolState): Promise<void> {
  const address = pool.address as Address;
  console.log(`[Indexer] Syncing pool ${address.slice(0, 10)}... from block ${pool.lastSyncBlock}`);

  try {
    // Get current block
    const currentBlock = await publicClient.getBlockNumber();
    
    // Fetch Deposit events
    const depositLogs = await publicClient.getLogs({
      address,
      event: DepositEventABI,
      fromBlock: BigInt(pool.lastSyncBlock),
      toBlock: currentBlock,
    });

    console.log(`[Indexer] Found ${depositLogs.length} deposit events`);

    // Process each deposit
    for (const log of depositLogs) {
      const commitment = log.args.commitment!;
      const leafIndex = Number(log.args.leafIndex!);
      const timestamp = Number(log.args.timestamp!);
      const txHash = log.transactionHash!;
      
      // Add to tree if not already present
      if (!pool.deposits.has(commitment)) {
        const commitmentBigInt = BigInt(commitment);
        pool.tree.insert(commitmentBigInt);
        
        const depositInfo: DepositInfo = {
          leafIndex,
          timestamp,
          blockNumber: Number(log.blockNumber),
          txHash,
        };
        pool.deposits.set(commitment, depositInfo);
        
        // Try to get depositor address from transaction
        try {
          const tx = await publicClient.getTransaction({ hash: txHash });
          if (tx && tx.from) {
            const depositorAddress = tx.from.toLowerCase();
            const existing = walletDeposits.get(depositorAddress) || [];
            
            // Check if already tracked
            if (!existing.some(d => d.commitment === commitment)) {
              existing.push({
                poolAddress: address,
                commitment,
                info: depositInfo,
              });
              walletDeposits.set(depositorAddress, existing);
              console.log(`[Indexer] Tracked deposit for wallet ${depositorAddress.slice(0, 10)}...`);
            }
          }
        } catch (err) {
          console.log(`[Indexer] Could not fetch tx ${txHash.slice(0, 10)}... for depositor`);
        }
        
        console.log(`[Indexer] Added deposit ${leafIndex}: ${commitment.slice(0, 18)}...`);
      }
    }

    // Fetch Withdrawal events
    const withdrawalLogs = await publicClient.getLogs({
      address,
      event: WithdrawalEventABI,
      fromBlock: BigInt(pool.lastSyncBlock),
      toBlock: currentBlock,
    });

    console.log(`[Indexer] Found ${withdrawalLogs.length} withdrawal events`);

    // Track nullifiers and record withdrawals by recipient
    for (const log of withdrawalLogs) {
      const nullifierHash = log.args.nullifierHash!;
      const recipient = log.args.recipient!;
      const relayer = log.args.relayer!;
      const fee = log.args.fee!;
      
      pool.nullifiers.add(nullifierHash);
      
      // Track withdrawal by recipient
      const recipientLower = recipient.toLowerCase();
      const existing = walletWithdrawals.get(recipientLower) || [];
      
      // Check if already tracked
      if (!existing.some(w => w.nullifierHash === nullifierHash)) {
        existing.push({
          poolAddress: address,
          recipient,
          nullifierHash,
          relayer,
          fee: fee.toString(),
          timestamp: Math.floor(Date.now() / 1000), // Use current time as approx
          txHash: log.transactionHash || '',
          blockNumber: Number(log.blockNumber || 0),
        });
        walletWithdrawals.set(recipientLower, existing);
      }
    }

    pool.lastSyncBlock = Number(currentBlock);
    console.log(`[Indexer] Pool synced to block ${currentBlock}. Total deposits: ${pool.tree.getLeafCount()}`);
  } catch (error: any) {
    console.error(`[Indexer] Sync error for ${address}:`, error.message);
  }
}

// Watch for new events
async function watchPool(pool: PoolState): Promise<void> {
  const address = pool.address as Address;
  
  // Use WebSocket client if available (real-time), otherwise fallback to HTTP (polling)
  const eventClient = wsClient || publicClient;
  
  // Watch for deposits
  eventClient.watchContractEvent({
    address,
    abi: [DepositEventABI],
    eventName: 'Deposit',
    onLogs: async (logs) => {
      for (const log of logs) {
        const commitment = log.args.commitment!;
        const leafIndex = Number(log.args.leafIndex!);
        const timestamp = Number(log.args.timestamp!);
        
        if (!pool.deposits.has(commitment)) {
          const commitmentBigInt = BigInt(commitment);
          pool.tree.insert(commitmentBigInt);
          
          // Try to get depositor from transaction
          let depositor: string | undefined;
          try {
            const tx = await publicClient.getTransaction({ hash: log.transactionHash! });
            depositor = tx.from.toLowerCase();
          } catch (e) {
            // Ignore errors
          }
          
          const depositInfo: DepositInfo = {
            leafIndex,
            timestamp,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash!,
            depositor,
          };
          
          pool.deposits.set(commitment, depositInfo);
          
          // Track by wallet
          if (depositor) {
            const walletKey = depositor.toLowerCase();
            if (!walletDeposits.has(walletKey)) {
              walletDeposits.set(walletKey, []);
            }
            walletDeposits.get(walletKey)!.push({
              poolAddress: address,
              commitment,
              info: depositInfo,
            });
          }
          
          console.log(`[Indexer] NEW deposit ${leafIndex} from ${depositor?.slice(0, 10) || 'unknown'}`);
        }
      }
    },
  });

  // Watch for withdrawals
  eventClient.watchContractEvent({
    address,
    abi: [WithdrawalEventABI],
    eventName: 'Withdrawal',
    onLogs: (logs) => {
      for (const log of logs) {
        const nullifierHash = log.args.nullifierHash!;
        pool.nullifiers.add(nullifierHash);
        console.log(`[Indexer] NEW withdrawal: ${nullifierHash.slice(0, 18)}...`);
      }
    },
  });

  console.log(`[Indexer] Watching pool ${address.slice(0, 10)}... for events`);
}

// ============ API Routes ============

// Get all pools
app.get('/api/pools', apiLimiter, (req, res) => {
  const poolList = Array.from(pools.entries()).map(([address, state]) => ({
    address,
    depositsCount: state.tree.getLeafCount(),
    withdrawalsCount: state.nullifiers.size,
    currentRoot: '0x' + state.tree.getRoot().toString(16).padStart(64, '0'),
  }));
  res.json(poolList);
});

// Native pool ABI (MixerPoolNative returns 3 values, not 4)
const MixerPoolNativeABI = [
  {
    type: 'function',
    name: 'getPoolInfo',
    inputs: [],
    outputs: [
      { name: '_denomination', type: 'uint256' },
      { name: '_depositsCount', type: 'uint256' },
      { name: '_root', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },
] as const;

// Get pool info
app.get('/api/pool/:address', apiLimiter, async (req, res) => {
  const address = req.params.address as Address;
  
  try {
    let token: string = '0x0000000000000000000000000000000000000000';
    let denomination: string;
    let depositsCount: number;
    let root: string;
    
    // Try ERC20 pool ABI first (4 return values)
    try {
      const poolInfo = await publicClient.readContract({
        address,
        abi: MixerPoolABI,
        functionName: 'getPoolInfo',
      });
      token = poolInfo[0] as string;
      denomination = poolInfo[1].toString();
      depositsCount = Number(poolInfo[2]);
      root = poolInfo[3] as string;
    } catch {
      // Fallback to native pool ABI (3 return values)
      const nativePoolInfo = await publicClient.readContract({
        address,
        abi: MixerPoolNativeABI,
        functionName: 'getPoolInfo',
      });
      token = '0x0000000000000000000000000000000000000000'; // Native token
      denomination = nativePoolInfo[0].toString();
      depositsCount = Number(nativePoolInfo[1]);
      root = nativePoolInfo[2] as string;
    }

    const pool = pools.get(address.toLowerCase());
    
    // Get recent deposits (last 2)
    const deposits: Array<{ commitment: string; leafIndex: number; timestamp: number; blockNumber: number; txHash?: string }> = [];
    if (pool) {
      const depositEntries = Array.from(pool.deposits.entries());
      // Sort by leafIndex descending (newest first)
      depositEntries.sort((a, b) => b[1].leafIndex - a[1].leafIndex);
      // Take last 2
      depositEntries.slice(0, 2).forEach(([commitment, info]) => {
        deposits.push({
          commitment,
          leafIndex: info.leafIndex,
          timestamp: info.timestamp,
          blockNumber: Number(info.blockNumber),
          txHash: info.txHash,
        });
      });
    }
    
    res.json({
      token,
      denomination,
      depositsCount,
      root,
      // Local state
      localDepositsCount: pool?.tree.getLeafCount() || 0,
      localRoot: pool ? '0x' + pool.tree.getRoot().toString(16).padStart(64, '0') : null,
      // Recent deposits for statistics
      deposits,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest root
app.get('/api/pool/:address/root', apiLimiter, (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  res.json({
    root: '0x' + pool.tree.getRoot().toString(16).padStart(64, '0'),
    depositsCount: pool.tree.getLeafCount(),
  });
});

// Get Merkle path
app.get('/api/pool/:address/path/:leafIndex', apiLimiter, async (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const leafIndex = parseInt(req.params.leafIndex);
  if (isNaN(leafIndex) || leafIndex < 0 || leafIndex >= pool.tree.getLeafCount()) {
    return res.status(400).json({ error: 'Invalid leaf index' });
  }

  try {
    const path = await pool.tree.getPath(leafIndex);
    res.json({
      pathElements: path.pathElements.map(e => '0x' + e.toString(16).padStart(64, '0')),
      pathIndices: path.pathIndices,
      root: '0x' + path.root.toString(16).padStart(64, '0'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get path' });
  }
});

// Get deposit info by commitment
app.get('/api/pool/:address/deposit/:commitment', apiLimiter, (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const commitment = req.params.commitment.toLowerCase();
  const deposit = pool.deposits.get(commitment) || pool.deposits.get(commitment.replace('0x', ''));
  
  // Also try with 0x prefix
  const deposit2 = pool.deposits.get('0x' + commitment.replace('0x', ''));
  
  const found = deposit || deposit2;
  
  if (!found) {
    return res.status(404).json({ error: 'Deposit not found' });
  }

  res.json(found);
});

// Check nullifier
app.get('/api/pool/:address/nullifier/:hash', apiLimiter, (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const hash = req.params.hash.toLowerCase();
  const isSpent = pool.nullifiers.has(hash) || pool.nullifiers.has('0x' + hash.replace('0x', ''));
  res.json({ isSpent });
});

// Relay withdrawal
app.post('/api/relay', relayLimiter, async (req, res) => {
  if (!secureWallet || !relayerAddress) {
    return res.status(503).json(createErrorResponse('RELAY_NOT_CONFIGURED'));
  }

  const { pool: poolAddress, proof, root, nullifierHash, recipient, fee } = req.body;

  if (!poolAddress || !proof || !root || !nullifierHash || !recipient) {
    return res.status(400).json(createErrorResponse('INVALID_PARAMS', 'Missing required fields: pool, proof, root, nullifierHash, recipient'));
  }

  const startTime = Date.now();
  
  try {
    // Check relayer balance before processing
    const relayerBalance = await secureWallet.getBalance();
    const minBalance = BigInt(0.01 * 1e18); // Minimum 0.01 DOGE for gas
    
    if (relayerBalance < minBalance) {
      console.error(`[Relayer] Insufficient balance: ${relayerBalance} < ${minBalance}`);
      return res.status(503).json(createErrorResponse('RELAY_INSUFFICIENT_BALANCE'));
    }
    
    console.log(`[Relayer] Processing withdrawal to ${recipient} (balance: ${Number(relayerBalance) / 1e18} DOGE)`);

    // Convert proof strings to bigints
    const proofBigInts = proof.map((p: string) => BigInt(p));

    // Submit transaction
    if (!walletClient) {
      return res.status(503).json({ error: 'Wallet not initialized' });
    }
    const txHash = await walletClient.writeContract({
      chain: dogeosTestnet,
      address: poolAddress as Address,
      abi: MixerPoolABI,
      functionName: 'withdraw',
      args: [
        proofBigInts as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        root as `0x${string}`,
        nullifierHash as `0x${string}`,
        recipient as Address,
        relayerAddress,
        BigInt(fee || 0),
      ],
    });

    console.log(`[Relayer] Withdrawal submitted: ${txHash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted');
    }

    const duration = Date.now() - startTime;
    console.log(`[Relayer] Withdrawal confirmed in block ${receipt.blockNumber} (${duration}ms)`);
    recordTransaction(true, duration);

    res.json({
      txHash,
      blockNumber: Number(receipt.blockNumber),
      relayer: relayerAddress,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Relayer] Error:', error.message);
    recordTransaction(false, duration, 'TX_FAILED');
    
    // Parse error for better messages
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json(createErrorResponse('INVALID_PROOF'));
    }
    if (errorMsg.includes('InvalidMerkleRoot') || errorMsg.includes('Unknown root')) {
      return res.status(400).json(createErrorResponse('INVALID_ROOT'));
    }
    if (errorMsg.includes('NullifierSpent') || errorMsg.includes('already spent')) {
      return res.status(400).json(createErrorResponse('NULLIFIER_SPENT'));
    }
    if (errorMsg.includes('insufficient funds')) {
      return res.status(503).json(createErrorResponse('RELAY_INSUFFICIENT_BALANCE'));
    }
    
    res.status(500).json(createErrorResponse('TX_FAILED', errorMsg));
  }
});

// Schedule withdrawal (V2 pools with timelock)
app.post('/api/relay/schedule', scheduleLimiter, async (req, res) => {
  if (!secureWallet || !relayerAddress) {
    return res.status(503).json(createErrorResponse('RELAY_NOT_CONFIGURED'));
  }

  const { pool: poolAddress, proof, root, nullifierHash, recipient, fee, delay } = req.body;

  if (!poolAddress || !proof || !root || !nullifierHash || !recipient || !delay) {
    return res.status(400).json(createErrorResponse('INVALID_PARAMS', 'Missing required fields'));
  }

  // Validate delay (1 hour to 7 days)
  const delaySeconds = parseInt(delay);
  if (delaySeconds < 3600 || delaySeconds > 604800) {
    return res.status(400).json({ error: 'Delay must be between 1 hour and 7 days' });
  }

  try {
    // Check relayer balance before processing
    const relayerBalance = await publicClient.getBalance({ address: relayerAddress });
    const minBalance = BigInt(0.01 * 1e18); // Minimum 0.01 DOGE for gas
    
    if (relayerBalance < minBalance) {
      console.error(`[Relayer] Insufficient balance for scheduling`);
      return res.status(503).json({ 
        error: 'Relayer temporarily unavailable',
        message: 'Relayer balance too low for gas.'
      });
    }
    
    console.log(`[Relayer] Scheduling withdrawal to ${recipient} with ${delaySeconds}s delay`);

    const proofBigInts = proof.map((p: string) => BigInt(p));

    // Call scheduleWithdrawal on V2 pool
    const MixerPoolV2ABI = [
      {
        type: 'function',
        name: 'scheduleWithdrawal',
        inputs: [
          { name: 'proof', type: 'uint256[8]' },
          { name: 'root', type: 'bytes32' },
          { name: 'nullifierHash', type: 'bytes32' },
          { name: 'recipient', type: 'address' },
          { name: 'relayer', type: 'address' },
          { name: 'fee', type: 'uint256' },
          { name: 'delay', type: 'uint256' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ] as const;

    if (!walletClient) {
      return res.status(503).json({ error: 'Wallet not initialized' });
    }
    const txHash = await walletClient.writeContract({
      chain: dogeosTestnet,
      address: poolAddress as Address,
      abi: MixerPoolV2ABI,
      functionName: 'scheduleWithdrawal',
      args: [
        proofBigInts as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        root as `0x${string}`,
        nullifierHash as `0x${string}`,
        recipient as Address,
        relayerAddress,
        BigInt(fee || 0),
        BigInt(delaySeconds),
      ],
    });

    console.log(`[Relayer] Schedule TX submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted');
    }

    const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;

    // Track scheduled withdrawal by recipient wallet
    const recipientKey = (recipient as string).toLowerCase();
    if (!walletScheduledWithdrawals.has(recipientKey)) {
      walletScheduledWithdrawals.set(recipientKey, []);
    }
    walletScheduledWithdrawals.get(recipientKey)!.push({
      nullifierHash,
      poolAddress,
      recipient: recipientKey,
      relayer: relayerAddress!,
      fee: (fee || 0).toString(),
      unlockTime,
      status: 'pending',
      scheduledTxHash: txHash,
    });

    console.log(`[Relayer] Withdrawal scheduled for ${recipientKey}, unlocks at ${new Date(unlockTime * 1000).toISOString()}`);

    res.json({
      txHash,
      blockNumber: Number(receipt.blockNumber),
      unlockTime: unlockTime * 1000, // milliseconds for JS Date
      nullifierHash,
    });
  } catch (error: any) {
    console.error('[Relayer] Schedule error:', error.message);
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json(createErrorResponse('INVALID_PROOF'));
    }
    
    res.status(500).json(createErrorResponse('TX_FAILED', errorMsg));
  }
});

// Execute scheduled withdrawal
app.post('/api/relay/execute', relayLimiter, async (req, res) => {
  if (!secureWallet || !relayerAddress) {
    return res.status(503).json(createErrorResponse('RELAY_NOT_CONFIGURED'));
  }

  const { pool: poolAddress, nullifierHash } = req.body;

  if (!poolAddress || !nullifierHash) {
    return res.status(400).json({ error: 'Missing pool or nullifierHash' });
  }

  try {
    console.log(`[Relayer] Executing scheduled withdrawal: ${nullifierHash}`);

    const MixerPoolV2ABI = [
      {
        type: 'function',
        name: 'executeScheduledWithdrawal',
        inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ] as const;

    if (!walletClient) {
      return res.status(503).json({ error: 'Wallet not initialized' });
    }
    const txHash = await walletClient.writeContract({
      chain: dogeosTestnet,
      address: poolAddress as Address,
      abi: MixerPoolV2ABI,
      functionName: 'executeScheduledWithdrawal',
      args: [nullifierHash as `0x${string}`],
    });

    console.log(`[Relayer] Execute TX submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted');
    }

    console.log(`[Relayer] Scheduled withdrawal executed in block ${receipt.blockNumber}`);

    // Update status in our tracking
    for (const [walletKey, withdrawals] of walletScheduledWithdrawals.entries()) {
      const found = withdrawals.find(w => w.nullifierHash.toLowerCase() === nullifierHash.toLowerCase());
      if (found) {
        found.status = 'executed';
        found.executedTxHash = txHash;
        break;
      }
    }

    res.json({
      txHash,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (error: any) {
    console.error('[Relayer] Execute error:', error.message);
    res.status(500).json(createErrorResponse('TX_FAILED', error.message));
  }
});

// Get scheduled withdrawal status
app.get('/api/pool/:address/scheduled/:nullifierHash', apiLimiter, async (req, res) => {
  const poolAddress = req.params.address;
  const nullifierHash = req.params.nullifierHash;

  try {
    const MixerPoolV2ABI = [
      {
        type: 'function',
        name: 'getWithdrawalStatus',
        inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
        outputs: [
          { name: 'timeRemaining', type: 'uint256' },
          { name: 'unlockTime', type: 'uint256' },
          { name: 'isReady', type: 'bool' },
          { name: 'executed', type: 'bool' },
        ],
        stateMutability: 'view',
      },
    ] as const;

    const result = await publicClient.readContract({
      address: poolAddress as Address,
      abi: MixerPoolV2ABI,
      functionName: 'getWithdrawalStatus',
      args: [nullifierHash as `0x${string}`],
    });

    res.json({
      exists: result[1] > 0n, // unlockTime > 0 means it exists
      timeRemaining: Number(result[0]),
      unlockTime: Number(result[1]),
      isReady: result[2],
      executed: result[3],
    });
  } catch (error: any) {
    console.error('[Pool] Status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Force sync pool
app.post('/api/pool/:address/sync', apiLimiter, async (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  try {
    await syncPoolFromChain(pool);
    res.json({
      success: true,
      depositsCount: pool.tree.getLeafCount(),
      nullifiersCount: pool.nullifiers.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', healthLimiter, async (req, res) => {
  let relayerBalance = null;
  let relayerHealthy = false;
  
  if (relayerAddress) {
    try {
      const balance = await publicClient.getBalance({ address: relayerAddress });
      const balanceDoge = Number(balance) / 1e18;
      relayerBalance = balanceDoge.toFixed(4);
      relayerHealthy = balance >= BigInt(0.01 * 1e18); // At least 0.01 DOGE
      
      // Update monitoring
      updateRelayerBalance(balanceDoge);
    } catch (e) {
      console.error('[Health] Failed to fetch relayer balance');
    }
  }
  
  const securityWarnings = getSecurityWarnings();
  const metrics = getMetrics();
  const rpcStatus = getEndpointStatus();
  
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    chain: 'DogeOS Chikyū Testnet',
    chainId: config.chainId,
    pools: pools.size,
    relayerAvailable: !!secureWallet && relayerHealthy,
    relayerAddress: relayerAddress || null,
    relayerBalance: relayerBalance,
    relayerHealthy: relayerHealthy,
    securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined,
    // Transaction metrics
    metrics: {
      transactions: metrics.transactions,
      health: metrics.health,
    },
    // RPC endpoint status
    rpcEndpoints: rpcStatus.map(e => ({
      name: e.name,
      healthy: e.healthy,
      priority: e.priority,
    })),
    // Rate limits
    rateLimits: {
      relay: `${RATE_LIMITS.relay.maxRequests} requests per ${RATE_LIMITS.relay.windowMs / 1000}s`,
      schedule: `${RATE_LIMITS.schedule.maxRequests} requests per ${RATE_LIMITS.schedule.windowMs / 1000}s`,
      api: `${RATE_LIMITS.api.maxRequests} requests per ${RATE_LIMITS.api.windowMs / 1000}s`,
    },
  });
});

// Detailed metrics endpoint (for monitoring dashboards)
app.get('/api/metrics', apiLimiter, (req, res) => {
  const metrics = getMetrics();
  const rpcStatus = getEndpointStatus();
  
  res.json({
    timestamp: Date.now(),
    transactions: metrics.transactions,
    relayer: metrics.relayer,
    health: metrics.health,
    errors: metrics.errors,
    rpcEndpoints: rpcStatus,
    pools: Array.from(pools.entries()).map(([address, pool]) => ({
      address,
      deposits: pool.tree.getLeafCount(),
      nullifiers: pool.nullifiers.size,
      lastSyncBlock: pool.lastSyncBlock,
    })),
  });
});

// Get deposits for a specific wallet
app.get('/api/wallet/:address/deposits', apiLimiter, (req, res) => {
  const walletAddress = req.params.address.toLowerCase();
  const deposits = walletDeposits.get(walletAddress) || [];
  
  // Sort by timestamp descending (newest first)
  const sorted = [...deposits].sort((a, b) => b.info.timestamp - a.info.timestamp);
  
  // Check pool status for each deposit
  const depositsWithStatus = sorted.map(d => {
    const pool = pools.get(d.poolAddress.toLowerCase());
    const totalWithdrawals = pool ? pool.nullifiers.size : 0;
    const totalDeposits = pool ? pool.deposits.size : 0;
    
    return {
      poolAddress: d.poolAddress,
      commitment: d.commitment,
      leafIndex: d.info.leafIndex,
      timestamp: d.info.timestamp,
      blockNumber: d.info.blockNumber,
      txHash: d.info.txHash,
      poolStats: {
        totalDeposits,
        totalWithdrawals,
      }
    };
  });
  
  res.json({
    wallet: walletAddress,
    count: deposits.length,
    deposits: depositsWithStatus,
  });
});

// Check if a specific nullifierHash has been spent
app.get('/api/nullifier/:poolAddress/:nullifierHash', apiLimiter, (req, res) => {
  const { poolAddress, nullifierHash } = req.params;
  const pool = pools.get(poolAddress.toLowerCase());
  
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }
  
  const isSpent = pool.nullifiers.has(nullifierHash);
  res.json({ nullifierHash, isSpent });
});

// Get inbox summary (for notification badge)
app.get('/api/wallet/:address/inbox-summary', apiLimiter, (req, res) => {
  const walletAddress = req.params.address.toLowerCase();
  
  const deposits = walletDeposits.get(walletAddress) || [];
  const scheduled = walletScheduledWithdrawals.get(walletAddress) || [];
  const withdrawals = walletWithdrawals.get(walletAddress) || [];
  
  // Count ready-to-execute withdrawals
  const now = Math.floor(Date.now() / 1000);
  const readyCount = scheduled.filter(sw => 
    sw.status !== 'executed' && sw.unlockTime <= now
  ).length;
  
  // Count pending scheduled withdrawals
  const pendingCount = scheduled.filter(sw => 
    sw.status !== 'executed' && sw.unlockTime > now
  ).length;
  
  // Recent activity (last 24 hours)
  const oneDayAgo = now - 86400;
  const recentDeposits = deposits.filter(d => d.info.timestamp > oneDayAgo).length;
  const recentWithdrawals = withdrawals.filter(w => w.timestamp > oneDayAgo).length;
  
  res.json({
    wallet: walletAddress,
    totalDeposits: deposits.length,
    totalWithdrawals: withdrawals.length,
    readyToExecute: readyCount,
    pendingScheduled: pendingCount,
    recentActivity: recentDeposits + recentWithdrawals,
    hasNotifications: readyCount > 0 || recentDeposits > 0 || recentWithdrawals > 0,
  });
});

// Get scheduled withdrawals for a specific wallet (by recipient)
app.get('/api/wallet/:address/scheduled', apiLimiter, (req, res) => {
  const walletAddress = req.params.address.toLowerCase();
  const scheduled = walletScheduledWithdrawals.get(walletAddress) || [];
  
  // Sort by unlockTime ascending
  const sorted = [...scheduled].sort((a, b) => a.unlockTime - b.unlockTime);
  
  res.json({
    wallet: walletAddress,
    count: scheduled.length,
    scheduled: sorted,
  });
});

// Get withdrawal history for a specific wallet (by recipient address)
app.get('/api/wallet/:address/withdrawals', apiLimiter, (req, res) => {
  const walletAddress = req.params.address.toLowerCase();
  const withdrawals = walletWithdrawals.get(walletAddress) || [];
  
  // Sort by timestamp descending (newest first)
  const sorted = [...withdrawals].sort((a, b) => b.timestamp - a.timestamp);
  
  res.json({
    wallet: walletAddress,
    count: withdrawals.length,
    withdrawals: sorted,
  });
});

// Network info
app.get('/api/network', apiLimiter, (req, res) => {
  res.json({
    name: 'DogeOS Chikyū Testnet',
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    wsRpcUrl: config.wsRpcUrl,
    blockExplorer: 'https://blockscout.testnet.dogeos.com',
    tokens: config.tokens,
  });
});

// ============ Shielded Pool Routes ============
// Mount shielded pool API routes
app.use('/api/shielded', apiLimiter, shieldedRouter);

// ============ Main ============

async function main() {
  console.log('[Backend] Starting Dogenado Backend...');
  console.log(`[Backend] Chain: DogeOS Chikyū Testnet (${config.chainId})`);
  console.log(`[Backend] RPC: ${config.rpcUrl}`);

  // Initialize storage (database or fallback to file/memory)
  const storageType = await initStorage();
  console.log(`[Backend] Storage initialized: ${storageType}`);

  // Start server first (non-blocking)
  app.listen(config.server.port, config.server.host, () => {
    console.log(`[Backend] Server running on http://${config.server.host}:${config.server.port}`);
    console.log('[Backend] Endpoints:');
    console.log('  GET  /api/health        - Health check');
    console.log('  GET  /api/network       - Network info');
    console.log('  GET  /api/pools         - List pools');
    console.log('  GET  /api/pool/:addr    - Pool info');
    console.log('  GET  /api/pool/:addr/root        - Latest root');
    console.log('  GET  /api/pool/:addr/path/:idx   - Merkle path');
    console.log('  GET  /api/pool/:addr/deposit/:commitment - Deposit info');
    console.log('  GET  /api/pool/:addr/nullifier/:hash - Check nullifier');
    console.log('  POST /api/pool/:addr/sync - Force sync');
    console.log('  POST /api/relay         - Submit withdrawal (relayer)');
    console.log('');
    console.log('[Shielded Pool Endpoints]');
    console.log('  GET  /api/shielded/pool/:addr      - Shielded pool info');
    console.log('  GET  /api/shielded/pool/:addr/root - Merkle root');
    console.log('  GET  /api/shielded/pool/:addr/path/:idx - Merkle path');
    console.log('  GET  /api/shielded/pool/:addr/memos - Transfer memos (discovery)');
    console.log('  POST /api/shielded/discover - Discover notes');
  });

  // Initialize pools in background (non-blocking)
  const poolAddresses = Object.values(config.contracts.pools).filter(Boolean) as string[];
  
  console.log(`[Backend] Pool addresses configured: ${poolAddresses.length}`);
  poolAddresses.forEach((addr, i) => console.log(`  Pool ${i + 1}: ${addr}`));
  
  // Initialize shielded pool if configured
  const shieldedPoolAddress = process.env.SHIELDED_POOL_ADDRESS;
  if (shieldedPoolAddress) {
    console.log(`[ShieldedPool] Initializing: ${shieldedPoolAddress}`);
    initializeShieldedPool(shieldedPoolAddress, config.merkleTreeDepth).then(async (pool) => {
      try {
        await syncShieldedPool(pool, publicClient);
        console.log(`[ShieldedPool] Synced successfully!`);
        watchShieldedPool(pool, publicClient);
      } catch (err: any) {
        console.error(`[ShieldedPool] Failed to sync:`, err.message);
      }
    }).catch((err: any) => {
      console.error(`[ShieldedPool] Failed to initialize:`, err.message);
    });
  } else {
    console.log('[ShieldedPool] Not configured. Set SHIELDED_POOL_ADDRESS env var after deployment.');
  }

  if (poolAddresses.length === 0) {
    console.log('[Backend] No mixer pools configured yet.');
    console.log('[Backend] Deploy contracts and set POOL_100_USDC, POOL_1000_USDC env vars.');
  } else {
    // Initialize and sync pools asynchronously
    for (const address of poolAddresses) {
      console.log(`[Indexer] Initializing pool ${address}...`);
      initializePool(address).then(async (pool) => {
        console.log(`[Indexer] Pool ${address} initialized, starting sync...`);
        try {
          await syncPoolFromChain(pool);
          console.log(`[Indexer] Pool ${address} synced successfully!`);
          watchPool(pool);
        } catch (err: any) {
          console.error(`[Indexer] Failed to sync pool ${address}:`, err.message);
        }
      }).catch((err: any) => {
        console.error(`[Indexer] Failed to initialize pool ${address}:`, err.message);
      });
    }
  }
}

main().catch(console.error);
