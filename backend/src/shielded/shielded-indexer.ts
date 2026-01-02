/**
 * Shielded Pool Indexer
 * 
 * Indexes the ShieldedPoolMultiToken contract for:
 * - Shield events (t→z)
 * - Transfer events (z→z)
 * - Unshield events (z→t)
 * - Swap events (z→z)
 * 
 * Maintains:
 * - Merkle tree of all commitments
 * - Nullifier set (spent notes)
 * - Encrypted memos for note discovery
 */

import { createPublicClient, http, parseAbiItem, type Address, type Log } from 'viem';
import { MerkleTree } from '../merkle/MerkleTree.js';

// Event ABIs for shielded pool
export const ShieldedPoolEvents = {
  Shield: parseAbiItem('event Shield(bytes32 indexed commitment, uint256 indexed leafIndex, address indexed token, uint256 amount, uint256 timestamp)'),
  Transfer: parseAbiItem('event Transfer(bytes32 indexed nullifierHash, bytes32 outputCommitment1, bytes32 outputCommitment2, uint256 indexed leafIndex1, uint256 indexed leafIndex2, bytes encryptedMemo1, bytes encryptedMemo2, uint256 timestamp)'),
  Unshield: parseAbiItem('event Unshield(bytes32 indexed nullifierHash, address indexed recipient, address indexed token, uint256 amount, address relayer, uint256 fee, uint256 timestamp)'),
  Swap: parseAbiItem('event Swap(bytes32 indexed inputNullifier, bytes32 outputCommitment, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, bytes encryptedMemo, uint256 timestamp)'),
};

export interface ShieldedPoolState {
  address: string;
  tree: MerkleTree;
  commitments: Map<string, CommitmentInfo>;
  nullifiers: Set<string>;
  transferMemos: Map<string, TransferMemoInfo>;
  lastSyncBlock: number;
  totalShielded: Map<string, bigint>; // token -> amount
}

export interface CommitmentInfo {
  leafIndex: number;
  token: string;
  amount: string;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  type: 'shield' | 'transfer' | 'swap';
}

export interface TransferMemoInfo {
  nullifierHash: string;
  outputCommitment1: string;
  outputCommitment2: string;
  encryptedMemo1: string;
  encryptedMemo2: string;
  leafIndex1: number;
  leafIndex2: number;
  timestamp: number;
  txHash: string;
}

// State storage
const shieldedPools: Map<string, ShieldedPoolState> = new Map();

/**
 * Initialize shielded pool indexer
 */
export async function initializeShieldedPool(
  address: string,
  merkleTreeDepth: number = 20
): Promise<ShieldedPoolState> {
  const tree = new MerkleTree(merkleTreeDepth);
  await tree.initialize();
  
  const state: ShieldedPoolState = {
    address,
    tree,
    commitments: new Map(),
    nullifiers: new Set(),
    transferMemos: new Map(),
    lastSyncBlock: 0,
    totalShielded: new Map(),
  };
  
  shieldedPools.set(address.toLowerCase(), state);
  console.log(`[ShieldedIndexer] Initialized pool: ${address}`);
  
  return state;
}

/**
 * Get shielded pool state
 */
export function getShieldedPool(address: string): ShieldedPoolState | undefined {
  return shieldedPools.get(address.toLowerCase());
}

/**
 * Sync shielded pool from chain
 */
