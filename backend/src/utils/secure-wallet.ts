/**
 * Secure Wallet Management
 * 
 * Handles private key security and transaction management.
 * For production, integrate with AWS KMS, HashiCorp Vault, or hardware wallets.
 * 
 * Key Management Options:
 * - Set KEY_PROVIDER=env (default) for environment variable
 * - Set KEY_PROVIDER=aws-kms for AWS KMS (production recommended)
 * - Set KEY_PROVIDER=vault for HashiCorp Vault (production recommended)
 */

import { createWalletClient, createPublicClient, http, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { dogeosTestnet } from '../config.js';
import { 
  loadPrivateKey, 
  runSecurityChecks, 
  validateKeyConfiguration,
  type SecurityValidation 
} from './key-management.js';

// ============ Security Warnings ============

const SECURITY_WARNINGS: string[] = [];

function addSecurityWarning(warning: string) {
  if (!SECURITY_WARNINGS.includes(warning)) {
    SECURITY_WARNINGS.push(warning);
    console.warn(`⚠️  SECURITY WARNING: ${warning}`);
  }
}

export function getSecurityWarnings(): string[] {
  return [...SECURITY_WARNINGS];
}

// ============ Nonce Management ============

interface NonceState {
  current: number;
  pending: Map<number, { hash: Hash; timestamp: number }>;
  lastConfirmed: number;
}

const nonceStates: Map<Address, NonceState> = new Map();

async function getNextNonce(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address
): Promise<number> {
  let state = nonceStates.get(address);
  
  if (!state) {
    // Initialize nonce state from chain
    const onChainNonce = await publicClient.getTransactionCount({ address });
    state = {
      current: onChainNonce,
      pending: new Map(),
      lastConfirmed: onChainNonce - 1,
    };
    nonceStates.set(address, state);
  }
  
  // Clean up old pending transactions (older than 5 minutes)
  const now = Date.now();
  for (const [nonce, tx] of state.pending.entries()) {
    if (now - tx.timestamp > 5 * 60 * 1000) {
      state.pending.delete(nonce);
    }
  }
  
  // Find next available nonce
  let nextNonce = state.current;
  while (state.pending.has(nextNonce)) {
    nextNonce++;
  }
  
  return nextNonce;
}

function markNoncePending(address: Address, nonce: number, hash: Hash) {
  const state = nonceStates.get(address);
  if (state) {
    state.pending.set(nonce, { hash, timestamp: Date.now() });
    state.current = Math.max(state.current, nonce + 1);
  }
}

function confirmNonce(address: Address, nonce: number) {
  const state = nonceStates.get(address);
  if (state) {
    state.pending.delete(nonce);
    state.lastConfirmed = Math.max(state.lastConfirmed, nonce);
  }
}

// ============ Transaction Retry Logic ============

interface TransactionConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_TX_CONFIG: TransactionConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface TransactionResult {
  success: boolean;
  hash?: Hash;
  error?: string;
  errorCode?: string;
  retries: number;
}

// ============ Secure Wallet Factory ============

export interface SecureWallet {
  address: Address;
  sendTransaction: (params: {
    to: Address;
    data: `0x${string}`;
    value?: bigint;
  }) => Promise<TransactionResult>;
  writeContract: (params: {
    address: Address;
    abi: any;
    functionName: string;
    args: any[];
  }) => Promise<TransactionResult>;
  getBalance: () => Promise<bigint>;
}

export async function createSecureWalletAsync(rpcUrl: string): Promise<SecureWallet | null> {
  // Run security checks first
  const securityPassed = runSecurityChecks();
  
  if (!securityPassed && process.env.NODE_ENV === 'production') {
    console.error('❌ Security checks failed - cannot start in production mode');
    return null;
  }
  
  // Load private key using key management service
  const privateKey = await loadPrivateKey();
  
  if (!privateKey) {
    console.error('❌ Failed to load private key');
    return null;
  }
  
  // Additional security warnings
  const validation = validateKeyConfiguration();
  validation.warnings.forEach(w => addSecurityWarning(w));
  
  try {
    const account = privateKeyToAccount(privateKey);
    
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(rpcUrl),
    });
    
    const walletClient = createWalletClient({
      account,
      chain: dogeosTestnet,
      transport: http(rpcUrl),
    });
    
    console.log(`✅ Secure wallet initialized (async): ${account.address}`);
    
    return createWalletInterface(account, publicClient, walletClient);
    
  } catch (error: any) {
    console.error('❌ Failed to create secure wallet:', error.message);
    return null;
  }
}

/**
 * Synchronous wrapper for backward compatibility
 * Uses environment variable directly (for simple setups)
 */
