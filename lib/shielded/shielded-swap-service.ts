/**
 * Shielded Swap Service
 * 
 * Enables private token swaps within the shielded layer.
 * Similar to Vanish.trade's approach but with our shielded note system.
 * 
 * Flow:
 * 1. User has shielded DOGE note
 * 2. User wants to swap to USDC
 * 3. Swap happens privately - old note destroyed, new note created
 * 4. On-chain: only sees nullifier + new commitment, not the swap details
 * 
 * This is DIFFERENT from transfer (z→z):
 * - Transfer: Same token, different owner
 * - Swap: Different token, same owner
 */

import {
  ShieldedNote,
  createNote,
  formatWeiToAmount,
  parseAmountToWei,
} from './shielded-note';
import { ShieldedIdentity } from './shielded-address';
import {
  randomFieldElement,
  computeCommitment,
  computeNullifier,
  computeNullifierHash,
  toBytes32,
  mimcHash2,
} from './shielded-crypto';
import { fetchMerklePath, generateSwapProof, fetchCommitmentsFromChain } from './shielded-proof-service';

// Cache for valid leaf indices per contract (avoids repeated fetches)
let validLeafIndicesCache: { poolAddress: string; leafIndices: Set<number>; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minute cache

// Supported tokens for shielded swaps
export const SWAP_TOKENS = {
  DOGE: {
    symbol: 'DOGE',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000', // Native
    isNative: true,
  },
  USDC: {
    symbol: 'USDC',
    decimals: 18,
    address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925',
  },
  USDT: {
    symbol: 'USDT',
    decimals: 18,
    address: '0xC81800b77D91391Ef03d7868cB81204E753093a9',
  },
  WETH: {
    symbol: 'WETH',
    decimals: 18,
    address: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000',
  },
} as const;

export type SwapToken = keyof typeof SWAP_TOKENS;

export interface SwapQuote {
  inputToken: SwapToken;
  outputToken: SwapToken;
  inputAmount: bigint;
  outputAmount: bigint;
  exchangeRate: number;
  priceImpact: number;
  fee: bigint;
  expiresAt: number;
}

export interface SwapProofInput {
  // Public
  merkleRoot: bigint;
  inputNullifierHash: bigint;
  outputCommitment: bigint;
  inputTokenAddress: bigint;
  outputTokenAddress: bigint;
  inputAmount: bigint;
  outputAmount: bigint;
  
  // Private
  inputNote: ShieldedNote;
  outputNote: ShieldedNote;
  spendingKey: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

// Cache for real-time prices
interface PriceCache {
  prices: Record<string, number>;
  lastUpdated: number;
}

let priceCache: PriceCache = {
  prices: {},
  lastUpdated: 0,
};

const CACHE_DURATION = 30000; // 30 seconds

// CoinGecko token IDs
const COINGECKO_IDS: Record<string, string> = {
  DOGE: 'dogecoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  WETH: 'ethereum',
};

/**
 * Fetch real-time prices from CoinGecko
 */
async function fetchRealTimePrices(): Promise<Record<string, number>> {
  // Check cache
  if (Date.now() - priceCache.lastUpdated < CACHE_DURATION) {
    return priceCache.prices;
  }

  try {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }
    
    const data = await response.json();
    
    // Convert to our token symbols
    const prices: Record<string, number> = {};
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      if (data[geckoId]?.usd) {
        prices[symbol] = data[geckoId].usd;
      }
    }
    
    // Update cache
    priceCache = {
      prices,
      lastUpdated: Date.now(),
    };
    
    return prices;
  } catch (error) {
    console.warn('Failed to fetch real-time prices, using fallback:', error);
    
    // Fallback prices
    return {
      DOGE: 0.15,
      USDC: 1.0,
      USDT: 1.0,
      WETH: 3000,
    };
  }
}

/**
 * Calculate exchange rate between two tokens
 */
