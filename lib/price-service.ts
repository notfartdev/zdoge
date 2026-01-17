/**
 * Price Service for Dogenado
 * 
 * Fetches real-time USD prices for tokens
 */

import { priceConfig } from './dogeos-config';

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache | null = null;

/**
 * Default fallback prices (used when API fails)
 */
const DEFAULT_PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  WETH: 3500,
  DOGE: 0.35,
  LBTC: 100000,
};

/**
 * Fetch current prices from CoinGecko
 * SECURITY: Includes timeout, error handling, and graceful degradation
 */
async function fetchPrices(): Promise<Record<string, number>> {
  const ids = Object.values(priceConfig.tokenIds).join(',');
  
  try {
    // SECURITY: Add timeout to prevent hanging requests (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response: Response;
    try {
      response = await fetch(
        `${priceConfig.apiUrl}/simple/price?ids=${ids}&vs_currencies=usd`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal, // Abort signal for timeout
          // Client-side fetch - no Next.js server options
          cache: 'no-store', // Always fetch fresh data, rely on our cache
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!response.ok) {
      // Log but don't throw - return default prices instead
      console.warn(`[Price] API returned ${response.status} ${response.statusText}, using default prices`);
      return DEFAULT_PRICES;
    }
    
    const data = await response.json();
    
    // Map CoinGecko IDs back to our token symbols
    const prices: Record<string, number> = {};
    for (const [symbol, id] of Object.entries(priceConfig.tokenIds)) {
      if (data[id]?.usd) {
        prices[symbol] = data[id].usd;
      }
    }
    
    // USDC and USDT are stablecoins, default to 1 if not found
    if (!prices.USDC) prices.USDC = 1;
    if (!prices.USDT) prices.USDT = 1;
    
    // Ensure all expected tokens have prices (fallback to defaults if missing)
    for (const symbol of Object.keys(priceConfig.tokenIds)) {
      if (!prices[symbol] && DEFAULT_PRICES[symbol]) {
        prices[symbol] = DEFAULT_PRICES[symbol];
      }
    }
    
    return prices;
  } catch (error: any) {
    // Handle all errors gracefully (network errors, CORS, timeout, etc.)
    if (error.name === 'AbortError') {
      console.warn('[Price] Request timeout, using default prices');
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error, CORS issue, or fetch not available
      console.warn('[Price] Network error (CORS/connectivity), using default prices:', error.message);
    } else {
      console.warn('[Price] Failed to fetch prices, using default prices:', error.message || error);
    }
    
    // Return default prices on any error - ensures UI continues to work
    return DEFAULT_PRICES;
  }
}

/**
 * Get cached prices or fetch new ones
 */
export async function getPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  
  // Return cached prices if still valid
  if (priceCache && now - priceCache.timestamp < priceConfig.cacheDuration) {
    return priceCache.prices;
  }
  
  // Fetch new prices
  const prices = await fetchPrices();
  priceCache = { prices, timestamp: now };
  
  return prices;
}

/**
 * Get price for a specific token
 * Returns 0 if token not found (handled gracefully by callers)
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  try {
    const prices = await getPrices();
    return prices[symbol] || 0;
  } catch (error) {
    // Fallback to default price if available, otherwise 0
    console.warn(`[Price] Failed to get price for ${symbol}, returning default`);
    return DEFAULT_PRICES[symbol] || 0;
  }
}

/**
 * Format USD value with proper formatting
 */
export function formatUSD(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

/**
 * Calculate USD value for a token amount
 * Returns 0 if price fetch fails (graceful degradation)
 */
export async function getUSDValue(
  amount: number,
  tokenSymbol: string
): Promise<number> {
  try {
    const price = await getTokenPrice(tokenSymbol);
    return amount * price;
  } catch (error) {
    console.warn(`[Price] Failed to calculate USD value for ${tokenSymbol}:`, error);
    // Return 0 instead of throwing - allows UI to continue without USD values
    return 0;
  }
}

/**
 * Format token amount with USD value
 */
export async function formatWithUSD(
  amount: number,
  tokenSymbol: string
): Promise<string> {
  const usdValue = await getUSDValue(amount, tokenSymbol);
  return `${amount} ${tokenSymbol} (${formatUSD(usdValue)})`;
}

