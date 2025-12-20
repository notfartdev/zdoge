/**
 * Hybrid Storage Service
 * 
 * Uses PostgreSQL when available, falls back to in-memory storage.
 * This ensures the application works in both production (with DB) and development (without DB).
 */

import * as db from './db.js';
import {
  saveWalletDeposits,
  loadWalletDeposits,
  saveSyncState as saveFileSyncState,
  loadSyncState as loadFileSyncState,
  saveNullifiers,
  loadNullifiers,
  type WalletDepositMapping,
  type StoredDeposit,
} from '../utils/persistence.js';

// Storage mode
let useDatabase = false;

/**
 * Initialize storage (try database first, fall back to file)
 */
export async function initStorage(): Promise<'database' | 'file' | 'memory'> {
  // Try database first
  const dbConnected = await db.initDatabase();
  
  if (dbConnected) {
    useDatabase = true;
    console.log('[Storage] Using PostgreSQL database');
    return 'database';
  }
  
  // Check if we have write access for file storage
  try {
    const testData = loadWalletDeposits();
    console.log('[Storage] Using file-based persistence');
    return 'file';
  } catch {
    console.log('[Storage] Using in-memory storage (data will be lost on restart)');
    return 'memory';
  }
}

/**
 * Check if using database
 */
export function isUsingDatabase(): boolean {
  return useDatabase;
}

// ============ Deposit Operations ============

export interface DepositInfo {
  poolAddress: string;
  commitment: string;
  leafIndex: number;
  depositorAddress?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  isWithdrawn: boolean;
}

// In-memory fallback
const memoryDeposits: Map<string, DepositInfo[]> = new Map();
const memoryWalletDeposits: Map<string, DepositInfo[]> = new Map();

export async function saveDeposit(deposit: DepositInfo): Promise<void> {
  if (useDatabase) {
    await db.insertDeposit({
      pool_address: deposit.poolAddress,
      commitment: deposit.commitment,
      leaf_index: deposit.leafIndex,
      depositor_address: deposit.depositorAddress,
      tx_hash: deposit.txHash,
      block_number: deposit.blockNumber,
      timestamp: new Date(deposit.timestamp),
      is_withdrawn: deposit.isWithdrawn,
    });
  } else {
    // In-memory storage
    const poolKey = deposit.poolAddress.toLowerCase();
    const existing = memoryDeposits.get(poolKey) || [];
    
    // Check for duplicate
    const existingIndex = existing.findIndex(d => d.commitment === deposit.commitment);
    if (existingIndex >= 0) {
      existing[existingIndex] = deposit;
    } else {
      existing.push(deposit);
    }
    memoryDeposits.set(poolKey, existing);
    
    // Update wallet deposits
    if (deposit.depositorAddress) {
      const walletKey = deposit.depositorAddress.toLowerCase();
      const walletDeposits = memoryWalletDeposits.get(walletKey) || [];
      const walletExistingIndex = walletDeposits.findIndex(d => d.commitment === deposit.commitment);
      if (walletExistingIndex >= 0) {
        walletDeposits[walletExistingIndex] = deposit;
      } else {
        walletDeposits.push(deposit);
      }
      memoryWalletDeposits.set(walletKey, walletDeposits);
    }
  }
}

export async function getDepositsForPool(poolAddress: string): Promise<DepositInfo[]> {
  if (useDatabase) {
    const deposits = await db.getDepositsForPool(poolAddress);
    return deposits.map(d => ({
      poolAddress: d.pool_address,
      commitment: d.commitment,
      leafIndex: d.leaf_index,
      depositorAddress: d.depositor_address,
      txHash: d.tx_hash,
      blockNumber: d.block_number,
      timestamp: new Date(d.timestamp).getTime(),
      isWithdrawn: d.is_withdrawn,
    }));
  } else {
    return memoryDeposits.get(poolAddress.toLowerCase()) || [];
  }
}

export async function getDepositsForWallet(walletAddress: string): Promise<DepositInfo[]> {
  if (useDatabase) {
    const deposits = await db.getDepositsForWallet(walletAddress);
    return deposits.map(d => ({
      poolAddress: d.pool_address,
      commitment: d.commitment,
      leafIndex: d.leaf_index,
      depositorAddress: d.depositor_address,
      txHash: d.tx_hash,
      blockNumber: d.block_number,
      timestamp: new Date(d.timestamp).getTime(),
      isWithdrawn: d.is_withdrawn,
    }));
  } else {
    return memoryWalletDeposits.get(walletAddress.toLowerCase()) || [];
  }
}

