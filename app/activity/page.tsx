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
  Wallet,
  Activity
} from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
  const [currentPage, setCurrentPage] = useState(1)

  // Initialize and load transactions
  useEffect(() => {
    if (!wallet?.address) {
      setTransactions([])
      return
    }

    initTransactionHistory(wallet.address)
    loadTransactions()
  }, [wallet?.address])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

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
  
  // Pagination constants and logic
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

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
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Activity
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            View your shielded transaction history
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['all', 'shield', 'transfer', 'swap', 'unshield'] as const).map((type) => {
            const count = typeCounts[type]
            const isActive = filter === type
            return (
              <Button
                key={type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter(type)
                  loadTransactions()
                }}
              >
                {type === 'all' ? 'All' : formatTransactionType(type)}
                {count > 0 && (
                  <span className="ml-1.5 opacity-70">
                    ({count})
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-bold mb-2">No Transactions</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your shielded transactions will appear here
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedTransactions.map((tx) => {
              return (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-medium text-primary">
                          {formatTransactionType(tx.type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tx.token}
                        </span>
                        <span className={`text-xs ml-auto ${
                          tx.status === 'confirmed' 
                            ? 'text-muted-foreground' 
                            : tx.status === 'failed' 
                            ? 'text-destructive' 
                            : 'text-muted-foreground/80'
                        }`}>
                          {tx.status === 'confirmed' ? 'Confirmed' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>

                      {/* Amount and Details */}
                      <div className="space-y-1.5">
                        {tx.type === 'shield' && (
                          <p className="text-xl font-bold">
                            +{tx.amount} {tx.token}
                          </p>
                        )}
                        
                        {tx.type === 'transfer' && (
                          <>
                            <p className="text-xl font-bold">
                              -{tx.amount} {tx.token}
                            </p>
                            {tx.recipientAddress && (
                              <p className="text-xs text-muted-foreground">
                                To: {shortenAddress(tx.recipientAddress, 12)}
                              </p>
                            )}
                            {tx.fee && parseFloat(tx.fee) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Fee: {tx.fee} {tx.token}
                              </p>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'swap' && (
                          <>
                            <p className="text-xl font-bold">
                              {tx.inputToken} → {tx.outputToken}
                            </p>
                            {tx.amount && tx.outputAmount && (
                              <p className="text-xs text-muted-foreground">
                                {tx.amount} {tx.inputToken} → {tx.outputAmount} {tx.outputToken}
                              </p>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'unshield' && (
                          <>
                            <p className="text-xl font-bold">
                              +{tx.amount} {tx.token}
                            </p>
                            {tx.recipientPublicAddress && (
                              <p className="text-xs text-muted-foreground">
                                To: {tx.recipientPublicAddress.slice(0, 8)}...{tx.recipientPublicAddress.slice(-6)}
                              </p>
                            )}
                            {tx.relayerFee && parseFloat(tx.relayerFee) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Fee: {tx.relayerFee} {tx.token}
                              </p>
                            )}
                          </>
                        )}

                        {/* Timestamp and Hash */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t">
                          <span className="text-xs text-muted-foreground" title={formatFullTimestamp(tx.timestamp)}>
                            {formatTimestamp(tx.timestamp)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyHash(tx.txHash)}
                              className="h-7 w-7 p-0"
                              title="Copy transaction hash"
                            >
                              {copiedHash === tx.txHash ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-7 w-7 p-0"
                              title="View on block explorer"
                            >
                              <a
                                href={`${links.explorer}/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>

                        {/* Transaction Hash */}
                        <code className="text-xs text-muted-foreground/60 font-mono break-all block mt-1">
                          {formatHash(tx.txHash)}
                        </code>
                      </div>
                    </div>
                  </div>
                </Card>
              )
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage > 1) setCurrentPage(currentPage - 1)
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(page)
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <span className="px-2">...</span>
                          </PaginationItem>
                        )
                      }
                      return null
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                        }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}

        {/* Summary Stats */}
        {transactions.length > 0 && (
          <Card className="mt-8 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Shields</p>
                <p className="text-2xl font-bold">{typeCounts.shield}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transfers</p>
                <p className="text-2xl font-bold">{typeCounts.transfer}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Unshields</p>
                <p className="text-2xl font-bold">{typeCounts.unshield}</p>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

