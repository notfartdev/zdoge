// @ts-nocheck
/**
 * Dogenado Relayer Service
 * 
 * Submits withdrawal transactions on behalf of users.
 * - Pays gas fees (compensated via withdrawal fee)
 * - Never learns user secrets (proofs are opaque)
 * - Validates proofs before submission
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import express from 'express';
import cors from 'cors';
import { config, MixerPoolABI, dogeosTestnet } from '../config.js';

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Withdrawal request tracking
interface WithdrawalRequest {
  id: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash?: string;
  error?: string;
  timestamp: number;
}

const withdrawalRequests: Map<string, WithdrawalRequest> = new Map();

// Rate limiting
const rateLimits: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

// Create clients
const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(config.rpcUrl),
});

let walletClient: ReturnType<typeof createWalletClient> | null = null;
let relayerAddress: Address | null = null;

/**
 * Initialize relayer wallet
 */
function initializeWallet(): boolean {
  if (!config.relayer.privateKey) {
    console.error('[Relayer] No private key configured');
    return false;
  }

  try {
    const account = privateKeyToAccount(config.relayer.privateKey as Hex);
    relayerAddress = account.address;

    walletClient = createWalletClient({
      account,
      chain: dogeosTestnet,
      transport: http(config.rpcUrl),
    });

    console.log(`[Relayer] Wallet initialized: ${relayerAddress}`);
    return true;
  } catch (error) {
    console.error('[Relayer] Failed to initialize wallet:', error);
    return false;
  }
}

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimits.get(ip) || [];
  
  // Filter to requests within window
  const recentRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);
  rateLimits.set(ip, recentRequests);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  recentRequests.push(now);
  return true;
}

/**
 * Validate withdrawal request
 */
async function validateWithdrawal(
  poolAddress: Address,
  proof: bigint[],
  root: Hex,
  nullifierHash: Hex,
  recipient: Address,
  fee: bigint
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if pool exists
    const poolInfo = await publicClient.readContract({
      address: poolAddress,
      abi: MixerPoolABI,
      functionName: 'getPoolInfo',
    });

    const denomination = poolInfo[1];

    // Check fee bounds
    if (fee < config.relayer.minFee) {
      return { valid: false, error: 'Fee too low' };
    }
    if (fee > config.relayer.maxFee) {
      return { valid: false, error: 'Fee too high' };
    }
    if (fee > denomination) {
      return { valid: false, error: 'Fee exceeds denomination' };
    }

    // Check if root is valid
    const isKnownRoot = await publicClient.readContract({
      address: poolAddress,
      abi: MixerPoolABI,
      functionName: 'isKnownRoot',
      args: [root],
    });

    if (!isKnownRoot) {
      return { valid: false, error: 'Unknown Merkle root' };
    }

    // Check if nullifier is already spent
    const isSpent = await publicClient.readContract({
      address: poolAddress,
      abi: MixerPoolABI,
      functionName: 'isSpent',
      args: [nullifierHash],
    });

    if (isSpent) {
      return { valid: false, error: 'Nullifier already spent' };
    }

    // Simulate the withdrawal
    try {
      await publicClient.simulateContract({
        address: poolAddress,
        abi: MixerPoolABI,
        functionName: 'withdraw',
        args: [
          proof.map(p => p) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          root,
          nullifierHash,
          recipient,
          relayerAddress!,
          fee,
        ],
        account: relayerAddress!,
      });
    } catch (simError: any) {
      return { valid: false, error: `Simulation failed: ${simError.message}` };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: `Validation error: ${error.message}` };
  }
}

/**
 * Submit withdrawal transaction
 */
async function submitWithdrawal(
  poolAddress: Address,
  proof: bigint[],
  root: Hex,
  nullifierHash: Hex,
  recipient: Address,
  fee: bigint
): Promise<{ txHash: string }> {
  if (!walletClient || !relayerAddress) {
    throw new Error('Relayer wallet not initialized');
  }

  const txHash = await walletClient.writeContract({
    chain: dogeosTestnet,
    address: poolAddress,
    abi: MixerPoolABI,
    functionName: 'withdraw',
    args: [
      proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      root,
      nullifierHash,
      recipient,
      relayerAddress,
      fee,
    ],
  });

  return { txHash };
}