export async function getRecentDeposits(poolAddress: string, limit: number = 10): Promise<DepositInfo[]> {
  if (useDatabase) {
    const deposits = await db.getRecentDeposits(poolAddress, limit);
    return deposits.map(d => ({
      poolAddress: d.pool_address,
      commitment: d.commitment,
      leafIndex: d.leaf_index,
      depositorAddress: d.depositor_address,
      txHash: d.tx_hash,
      blockNumber: d.block_number,
      timestamp: new Date(d.timestamp).getTime(),
      isWithdrawn: d.is_withdrawn,
    }));
  } else {
    const deposits = memoryDeposits.get(poolAddress.toLowerCase()) || [];
    return [...deposits]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

// ============ Nullifier Operations ============

const memoryNullifiers: Map<string, Set<string>> = new Map();

export async function saveNullifier(
  poolAddress: string,
  nullifierHash: string,
  txHash: string,
  blockNumber: number,
  timestamp: number
): Promise<void> {
  if (useDatabase) {
    await db.insertNullifier({
      pool_address: poolAddress,
      nullifier_hash: nullifierHash,
      tx_hash: txHash,
      block_number: blockNumber,
      timestamp: new Date(timestamp),
    });
  } else {
    const poolKey = poolAddress.toLowerCase();
    const existing = memoryNullifiers.get(poolKey) || new Set();
    existing.add(nullifierHash);
    memoryNullifiers.set(poolKey, existing);
  }
}

export async function isNullifierSpent(
  poolAddress: string,
  nullifierHash: string
): Promise<boolean> {
  if (useDatabase) {
    return db.isNullifierSpent(poolAddress, nullifierHash);
  } else {
    const nullifiers = memoryNullifiers.get(poolAddress.toLowerCase());
    return nullifiers?.has(nullifierHash) || false;
  }
}

export async function getNullifiersForPool(poolAddress: string): Promise<string[]> {
  if (useDatabase) {
    return db.getNullifiersForPool(poolAddress);
  } else {
    const nullifiers = memoryNullifiers.get(poolAddress.toLowerCase());
    return nullifiers ? Array.from(nullifiers) : [];
  }
}

// ============ Scheduled Withdrawal Operations ============

export interface ScheduledWithdrawalInfo {
  poolAddress: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  unlockTime: number;
  status: 'pending' | 'ready' | 'executed' | 'expired';
  scheduledTxHash?: string;
  executedTxHash?: string;
  depositorAddress?: string;
}

const memoryScheduledWithdrawals: Map<string, ScheduledWithdrawalInfo[]> = new Map();

export async function saveScheduledWithdrawal(
  withdrawal: ScheduledWithdrawalInfo
): Promise<void> {
  if (useDatabase) {
    await db.insertScheduledWithdrawal({
      pool_address: withdrawal.poolAddress,
      nullifier_hash: withdrawal.nullifierHash,
      recipient: withdrawal.recipient,
      relayer: withdrawal.relayer,
      fee: withdrawal.fee,
      unlock_time: new Date(withdrawal.unlockTime),
      status: withdrawal.status,
      scheduled_tx_hash: withdrawal.scheduledTxHash,
      depositor_address: withdrawal.depositorAddress,
    });
  } else {
    const key = `${withdrawal.poolAddress.toLowerCase()}-${withdrawal.nullifierHash}`;
    const existing = memoryScheduledWithdrawals.get(key) || [];
    existing.push(withdrawal);
    memoryScheduledWithdrawals.set(key, existing);
  }
}

export async function getScheduledWithdrawalsForWallet(
  walletAddress: string
): Promise<ScheduledWithdrawalInfo[]> {
  if (useDatabase) {
    const withdrawals = await db.getScheduledWithdrawalsForWallet(walletAddress);
    return withdrawals.map(w => ({
      poolAddress: w.pool_address,
      nullifierHash: w.nullifier_hash,
      recipient: w.recipient,
      relayer: w.relayer,
      fee: w.fee,
      unlockTime: new Date(w.unlock_time).getTime(),
      status: w.status,
      scheduledTxHash: w.scheduled_tx_hash,
      executedTxHash: w.executed_tx_hash,
      depositorAddress: w.depositor_address,
    }));
  } else {
    // Search all scheduled withdrawals for this wallet
    const results: ScheduledWithdrawalInfo[] = [];
    for (const withdrawals of memoryScheduledWithdrawals.values()) {
      for (const w of withdrawals) {
        if (w.recipient.toLowerCase() === walletAddress.toLowerCase() ||
            w.depositorAddress?.toLowerCase() === walletAddress.toLowerCase()) {
          results.push(w);
        }
      }
    }
    return results;
  }
}

export async function updateScheduledWithdrawalStatus(
  poolAddress: string,
  nullifierHash: string,
  status: ScheduledWithdrawalInfo['status'],
  executedTxHash?: string
): Promise<void> {
  if (useDatabase) {
    await db.updateScheduledWithdrawalStatus(poolAddress, nullifierHash, status, executedTxHash);
  } else {
    const key = `${poolAddress.toLowerCase()}-${nullifierHash}`;
    const withdrawals = memoryScheduledWithdrawals.get(key);
    if (withdrawals) {
      for (const w of withdrawals) {
        if (w.nullifierHash === nullifierHash) {
          w.status = status;
          if (executedTxHash) w.executedTxHash = executedTxHash;
        }
      }
    }
  }
}

// ============ Withdrawal Operations ============

export interface WithdrawalInfo {
  poolAddress: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

const memoryWithdrawals: Map<string, WithdrawalInfo[]> = new Map();

export async function saveWithdrawal(withdrawal: WithdrawalInfo): Promise<void> {
  if (useDatabase) {
    await db.insertWithdrawal({
      pool_address: withdrawal.poolAddress,
      nullifier_hash: withdrawal.nullifierHash,
      recipient: withdrawal.recipient,
      relayer: withdrawal.relayer,
      fee: withdrawal.fee,
      tx_hash: withdrawal.txHash,
      block_number: withdrawal.blockNumber,
      timestamp: new Date(withdrawal.timestamp),
    });
  } else {
    const walletKey = withdrawal.recipient.toLowerCase();
    const existing = memoryWithdrawals.get(walletKey) || [];
    existing.push(withdrawal);
    memoryWithdrawals.set(walletKey, existing);
  }
}

export async function getWithdrawalsForWallet(
  walletAddress: string
): Promise<WithdrawalInfo[]> {
  if (useDatabase) {
    const withdrawals = await db.getWithdrawalsForWallet(walletAddress);
    return withdrawals.map(w => ({
      poolAddress: w.pool_address,
      nullifierHash: w.nullifier_hash,
      recipient: w.recipient,
      relayer: w.relayer,
      fee: w.fee,
      txHash: w.tx_hash,
      blockNumber: w.block_number,
      timestamp: new Date(w.timestamp).getTime(),
    }));
  } else {
    return memoryWithdrawals.get(walletAddress.toLowerCase()) || [];
  }
}

// ============ Sync State ============

interface SyncStateInfo {
  lastDepositBlock: number;
  lastWithdrawalBlock: number;
  depositsCount: number;
  nullifiersCount: number;
}

const memorySyncState: Map<string, SyncStateInfo> = new Map();

export async function getSyncState(poolAddress: string): Promise<SyncStateInfo | null> {
  if (useDatabase) {
    return db.getSyncState(poolAddress);
  } else {
    return memorySyncState.get(poolAddress.toLowerCase()) || null;
  }
}

export async function updateSyncState(
  poolAddress: string,
  updates: Partial<SyncStateInfo>
): Promise<void> {
  if (useDatabase) {
    await db.updateSyncState(poolAddress, updates);
  } else {
    const key = poolAddress.toLowerCase();
    const existing = memorySyncState.get(key) || {
      lastDepositBlock: 0,
      lastWithdrawalBlock: 0,
      depositsCount: 0,
      nullifiersCount: 0,
    };
    memorySyncState.set(key, { ...existing, ...updates });
  }
}

// ============ Transaction Logging ============

export async function logTransaction(
  txType: 'relay' | 'schedule' | 'execute',
  poolAddress: string | null,
  txHash: string | null,
  status: 'pending' | 'success' | 'failed',
  durationMs: number,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  if (useDatabase) {
    await db.logTransaction(
      txType,
      poolAddress,
      txHash,
      status,
      durationMs,
      errorCode,
      errorMessage
    );
  }
  // In-memory mode: just log to console
  console.log(`[TX Log] ${txType} ${status} ${txHash || 'N/A'} (${durationMs}ms)`);
}

// ============ Statistics ============

export async function getPoolStats(poolAddress: string): Promise<{
  totalDeposits: number;
  totalWithdrawals: number;
  activeDeposits: number;
}> {
  if (useDatabase) {
    return db.getPoolStats(poolAddress);
  } else {
    const deposits = memoryDeposits.get(poolAddress.toLowerCase()) || [];
    const nullifiers = memoryNullifiers.get(poolAddress.toLowerCase()) || new Set();
    return {
      totalDeposits: deposits.length,
      totalWithdrawals: nullifiers.size,
      activeDeposits: deposits.length - nullifiers.size,
    };
  }
}

export async function getGlobalStats(): Promise<{
  totalPools: number;
  totalDeposits: number;
  totalWithdrawals: number;
  storageMode: string;
}> {
  if (useDatabase) {
    const stats = await db.getGlobalStats();
    return {
      ...stats,
      storageMode: 'postgresql',
    };
  } else {
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    
    for (const deposits of memoryDeposits.values()) {
      totalDeposits += deposits.length;
    }
    for (const nullifiers of memoryNullifiers.values()) {
      totalWithdrawals += nullifiers.size;
    }
    
    return {
      totalPools: memoryDeposits.size,
      totalDeposits,
      totalWithdrawals,
      storageMode: 'memory',
    };
  }
}

