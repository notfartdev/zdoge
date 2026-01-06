"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { type SupportedToken } from "./dogeos-config"

interface TokenPrices {
  [symbol: string]: number | null
}

interface TokenContextType {
  selectedToken: SupportedToken
  setSelectedToken: (token: SupportedToken) => void
  prices: TokenPrices
  loadingPrices: boolean
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

// CoinGecko token IDs
const COINGECKO_IDS: Record<string, string> = {
  DOGE: 'dogecoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  USD1: 'usd-coin', // Use USDC as proxy for USD1
  WETH: 'ethereum',
  LBTC: 'bitcoin',
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [selectedToken, setSelectedToken] = useState<SupportedToken>("USDC")
  const [prices, setPrices] = useState<TokenPrices>({})
  const [loadingPrices, setLoadingPrices] = useState(true)

  // Fetch real prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = Object.values(COINGECKO_IDS).filter((v, i, a) => a.indexOf(v) === i).join(',')
        
        // Add timeout and better error handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          }
        )
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch prices: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        
        // Map back to our token symbols
        const tokenPrices: TokenPrices = {}
        for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
          tokenPrices[symbol] = data[geckoId]?.usd || null
        }
        
        setPrices(tokenPrices)
        setLoadingPrices(false)
        console.log('[Prices] Fetched:', tokenPrices)
      } catch (error: any) {
        // Silently handle errors - use fallback prices
        if (error.name !== 'AbortError') {
          console.warn('[Prices] Failed to fetch:', error.message || error)
        }
        
        // Fallback prices
        setPrices({
          DOGE: 0.40,
          USDC: 1,
          USDT: 1,
          USD1: 1,
          WETH: 3500,
          LBTC: 100000,
        })
        setLoadingPrices(false)
      }
    }

    fetchPrices()
    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TokenContext.Provider value={{ selectedToken, setSelectedToken, prices, loadingPrices }}>
      {children}
    </TokenContext.Provider>
  )
}

export function useToken() {
  const context = useContext(TokenContext)
  if (!context) {
    throw new Error("useToken must be used within TokenProvider")
  }
  return context
}

// Helper to format USD with real prices
export function formatRealUSD(amount: number, tokenSymbol: string, prices: TokenPrices): string {
  const price = prices[tokenSymbol]
  if (price === null || price === undefined) {
    return '$--'
  }
  const usdValue = amount * price
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue)
}

