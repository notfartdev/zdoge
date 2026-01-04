/**
 * Shielded Transaction History Service
 * 
 * Tracks and stores all shielded transactions for display in Activity page
 */

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

function getStorageKey(): string {
  const addr = currentWalletAddress?.toLowerCase() || 'default'
  return `${STORAGE_PREFIX}${addr}`
}

/**
 * Initialize transaction history for a wallet
 */
export function initTransactionHistory(walletAddress: string): void {
  currentWalletAddress = walletAddress
}

/**
 * Add a transaction to history
 */
export function addTransaction(tx: Omit<ShieldedTransaction, 'id'>): void {
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
  
  saveTransactionHistory(history)
  console.log('[TxHistory] Added transaction:', id, tx.type)
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(
  txHash: string,
  type: TransactionType,
  status: 'pending' | 'confirmed' | 'failed',
  blockNumber?: number
): void {
  const history = getTransactionHistory()
  const id = `${txHash}-${type}`
  
  const index = history.findIndex(t => t.id === id)
  if (index !== -1) {
    history[index].status = status
    if (blockNumber) {
      history[index].blockNumber = blockNumber
    }
    saveTransactionHistory(history)
  }
}

/**
 * Get all transactions for current wallet
 */
export function getTransactionHistory(): ShieldedTransaction[] {
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

function saveTransactionHistory(history: ShieldedTransaction[]): void {
  if (typeof localStorage === 'undefined' || !currentWalletAddress) {
    return
  }
  
  const key = getStorageKey()
  localStorage.setItem(key, JSON.stringify(history))
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

