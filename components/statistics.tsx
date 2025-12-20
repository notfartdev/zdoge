"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { api, tokenPools } from "@/lib/dogeos-config"
import { useToken } from "@/lib/token-context"

interface DepositInfo {
  commitment: string
  leafIndex: number
  timestamp: number
  blockNumber: number
  txHash?: string
}

interface PoolStats {
  amount: string
  address: string
  depositsCount: number
  recentDeposits: DepositInfo[]
}

export function Statistics() {
  // Use shared token context - synced with deposit interface
  const { selectedToken } = useToken()
  const [poolStats, setPoolStats] = useState<PoolStats[]>([])
  const [totalDeposits, setTotalDeposits] = useState(0)
  const [latestDepositTime, setLatestDepositTime] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const tokenConfig = tokenPools[selectedToken]

  useEffect(() => {
    const fetchPoolStats = async () => {
      setLoading(true)
      try {
        const config = tokenPools[selectedToken]
        const statsPromises = Object.entries(config.pools).map(async ([amount, address]) => {
          try {
            const response = await fetch(`${api.indexer}/api/pool/${address}`)
            if (!response.ok) return null
            const data = await response.json()
            
            return {
              amount,
              address,
              depositsCount: data.depositsCount || 0,
              recentDeposits: data.deposits || [],
            }
          } catch (err) {
            console.error(`Failed to fetch pool ${amount}:`, err)
            return null
          }
        })

        const results = await Promise.all(statsPromises)
        const validStats = results.filter((s): s is PoolStats => s !== null)
        
        // Sort by amount
        validStats.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
        
        setPoolStats(validStats)
        
        // Calculate total deposits for this token
        const total = validStats.reduce((sum, pool) => sum + pool.depositsCount, 0)
        setTotalDeposits(total)

        // Find latest deposit time (convert to ms)
        let latestTime = 0
        validStats.forEach(pool => {
          if (pool.recentDeposits.length > 0) {
            const newest = (pool.recentDeposits[0]?.timestamp || 0) * 1000
            if (newest > latestTime) latestTime = newest
          }
        })
        if (latestTime > 0) {
          setLatestDepositTime(latestTime)
        } else {
          setLatestDepositTime(null)
        }

        setLoading(false)
      } catch (error) {
        console.error("[Stats] Failed to fetch:", error)
        setLoading(false)
      }
    }

    fetchPoolStats()
    const interval = setInterval(fetchPoolStats, 15000)

    return () => clearInterval(interval)
  }, [selectedToken])

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

  const formatHash = (hash: string) => {
    if (!hash) return '-----'
    const clean = hash.startsWith('0x') ? hash.slice(2) : hash
    return clean.slice(-5).toUpperCase()
  }

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount)
    if (num >= 1000) return num.toLocaleString()
    return amount
  }

  // Get the pool with most recent deposit for showing in "Latest Deposits" section
  const poolWithMostRecentDeposit = poolStats.find(p => p.recentDeposits.length > 0)

  return (
    <Card className="glass-card p-6 rounded-none border-[#C2A633]/15 h-fit">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#C2A633]/20">
        <h3 className="font-mono text-base font-bold text-white uppercase tracking-wider">Statistics</h3>
      </div>

      <div className="space-y-6">
        {/* Current Token Display - Auto-synced with deposit interface */}
        <div className="flex items-center justify-between p-3 bg-[#C2A633]/10 border border-[#C2A633]/30">
          <span className="font-mono text-xs text-gray-400 uppercase">Viewing</span>
          <span className="font-mono text-lg font-bold text-[#C2A633]">{selectedToken}</span>
        </div>

        {/* Total Deposits for Selected Token */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">
              {selectedToken} Deposits
            </span>
            {totalDeposits > 0 && (
              <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">✓</span>
              </div>
            )}
          </div>
          <p className="font-mono text-4xl text-white font-bold leading-none">
            {loading ? '...' : totalDeposits.toLocaleString()}
          </p>
          <p className="font-mono text-[10px] text-gray-500">total {selectedToken} deposits</p>
        </div>

        {/* Deposits by Amount */}
        <div className="space-y-2">
          <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider">By Pool</h4>
          <div className="space-y-1">
            {tokenConfig.amounts.map((amount) => {
              const stats = poolStats.find(p => p.amount === amount.toString())
              const count = stats?.depositsCount || 0
              
              return (
                <div
                  key={amount}
                  className="flex items-center justify-between p-2 bg-black/40 border border-[#C2A633]/10"
                >
                  <span className="font-mono text-sm text-white">
                    {formatAmount(amount.toString())} {selectedToken}
                  </span>
                  <span className={`font-mono text-sm font-bold ${count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                    {loading ? '...' : count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Latest 2 Deposits */}
        <div className="space-y-2">
          <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider">Latest Deposits</h4>
          <div className="grid grid-cols-2 gap-2">
            {poolWithMostRecentDeposit && poolWithMostRecentDeposit.recentDeposits.length > 0 ? (
              poolWithMostRecentDeposit.recentDeposits.slice(0, 2).map((deposit, i) => (
                <div
                  key={i}
                  className="p-2 bg-black/40 border border-[#C2A633]/15"
                >
                  <div className="font-mono text-xs text-white font-bold">
                    ...{formatHash(deposit.txHash || deposit.commitment)}
                  </div>
                  <div className="font-mono text-[10px] text-[#C2A633] mt-0.5">
                    {deposit.timestamp ? formatTimeAgo(deposit.timestamp * 1000) : 'recently'}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 p-2 bg-black/40 border border-[#C2A633]/15 text-center">
                <span className="font-mono text-xs text-gray-500">No deposits yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Latest Activity */}
        <div className="pt-3 border-t border-[#C2A633]/20">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">Last Activity</span>
            <span className="font-mono text-sm text-[#C2A633] font-bold">
              {latestDepositTime ? formatTimeAgo(latestDepositTime) : '--'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
