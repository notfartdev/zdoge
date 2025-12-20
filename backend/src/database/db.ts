/**
 * Database Service
 * 
 * PostgreSQL database connection and query management.
 * Uses pg library for PostgreSQL connections.
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dogenado',
  user: process.env.DB_USER || 'dogenado',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Connection pool
let pool: pg.Pool | null = null;

/**
 * Initialize database connection pool
 */
export async function initDatabase(): Promise<boolean> {
  try {
    pool = new Pool(DB_CONFIG);
    
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log(`[Database] Connected to PostgreSQL at ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
    return true;
    
  } catch (error: any) {
    console.error('[Database] Failed to connect:', error.message);
    console.warn('[Database] Falling back to in-memory storage');
    pool = null;
    return false;
  }
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return pool !== null;
}

/**
 * Execute a query
 */
export async function query(
  text: string, 
  params?: any[]
): Promise<pg.QueryResult<any>> {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`[Database] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error: any) {
    console.error('[Database] Query error:', error.message);
    throw error;
  }
}

/**
 * Execute a query and return first row
 */
export async function queryOne<T = any>(
  text: string, 
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Database] Connection pool closed');
  }
}

// ============ Deposit Operations ============

export interface DepositRecord {
  id?: string;
  pool_address: string;
  commitment: string;
  leaf_index: number;
  depositor_address?: string;
  tx_hash: string;
  block_number: number;
  timestamp: Date;
  is_withdrawn: boolean;
}

export async function insertDeposit(deposit: Omit<DepositRecord, 'id'>): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO deposits 
     (pool_address, commitment, leaf_index, depositor_address, tx_hash, block_number, timestamp, is_withdrawn)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (pool_address, commitment) DO UPDATE SET
       depositor_address = COALESCE(EXCLUDED.depositor_address, deposits.depositor_address)
     RETURNING id`,
    [
      deposit.pool_address.toLowerCase(),
      deposit.commitment,
      deposit.leaf_index,
      deposit.depositor_address?.toLowerCase(),
      deposit.tx_hash,
      deposit.block_number,
      deposit.timestamp,
      deposit.is_withdrawn,
    ]
  );
  return result.rows[0].id;
}

export async function getDepositsForPool(poolAddress: string): Promise<DepositRecord[]> {
  const result = await query<DepositRecord>(
    `SELECT * FROM deposits 
     WHERE pool_address = $1 
     ORDER BY leaf_index ASC`,
    [poolAddress.toLowerCase()]
  );
  return result.rows;
}

export async function getDepositsForWallet(walletAddress: string): Promise<DepositRecord[]> {
  const result = await query<DepositRecord>(
    `SELECT * FROM deposits 
     WHERE depositor_address = $1 
     ORDER BY timestamp DESC`,
    [walletAddress.toLowerCase()]
  );
  return result.rows;
}

export async function getRecentDeposits(
  poolAddress: string, 
  limit: number = 10
): Promise<DepositRecord[]> {
  const result = await query<DepositRecord>(
    `SELECT * FROM deposits 
     WHERE pool_address = $1 
     ORDER BY timestamp DESC 
     LIMIT $2`,
    [poolAddress.toLowerCase(), limit]
  );
  return result.rows;
}

export async function markDepositAsWithdrawn(
  poolAddress: string, 
  commitment: string
): Promise<void> {
  await query(
    `UPDATE deposits SET is_withdrawn = TRUE WHERE pool_address = $1 AND commitment = $2`,
    [poolAddress.toLowerCase(), commitment]
  );
}

// ============ Nullifier Operations ============

export interface NullifierRecord {
  id?: string;
  pool_address: string;
  nullifier_hash: string;
  tx_hash: string;
  block_number: number;
  timestamp: Date;
}

export async function insertNullifier(nullifier: Omit<NullifierRecord, 'id'>): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO nullifiers 
     (pool_address, nullifier_hash, tx_hash, block_number, timestamp)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pool_address, nullifier_hash) DO NOTHING
     RETURNING id`,
    [
      nullifier.pool_address.toLowerCase(),
      nullifier.nullifier_hash,
      nullifier.tx_hash,
      nullifier.block_number,
      nullifier.timestamp,
    ]
  );
  return result.rows[0]?.id || '';
}

