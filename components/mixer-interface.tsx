"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, Copy } from "lucide-react"
import { api, tokenPools } from "@/lib/dogeos-config"

// Token logo URLs - using Trust Wallet token list and CoinGecko
const tokenLogos: Record<string, string> = {
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  WDOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  WETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  LBTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", // Using BTC logo for LBTC
  USD1: "https://assets.coingecko.com/coins/images/54977/standard/USD1_1000x1000_transparent.png?1749297002",
}

interface PoolStats {
  depositsCount: number
  deposits?: Array<{ timestamp: number }>
}

interface AggregatedStats {
  totalAnonymitySet: number
  poolAmounts: string[]
  latestDepositTime: number | null
}

export function MixerInterface() {
  const [amount, setAmount] = useState([10])
  const [activeTab, setActiveTab] = useState("deposit")
  const [stats, setStats] = useState<AggregatedStats>({
    totalAnonymitySet: 0,
    poolAmounts: [],
    latestDepositTime: null,
  })
  const [loading, setLoading] = useState(true)

  // Fetch real statistics from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get all pools from all tokens
        const allPools: Array<{ amount: string; address: string }> = []
        Object.values(tokenPools).forEach((tokenConfig) => {
          Object.entries(tokenConfig.pools).forEach(([amount, address]) => {
            allPools.push({ amount, address })
          })
        })

        // Fetch stats from all pools
        const statsPromises = allPools.map(async ({ amount, address }) => {
          try {
            const response = await fetch(`${api.indexer}/api/pool/${address}`)
            if (!response.ok) return null
            const data: PoolStats = await response.json()
            return { amount, ...data }
          } catch (err) {
            console.error(`Failed to fetch pool ${amount}:`, err)
            return null
          }
        })

        const results = await Promise.all(statsPromises)
        const validStats = results.filter((s): s is { amount: string } & PoolStats => s !== null)

        // Aggregate statistics
        const totalAnonymitySet = validStats.reduce((sum, pool) => sum + (pool.depositsCount || 0), 0)
        
        // Get unique pool amounts (sorted)
        const poolAmounts = [...new Set(validStats.map(p => p.amount))]
          .map(a => parseFloat(a))
          .sort((a, b) => a - b)
          .map(a => a.toString())

        // Find latest deposit time
        let latestTime = 0
        validStats.forEach(pool => {
          if (pool.deposits && pool.deposits.length > 0) {
            const newest = (pool.deposits[0]?.timestamp || 0) * 1000
            if (newest > latestTime) latestTime = newest
          }
        })

        setStats({
          totalAnonymitySet,
          poolAmounts,
          latestDepositTime: latestTime > 0 ? latestTime : null,
        })
        setLoading(false)
      } catch (error) {
        console.error("[MixerInterface] Failed to fetch stats:", error)
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  return (
    <section
      id="mix"
      className="relative min-h-screen w-full flex items-center justify-center bg-background pt-32 pb-20 px-6"
    >
      <div className="w-full max-w-7xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/dogenadologo.png" alt="DogenadoCash" className="w-20 h-20 rounded-full" />
          </div>
          <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl lg:text-8xl xl:text-9xl font-light tracking-tight mb-6 md:mb-8">
            DOGENADO<span className="italic">CASH</span>
          </h1>
          <p className="font-mono text-sm sm:text-base md:text-lg tracking-wider text-gray-400 max-w-2xl mx-auto px-4">
            A decentralized privacy protocol enabling private transactions on Doge.
          </p>
        </motion.div>

        {/* Main Interface - Demo Only */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-6 lg:gap-8 items-start"
        >
          {/* Left: Mixer Interface (Demo) */}
          <div className="border border-white/10 bg-black/20 backdrop-blur-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-transparent border-b border-white/10 rounded-none h-auto p-0">
                <TabsTrigger
                  value="deposit"
                  className="rounded-none border-r border-white/10 data-[state=active]:bg-[#C2A633] data-[state=active]:text-black font-mono text-xs tracking-widest py-4"
                >
                  DEPOSIT
                </TabsTrigger>
                <TabsTrigger
                  value="withdraw"
                  className="rounded-none data-[state=active]:bg-[#C2A633] data-[state=active]:text-black font-mono text-xs tracking-widest py-4"
                >
                  WITHDRAW
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="p-4 sm:p-6 md:p-8">
                <div className="space-y-6">
                  {/* Amount Selection */}
                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-4 block">
                      AMOUNT <span className="text-[#C2A633]">Ð</span>
                    </label>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="font-mono text-2xl text-foreground tabular-nums">{amount[0]} DOGE</span>
                    </div>
                    <Slider value={amount} onValueChange={setAmount} min={0.1} max={100} step={0.1} className="mb-4" />
                    <div className="flex justify-between font-mono text-xs text-muted-foreground">
                      <span>0.1 DOGE</span>
                      <span>10 DOGE</span>
                      <span>100 DOGE</span>
                    </div>
                  </div>

                  <Button className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono text-xs tracking-widest py-4 sm:py-6 min-h-[44px] cursor-default">
                    GENERATE DEPOSIT
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="withdraw" className="p-4 sm:p-6 md:p-8">
                <div className="space-y-6">
                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-3 block">
                      SECRET NOTE
                    </label>
                    <Input
                      placeholder="dogenado://note/..."
                      className="bg-black/40 border-white/10 font-mono text-xs"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-3 block">
                      RECIPIENT ADDRESS
                    </label>
                    <Input placeholder="D..." className="bg-black/40 border-white/10 font-mono text-xs" readOnly />
                  </div>

                  <Button className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono text-xs tracking-widest py-4 sm:py-6 min-h-[44px] cursor-default">
                    WITHDRAW
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6 mt-6 lg:mt-0">
            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Anonymity Set</span>
              </div>
              <div className="space-y-1">
                {loading ? (
                  <div className="font-mono text-4xl text-foreground tabular-nums animate-pulse">---</div>
                ) : (
                  <div className="font-mono text-4xl text-foreground tabular-nums">
                    {stats.totalAnonymitySet.toLocaleString()}
                  </div>
                )}
                <p className="font-mono text-xs text-muted-foreground">equal user deposits</p>
              </div>
            </div>

            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Available Tokens</span>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xl text-[#C2A633]/50 tabular-nums animate-pulse">---</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap">
                    {Object.keys(tokenPools).map((token) => (
                      <div key={token} className="flex items-center gap-2 group">
                        <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0 ring-1 ring-white/10 group-hover:ring-[#C2A633]/50 transition-all">
                          <img
                            src={tokenLogos[token] || tokenLogos.USD1}
                            alt={token}
                            className="w-full h-full object-contain p-0.5"
                            onError={(e) => {
                              // Hide image if it fails to load
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        </div>
                        <span className="font-mono text-lg text-[#C2A633] tabular-nums group-hover:text-[#C2A633]/80 transition-colors">
                          {token}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="font-mono text-xs text-muted-foreground">available for anonymous transactions</p>
              </div>
            </div>

            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Latest Deposit
                </span>
              </div>
              <div className="space-y-1">
                {loading ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl text-foreground tabular-nums animate-pulse">---</span>
                  </div>
                ) : stats.latestDepositTime ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl text-foreground tabular-nums">
                      {formatTimeAgo(stats.latestDepositTime).split(' ')[0]}
                    </span>
                    <span className="font-mono text-base text-muted-foreground">
                      {formatTimeAgo(stats.latestDepositTime).split(' ').slice(1).join(' ')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl text-foreground tabular-nums">--</span>
                    <span className="font-mono text-base text-muted-foreground">no activity</span>
                  </div>
                )}
                <p className="font-mono text-xs text-muted-foreground">last activity</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
