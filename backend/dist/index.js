"use strict";
/**
 * Dogenado Backend - Combined Entry Point
 *
 * Runs both indexer and relayer in a single process.
 * For production, run them separately for better reliability.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_js_1 = require("./config.js");
const MerkleTree_js_1 = require("./merkle/MerkleTree.js");
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
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const pools = new Map();
// Create viem client
const publicClient = (0, viem_1.createPublicClient)({
    chain: config_js_1.dogeosTestnet,
    transport: (0, viem_1.http)(config_js_1.config.rpcUrl),
});
// Create wallet client for relayer (if private key is available)
let walletClient = null;
let relayerAddress = null;
if (process.env.RELAYER_PRIVATE_KEY) {
    const account = (0, accounts_1.privateKeyToAccount)(`0x${process.env.RELAYER_PRIVATE_KEY.replace('0x', '')}`);
    relayerAddress = account.address;
    walletClient = (0, viem_1.createWalletClient)({
        account,
        chain: config_js_1.dogeosTestnet,
        transport: (0, viem_1.http)(config_js_1.config.rpcUrl),
    });
    console.log(`[Relayer] Initialized with address: ${relayerAddress}`);
}
// ============ Event ABI ============
const DepositEventABI = (0, viem_1.parseAbiItem)('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)');
const WithdrawalEventABI = (0, viem_1.parseAbiItem)('event Withdrawal(address indexed recipient, bytes32 indexed nullifierHash, address indexed relayer, uint256 fee)');
// ============ Pool Management ============
async function initializePool(address) {
    const tree = new MerkleTree_js_1.MerkleTree(config_js_1.config.merkleTreeDepth);
    await tree.initialize();
    const state = {
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
async function syncPoolFromChain(pool) {
    const address = pool.address;
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
            const commitment = log.args.commitment;
            const leafIndex = Number(log.args.leafIndex);
            const timestamp = Number(log.args.timestamp);
            // Add to tree if not already present
            if (!pool.deposits.has(commitment)) {
                const commitmentBigInt = BigInt(commitment);
                pool.tree.insert(commitmentBigInt);
                pool.deposits.set(commitment, {
                    leafIndex,
                    timestamp,
                    blockNumber: Number(log.blockNumber),
                    txHash: log.transactionHash,
                });
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
        // Track nullifiers
        for (const log of withdrawalLogs) {
            const nullifierHash = log.args.nullifierHash;
            pool.nullifiers.add(nullifierHash);
        }
        pool.lastSyncBlock = Number(currentBlock);
        console.log(`[Indexer] Pool synced to block ${currentBlock}. Total deposits: ${pool.tree.getLeafCount()}`);
    }
    catch (error) {
        console.error(`[Indexer] Sync error for ${address}:`, error.message);
    }
}
// Watch for new events
async function watchPool(pool) {
    const address = pool.address;
    // Watch for deposits
    publicClient.watchContractEvent({
        address,
        abi: [DepositEventABI],
        eventName: 'Deposit',
        onLogs: (logs) => {
            for (const log of logs) {
                const commitment = log.args.commitment;
                const leafIndex = Number(log.args.leafIndex);
                const timestamp = Number(log.args.timestamp);
                if (!pool.deposits.has(commitment)) {
                    const commitmentBigInt = BigInt(commitment);
                    pool.tree.insert(commitmentBigInt);
                    pool.deposits.set(commitment, {
                        leafIndex,
                        timestamp,
                        blockNumber: Number(log.blockNumber),
                        txHash: log.transactionHash,
                    });
                    console.log(`[Indexer] NEW deposit ${leafIndex}: ${commitment.slice(0, 18)}...`);
                }
            }
        },
    });
    // Watch for withdrawals
    publicClient.watchContractEvent({
        address,
        abi: [WithdrawalEventABI],
        eventName: 'Withdrawal',
        onLogs: (logs) => {
            for (const log of logs) {
                const nullifierHash = log.args.nullifierHash;
                pool.nullifiers.add(nullifierHash);
                console.log(`[Indexer] NEW withdrawal: ${nullifierHash.slice(0, 18)}...`);
            }
        },
    });
    console.log(`[Indexer] Watching pool ${address.slice(0, 10)}... for events`);
}
// ============ API Routes ============
// Get all pools
app.get('/api/pools', (req, res) => {
    const poolList = Array.from(pools.entries()).map(([address, state]) => ({
        address,
        depositsCount: state.tree.getLeafCount(),
        withdrawalsCount: state.nullifiers.size,
        currentRoot: '0x' + state.tree.getRoot().toString(16).padStart(64, '0'),
    }));
    res.json(poolList);
});
// Get pool info
app.get('/api/pool/:address', async (req, res) => {
    const address = req.params.address;
    try {
        const poolInfo = await publicClient.readContract({
            address,
            abi: config_js_1.MixerPoolABI,
            functionName: 'getPoolInfo',
        });
        const pool = pools.get(address.toLowerCase());
        res.json({
            token: poolInfo[0],
            denomination: poolInfo[1].toString(),
            depositsCount: poolInfo[2].toString(),
            root: poolInfo[3],
            // Local state
            localDepositsCount: pool?.tree.getLeafCount() || 0,
            localRoot: pool ? '0x' + pool.tree.getRoot().toString(16).padStart(64, '0') : null,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get latest root
app.get('/api/pool/:address/root', (req, res) => {
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
app.get('/api/pool/:address/path/:leafIndex', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get path' });
    }
});
// Get deposit info by commitment
app.get('/api/pool/:address/deposit/:commitment', (req, res) => {
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
app.get('/api/pool/:address/nullifier/:hash', (req, res) => {
    const pool = pools.get(req.params.address.toLowerCase());
    if (!pool) {
        return res.status(404).json({ error: 'Pool not found' });
    }
    const hash = req.params.hash.toLowerCase();
    const isSpent = pool.nullifiers.has(hash) || pool.nullifiers.has('0x' + hash.replace('0x', ''));
    res.json({ isSpent });
});
// Relay withdrawal
app.post('/api/relay', async (req, res) => {
    if (!walletClient || !relayerAddress) {
        return res.status(503).json({
            error: 'Relayer not configured. Set RELAYER_PRIVATE_KEY environment variable.'
        });
    }
    const { pool: poolAddress, proof, root, nullifierHash, recipient, fee } = req.body;
    if (!poolAddress || !proof || !root || !nullifierHash || !recipient) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        console.log(`[Relayer] Processing withdrawal to ${recipient}`);
        // Convert proof strings to bigints
        const proofBigInts = proof.map((p) => BigInt(p));
        // Submit transaction
        const txHash = await walletClient.writeContract({
            address: poolAddress,
            abi: config_js_1.MixerPoolABI,
            functionName: 'withdraw',
            args: [
                proofBigInts,
                root,
                nullifierHash,
                recipient,
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
        console.log(`[Relayer] Withdrawal confirmed in block ${receipt.blockNumber}`);
        res.json({
            txHash,
            blockNumber: Number(receipt.blockNumber),
            relayer: relayerAddress,
        });
    }
    catch (error) {
        console.error('[Relayer] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// Schedule withdrawal (V2 pools with timelock)
app.post('/api/relay/schedule', async (req, res) => {
    if (!walletClient || !relayerAddress) {
        return res.status(503).json({
            error: 'Relayer not configured.'
        });
    }
    const { pool: poolAddress, proof, root, nullifierHash, recipient, fee, delay } = req.body;
    if (!poolAddress || !proof || !root || !nullifierHash || !recipient || !delay) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    // Validate delay (1 hour to 7 days)
    const delaySeconds = parseInt(delay);
    if (delaySeconds < 3600 || delaySeconds > 604800) {
        return res.status(400).json({ error: 'Delay must be between 1 hour and 7 days' });
    }
    try {
        console.log(`[Relayer] Scheduling withdrawal to ${recipient} with ${delaySeconds}s delay`);
        const proofBigInts = proof.map((p) => BigInt(p));
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
        ];
        const txHash = await walletClient.writeContract({
            address: poolAddress,
            abi: MixerPoolV2ABI,
            functionName: 'scheduleWithdrawal',
            args: [
                proofBigInts,
                root,
                nullifierHash,
                recipient,
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
        console.log(`[Relayer] Withdrawal scheduled, unlocks at ${new Date(unlockTime * 1000).toISOString()}`);
        res.json({
            txHash,
            blockNumber: Number(receipt.blockNumber),
            unlockTime: unlockTime * 1000, // milliseconds for JS Date
            nullifierHash,
        });
    }
    catch (error) {
        console.error('[Relayer] Schedule error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// Execute scheduled withdrawal
app.post('/api/relay/execute', async (req, res) => {
    if (!walletClient || !relayerAddress) {
        return res.status(503).json({
            error: 'Relayer not configured.'
        });
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
        ];
        const txHash = await walletClient.writeContract({
            address: poolAddress,
            abi: MixerPoolV2ABI,
            functionName: 'executeScheduledWithdrawal',
            args: [nullifierHash],
        });
        console.log(`[Relayer] Execute TX submitted: ${txHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'reverted') {
            throw new Error('Transaction reverted');
        }
        console.log(`[Relayer] Scheduled withdrawal executed in block ${receipt.blockNumber}`);
        res.json({
            txHash,
            blockNumber: Number(receipt.blockNumber),
        });
    }
    catch (error) {
        console.error('[Relayer] Execute error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// Get scheduled withdrawal status
app.get('/api/pool/:address/scheduled/:nullifierHash', async (req, res) => {
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
        ];
        const result = await publicClient.readContract({
            address: poolAddress,
            abi: MixerPoolV2ABI,
            functionName: 'getWithdrawalStatus',
            args: [nullifierHash],
        });
        res.json({
            exists: result[1] > 0n, // unlockTime > 0 means it exists
            timeRemaining: Number(result[0]),
            unlockTime: Number(result[1]),
            isReady: result[2],
            executed: result[3],
        });
    }
    catch (error) {
        console.error('[Pool] Status error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// Force sync pool
app.post('/api/pool/:address/sync', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        chain: 'DogeOS Chikyū Testnet',
        chainId: config_js_1.config.chainId,
        pools: pools.size,
        relayerAvailable: !!walletClient,
        relayerAddress: relayerAddress || null,
    });
});
// Network info
app.get('/api/network', (req, res) => {
    res.json({
        name: 'DogeOS Chikyū Testnet',
        chainId: config_js_1.config.chainId,
        rpcUrl: config_js_1.config.rpcUrl,
        wsRpcUrl: config_js_1.config.wsRpcUrl,
        blockExplorer: 'https://blockscout.testnet.dogeos.com',
        tokens: config_js_1.config.tokens,
    });
});
// ============ Main ============
async function main() {
    console.log('[Backend] Starting Dogenado Backend...');
    console.log(`[Backend] Chain: DogeOS Chikyū Testnet (${config_js_1.config.chainId})`);
    console.log(`[Backend] RPC: ${config_js_1.config.rpcUrl}`);
    // Start server first (non-blocking)
    app.listen(config_js_1.config.server.port, config_js_1.config.server.host, () => {
        console.log(`[Backend] Server running on http://${config_js_1.config.server.host}:${config_js_1.config.server.port}`);
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
    });
    // Initialize pools in background (non-blocking)
    const poolAddresses = Object.values(config_js_1.config.contracts.pools).filter(Boolean);
    console.log(`[Backend] Pool addresses configured: ${poolAddresses.length}`);
    poolAddresses.forEach((addr, i) => console.log(`  Pool ${i + 1}: ${addr}`));
    if (poolAddresses.length === 0) {
        console.log('[Backend] No pools configured yet.');
        console.log('[Backend] Deploy contracts and set POOL_100_USDC, POOL_1000_USDC env vars.');
    }
    else {
        // Initialize and sync pools asynchronously
        for (const address of poolAddresses) {
            console.log(`[Indexer] Initializing pool ${address}...`);
            initializePool(address).then(async (pool) => {
                console.log(`[Indexer] Pool ${address} initialized, starting sync...`);
                try {
                    await syncPoolFromChain(pool);
                    console.log(`[Indexer] Pool ${address} synced successfully!`);
                    watchPool(pool);
                }
                catch (err) {
                    console.error(`[Indexer] Failed to sync pool ${address}:`, err.message);
                }
            }).catch((err) => {
                console.error(`[Indexer] Failed to initialize pool ${address}:`, err.message);
            });
        }
    }
}
main().catch(console.error);