export async function syncShieldedPool(
  pool: ShieldedPoolState,
  publicClient: ReturnType<typeof createPublicClient>
): Promise<void> {
  const address = pool.address as Address;
  console.log(`[ShieldedIndexer] Syncing pool ${address.slice(0, 10)}... from block ${pool.lastSyncBlock}`);
  
  try {
    const currentBlock = await publicClient.getBlockNumber();
    
    // Fetch all event types
    const [shieldLogs, transferLogs, unshieldLogs, swapLogs] = await Promise.all([
      publicClient.getLogs({
        address,
        event: ShieldedPoolEvents.Shield,
        fromBlock: BigInt(pool.lastSyncBlock),
        toBlock: currentBlock,
      }),
      publicClient.getLogs({
        address,
        event: ShieldedPoolEvents.Transfer,
        fromBlock: BigInt(pool.lastSyncBlock),
        toBlock: currentBlock,
      }),
      publicClient.getLogs({
        address,
        event: ShieldedPoolEvents.Unshield,
        fromBlock: BigInt(pool.lastSyncBlock),
        toBlock: currentBlock,
      }),
      publicClient.getLogs({
        address,
        event: ShieldedPoolEvents.Swap,
        fromBlock: BigInt(pool.lastSyncBlock),
        toBlock: currentBlock,
      }),
    ]);
    
    console.log(`[ShieldedIndexer] Found: ${shieldLogs.length} shields, ${transferLogs.length} transfers, ${unshieldLogs.length} unshields, ${swapLogs.length} swaps`);
    
    // Process Shield events
    for (const log of shieldLogs) {
      const commitment = log.args.commitment as string;
      const leafIndex = Number(log.args.leafIndex);
      const token = log.args.token as string;
      const amount = log.args.amount as bigint;
      
      if (!pool.commitments.has(commitment)) {
        pool.tree.insert(BigInt(commitment));
        pool.commitments.set(commitment, {
          leafIndex,
          token,
          amount: amount.toString(),
          timestamp: Number(log.args.timestamp),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash!,
          type: 'shield',
        });
        
        // Update total shielded
        const currentTotal = pool.totalShielded.get(token) || 0n;
        pool.totalShielded.set(token, currentTotal + amount);
      }
    }
    
    // Process Transfer events
    for (const log of transferLogs) {
      const nullifierHash = log.args.nullifierHash as string;
      const outputCommitment1 = log.args.outputCommitment1 as string;
      const outputCommitment2 = log.args.outputCommitment2 as string;
      const leafIndex1 = Number(log.args.leafIndex1);
      const leafIndex2 = Number(log.args.leafIndex2);
      
      // Mark nullifier as spent
      pool.nullifiers.add(nullifierHash);
      
      // Add new commitments
      if (!pool.commitments.has(outputCommitment1)) {
        pool.tree.insert(BigInt(outputCommitment1));
        pool.commitments.set(outputCommitment1, {
          leafIndex: leafIndex1,
          token: '', // Unknown from transfer event
          amount: '',
          timestamp: Number(log.args.timestamp),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash!,
          type: 'transfer',
        });
      }
      
      if (outputCommitment2 !== '0x0000000000000000000000000000000000000000000000000000000000000000' && 
          !pool.commitments.has(outputCommitment2)) {
        pool.tree.insert(BigInt(outputCommitment2));
        pool.commitments.set(outputCommitment2, {
          leafIndex: leafIndex2,
          token: '',
          amount: '',
          timestamp: Number(log.args.timestamp),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash!,
          type: 'transfer',
        });
      }
      
      // Store encrypted memos for discovery
      pool.transferMemos.set(nullifierHash, {
        nullifierHash,
        outputCommitment1,
        outputCommitment2,
        encryptedMemo1: log.args.encryptedMemo1 as string || '',
        encryptedMemo2: log.args.encryptedMemo2 as string || '',
        leafIndex1,
        leafIndex2,
        timestamp: Number(log.args.timestamp),
        txHash: log.transactionHash!,
      });
    }
    
    // Process Unshield events
    for (const log of unshieldLogs) {
      const nullifierHash = log.args.nullifierHash as string;
      const token = log.args.token as string;
      const amount = log.args.amount as bigint;
      
      pool.nullifiers.add(nullifierHash);
      
      // Update total shielded
      const currentTotal = pool.totalShielded.get(token) || 0n;
      pool.totalShielded.set(token, currentTotal - amount);
    }
    
    // Process Swap events
    for (const log of swapLogs) {
      const inputNullifier = log.args.inputNullifier as string;
      const outputCommitment = log.args.outputCommitment as string;
      const tokenIn = log.args.tokenIn as string;
      const tokenOut = log.args.tokenOut as string;
      const amountIn = log.args.amountIn as bigint;
      const amountOut = log.args.amountOut as bigint;
      
      pool.nullifiers.add(inputNullifier);
      
      if (!pool.commitments.has(outputCommitment)) {
        // Get leaf index from event (need to track this)
        const leafIndex = pool.tree.getLeafCount();
        pool.tree.insert(BigInt(outputCommitment));
        pool.commitments.set(outputCommitment, {
          leafIndex,
          token: tokenOut,
          amount: amountOut.toString(),
          timestamp: Number(log.args.timestamp),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash!,
          type: 'swap',
        });
      }
      
      // Update totals
      const currentIn = pool.totalShielded.get(tokenIn) || 0n;
      const currentOut = pool.totalShielded.get(tokenOut) || 0n;
      pool.totalShielded.set(tokenIn, currentIn - amountIn);
      pool.totalShielded.set(tokenOut, currentOut + amountOut);
    }
    
    pool.lastSyncBlock = Number(currentBlock);
    console.log(`[ShieldedIndexer] Pool synced to block ${currentBlock}. Total commitments: ${pool.tree.getLeafCount()}`);
    
  } catch (error: any) {
    console.error(`[ShieldedIndexer] Sync error:`, error.message);
    throw error;
  }
}

/**
 * Watch for new events (real-time)
 */