function calculateExchangeRate(
  inputToken: SwapToken,
  outputToken: SwapToken,
  prices: Record<string, number>
): number {
  const inputPriceUsd = prices[inputToken] || 1;
  const outputPriceUsd = prices[outputToken] || 1;
  
  // inputToken / outputToken = rate
  // e.g., DOGE ($0.15) → USDC ($1.0) = 0.15
  return inputPriceUsd / outputPriceUsd;
}

/**
 * Get a swap quote with real-time prices
 * 
 * Fetches current market rates from CoinGecko and calculates the swap.
 */
export async function getSwapQuote(
  inputToken: SwapToken,
  outputToken: SwapToken,
  inputAmount: bigint
): Promise<SwapQuote> {
  // Fetch real-time prices
  const prices = await fetchRealTimePrices();
  
  // Calculate exchange rate
  const rate = calculateExchangeRate(inputToken, outputToken, prices);
  
  // Calculate amounts
  const inputDecimals = SWAP_TOKENS[inputToken].decimals;
  const outputDecimals = SWAP_TOKENS[outputToken].decimals;
  
  const inputAmountNum = Number(inputAmount) / (10 ** inputDecimals);
  const outputAmountNum = inputAmountNum * rate;
  
  // 0.3% swap fee
  const feePercent = 0.003;
  const outputAfterFee = outputAmountNum * (1 - feePercent);
  
  const outputAmount = BigInt(Math.floor(outputAfterFee * (10 ** outputDecimals)));
  const fee = BigInt(Math.floor(outputAmountNum * feePercent * (10 ** outputDecimals)));
  
  // Estimate price impact (simplified - in production use liquidity depth)
  const priceImpact = inputAmountNum > 10000 ? 0.5 : 0.1; // Higher for large trades
  
  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    exchangeRate: rate,
    priceImpact,
    fee,
    expiresAt: Date.now() + 30000, // Quote valid for 30 seconds
  };
}

/**
 * Get current USD prices for all tokens
 */
export async function getTokenPrices(): Promise<Record<string, number>> {
  return fetchRealTimePrices();
}

/**
 * Validate quote hasn't expired
 */
export function isQuoteValid(quote: SwapQuote): boolean {
  return Date.now() < quote.expiresAt;
}

/**
 * Prepare a shielded swap
 * 
 * This creates:
 * 1. Nullifier for the input note (spent)
 * 2. New note for the output token (created)
 * 3. ZK proof proving value conservation at the oracle rate
 */
export async function prepareShieldedSwap(
  inputNote: ShieldedNote,
  identity: ShieldedIdentity,
  quote: SwapQuote,
  poolAddress: string
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  inputNullifierHash: `0x${string}`;
  outputNote: ShieldedNote;
  changeNote: ShieldedNote | null;  // Change note (null if no change)
  outputCommitment: `0x${string}`;
  changeCommitment: `0x${string}`;  // Change commitment (0x0 if no change)
  merkleRoot: `0x${string}`;
}> {
  if (inputNote.leafIndex === undefined) {
    throw new Error('Input note has no leaf index');
  }
  
  // swapAmount is the amount being swapped (from quote.inputAmount)
  // This can be less than inputNote.amount if doing a partial swap
  const swapAmount = quote.inputAmount;
  
  // Verify swapAmount <= inputNote.amount
  if (swapAmount > inputNote.amount) {
    throw new Error('Quote swap amount cannot exceed input note amount');
  }
  
  // Generate real ZK proof (now supports partial swaps with change notes)
  const proofResult = await generateSwapProof(
    inputNote,
    identity,
    swapAmount,  // Amount to swap (can be less than note amount)
    quote.outputToken,
    quote.outputAmount,
    poolAddress
  );
  
  return {
    proof: {
      proof: proofResult.proof.proof,
      publicInputs: proofResult.proof.publicInputs,
    },
    inputNullifierHash: toBytes32(proofResult.nullifierHash),
    outputNote: proofResult.outputNote,
    changeNote: proofResult.changeNote,  // Added change note
    outputCommitment: toBytes32(proofResult.outputNote.commitment),
    changeCommitment: proofResult.changeNote ? toBytes32(proofResult.changeNote.commitment) : toBytes32(0n),  // Added change commitment
    merkleRoot: toBytes32(proofResult.root),
  };
}

