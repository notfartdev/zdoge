/**
 * Dogenado Indexer Service
 * 
 * Listens to blockchain events and maintains:
 * - Merkle tree state
 * - Deposit history
 * - Root history
 * - Nullifier tracking
 */

import { createPublicClient, http, webSocket, parseAbiItem, type Log } from 'viem';
import express from 'express';
import cors from 'cors';
import { config, MixerPoolABI, dogeosTestnet } from '../config.js';
import { MerkleTree } from '../merkle/MerkleTree.js';

// State
interface PoolState {
  address: string;
  tree: MerkleTree;
  deposits: Map<string, { leafIndex: number; timestamp: number; blockNumber: bigint }>;
  nullifiers: Set<string>;
  rootHistory: string[];
}

const pools: Map<string, PoolState> = new Map();

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create viem client
const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(config.rpcUrl),
});

// WebSocket client for real-time events
let wsClient: ReturnType<typeof createPublicClient> | null = null;

/**
 * Initialize pool state
 */
function initializePool(address: string): PoolState {
  const state: PoolState = {
    address,
    tree: new MerkleTree(config.merkleTreeDepth),
    deposits: new Map(),
    nullifiers: new Set(),
    rootHistory: [],
  };
  pools.set(address.toLowerCase(), state);
  console.log(`[Indexer] Initialized pool: ${address}`);
  return state;
}

/**
 * Process Deposit event
 */
function processDeposit(
  poolAddress: string,
  commitment: string,
  leafIndex: bigint,
  timestamp: bigint,
  blockNumber: bigint
): void {
  const pool = pools.get(poolAddress.toLowerCase());
  if (!pool) {
    console.warn(`[Indexer] Unknown pool: ${poolAddress}`);
    return;
  }

  // Add to Merkle tree
  const commitmentBigInt = BigInt(commitment);
  pool.tree.insert(commitmentBigInt);
  
  // Store deposit info
  pool.deposits.set(commitment, {
    leafIndex: Number(leafIndex),
    timestamp: Number(timestamp),
    blockNumber,
  });

  // Update root history
  const newRoot = pool.tree.getRoot().toString();
  pool.rootHistory.push(newRoot);
  
  // Keep last 30 roots
  if (pool.rootHistory.length > 30) {
    pool.rootHistory.shift();
  }

  console.log(`[Indexer] Deposit: ${commitment.slice(0, 10)}... at index ${leafIndex}`);
}

/**
 * Process Withdrawal event
 */
function processWithdrawal(
  poolAddress: string,
  nullifierHash: string
): void {
  const pool = pools.get(poolAddress.toLowerCase());
  if (!pool) return;

  pool.nullifiers.add(nullifierHash);
  console.log(`[Indexer] Withdrawal: nullifier ${nullifierHash.slice(0, 10)}...`);
}

/**
 * Sync historical events for a pool
 */
async function syncPool(poolAddress: string): Promise<void> {
  console.log(`[Indexer] Syncing pool: ${poolAddress}`);
  
  const pool = pools.get(poolAddress.toLowerCase()) || initializePool(poolAddress);

  try {
    // Get deposit events
    const depositLogs = await publicClient.getLogs({
      address: poolAddress as `0x${string}`,
      event: parseAbiItem('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)'),
      fromBlock: 0n,
      toBlock: 'latest',
    });

    console.log(`[Indexer] Found ${depositLogs.length} historical deposits`);

    // Process in order
    for (const log of depositLogs) {
      const { commitment, leafIndex, timestamp } = log.args as {
        commitment: string;
        leafIndex: bigint;
        timestamp: bigint;
      };
      processDeposit(poolAddress, commitment, leafIndex, timestamp, log.blockNumber);
    }

    // Get withdrawal events
    const withdrawalLogs = await publicClient.getLogs({
      address: poolAddress as `0x${string}`,
      event: parseAbiItem('event Withdrawal(address indexed recipient, bytes32 indexed nullifierHash, address indexed relayer, uint256 fee)'),
      fromBlock: 0n,
      toBlock: 'latest',
    });

    console.log(`[Indexer] Found ${withdrawalLogs.length} historical withdrawals`);

    for (const log of withdrawalLogs) {
      const { nullifierHash } = log.args as { nullifierHash: string };
      processWithdrawal(poolAddress, nullifierHash);
    }

    console.log(`[Indexer] Pool synced: ${pool.tree.getLeafCount()} deposits, ${pool.nullifiers.size} withdrawals`);
  } catch (error) {
    console.error(`[Indexer] Sync error:`, error);
  }
}