export function watchShieldedPool(
  pool: ShieldedPoolState,
  publicClient: ReturnType<typeof createPublicClient>
): void {
  const address = pool.address as Address;
  
  // Watch Shield events
  publicClient.watchContractEvent({
    address,
    abi: [ShieldedPoolEvents.Shield],
    eventName: 'Shield',
    onLogs: (logs) => {
      for (const log of logs) {
        const commitment = log.args.commitment as string;
        const leafIndex = Number(log.args.leafIndex);
        const token = log.args.token as string;
        const amount = log.args.amount as bigint;
        
        if (!pool.commitments.has(commitment)) {
          pool.tree.insert(BigInt(commitment));
          pool.commitments.set(commitment, {
            leafIndex,
            token,
            amount: amount.toString(),
            timestamp: Number(log.args.timestamp),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash!,
            type: 'shield',
          });
          
          const currentTotal = pool.totalShielded.get(token) || 0n;
          pool.totalShielded.set(token, currentTotal + amount);
          
          console.log(`[ShieldedIndexer] NEW shield: ${commitment.slice(0, 18)}... (${amount} ${token})`);
        }
      }
    },
  });
  
  // Watch Transfer events
  publicClient.watchContractEvent({
    address,
    abi: [ShieldedPoolEvents.Transfer],
    eventName: 'Transfer',
    onLogs: (logs) => {
      for (const log of logs) {
        const nullifierHash = log.args.nullifierHash as string;
        pool.nullifiers.add(nullifierHash);
        console.log(`[ShieldedIndexer] NEW transfer: nullifier ${nullifierHash.slice(0, 18)}...`);
        
        // Store memo for discovery
        pool.transferMemos.set(nullifierHash, {
          nullifierHash,
          outputCommitment1: log.args.outputCommitment1 as string,
          outputCommitment2: log.args.outputCommitment2 as string,
          encryptedMemo1: log.args.encryptedMemo1 as string || '',
          encryptedMemo2: log.args.encryptedMemo2 as string || '',
          leafIndex1: Number(log.args.leafIndex1),
          leafIndex2: Number(log.args.leafIndex2),
          timestamp: Number(log.args.timestamp),
          txHash: log.transactionHash!,
        });
      }
    },
  });
  
  // Watch Unshield events
  publicClient.watchContractEvent({
    address,
    abi: [ShieldedPoolEvents.Unshield],
    eventName: 'Unshield',
    onLogs: (logs) => {
      for (const log of logs) {
        const nullifierHash = log.args.nullifierHash as string;
        pool.nullifiers.add(nullifierHash);
        console.log(`[ShieldedIndexer] NEW unshield: ${log.args.recipient}`);
      }
    },
  });
  
  // Watch Swap events
  publicClient.watchContractEvent({
    address,
    abi: [ShieldedPoolEvents.Swap],
    eventName: 'Swap',
    onLogs: (logs) => {
      for (const log of logs) {
        const inputNullifier = log.args.inputNullifier as string;
        pool.nullifiers.add(inputNullifier);
        console.log(`[ShieldedIndexer] NEW swap: ${log.args.tokenIn} → ${log.args.tokenOut}`);
      }
    },
  });
  
  console.log(`[ShieldedIndexer] Watching pool ${address.slice(0, 10)}... for events`);
}

/**
 * Get Merkle path for a commitment
 */
export async function getShieldedMerklePath(
  poolAddress: string,
  leafIndex: number
): Promise<{
  pathElements: string[];
  pathIndices: number[];
  root: string;
} | null> {
  const pool = shieldedPools.get(poolAddress.toLowerCase());
  if (!pool) return null;
  
  if (leafIndex < 0 || leafIndex >= pool.tree.getLeafCount()) {
    return null;
  }
  
  const path = await pool.tree.getPath(leafIndex);
  return {
    pathElements: path.pathElements.map(e => '0x' + e.toString(16).padStart(64, '0')),
    pathIndices: path.pathIndices,
    root: '0x' + path.root.toString(16).padStart(64, '0'),
  };
}

/**
 * Get transfer memos for note discovery
 * Returns all transfers since a given block
 */
export function getTransferMemos(
  poolAddress: string,
  sinceTimestamp?: number
): TransferMemoInfo[] {
  const pool = shieldedPools.get(poolAddress.toLowerCase());
  if (!pool) return [];
  
  const memos = Array.from(pool.transferMemos.values());
  
  if (sinceTimestamp) {
    return memos.filter(m => m.timestamp > sinceTimestamp);
  }
  
  return memos;
}

/**
 * Get pool statistics
 */
export function getShieldedPoolStats(poolAddress: string): {
  totalCommitments: number;
  totalNullifiers: number;
  shieldedBalances: Record<string, string>;
  root: string;
} | null {
  const pool = shieldedPools.get(poolAddress.toLowerCase());
  if (!pool) return null;
  
  const balances: Record<string, string> = {};
  for (const [token, amount] of pool.totalShielded.entries()) {
    balances[token] = amount.toString();
  }
  
  return {
    totalCommitments: pool.tree.getLeafCount(),
    totalNullifiers: pool.nullifiers.size,
    shieldedBalances: balances,
    root: '0x' + pool.tree.getRoot().toString(16).padStart(64, '0'),
  };
}

/**
 * Check if nullifier is spent
 */
export function isNullifierSpent(poolAddress: string, nullifierHash: string): boolean {
  const pool = shieldedPools.get(poolAddress.toLowerCase());
  if (!pool) return false;
  
  return pool.nullifiers.has(nullifierHash) || 
         pool.nullifiers.has('0x' + nullifierHash.replace('0x', ''));
}


