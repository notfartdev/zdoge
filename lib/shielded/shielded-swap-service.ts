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
import { getNotes, verifyNoteBeforeSpending } from './shielded-service';

// Cache for valid leaf indices per contract (avoids repeated fetches)
let validLeafIndicesCache: { poolAddress: string; leafIndices: Set<number>; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minute cache

// Supported tokens for shielded swaps
// This can be dynamically updated via addSwapToken/removeSwapToken functions
export let SWAP_TOKENS: Record<string, {
  symbol: string;
  decimals: number;
  address: string;
  isNative?: boolean;
}> = {
  DOGE: {
    symbol: 'DOGE',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000', // Native - V4 contract uses address(0) for NATIVE_TOKEN
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
  USD1: {
    symbol: 'USD1',
    decimals: 18,
    address: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F',
  },
};

export type SwapToken = string; // Now dynamic, can be any token symbol

/**
 * Add a token to the swap token list
 * @param symbol Token symbol (e.g., 'USD1', 'LBTC')
 * @param config Token configuration
 */
export function addSwapToken(
  symbol: string,
  config: {
    decimals: number;
    address: string;
    isNative?: boolean;
  }
): void {
  SWAP_TOKENS[symbol] = {
    symbol,
    ...config,
  };
  
  // Persist to localStorage for persistence across page reloads
  try {
    const stored = localStorage.getItem('swap_tokens_config');
    const tokens = stored ? JSON.parse(stored) : {};
    tokens[symbol] = config;
    localStorage.setItem('swap_tokens_config', JSON.stringify(tokens));
    
    // Dispatch event to notify UI components
    window.dispatchEvent(new CustomEvent('swap-tokens-updated'));
  } catch (error) {
    console.warn('[Swap] Failed to persist swap token config:', error);
  }
}

/**
 * Remove a token from the swap token list
 * @param symbol Token symbol to remove
 */
export function removeSwapToken(symbol: string): void {
  if (symbol === 'DOGE') {
    console.warn('[Swap] Cannot remove DOGE token (required)');
    return;
  }
  
  delete SWAP_TOKENS[symbol];
  
  // Update localStorage
  try {
    const stored = localStorage.getItem('swap_tokens_config');
    const tokens = stored ? JSON.parse(stored) : {};
    delete tokens[symbol];
    localStorage.setItem('swap_tokens_config', JSON.stringify(tokens));
    
    // Dispatch event to notify UI components
    window.dispatchEvent(new CustomEvent('swap-tokens-updated'));
  } catch (error) {
    console.warn('[Swap] Failed to update swap token config:', error);
  }
}

/**
 * Load swap tokens from localStorage on initialization
 */
export function loadSwapTokensFromStorage(): void {
  try {
    const stored = localStorage.getItem('swap_tokens_config');
    if (stored) {
      const tokens = JSON.parse(stored);
      // Merge with default tokens (don't overwrite defaults, only add new ones)
      for (const [symbol, config] of Object.entries(tokens)) {
        if (!SWAP_TOKENS[symbol]) {
          SWAP_TOKENS[symbol] = {
            symbol,
            ...(config as any),
          };
        }
      }
    }
  } catch (error) {
    console.warn('[Swap] Failed to load swap tokens from storage:', error);
  }
}

// Load tokens from storage on module initialization
if (typeof window !== 'undefined') {
  loadSwapTokensFromStorage();
}

export interface SwapQuote {
  inputToken: SwapToken;
  outputToken: SwapToken;
  inputAmount: bigint;
  outputAmount: bigint;
  exchangeRate: number;
  priceImpact: number;
  fee: bigint; // Total fee (swap fee + platform fee)
  swapFee: bigint; // 0.3% swap fee
  platformFee: bigint; // 5 DOGE platform fee (in output token)
  expiresAt: number;
  error?: string; // Optional error message for graceful handling
  minimumRequired?: string; // Minimum amount required after fees
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
 * Get token price key for CoinGecko lookup
 */
function getTokenPriceKey(token: SwapToken): string {
  return token; // Token symbol maps directly to price key
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
  const swapFeeAmount = outputAmountNum * feePercent;
  const outputAfterSwapFee = outputAmountNum - swapFeeAmount;
  
  // Platform fee: 5 DOGE (or equivalent in output token)
  // Convert 5 DOGE to output token value using current exchange rate
  const DOGE_PRICE = prices['dogecoin'] || 0.08; // Fallback to ~$0.08 if price unavailable
  const OUTPUT_TOKEN_PRICE = prices[getTokenPriceKey(outputToken)] || DOGE_PRICE;
  const PLATFORM_FEE_DOGE = 5; // Fixed 5 DOGE platform fee
  const platformFeeInOutputToken = (PLATFORM_FEE_DOGE * DOGE_PRICE) / OUTPUT_TOKEN_PRICE;
  
  // Deduct platform fee from output
  const outputAfterAllFees = outputAfterSwapFee - platformFeeInOutputToken;
  
  // Ensure output is not negative
  // Return null instead of throwing to allow graceful handling in UI
  if (outputAfterAllFees < 0) {
    const minimumRequired = (platformFeeInOutputToken + swapFeeAmount).toFixed(6);
    const errorMessage = `Swap amount too small. Minimum required after fees: ${minimumRequired} ${outputToken}`;
    // Return a special quote object that indicates the error
    // This allows the UI to display a friendly message instead of crashing
    return {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount: 0n,
      exchangeRate: rate,
      priceImpact: 0,
      fee: 0n,
      swapFee: 0n,
      platformFee: BigInt(Math.floor(platformFeeInOutputToken * (10 ** outputDecimals))),
      expiresAt: Date.now() + 30000,
      // Add error flag for UI handling
      error: errorMessage,
      minimumRequired: minimumRequired,
    } as SwapQuote & { error?: string; minimumRequired?: string };
  }
  
  const outputAmount = BigInt(Math.floor(outputAfterAllFees * (10 ** outputDecimals)));
  const swapFee = BigInt(Math.floor(swapFeeAmount * (10 ** outputDecimals)));
  const platformFee = BigInt(Math.floor(platformFeeInOutputToken * (10 ** outputDecimals)));
  const totalFee = swapFee + platformFee;
  
  // Estimate price impact (simplified - in production use liquidity depth)
  const priceImpact = inputAmountNum > 10000 ? 0.5 : 0.1; // Higher for large trades
  
  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    exchangeRate: rate,
    priceImpact,
    fee: totalFee, // Total fee (swap + platform)
    swapFee, // 0.3% swap fee
    platformFee, // 5 DOGE platform fee
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
  
  // Just-in-time verification: Verify note exists on-chain AND not spent
  // This replaces blocking sync on page load with targeted verification before spending
  await verifyNoteBeforeSpending(inputNote, poolAddress, identity);
  
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

/**
 * Prepare sequential swaps (auto-split large swaps across multiple notes)
 * 
 * When swap amount exceeds single note capacity, automatically splits into multiple
 * sequential swaps. Each swap uses a single note and creates separate output notes.
 * 
 * @param inputToken Input token symbol
 * @param outputToken Output token symbol
 * @param totalInputAmount Total amount to swap (will be split across multiple swaps)
 * @param poolAddress Contract address
 * @param identity User's shielded identity
 * @param availableNotes Available notes for the input token
 * @param onProgress Callback for progress updates (swapIndex, totalSwaps, amount)
 * @returns Array of swap results
 */
export async function prepareSequentialSwaps(
  inputToken: SwapToken,
  outputToken: SwapToken,
  totalInputAmount: bigint,
  poolAddress: string,
  identity: { spendingKey: bigint; shieldedAddress: bigint },
  availableNotes: ShieldedNote[],
  onProgress?: (swapIndex: number, totalSwaps: number, amount: number) => void
): Promise<Array<{
  proof: { proof: string[]; publicInputs: string[] };
  root: `0x${string}`;
  inputNullifierHash: `0x${string}`;
  outputCommitment1: `0x${string}`;
  outputCommitment2: `0x${string}`;
  outputNote: ShieldedNote;
  changeNote: ShieldedNote | null;
  noteIndex: number;
  note: ShieldedNote;
  inputAmount: bigint;
  outputAmount: bigint;
}>> {
  if (availableNotes.length === 0) {
    throw new Error('No available notes for swap');
  }

  const inputDecimals = SWAP_TOKENS[inputToken].decimals;
  const MIN_CHANGE = 1000n; // Minimum 1000 wei for change note

  // Get all notes to find original indices
  const allNotes = getNotes();

  /**
   * Find optimal subset of notes to minimize swaps
   * Uses greedy algorithm to select notes
   * Validates that each swap will be viable after fees
   */
  async function findOptimalNoteSubset(
    notes: ShieldedNote[],
    targetAmount: bigint
  ): Promise<Array<{ note: ShieldedNote; originalIndex: number; swapAmount: bigint }>> {
    // Sort notes by amount (largest first)
    // Find original indices in allNotes by commitment
    const sortedNotes = notes
      .map((note) => {
        // Find original index in allNotes by commitment
        const originalIndex = allNotes.findIndex(n => n.commitment === note.commitment);
        return { note, originalIndex: originalIndex >= 0 ? originalIndex : 0 };
      })
      .sort((a, b) => Number(b.note.amount - a.note.amount));

    const swaps: Array<{ note: ShieldedNote; originalIndex: number; swapAmount: bigint }> = [];
    let remainingAmount = targetAmount;

    // Helper function to check if a swap amount is viable (not too small after fees)
    const isSwapViable = async (swapAmount: bigint): Promise<boolean> => {
      try {
        const quote = await getSwapQuote(inputToken, outputToken, swapAmount);
        // If quote has an error, the swap is not viable
        return !quote.error;
      } catch (error) {
        // If quote generation fails, assume not viable
        return false;
      }
    };

    for (const { note, originalIndex } of sortedNotes) {
      if (remainingAmount <= 0n) break;

      // Calculate how much we can swap from this note
      // For swaps, we can swap up to the note amount (change note will be created if needed)
      const maxSwapable = note.amount;

      if (remainingAmount >= maxSwapable) {
        // Use entire note - check if it's viable
        const viable = await isSwapViable(maxSwapable);
        if (viable) {
          swaps.push({
            note,
            originalIndex,
            swapAmount: maxSwapable,
          });
          remainingAmount -= maxSwapable;
        } else {
          // Note too small even when fully swapped - skip it
          console.warn(
            `[SequentialSwap] Skipping note (${formatWeiToAmount(note.amount, inputDecimals)} ${inputToken}) - too small after fees`
          );
          continue;
        }
      } else {
        // Partial swap (will create change note)
        // Ensure we leave minimum change if doing partial swap
        const potentialChange = note.amount - remainingAmount;
        
        if (potentialChange >= MIN_CHANGE || potentialChange === 0n) {
          // Check if the partial swap amount is viable
          const viable = await isSwapViable(remainingAmount);
          if (viable) {
            swaps.push({
              note,
              originalIndex,
              swapAmount: remainingAmount,
            });
            remainingAmount = 0n;
          } else {
            // Partial swap too small - try using entire note instead
            const fullSwapViable = await isSwapViable(maxSwapable);
            if (fullSwapViable) {
              swaps.push({
                note,
                originalIndex,
                swapAmount: maxSwapable,
              });
              remainingAmount -= maxSwapable;
            } else {
              // Even full note swap is too small - skip it
              console.warn(
                `[SequentialSwap] Skipping note (${formatWeiToAmount(note.amount, inputDecimals)} ${inputToken}) - too small after fees`
              );
              continue;
            }
          }
        } else {
          // Change would be too small, use entire note - check if viable
          const viable = await isSwapViable(maxSwapable);
          if (viable) {
            swaps.push({
              note,
              originalIndex,
              swapAmount: maxSwapable,
            });
            remainingAmount -= maxSwapable;
          } else {
            // Note too small - skip it
            console.warn(
              `[SequentialSwap] Skipping note (${formatWeiToAmount(note.amount, inputDecimals)} ${inputToken}) - too small after fees`
            );
            continue;
          }
        }
      }
    }

    if (remainingAmount > 0n) {
      const totalSelected = swaps.reduce((sum, s) => sum + s.swapAmount, 0n);
      const remainingAmountDoge = formatWeiToAmount(remainingAmount, inputDecimals);
      const totalSelectedDoge = formatWeiToAmount(totalSelected, inputDecimals);
      const targetAmountDoge = formatWeiToAmount(targetAmount, inputDecimals);
      
      // Allow small remainder tolerance (e.g., < 0.01 DOGE or < 1% of target)
      const toleranceDoge = Math.max(0.01, targetAmountDoge * 0.01); // 1% or 0.01 DOGE, whichever is larger
      
      if (remainingAmountDoge <= toleranceDoge) {
        // Remainder is small enough to ignore - proceed with reduced amount
        console.warn(
          `[SequentialSwap] Small remainder (${remainingAmountDoge.toFixed(4)} ${inputToken}) cannot be swapped due to fees. ` +
          `Proceeding with ${totalSelectedDoge.toFixed(4)} ${inputToken} from ${swaps.length} note(s).`
        );
        // Continue with the swaps we have - the caller will use the actual swapped amount
      } else {
        // Remainder is significant - throw error
        throw new Error(
          `Cannot complete swap: ${remainingAmountDoge.toFixed(4)} ${inputToken} remaining after selecting viable swaps. ` +
          `Selected: ${totalSelectedDoge.toFixed(4)} ${inputToken} from ${swaps.length} note(s). ` +
          `Some notes may be too small to swap after fees. Please try a smaller amount.`
        );
      }
    }

    if (swaps.length === 0) {
      throw new Error(
        `No viable swaps found. All notes are too small after fees. ` +
        `Minimum required: ~0.4 ${outputToken} (platform fee).`
      );
    }

    console.log(`[SequentialSwap] Selected ${swaps.length} viable notes for swap:`);
    swaps.forEach((s, i) => {
      console.log(
        `  Swap ${i + 1}: ${formatWeiToAmount(s.swapAmount, inputDecimals)} ${inputToken} from note at index ${s.originalIndex} (${formatWeiToAmount(s.note.amount, inputDecimals)} ${inputToken})`
      );
    });

    return swaps;
  }

  // Find optimal note selection (with viability checks)
  const optimalSwaps = await findOptimalNoteSubset(availableNotes, totalInputAmount);

  // Generate quotes and proofs for each swap
  const results: Array<{
    proof: { proof: string[]; publicInputs: string[] };
    root: `0x${string}`;
    inputNullifierHash: `0x${string}`;
    outputCommitment1: `0x${string}`;
    outputCommitment2: `0x${string}`;
    outputNote: ShieldedNote;
    changeNote: ShieldedNote | null;
    noteIndex: number;
    note: ShieldedNote;
    inputAmount: bigint;
    outputAmount: bigint;
  }> = [];

  for (let i = 0; i < optimalSwaps.length; i++) {
    const swap = optimalSwaps[i];

    // Update progress: Generating quote and proof
    if (onProgress) {
      onProgress(i + 1, optimalSwaps.length, Number(swap.swapAmount) / 10 ** inputDecimals);
    }

    // Get quote for this swap amount
    const quote = await getSwapQuote(inputToken, outputToken, swap.swapAmount);

    if (quote.error) {
      throw new Error(`Swap ${i + 1} quote error: ${quote.error}`);
    }

    // Prepare swap proof
    const swapResult = await prepareShieldedSwap(swap.note, identity, quote, poolAddress);

    results.push({
      proof: swapResult.proof,
      root: swapResult.merkleRoot,
      inputNullifierHash: swapResult.inputNullifierHash,
      outputCommitment1: swapResult.outputCommitment,
      outputCommitment2: swapResult.changeCommitment,
      outputNote: swapResult.outputNote,
      changeNote: swapResult.changeNote,
      noteIndex: swap.originalIndex,
      note: swap.note,
      inputAmount: swap.swapAmount,
      outputAmount: quote.outputAmount,
    });
  }

  return results;
}

