"use strict";
/**
 * Dogenado Indexer Service
 *
 * Listens to blockchain events and maintains:
 * - Merkle tree state
 * - Deposit history
 * - Root history
 * - Nullifier tracking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pools = exports.app = void 0;
const viem_1 = require("viem");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_js_1 = require("../config.js");
const MerkleTree_js_1 = require("../merkle/MerkleTree.js");
const pools = new Map();
exports.pools = pools;
// Express app
const app = (0, express_1.default)();
exports.app = app;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Create viem client
const publicClient = (0, viem_1.createPublicClient)({
    chain: config_js_1.dogeosTestnet,
    transport: (0, viem_1.http)(config_js_1.config.rpcUrl),
});
// WebSocket client for real-time events
let wsClient = null;
/**
 * Initialize pool state
 */
function initializePool(address) {
    const state = {
        address,
        tree: new MerkleTree_js_1.MerkleTree(config_js_1.config.merkleTreeDepth),
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
function processDeposit(poolAddress, commitment, leafIndex, timestamp, blockNumber) {
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
function processWithdrawal(poolAddress, nullifierHash) {
    const pool = pools.get(poolAddress.toLowerCase());
    if (!pool)
        return;
    pool.nullifiers.add(nullifierHash);
    console.log(`[Indexer] Withdrawal: nullifier ${nullifierHash.slice(0, 10)}...`);
}
/**
 * Sync historical events for a pool
 */
async function syncPool(poolAddress) {
    console.log(`[Indexer] Syncing pool: ${poolAddress}`);
    const pool = pools.get(poolAddress.toLowerCase()) || initializePool(poolAddress);
    try {
        // Get deposit events
        const depositLogs = await publicClient.getLogs({
            address: poolAddress,
            event: (0, viem_1.parseAbiItem)('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)'),
            fromBlock: 0n,
            toBlock: 'latest',
        });
        console.log(`[Indexer] Found ${depositLogs.length} historical deposits`);
        // Process in order
        for (const log of depositLogs) {
            const { commitment, leafIndex, timestamp } = log.args;
            processDeposit(poolAddress, commitment, leafIndex, timestamp, log.blockNumber);
        }
        // Get withdrawal events
        const withdrawalLogs = await publicClient.getLogs({
            address: poolAddress,
            event: (0, viem_1.parseAbiItem)('event Withdrawal(address indexed recipient, bytes32 indexed nullifierHash, address indexed relayer, uint256 fee)'),
            fromBlock: 0n,
            toBlock: 'latest',
        });
        console.log(`[Indexer] Found ${withdrawalLogs.length} historical withdrawals`);
        for (const log of withdrawalLogs) {
            const { nullifierHash } = log.args;
            processWithdrawal(poolAddress, nullifierHash);
        }
        console.log(`[Indexer] Pool synced: ${pool.tree.getLeafCount()} deposits, ${pool.nullifiers.size} withdrawals`);
    }
    catch (error) {
        console.error(`[Indexer] Sync error:`, error);
    }
}
/**
 * Start real-time event watching
 */
async function watchPool(poolAddress) {
    console.log(`[Indexer] Watching pool: ${poolAddress}`);
    // Watch Deposit events
    publicClient.watchContractEvent({
        address: poolAddress,
        abi: config_js_1.MixerPoolABI,
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
        address: poolAddress,
        abi: config_js_1.MixerPoolABI,
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
app.get('/pool/:address/path/:leafIndex', (req, res) => {
    const pool = pools.get(req.params.address.toLowerCase());
    if (!pool) {
        return res.status(404).json({ error: 'Pool not found' });
    }
    const leafIndex = parseInt(req.params.leafIndex);
    if (isNaN(leafIndex) || leafIndex < 0 || leafIndex >= pool.tree.getLeafCount()) {
        return res.status(400).json({ error: 'Invalid leaf index' });
    }
    try {
        const path = pool.tree.getPath(leafIndex);
        res.json({
            pathElements: path.pathElements.map(e => '0x' + e.toString(16).padStart(64, '0')),
            pathIndices: path.pathIndices,
            root: '0x' + path.root.toString(16).padStart(64, '0'),
        });
    }
    catch (error) {
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
    console.log(`[Indexer] RPC: ${config_js_1.config.rpcUrl}`);
    // Initialize pools from config
    const poolAddresses = Object.values(config_js_1.config.contracts.pools).filter(Boolean);
    if (poolAddresses.length === 0) {
        console.log('[Indexer] No pools configured. Waiting for configuration...');
    }
    else {
        for (const address of poolAddresses) {
            initializePool(address);
            await syncPool(address);
            await watchPool(address);
        }
    }
    // Start HTTP server
    app.listen(config_js_1.config.server.port, config_js_1.config.server.host, () => {
        console.log(`[Indexer] HTTP server listening on http://${config_js_1.config.server.host}:${config_js_1.config.server.port}`);
    });
}
main().catch(console.error);