export async function isNullifierSpent(
  poolAddress: string, 
  nullifierHash: string
): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM nullifiers 
     WHERE pool_address = $1 AND nullifier_hash = $2`,
    [poolAddress.toLowerCase(), nullifierHash]
  );
  return parseInt(result?.count || '0') > 0;
}

export async function getNullifiersForPool(poolAddress: string): Promise<string[]> {
  const result = await query<{ nullifier_hash: string }>(
    `SELECT nullifier_hash FROM nullifiers WHERE pool_address = $1`,
    [poolAddress.toLowerCase()]
  );
  return result.rows.map(r => r.nullifier_hash);
}

// ============ Scheduled Withdrawal Operations ============

export interface ScheduledWithdrawalRecord {
  id?: string;
  pool_address: string;
  nullifier_hash: string;
  recipient: string;
  relayer: string;
  fee: string;
  unlock_time: Date;
  status: 'pending' | 'ready' | 'executed' | 'expired';
  scheduled_tx_hash?: string;
  executed_tx_hash?: string;
  depositor_address?: string;
}

export async function insertScheduledWithdrawal(
  withdrawal: Omit<ScheduledWithdrawalRecord, 'id'>
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO scheduled_withdrawals 
     (pool_address, nullifier_hash, recipient, relayer, fee, unlock_time, status, scheduled_tx_hash, depositor_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (pool_address, nullifier_hash) DO UPDATE SET
       status = EXCLUDED.status,
       scheduled_tx_hash = EXCLUDED.scheduled_tx_hash
     RETURNING id`,
    [
      withdrawal.pool_address.toLowerCase(),
      withdrawal.nullifier_hash,
      withdrawal.recipient.toLowerCase(),
      withdrawal.relayer.toLowerCase(),
      withdrawal.fee,
      withdrawal.unlock_time,
      withdrawal.status,
      withdrawal.scheduled_tx_hash,
      withdrawal.depositor_address?.toLowerCase(),
    ]
  );
  return result.rows[0].id;
}

export async function getScheduledWithdrawalsForWallet(
  walletAddress: string
): Promise<ScheduledWithdrawalRecord[]> {
  const result = await query<ScheduledWithdrawalRecord>(
    `SELECT * FROM scheduled_withdrawals 
     WHERE recipient = $1 OR depositor_address = $1
     ORDER BY unlock_time ASC`,
    [walletAddress.toLowerCase()]
  );
  return result.rows;
}

export async function updateScheduledWithdrawalStatus(
  poolAddress: string,
  nullifierHash: string,
  status: ScheduledWithdrawalRecord['status'],
  executedTxHash?: string
): Promise<void> {
  await query(
    `UPDATE scheduled_withdrawals 
     SET status = $3, executed_tx_hash = $4, updated_at = NOW()
     WHERE pool_address = $1 AND nullifier_hash = $2`,
    [poolAddress.toLowerCase(), nullifierHash, status, executedTxHash]
  );
}

// ============ Withdrawal Operations ============

export interface WithdrawalRecord {
  id?: string;
  pool_address: string;
  nullifier_hash: string;
  recipient: string;
  relayer: string;
  fee: string;
  tx_hash: string;
  block_number: number;
  timestamp: Date;
}

export async function insertWithdrawal(
  withdrawal: Omit<WithdrawalRecord, 'id'>
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO withdrawals 
     (pool_address, nullifier_hash, recipient, relayer, fee, tx_hash, block_number, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (pool_address, nullifier_hash) DO NOTHING
     RETURNING id`,
    [
      withdrawal.pool_address.toLowerCase(),
      withdrawal.nullifier_hash,
      withdrawal.recipient.toLowerCase(),
      withdrawal.relayer.toLowerCase(),
      withdrawal.fee,
      withdrawal.tx_hash,
      withdrawal.block_number,
      withdrawal.timestamp,
    ]
  );
  return result.rows[0]?.id || '';
}

export async function getWithdrawalsForWallet(
  walletAddress: string
): Promise<WithdrawalRecord[]> {
  const result = await query<WithdrawalRecord>(
    `SELECT * FROM withdrawals 
     WHERE recipient = $1 
     ORDER BY timestamp DESC`,
    [walletAddress.toLowerCase()]
  );
  return result.rows;
}

// ============ Merkle Root Operations ============

export async function insertMerkleRoot(
  poolAddress: string,
  root: string,
  leafCount: number,
  blockNumber: number
): Promise<void> {
  await query(
    `INSERT INTO merkle_roots (pool_address, root, leaf_count, block_number)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pool_address, root) DO NOTHING`,
    [poolAddress.toLowerCase(), root, leafCount, blockNumber]
  );
}

export async function isMerkleRootKnown(
  poolAddress: string,
  root: string
): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM merkle_roots 
     WHERE pool_address = $1 AND root = $2`,
    [poolAddress.toLowerCase(), root]
  );
  return parseInt(result?.count || '0') > 0;
}

