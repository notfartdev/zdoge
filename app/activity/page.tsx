"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Wallet
} from "lucide-react"
import { useWallet } from "@/lib/wallet-context"
import { useToast } from "@/hooks/use-toast"
import {
  getTransactionHistory,
  initTransactionHistory,
  getTransactionsByType,
  formatTransactionType,
  type TransactionType,
  type ShieldedTransaction,
} from "@/lib/shielded/transaction-history"
import { links } from "@/lib/dogeos-config"
import { shortenAddress } from "@/lib/shielded/shielded-address"

export default function ActivityPage() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<ShieldedTransaction[]>([])
  const [filter, setFilter] = useState<TransactionType | 'all'>('all')
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize and load transactions
  useEffect(() => {
    if (!wallet?.address) {
      setTransactions([])
      return
    }

    initTransactionHistory(wallet.address)
    loadTransactions()
  }, [wallet?.address])

  const loadTransactions = () => {
    const history = filter === 'all' 
      ? getTransactionHistory()
      : getTransactionsByType(filter)
    setTransactions(history)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadTransactions()
    setTimeout(() => setIsRefreshing(false), 500)
    toast({ title: "Refreshed", description: "Transaction history updated" })
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
    toast({ title: "Copied!", description: "Transaction hash copied to clipboard" })
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatFullTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const formatHash = (hash: string): string => {
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`
  }

  if (!wallet?.isConnected || !wallet?.address) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
          <Card className="p-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to view your transaction history
            </p>
          </Card>
        </main>
      </div>
    )
  }

  const filteredTransactions = filter === 'all' 
    ? transactions
    : transactions.filter(tx => tx.type === filter)

  const typeCounts = {
    all: transactions.length,
    shield: getTransactionsByType('shield').length,
    transfer: getTransactionsByType('transfer').length,
    swap: getTransactionsByType('swap').length,
    unshield: getTransactionsByType('unshield').length,
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">
              Activity
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-[#C2A633]/20 hover:bg-[#C2A633]/10 hover:border-[#C2A633]/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs font-mono">Refresh</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Transaction history
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6 pb-4 border-b border-[#C2A633]/10">
          {(['all', 'shield', 'transfer', 'swap', 'unshield'] as const).map((type) => {
            const count = typeCounts[type]
            const isActive = filter === type
            return (
              <button
                key={type}
                onClick={() => {
                  setFilter(type)
                  loadTransactions()
                }}
                className={`text-xs font-mono tracking-wider px-3 py-1.5 rounded transition-all ${
                  isActive 
                    ? 'bg-[#C2A633] text-black font-bold' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {type === 'all' ? 'ALL' : formatTransactionType(type).toUpperCase()}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? 'text-black/60' : 'text-muted-foreground'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <Card className="p-12 text-center bg-zinc-950 border-[#C2A633]/20">
            <h3 className="text-lg font-bold mb-2 font-mono">No Transactions</h3>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              Your shielded transactions will appear here
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((tx) => {
              return (
                <Card key={tx.id} className="p-4 bg-zinc-950 border-[#C2A633]/20 hover:border-[#C2A633]/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-[#C2A633] font-bold tracking-wider">
                          {formatTransactionType(tx.type).toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {tx.token}
                        </span>
                        <span className={`text-xs font-mono ml-auto ${
                          tx.status === 'confirmed' 
                            ? 'text-muted-foreground' 
                            : tx.status === 'failed' 
                            ? 'text-muted-foreground/60' 
                            : 'text-muted-foreground/80'
                        }`}>
                          {tx.status === 'confirmed' ? 'CONFIRMED' : tx.status === 'failed' ? 'FAILED' : 'PENDING'}
                        </span>
                      </div>

                      {/* Amount and Details */}
                      <div className="space-y-1.5">
                        {tx.type === 'shield' && (
                          <p className="text-xl font-bold font-mono">
                            +{tx.amount} {tx.token}
                          </p>
                        )}
                        
                        {tx.type === 'transfer' && (
                          <>
                            <p className="text-xl font-bold font-mono">
                              -{tx.amount} {tx.token}
                            </p>
                            {tx.recipientAddress && (
                              <p className="text-xs text-muted-foreground font-mono">
                                To: {shortenAddress(tx.recipientAddress, 12)}
                              </p>
                            )}
                            {tx.fee && parseFloat(tx.fee) > 0 && (
                              <p className="text-xs text-muted-foreground font-mono">
                                Fee: {tx.fee} {tx.token}
                              </p>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'swap' && (
                          <>
                            <p className="text-xl font-bold font-mono">
                              {tx.inputToken} → {tx.outputToken}
                            </p>
                            {tx.amount && tx.outputAmount && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {tx.amount} {tx.inputToken} → {tx.outputAmount} {tx.outputToken}
                              </p>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'unshield' && (
                          <>
                            <p className="text-xl font-bold font-mono">
                              +{tx.amount} {tx.token}
                            </p>
                            {tx.recipientPublicAddress && (
                              <p className="text-xs text-muted-foreground font-mono">
                                To: {tx.recipientPublicAddress.slice(0, 8)}...{tx.recipientPublicAddress.slice(-6)}
                              </p>
                            )}
                            {tx.relayerFee && parseFloat(tx.relayerFee) > 0 && (
                              <p className="text-xs text-muted-foreground font-mono">
                                Fee: {tx.relayerFee} {tx.token}
                              </p>
                            )}
                          </>
                        )}

                        {/* Timestamp and Hash */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#C2A633]/10">
                          <span className="text-xs text-muted-foreground font-mono" title={formatFullTimestamp(tx.timestamp)}>
                            {formatTimestamp(tx.timestamp)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyHash(tx.txHash)}
                              className="p-1.5 hover:bg-white/5 rounded transition-colors"
                              title="Copy transaction hash"
                            >
                              {copiedHash === tx.txHash ? (
                                <Check className="h-3.5 w-3.5 text-[#C2A633]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              )}
                            </button>
                            <a
                              href={`${links.explorer}/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on block explorer"
                              className="p-1.5 hover:bg-white/5 rounded transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-[#C2A633]" />
                            </a>
                          </div>
                        </div>

                        {/* Transaction Hash */}
                        <code className="text-[10px] text-muted-foreground/60 font-mono break-all block mt-1">
                          {formatHash(tx.txHash)}
                        </code>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Summary Stats */}
        {transactions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#C2A633]/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">TOTAL</p>
                <p className="text-2xl font-bold font-mono">{transactions.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">SHIELDS</p>
                <p className="text-2xl font-bold font-mono">{typeCounts.shield}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">TRANSFERS</p>
                <p className="text-2xl font-bold font-mono">{typeCounts.transfer}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">UNSHIELDS</p>
                <p className="text-2xl font-bold font-mono">{typeCounts.unshield}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

