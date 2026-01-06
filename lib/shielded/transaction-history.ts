/**
 * Shielded Transaction History Service
 * 
 * Tracks and stores all shielded transactions for display in Activity page
 * Syncs with backend API for persistence across devices
 */

import { api } from '../dogeos-config'

export type TransactionType = 'shield' | 'transfer' | 'swap' | 'unshield'

export interface ShieldedTransaction {
  id: string // Unique ID (txHash + type)
  type: TransactionType
  txHash: string
  timestamp: number // Unix timestamp (seconds)
  token: string // Token symbol (DOGE, USDC, etc.)
  amount: string // Amount as string (e.g., "5.0000")
  amountWei: string // Amount in wei as string
  
  // For shield
  commitment?: string
  leafIndex?: number
  
  // For transfer
  recipientAddress?: string // Shielded address (zdoge:...)
  recipientPublic?: string // Public address if known
  fee?: string // Relayer fee
  changeAmount?: string // Change returned
  isIncoming?: boolean // true if this is a received transfer (discovered note)
  
  // For swap
  inputToken?: string
  outputToken?: string
  outputAmount?: string
  
  // For unshield
  recipientPublicAddress?: string
  relayerFee?: string
  
  // Status
  status: 'pending' | 'confirmed' | 'failed'
  blockNumber?: number
}

// Storage key per wallet
const STORAGE_PREFIX = 'dogenado_shielded_tx_history_'
let currentWalletAddress: string | null = null
let syncInProgress = false

function getStorageKey(): string {
  const addr = currentWalletAddress?.toLowerCase() || 'default'
  return `${STORAGE_PREFIX}${addr}`
}

/**
 * Initialize transaction history for a wallet
 * Loads from backend and syncs with local storage
 */
export async function initTransactionHistory(walletAddress: string): Promise<void> {
  currentWalletAddress = walletAddress
  
  // Load from backend first
  try {
    const backendTxs = await loadFromBackend(walletAddress)
    if (backendTxs.length > 0) {
      // Merge with local storage (backend takes precedence)
      const localTxs = loadFromLocalStorage()
      const merged = mergeTransactions(backendTxs, localTxs)
      saveToLocalStorage(merged)
      console.log('[TxHistory] Loaded', backendTxs.length, 'transactions from backend')
    }
  } catch (error) {
    console.warn('[TxHistory] Failed to load from backend, using local storage only:', error)
  }
}

/**
 * Load transactions from backend API
 */
async function loadFromBackend(walletAddress: string): Promise<ShieldedTransaction[]> {
  try {
    const response = await fetch(
      `${api.indexer}/api/wallet/${walletAddress}/shielded-transactions?limit=500`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }
    
    const data = await response.json()
    return data.transactions || []
  } catch (error) {
    console.warn('[TxHistory] Backend load error:', error)
    return []
  }
}

/**
 * Sync transactions to backend API
 */