// ============ API Routes ============

/**
 * POST /withdraw
 * Submit a withdrawal request
 */
app.post('/withdraw', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { poolAddress, proof, root, nullifierHash, recipient, fee } = req.body;

  // Basic validation
  if (!poolAddress || !proof || !root || !nullifierHash || !recipient || fee === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Parse inputs
  let parsedProof: bigint[];
  let parsedFee: bigint;

  try {
    parsedProof = proof.map((p: string) => BigInt(p));
    parsedFee = BigInt(fee);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid proof or fee format' });
  }

  // Validate withdrawal
  const validation = await validateWithdrawal(
    poolAddress as Address,
    parsedProof,
    root as Hex,
    nullifierHash as Hex,
    recipient as Address,
    parsedFee
  );

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Create request record
  const requestId = crypto.randomUUID();
  const request: WithdrawalRequest = {
    id: requestId,
    status: 'pending',
    timestamp: Date.now(),
  };
  withdrawalRequests.set(nullifierHash, request);

  try {
    // Submit transaction
    request.status = 'submitted';
    const { txHash } = await submitWithdrawal(
      poolAddress as Address,
      parsedProof,
      root as Hex,
      nullifierHash as Hex,
      recipient as Address,
      parsedFee
    );

    request.txHash = txHash;
    console.log(`[Relayer] Withdrawal submitted: ${txHash}`);

    // Wait for confirmation (async)
    publicClient.waitForTransactionReceipt({ hash: txHash as Hex })
      .then(() => {
        request.status = 'confirmed';
        console.log(`[Relayer] Withdrawal confirmed: ${txHash}`);
      })
      .catch((error) => {
        request.status = 'failed';
        request.error = error.message;
        console.error(`[Relayer] Withdrawal failed: ${error.message}`);
      });

    res.json({
      requestId,
      txHash,
      status: 'submitted',
    });
  } catch (error: any) {
    request.status = 'failed';
    request.error = error.message;
    console.error(`[Relayer] Withdrawal error:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /withdraw/:nullifier/status
 * Check withdrawal status
 */
app.get('/withdraw/:nullifier/status', (req, res) => {
  const request = withdrawalRequests.get(req.params.nullifier);
  
  if (!request) {
    return res.status(404).json({ error: 'Withdrawal request not found' });
  }

  res.json(request);
});

/**
 * GET /relayer/info
 * Get relayer information
 */
app.get('/relayer/info', async (req, res) => {
  if (!relayerAddress) {
    return res.status(503).json({ error: 'Relayer not initialized' });
  }

  const balance = await publicClient.getBalance({ address: relayerAddress });

  res.json({
    address: relayerAddress,
    balance: balance.toString(),
    minFee: config.relayer.minFee.toString(),
    maxFee: config.relayer.maxFee.toString(),
    rateLimitWindow: RATE_LIMIT_WINDOW,
    maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
  });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: relayerAddress ? 'ok' : 'not_initialized',
    timestamp: Date.now(),
    relayer: relayerAddress,
  });
});

// ============ Main ============

async function main() {
  console.log('[Relayer] Starting Dogenado Relayer...');
  console.log(`[Relayer] RPC: ${config.rpcUrl}`);

  // Initialize wallet
  const walletInitialized = initializeWallet();
  
  if (!walletInitialized) {
    console.warn('[Relayer] Running without wallet - withdrawal submissions disabled');
  } else {
    // Check balance
    const balance = await publicClient.getBalance({ address: relayerAddress! });
    console.log(`[Relayer] Balance: ${balance} wei`);

    if (balance === 0n) {
      console.warn('[Relayer] WARNING: Relayer has no balance for gas');
    }
  }

  // Start HTTP server
  const port = config.server.port + 1; // Relayer on port 3002
  app.listen(port, config.server.host, () => {
    console.log(`[Relayer] HTTP server listening on http://${config.server.host}:${port}`);
  });
}

main().catch(console.error);

export { app };