/**
 * Get user's shielded token balances
 */
export function getShieldedBalances(notes: ShieldedNote[]): Record<string, bigint> {
  const balances: Record<string, bigint> = {};
  
  for (const note of notes) {
    if (note.leafIndex !== undefined) { // Only count confirmed notes
      const token = note.token || 'DOGE';
      balances[token] = (balances[token] || 0n) + note.amount;
    }
  }
  
  return balances;
}

/**
 * Get notes for a specific token
 */
/**
 * Fetch valid leaf indices for a given contract
 */
async function getValidLeafIndices(poolAddress: string): Promise<Set<number>> {
  // Check cache
  if (validLeafIndicesCache && 
      validLeafIndicesCache.poolAddress === poolAddress &&
      Date.now() - validLeafIndicesCache.timestamp < CACHE_TTL) {
    return validLeafIndicesCache.leafIndices;
  }

  try {
    // Fetch commitments from chain (reuses the same logic as Merkle tree building)
    const commitments = await fetchCommitmentsFromChain(poolAddress);
    const leafIndices = new Set(commitments.map(c => c.leafIndex));

    // Update cache
    validLeafIndicesCache = {
      poolAddress,
      leafIndices,
      timestamp: Date.now(),
    };

    console.log(`[Swap] Found ${leafIndices.size} valid leaf indices for contract ${poolAddress}`);
    return leafIndices;
  } catch (error) {
    console.warn('[Swap] Error fetching valid leaf indices:', error);
    return new Set(); // Return empty set on error
  }
}

/**
 * Check if a nullifier hash is already spent on-chain
 * Uses backend API endpoint for reliable checking
 */
async function isNullifierSpent(
  nullifierHash: bigint,
  poolAddress: string
): Promise<boolean> {
  try {
    const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 
      (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : 'https://dogenadocash.onrender.com');
    
    const nullifierHashHex = '0x' + nullifierHash.toString(16).padStart(64, '0');
    const response = await fetch(`${RELAYER_URL}/api/shielded/pool/${poolAddress}/nullifier/${nullifierHashHex}`);
    
    if (!response.ok) {
      console.warn('[Swap] Error checking nullifier:', response.status);
      return false; // Assume not spent if check fails
    }
    
    const data = await response.json();
    return data.isSpent === true;
  } catch (error) {
    console.warn('[Swap] Error checking if nullifier is spent:', error);
    return false; // Assume not spent if check fails
  }
}

/**
 * Check if the contract has sufficient liquidity for a swap output token
 * 
 * @param outputToken The token symbol to check liquidity for
 * @param requiredAmount The amount required (in wei/smallest unit)
 * @param poolAddress The shielded pool contract address
 * @returns Object with hasLiquidity flag and available balance
 */
export async function checkSwapLiquidity(
  outputToken: SwapToken,
  requiredAmount: bigint,
  poolAddress: string
): Promise<{ hasLiquidity: boolean; availableBalance: bigint; requiredAmount: bigint }> {
  try {
    const tokenConfig = SWAP_TOKENS[outputToken];
    const RPC_URL = 'https://rpc.testnet.dogeos.com';
    
    let availableBalance: bigint;
    
    if (tokenConfig.isNative || outputToken === 'DOGE') {
      // Check native DOGE balance
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [poolAddress, 'latest'],
        }),
      });
      
      const data = await response.json();
      availableBalance = BigInt(data.result || '0x0');
    } else {
      // Check ERC20 token balance
      const { createPublicClient, http, defineChain } = await import('viem');
      
      const dogeos = defineChain({
        id: 6281971,
        name: 'DogeOS Testnet',
        nativeCurrency: { name: 'DOGE', symbol: 'DOGE', decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      });
      
      const client = createPublicClient({
        chain: dogeos,
        transport: http(RPC_URL),
      });
      
      availableBalance = await client.readContract({
        address: tokenConfig.address as `0x${string}`,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'balanceOf',
        args: [poolAddress as `0x${string}`],
      }) as bigint;
    }
    
    return {
      hasLiquidity: availableBalance >= requiredAmount,
      availableBalance,
      requiredAmount,
    };
  } catch (error) {
    console.error('[Swap] Error checking liquidity:', error);
    // If check fails, return false to be safe
    return {
      hasLiquidity: false,
      availableBalance: 0n,
      requiredAmount,
    };
  }
}