async function syncToBackend(walletAddress: string, transactions: ShieldedTransaction[]): Promise<void> {
  if (syncInProgress) {
    console.log('[TxHistory] Sync already in progress, skipping')
    return
  }
  
  syncInProgress = true
  try {
    const response = await fetch(
      `${api.indexer}/api/wallet/${walletAddress}/shielded-transactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }
    
    console.log('[TxHistory] Synced', transactions.length, 'transactions to backend')
  } catch (error) {
    console.warn('[TxHistory] Backend sync error (will retry later):', error)
    // Don't throw - we continue with local storage
  } finally {
    syncInProgress = false
  }
}

/**
 * Merge backend and local transactions (backend takes precedence)
 */
function mergeTransactions(
  backend: ShieldedTransaction[],
  local: ShieldedTransaction[]
): ShieldedTransaction[] {
  const merged = new Map<string, ShieldedTransaction>()
  
  // Add local first
  for (const tx of local) {
    merged.set(tx.id, tx)
  }
  
  // Overwrite with backend (more up-to-date)
  for (const tx of backend) {
    merged.set(tx.id, tx)
  }
  
  // Sort by timestamp descending
  return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Load from local storage
 */
function loadFromLocalStorage(): ShieldedTransaction[] {
  if (typeof localStorage === 'undefined' || !currentWalletAddress) {
    return []
  }
  
  const key = getStorageKey()
  const stored = localStorage.getItem(key)
  if (!stored) return []
  
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

/**
 * Save to local storage
 */
function saveToLocalStorage(history: ShieldedTransaction[]): void {
  if (typeof localStorage === 'undefined' || !currentWalletAddress) {
    return
  }
  
  const key = getStorageKey()
  localStorage.setItem(key, JSON.stringify(history))
}

/**
 * Add a transaction to history
 * Syncs to backend in background
 */
export async function addTransaction(tx: Omit<ShieldedTransaction, 'id'>): Promise<void> {
  if (!currentWalletAddress) {
    console.warn('[TxHistory] No wallet address set, skipping transaction save')
    return
  }
  
  const id = `${tx.txHash}-${tx.type}`
  const transaction: ShieldedTransaction = {
    ...tx,
    id,
  }
  
  const history = getTransactionHistory()
  
  // Check if already exists (avoid duplicates)
  if (history.some(t => t.id === id)) {
    console.log('[TxHistory] Transaction already exists:', id)
    return
  }
  
  // Add to beginning (most recent first)
  history.unshift(transaction)
  
  // Keep last 500 transactions
  if (history.length > 500) {
    history.splice(500)
  }
  
  saveToLocalStorage(history)
  console.log('[TxHistory] Added transaction:', id, tx.type)
  
  // Sync to backend in background (don't await)
  syncToBackend(currentWalletAddress, history).catch(err => {
    console.warn('[TxHistory] Background sync failed:', err)
  })
}

/**
 * Update transaction status
 * Syncs to backend in background
 */
export async function updateTransactionStatus(
  txHash: string,
  type: TransactionType,
  status: 'pending' | 'confirmed' | 'failed',
  blockNumber?: number
): Promise<void> {
  if (!currentWalletAddress) {
    return
  }
  
  const history = getTransactionHistory()
  const id = `${txHash}-${type}`
  
  const index = history.findIndex(t => t.id === id)
  if (index !== -1) {
    history[index].status = status
    if (blockNumber) {
      history[index].blockNumber = blockNumber
    }
    saveToLocalStorage(history)
    
    // Sync to backend in background (don't await)
    syncToBackend(currentWalletAddress, history).catch(err => {
      console.warn('[TxHistory] Background sync failed:', err)
    })
  }
}

/**
 * Get all transactions for current wallet
 */
export function getTransactionHistory(): ShieldedTransaction[] {
  return loadFromLocalStorage()
}

/**
 * Get transactions filtered by type
 */
export function getTransactionsByType(type: TransactionType): ShieldedTransaction[] {
  return getTransactionHistory().filter(tx => tx.type === type)
}

/**
 * Get recent transactions (last N)
 */
export function getRecentTransactions(limit: number = 50): ShieldedTransaction[] {
  return getTransactionHistory().slice(0, limit)
}

/**
 * Clear transaction history (for testing)
 */
export function clearTransactionHistory(): void {
  if (typeof localStorage === 'undefined' || !currentWalletAddress) {
    return
  }
  
  const key = getStorageKey()
  localStorage.removeItem(key)
}

/**
 * Force sync current transaction history to backend
 */
export async function syncTransactionHistory(): Promise<void> {
  if (!currentWalletAddress) {
    return
  }
  
  const history = getTransactionHistory()
  await syncToBackend(currentWalletAddress, history)
}

/**
 * Helper: Format transaction for display
 */
export function formatTransactionType(type: TransactionType): string {
  switch (type) {
    case 'shield':
      return 'Shield'
    case 'transfer':
      return 'Transfer'
    case 'swap':
      return 'Swap'
    case 'unshield':
      return 'Unshield'
  }
}