/**
 * Start real-time event watching
 */
async function watchPool(poolAddress: string): Promise<void> {
  console.log(`[Indexer] Watching pool: ${poolAddress}`);

  // Watch Deposit events
  publicClient.watchContractEvent({
    address: poolAddress as `0x${string}`,
    abi: MixerPoolABI,
    eventName: 'Deposit',
    onLogs: (logs) => {
      for (const log of logs) {
        const { commitment, leafIndex, timestamp } = log.args;
        if (commitment && leafIndex !== undefined && timestamp !== undefined) {
          processDeposit(poolAddress, commitment, leafIndex, timestamp, log.blockNumber);
        }
      }
    },
  });

  // Watch Withdrawal events
  publicClient.watchContractEvent({
    address: poolAddress as `0x${string}`,
    abi: MixerPoolABI,
    eventName: 'Withdrawal',
    onLogs: (logs) => {
      for (const log of logs) {
        const { nullifierHash } = log.args;
        if (nullifierHash) {
          processWithdrawal(poolAddress, nullifierHash);
        }
      }
    },
  });
}

// ============ API Routes ============

/**
 * GET /pools
 * List all indexed pools
 */
app.get('/pools', (req, res) => {
  const poolList = Array.from(pools.entries()).map(([address, state]) => ({
    address,
    depositsCount: state.tree.getLeafCount(),
    withdrawalsCount: state.nullifiers.size,
    currentRoot: state.tree.getRoot().toString(),
  }));
  res.json(poolList);
});

/**
 * GET /pool/:address/root/latest
 * Get latest Merkle root
 */
app.get('/pool/:address/root/latest', (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  res.json({
    root: '0x' + pool.tree.getRoot().toString(16).padStart(64, '0'),
    depositsCount: pool.tree.getLeafCount(),
  });
});

/**
 * GET /pool/:address/root/history
 * Get root history
 */
app.get('/pool/:address/root/history', (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  res.json({
    roots: pool.rootHistory.map(r => '0x' + BigInt(r).toString(16).padStart(64, '0')),
  });
});

/**
 * GET /pool/:address/path/:leafIndex
 * Get Merkle path for a deposit
 */
app.get('/pool/:address/path/:leafIndex', async (req, res) => {
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
      pathElements: path.pathElements.map((e: bigint) => '0x' + e.toString(16).padStart(64, '0')),
      pathIndices: path.pathIndices,
      root: '0x' + path.root.toString(16).padStart(64, '0'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get path' });
  }
});

/**
 * GET /pool/:address/deposit/:commitment
 * Get deposit info
 */
app.get('/pool/:address/deposit/:commitment', (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const deposit = pool.deposits.get(req.params.commitment);
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit not found' });
  }

  res.json(deposit);
});

/**
 * GET /pool/:address/nullifier/:hash
 * Check if nullifier is spent
 */
app.get('/pool/:address/nullifier/:hash', (req, res) => {
  const pool = pools.get(req.params.address.toLowerCase());
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const isSpent = pool.nullifiers.has(req.params.hash);
  res.json({ isSpent });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ============ Main ============

async function main() {
  console.log('[Indexer] Starting Dogenado Indexer...');
  console.log(`[Indexer] RPC: ${config.rpcUrl}`);

  // Initialize pools from config
  const poolAddresses = Object.values(config.contracts.pools).filter(Boolean);
  
  if (poolAddresses.length === 0) {
    console.log('[Indexer] No pools configured. Waiting for configuration...');
  } else {
    for (const address of poolAddresses) {
      initializePool(address);
      await syncPool(address);
      await watchPool(address);
    }
  }

  // Start HTTP server
  app.listen(config.server.port, config.server.host, () => {
    console.log(`[Indexer] HTTP server listening on http://${config.server.host}:${config.server.port}`);
  });
}

main().catch(console.error);

export { app, pools };

