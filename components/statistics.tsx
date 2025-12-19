"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PoolStats {
  anonymitySet: number
  totalDeposits: number
  latestDeposits: Array<{ id: number; timestamp: number }>
}

export function Statistics() {
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [selectedPool] = useState(1)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/pools/${selectedPool}`)
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error("[v0] Failed to fetch stats:", error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)

    return () => clearInterval(interval)
  }, [selectedPool])

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours} hours ago`
    if (minutes > 0) return `${minutes} minutes ago`
    return `${seconds} seconds ago`
  }

  return (
    <Card className="glass-card p-6 rounded-none border-[#C2A633]/15 h-fit">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#C2A633]/20">
        <h3 className="font-mono text-base font-bold text-white uppercase tracking-wider">Statistics</h3>
        <Badge
          variant="outline"
          className="border-[#C2A633] text-[#C2A633] font-mono bg-[#C2A633]/10 px-3 py-1 text-xs"
        >
          {selectedPool} DOGE
        </Badge>
      </div>

      {stats && (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">Anonymity set</span>
              <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">✓</span>
              </div>
            </div>
            <p className="font-mono text-5xl text-white font-bold leading-none">
              {stats.anonymitySet.toLocaleString()}
            </p>
            <p className="font-mono text-xs text-gray-500">equal user deposits</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider">Latest deposits</h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.latestDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="p-3 bg-black/40 border border-[#C2A633]/15 transition-all duration-200 hover:border-[#C2A633]/40 hover:bg-black/60"
                >
                  <div className="font-mono text-sm text-white font-bold">#{deposit.id}</div>
                  <div className="font-mono text-[10px] text-[#C2A633] mt-1">{formatTimeAgo(deposit.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#C2A633]/20">
            <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider">Pool Amounts</h4>
            <div className="flex items-center gap-3 flex-wrap">
              {[1, 10, 100, 1000].map((amount) => (
                <div
                  key={amount}
                  className="px-3 py-2 bg-black/40 border border-[#C2A633]/15 transition-all duration-200 hover:border-[#C2A633]/40"
                >
                  <span className="font-mono text-base text-[#C2A633] font-bold">{amount} Ð</span>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-gray-500">available mixing pools</p>
          </div>

          <div className="pt-4 border-t border-[#C2A633]/20">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">Latest Deposit</span>
              <span className="font-mono text-sm text-[#C2A633] font-bold">7 hours ago</span>
            </div>
            <p className="font-mono text-[10px] text-gray-500">last activity</p>
          </div>
        </div>
      )}
    </Card>
  )
}