// ============ Sync State Operations ============

export async function getSyncState(poolAddress: string): Promise<{
  lastDepositBlock: number;
  lastWithdrawalBlock: number;
  depositsCount: number;
  nullifiersCount: number;
} | null> {
  const result = await queryOne<{
    last_deposit_block: number;
    last_withdrawal_block: number;
    deposits_count: number;
    nullifiers_count: number;
  }>(
    `SELECT * FROM sync_state WHERE pool_address = $1`,
    [poolAddress.toLowerCase()]
  );
  
  if (!result) return null;
  
  return {
    lastDepositBlock: result.last_deposit_block,
    lastWithdrawalBlock: result.last_withdrawal_block,
    depositsCount: result.deposits_count,
    nullifiersCount: result.nullifiers_count,
  };
}

export async function updateSyncState(
  poolAddress: string,
  updates: {
    lastDepositBlock?: number;
    lastWithdrawalBlock?: number;
    depositsCount?: number;
    nullifiersCount?: number;
  }
): Promise<void> {
  await query(
    `INSERT INTO sync_state (pool_address, last_deposit_block, last_withdrawal_block, deposits_count, nullifiers_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pool_address) DO UPDATE SET
       last_deposit_block = COALESCE($2, sync_state.last_deposit_block),
       last_withdrawal_block = COALESCE($3, sync_state.last_withdrawal_block),
       deposits_count = COALESCE($4, sync_state.deposits_count),
       nullifiers_count = COALESCE($5, sync_state.nullifiers_count)`,
    [
      poolAddress.toLowerCase(),
      updates.lastDepositBlock || 0,
      updates.lastWithdrawalBlock || 0,
      updates.depositsCount || 0,
      updates.nullifiersCount || 0,
    ]
  );
}

// ============ Transaction Log Operations ============

export async function logTransaction(
  txType: 'relay' | 'schedule' | 'execute',
  poolAddress: string | null,
  txHash: string | null,
  status: 'pending' | 'success' | 'failed',
  durationMs: number,
  errorCode?: string,
  errorMessage?: string,
  gasUsed?: number,
  gasPrice?: string
): Promise<void> {
  await query(
    `INSERT INTO transaction_logs 
     (tx_type, pool_address, tx_hash, status, duration_ms, error_code, error_message, gas_used, gas_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [txType, poolAddress?.toLowerCase(), txHash, status, durationMs, errorCode, errorMessage, gasUsed, gasPrice]
  );
}

// ============ Statistics ============

export async function getPoolStats(poolAddress: string): Promise<{
  totalDeposits: number;
  totalWithdrawals: number;
  activeDeposits: number;
}> {
  const result = await queryOne<{
    total_deposits: string;
    total_withdrawals: string;
  }>(
    `SELECT 
       (SELECT COUNT(*) FROM deposits WHERE pool_address = $1) as total_deposits,
       (SELECT COUNT(*) FROM nullifiers WHERE pool_address = $1) as total_withdrawals`,
    [poolAddress.toLowerCase()]
  );
  
  const totalDeposits = parseInt(result?.total_deposits || '0');
  const totalWithdrawals = parseInt(result?.total_withdrawals || '0');
  
  return {
    totalDeposits,
    totalWithdrawals,
    activeDeposits: totalDeposits - totalWithdrawals,
  };
}

export async function getGlobalStats(): Promise<{
  totalPools: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
}> {
  const result = await queryOne<{
    total_pools: string;
    total_deposits: string;
    total_withdrawals: string;
    total_tx: string;
    success_tx: string;
    failed_tx: string;
  }>(
    `SELECT 
       (SELECT COUNT(*) FROM pools) as total_pools,
       (SELECT COUNT(*) FROM deposits) as total_deposits,
       (SELECT COUNT(*) FROM nullifiers) as total_withdrawals,
       (SELECT COUNT(*) FROM transaction_logs) as total_tx,
       (SELECT COUNT(*) FROM transaction_logs WHERE status = 'success') as success_tx,
       (SELECT COUNT(*) FROM transaction_logs WHERE status = 'failed') as failed_tx`
  );
  
  return {
    totalPools: parseInt(result?.total_pools || '0'),
    totalDeposits: parseInt(result?.total_deposits || '0'),
    totalWithdrawals: parseInt(result?.total_withdrawals || '0'),
    totalTransactions: parseInt(result?.total_tx || '0'),
    successfulTransactions: parseInt(result?.success_tx || '0'),
    failedTransactions: parseInt(result?.failed_tx || '0'),
  };
}