/**
 * Filter notes to only those that exist in the current contract and are not spent
 * 
 * This prevents using notes from old contracts that don't exist in the current contract's Merkle tree,
 * and prevents using notes that have already been spent.
 */
export async function filterValidNotes(
  notes: ShieldedNote[],
  poolAddress: string,
  identity?: { spendingKey: bigint }
): Promise<ShieldedNote[]> {
  const validIndices = await getValidLeafIndices(poolAddress);
  
  // First filter by leaf index
  let filtered = notes.filter(note => {
    if (note.leafIndex === undefined) return false;
    return validIndices.has(note.leafIndex);
  });
  
  const filteredByIndex = notes.length - filtered.length;
  if (filteredByIndex > 0) {
    console.log(`[Swap] Filtered out ${filteredByIndex} note(s) that don't exist in the current contract (${poolAddress}). ` +
                `These notes are from an old contract and need to be unshielded from the old contract first.`);
  }
  
  // Then filter out spent notes if identity is provided
  if (identity) {
    const unspentNotes: typeof filtered = [];
    for (const note of filtered) {
      if (note.leafIndex === undefined) continue;
      
      try {
        const nullifier = await computeNullifier(
          note.secret,
          BigInt(note.leafIndex),
          identity.spendingKey
        );
        const nullifierHash = await computeNullifierHash(nullifier);
        const isSpent = await isNullifierSpent(nullifierHash, poolAddress);
        
        if (!isSpent) {
          unspentNotes.push(note);
        } else {
          console.log(`[Swap] Filtered out spent note at leaf index ${note.leafIndex}`);
        }
      } catch (error) {
        console.warn(`[Swap] Error checking if note is spent:`, error);
        // If check fails, include the note to be safe (let contract reject it)
        unspentNotes.push(note);
      }
    }
    
    const filteredBySpent = filtered.length - unspentNotes.length;
    if (filteredBySpent > 0) {
      console.log(`[Swap] Filtered out ${filteredBySpent} note(s) that are already spent.`);
    }
    
    filtered = unspentNotes;
  }
  
  return filtered;
}

export function getNotesForToken(notes: ShieldedNote[], token: SwapToken): ShieldedNote[] {
  return notes.filter(n => 
    n.token === token && 
    n.leafIndex !== undefined && 
    n.amount > 0n
  );
}

/**
 * Format swap details for display
 */
export function formatSwapDetails(quote: SwapQuote): {
  input: string;
  output: string;
  rate: string;
  fee: string;
} {
  const inputAmount = Number(quote.inputAmount) / 1e18;
  const outputAmount = Number(quote.outputAmount) / 1e18;
  const feeAmount = Number(quote.fee) / 1e18;
  
  return {
    input: `${inputAmount.toFixed(4)} ${quote.inputToken}`,
    output: `${outputAmount.toFixed(4)} ${quote.outputToken}`,
    rate: `1 ${quote.inputToken} = ${quote.exchangeRate.toFixed(6)} ${quote.outputToken}`,
    fee: `${feeAmount.toFixed(6)} ${quote.outputToken} (0.3%)`,
  };
}

