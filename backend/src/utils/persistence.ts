/**
 * Simple File-Based Persistence
 * 
 * For testnet/development use. For production, use PostgreSQL or MongoDB.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Persistence] Created data directory: ${DATA_DIR}`);
  }
}

// ============ Deposit Storage ============

export interface StoredDeposit {
  poolAddress: string;
  commitment: string;
  leafIndex: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  depositor?: string;
}

export interface DepositStore {
  deposits: StoredDeposit[];
  lastUpdated: number;
}

export function saveDeposits(poolAddress: string, deposits: StoredDeposit[]): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `deposits_${poolAddress.toLowerCase()}.json`);
  
  const store: DepositStore = {
    deposits,
    lastUpdated: Date.now(),
  };
  
  fs.writeFileSync(filename, JSON.stringify(store, null, 2));
}

export function loadDeposits(poolAddress: string): StoredDeposit[] {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `deposits_${poolAddress.toLowerCase()}.json`);
  
  if (!fs.existsSync(filename)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    const store: DepositStore = JSON.parse(data);
    return store.deposits || [];
  } catch (error) {
    console.error(`[Persistence] Failed to load deposits for ${poolAddress}:`, error);
    return [];
  }
}

// ============ Wallet Deposit Mapping ============

export interface WalletDepositMapping {
  [walletAddress: string]: Array<{
    poolAddress: string;
    commitment: string;
    leafIndex: number;
    timestamp: number;
    txHash: string;
  }>;
}

export function saveWalletDeposits(mappings: WalletDepositMapping): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, 'wallet_deposits.json');
  
  fs.writeFileSync(filename, JSON.stringify({
    mappings,
    lastUpdated: Date.now(),
  }, null, 2));
}

export function loadWalletDeposits(): WalletDepositMapping {
  ensureDataDir();
  const filename = path.join(DATA_DIR, 'wallet_deposits.json');
  
  if (!fs.existsSync(filename)) {
    return {};
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    const store = JSON.parse(data);
    return store.mappings || {};
  } catch (error) {
    console.error('[Persistence] Failed to load wallet deposits:', error);
    return {};
  }
}

// ============ Scheduled Withdrawals ============

export interface StoredScheduledWithdrawal {
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

export function saveScheduledWithdrawals(
  walletAddress: string, 
  withdrawals: StoredScheduledWithdrawal[]
): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `scheduled_${walletAddress.toLowerCase()}.json`);
  
  fs.writeFileSync(filename, JSON.stringify({
    withdrawals,
    lastUpdated: Date.now(),
  }, null, 2));
}

export function loadScheduledWithdrawals(walletAddress: string): StoredScheduledWithdrawal[] {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `scheduled_${walletAddress.toLowerCase()}.json`);
  
  if (!fs.existsSync(filename)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    const store = JSON.parse(data);
    return store.withdrawals || [];
  } catch (error) {
    console.error(`[Persistence] Failed to load scheduled withdrawals for ${walletAddress}:`, error);
    return [];
  }
}

// ============ Nullifier Storage ============

export function saveNullifiers(poolAddress: string, nullifiers: string[]): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `nullifiers_${poolAddress.toLowerCase()}.json`);
  
  fs.writeFileSync(filename, JSON.stringify({
    nullifiers,
    lastUpdated: Date.now(),
  }, null, 2));
}

export function loadNullifiers(poolAddress: string): string[] {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `nullifiers_${poolAddress.toLowerCase()}.json`);
  
  if (!fs.existsSync(filename)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    const store = JSON.parse(data);
    return store.nullifiers || [];
  } catch (error) {
    console.error(`[Persistence] Failed to load nullifiers for ${poolAddress}:`, error);
    return [];
  }
}

// ============ Sync State ============

export interface SyncState {
  poolAddress: string;
  lastSyncBlock: number;
  depositsCount: number;
  nullifiersCount: number;
}

export function saveSyncState(poolAddress: string, state: Omit<SyncState, 'poolAddress'>): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `sync_${poolAddress.toLowerCase()}.json`);
  
  fs.writeFileSync(filename, JSON.stringify({
    ...state,
    poolAddress,
    lastUpdated: Date.now(),
  }, null, 2));
}

export function loadSyncState(poolAddress: string): SyncState | null {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `sync_${poolAddress.toLowerCase()}.json`);
  
  if (!fs.existsSync(filename)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[Persistence] Failed to load sync state for ${poolAddress}:`, error);
    return null;
  }
}

// ============ Withdrawal History ============

export interface StoredWithdrawal {
  poolAddress: string;
  recipient: string;
  nullifierHash: string;
  relayer: string;
  fee: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

export function saveWithdrawalHistory(walletAddress: string, withdrawals: StoredWithdrawal[]): void {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `withdrawals_${walletAddress.toLowerCase()}.json`);
  
  fs.writeFileSync(filename, JSON.stringify({
    withdrawals,
    lastUpdated: Date.now(),
  }, null, 2));
}

export function loadWithdrawalHistory(walletAddress: string): StoredWithdrawal[] {
  ensureDataDir();
  const filename = path.join(DATA_DIR, `withdrawals_${walletAddress.toLowerCase()}.json`);
  
  if (!fs.existsSync(filename)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filename, 'utf-8');
    const store = JSON.parse(data);
    return store.withdrawals || [];
  } catch (error) {
    console.error(`[Persistence] Failed to load withdrawal history for ${walletAddress}:`, error);
    return [];
  }
}

// ============ Cleanup ============

export function clearAllData(): void {
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(DATA_DIR, file));
    }
    console.log('[Persistence] Cleared all data');
  }
}

console.log(`[Persistence] Using data directory: ${path.resolve(DATA_DIR)}`);

