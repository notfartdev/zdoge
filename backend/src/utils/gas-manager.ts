/**
 * Gas Price Manager
 * 
 * Handles dynamic gas pricing to prevent stuck transactions.
 */

import { createPublicClient, http, formatGwei, parseGwei } from 'viem';
import { dogeosTestnet } from '../config.js';

// Gas price configuration
const GAS_CONFIG = {
  // Minimum gas price (in gwei)
  minGasPrice: 1n,
  // Maximum gas price multiplier over base
  maxMultiplier: 2,
  // Priority fee for faster inclusion
  priorityFee: parseGwei('0.1'),
  // Cache duration in ms
  cacheDuration: 10000, // 10 seconds
  // Retry bump percentage (10%)
  retryBumpPercent: 10,
};

interface GasPriceCache {
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  timestamp: number;
}

let gasPriceCache: GasPriceCache | null = null;

// Create client for gas price queries
const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
});

/**
 * Get current gas price with caching
 */
export async function getGasPrice(): Promise<bigint> {
  const now = Date.now();
  
  // Return cached value if fresh
  if (gasPriceCache && (now - gasPriceCache.timestamp) < GAS_CONFIG.cacheDuration) {
    return gasPriceCache.gasPrice;
  }
  
  try {
    const gasPrice = await publicClient.getGasPrice();
    
    // Apply minimum
    const effectiveGasPrice = gasPrice > GAS_CONFIG.minGasPrice 
      ? gasPrice 
      : GAS_CONFIG.minGasPrice;
    
    gasPriceCache = {
      gasPrice: effectiveGasPrice,
      timestamp: now,
    };
    
    console.log(`[Gas] Current gas price: ${formatGwei(effectiveGasPrice)} gwei`);
    return effectiveGasPrice;
    
  } catch (error) {
    console.error('[Gas] Failed to fetch gas price, using fallback');
    // Fallback to minimum
    return GAS_CONFIG.minGasPrice;
  }
}

/**
 * Get gas price for EIP-1559 transactions
 */
export async function getEIP1559GasPrice(): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  const now = Date.now();
  
  // Return cached value if fresh
  if (gasPriceCache?.maxFeePerGas && (now - gasPriceCache.timestamp) < GAS_CONFIG.cacheDuration) {
    return {
      maxFeePerGas: gasPriceCache.maxFeePerGas,
      maxPriorityFeePerGas: gasPriceCache.maxPriorityFeePerGas!,
    };
  }
  
  try {
    // Get base fee from latest block
    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const baseFee = block.baseFeePerGas || parseGwei('1');
    
    // Calculate max fee (base fee * 2 + priority fee)
    const maxFeePerGas = baseFee * BigInt(GAS_CONFIG.maxMultiplier) + GAS_CONFIG.priorityFee;
    const maxPriorityFeePerGas = GAS_CONFIG.priorityFee;
    
    gasPriceCache = {
      gasPrice: maxFeePerGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      timestamp: now,
    };
    
    console.log(`[Gas] EIP-1559: maxFee=${formatGwei(maxFeePerGas)} gwei, priority=${formatGwei(maxPriorityFeePerGas)} gwei`);
    
    return { maxFeePerGas, maxPriorityFeePerGas };
    
  } catch (error) {
    console.error('[Gas] Failed to get EIP-1559 gas, falling back to legacy');
    const gasPrice = await getGasPrice();
    return {
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: GAS_CONFIG.priorityFee,
    };
  }
}

/**
 * Calculate bumped gas price for retry
 */
export function bumpGasPrice(currentGasPrice: bigint): bigint {
  const bump = (currentGasPrice * BigInt(GAS_CONFIG.retryBumpPercent)) / 100n;
  return currentGasPrice + bump;
}

/**
 * Estimate if transaction is likely to be stuck
 */
export async function isGasPriceTooLow(txGasPrice: bigint): Promise<boolean> {
  const currentGasPrice = await getGasPrice();
  // Consider stuck if tx gas price is less than 80% of current
  return txGasPrice < (currentGasPrice * 80n) / 100n;
}

/**
 * Get gas limit with buffer
 */
export function getGasLimitWithBuffer(estimatedGas: bigint, bufferPercent: number = 20): bigint {
  const buffer = (estimatedGas * BigInt(bufferPercent)) / 100n;
  return estimatedGas + buffer;
}

console.log('[Gas] Gas manager initialized');

