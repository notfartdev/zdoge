/**
 * Shielded Pool API Routes
 * 
 * Endpoints for shielded transaction operations:
 * - Get pool info and statistics
 * - Get Merkle paths for proofs
 * - Get transfer memos for note discovery
 * - Check nullifier status
 * - Relay shielded transactions
 */

import { Router, type Request, type Response } from 'express';
import { type Address } from 'viem';
import {
  getShieldedPool,
  getShieldedMerklePath,
  getTransferMemos,
  getShieldedPoolStats,
  isNullifierSpent,
} from './shielded-indexer.js';

export const shieldedRouter = Router();

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