export function createSecureWallet(rpcUrl: string): SecureWallet | null {
  // Get private key from environment (synchronous path)
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ RELAYER_PRIVATE_KEY not set in environment');
    return null;
  }
  
  // Validate private key format
  const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  if (!/^0x[0-9a-fA-F]{64}$/.test(cleanKey)) {
    console.error('❌ Invalid private key format');
    return null;
  }
  
  // Security checks
  if (process.env.NODE_ENV === 'production') {
    addSecurityWarning('Using raw private key in production. Consider AWS KMS or hardware wallet.');
  }
  
  try {
    const account = privateKeyToAccount(cleanKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(rpcUrl),
    });
    
    const walletClient = createWalletClient({
      account,
      chain: dogeosTestnet,
      transport: http(rpcUrl),
    });
    
    console.log(`✅ Secure wallet initialized: ${account.address}`);
    
    // Return the same interface as async version
    return createWalletInterface(account, publicClient, walletClient);
    
  } catch (error: any) {
    console.error('❌ Failed to create secure wallet:', error.message);
    return null;
  }
}

/**
 * Helper to create wallet interface (shared by sync and async versions)
 */
function createWalletInterface(
  account: ReturnType<typeof privateKeyToAccount>,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>
): SecureWallet {
  // Transaction sender with retry logic
  async function sendTransactionWithRetry(
    sendFn: (nonce: number) => Promise<Hash>,
    config: TransactionConfig = DEFAULT_TX_CONFIG
  ): Promise<TransactionResult> {
    let lastError: Error | null = null;
    let retries = 0;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const nonce = await getNextNonce(publicClient as any, account.address);
        console.log(`[TX] Attempt ${attempt + 1}/${config.maxRetries + 1}, nonce: ${nonce}`);
        
        const hash = await sendFn(nonce);
        markNoncePending(account.address, nonce, hash);
        
        // Wait for confirmation
        try {
          const receipt = await (publicClient as any).waitForTransactionReceipt({ 
            hash,
            timeout: 60_000,
          });
          
          confirmNonce(account.address, nonce);
          
          if (receipt.status === 'success') {
            return { success: true, hash, retries };
          } else {
            return { 
              success: false, 
              hash,
              error: 'Transaction reverted',
              errorCode: 'TX_REVERTED',
              retries 
            };
          }
        } catch (waitError: any) {
          console.warn(`[TX] Wait timeout for ${hash}, may still be pending`);
          return { success: true, hash, retries };
        }
        
      } catch (error: any) {
        lastError = error;
        retries++;
        
        const errorMessage = error.message || String(error);
        
        if (errorMessage.includes('nonce too low')) {
          console.warn('[TX] Nonce too low, refreshing...');
          const state = nonceStates.get(account.address);
          if (state) {
            const onChainNonce = await (publicClient as any).getTransactionCount({ address: account.address });
            state.current = onChainNonce;
          }
          continue;
        }
        
        if (errorMessage.includes('insufficient funds')) {
          return {
            success: false,
            error: 'Insufficient funds for gas',
            errorCode: 'INSUFFICIENT_FUNDS',
            retries,
          };
        }
        
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(2, attempt),
            config.maxDelayMs
          );
          console.log(`[TX] Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      errorCode: 'MAX_RETRIES_EXCEEDED',
      retries,
    };
  }
  
  return {
    address: account.address,
    
    async sendTransaction({ to, data, value }) {
      return sendTransactionWithRetry(async (nonce) => {
        return (walletClient as any).sendTransaction({
          to,
          data,
          value,
          nonce,
        });
      });
    },
    
    async writeContract({ address, abi, functionName, args }) {
      return sendTransactionWithRetry(async (nonce) => {
        return (walletClient as any).writeContract({
          address,
          abi,
          functionName,
          args,
          nonce,
        });
      });
    },
    
    async getBalance() {
      return (publicClient as any).getBalance({ address: account.address });
    },
  };
}

// ============ Error Codes ============

export const ERROR_CODES = {
  // Relay errors
  RELAY_NOT_CONFIGURED: { code: 'E001', message: 'Relayer not configured' },
  RELAY_INSUFFICIENT_BALANCE: { code: 'E002', message: 'Relayer has insufficient balance for gas' },
  RELAY_RATE_LIMITED: { code: 'E003', message: 'Too many requests, please try again later' },
  
  // Transaction errors
  TX_FAILED: { code: 'E010', message: 'Transaction failed' },
  TX_REVERTED: { code: 'E011', message: 'Transaction reverted on chain' },
  TX_TIMEOUT: { code: 'E012', message: 'Transaction confirmation timeout' },
  TX_NONCE_ERROR: { code: 'E013', message: 'Nonce conflict, please retry' },
  
  // Validation errors
  INVALID_PROOF: { code: 'E020', message: 'Invalid zero-knowledge proof' },
  INVALID_ROOT: { code: 'E021', message: 'Unknown merkle root' },
  NULLIFIER_SPENT: { code: 'E022', message: 'Note has already been withdrawn' },
  INVALID_PARAMS: { code: 'E023', message: 'Missing or invalid parameters' },
  
  // Pool errors
  POOL_NOT_FOUND: { code: 'E030', message: 'Pool not found' },
  POOL_SYNC_FAILED: { code: 'E031', message: 'Failed to sync pool data' },
  
  // General errors
  INTERNAL_ERROR: { code: 'E999', message: 'Internal server error' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function createErrorResponse(code: ErrorCode, details?: string) {
  const errorInfo = ERROR_CODES[code];
  return {
    error: errorInfo.message,
    code: errorInfo.code,
    details: details || undefined,
  };
}

