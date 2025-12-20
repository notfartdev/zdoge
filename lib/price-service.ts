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
 * Fetch current prices from CoinGecko
 */
async function fetchPrices(): Promise<Record<string, number>> {
  const ids = Object.values(priceConfig.tokenIds).join(',');
  
  try {
    const response = await fetch(
      `${priceConfig.apiUrl}/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch prices');
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
    
    return prices;
  } catch (error) {
    console.error('[Price] Failed to fetch prices:', error);
    // Return default prices on error
    return {
      USDC: 1,
      USDT: 1,
      WETH: 3500,
      DOGE: 0.35,
      LBTC: 100000,
    };
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
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  const prices = await getPrices();
  return prices[symbol] || 0;
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
 */
export async function getUSDValue(
  amount: number,
  tokenSymbol: string
): Promise<number> {
  const price = await getTokenPrice(tokenSymbol);
  return amount * price;
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

