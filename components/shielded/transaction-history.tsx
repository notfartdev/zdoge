"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Shield, LogOut, Send, ArrowDownUp, Filter } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getTransactionHistory, type ShieldedTransaction as Transaction } from "@/lib/shielded/transaction-history"
import { dogeosTestnet } from "@/lib/dogeos-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TransactionHistoryProps {
  walletAddress: string
  className?: string
}

export function TransactionHistory({ walletAddress, className }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "shield" | "unshield" | "transfer" | "swap">("all")

  useEffect(() => {
    function loadHistory() {
      setIsLoading(true)
      try {
        const history = getTransactionHistory()
        setTransactions(history.sort((a, b) => b.timestamp - a.timestamp))
      } catch (error) {
        console.error("[TransactionHistory] Failed to load:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
    
    // Listen for updates
    const handleUpdate = () => loadHistory()
    window.addEventListener('shielded-wallet-updated', handleUpdate)
    return () => window.removeEventListener('shielded-wallet-updated', handleUpdate)
  }, [walletAddress])

  const filteredTransactions = transactions.filter(tx => 
    filter === "all" || tx.type === filter
  )

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'shield':
        return <Shield className="h-4 w-4" />
      case 'unshield':
        return <LogOut className="h-4 w-4" />
      case 'transfer':
        return <Send className="h-4 w-4" />
      case 'swap':
        return <ArrowDownUp className="h-4 w-4" />
      default:
        return null
    }
  }

  const formatAmount = (amount: string, maxDecimals: number = 4): string => {
    if (!amount) return '0'
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    // Limit to maxDecimals and remove trailing zeros
    return num.toFixed(maxDecimals).replace(/\.?0+$/, '')
  }

  const getTransactionLabel = (tx: Transaction) => {
    switch (tx.type) {
      case 'shield':
        return `Shielded ${formatAmount(tx.amount, 4)} ${tx.token}`
      case 'unshield':
        return `Unshielded ${formatAmount(tx.amount, 4)} ${tx.token}`
      case 'transfer':
        return `Sent ${formatAmount(tx.amount, 4)} ${tx.token}`
      case 'swap':
        return `Swapped ${formatAmount(tx.amount, 4)} ${tx.inputToken || tx.token} → ${formatAmount(tx.outputAmount || '0', 4)} ${tx.outputToken}`
      default:
        return 'Transaction'
    }
  }

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Confirmed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      default:
        return null
    }
  }

  return (
    <Card className={`bg-zinc-900 border-[#C2A633]/20 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white text-base sm:text-lg">Transaction History</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-24 sm:w-32 h-8 bg-zinc-800 border-zinc-700 text-xs sm:text-sm">
              <Filter className="h-3 w-3 mr-1 sm:mr-2 flex-shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="shield">Shield</SelectItem>
              <SelectItem value="unshield">Unshield</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="swap">Swap</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#C2A633]" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No transactions found</p>
            <p className="text-sm mt-2">{filter !== "all" && "Try selecting a different filter"}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {filteredTransactions.map((tx) => (
              <div
                key={`${tx.txHash}-${tx.timestamp}`}
                className="p-2 sm:p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-[#C2A633]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#C2A633]/20 flex items-center justify-center text-[#C2A633]">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <p className="text-xs sm:text-sm font-medium text-white truncate">
                          {getTransactionLabel(tx)}
                        </p>
                        <div className="flex-shrink-0">
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-gray-400">
                        <span className="whitespace-nowrap">{formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })}</span>
                        {tx.txHash && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="font-mono text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-none">{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</span>
                          </>
                        )}
                      </div>
                      {tx.fee && (
                        <div className="text-xs text-gray-500 mt-1">
                          Fee: {formatAmount(tx.fee, 4)} {tx.token}
                        </div>
                      )}
                    </div>
                  </div>
                  {tx.txHash && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0"
                      onClick={() => window.open(`${dogeosTestnet.blockExplorers.default.url}/tx/${tx.txHash}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
