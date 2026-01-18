"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ExternalLink,
  Copy,
  Check,
  RefreshCw
} from "lucide-react"
import { WalletIcon } from "@/components/wallet-icon"
import { WalletConnectButton } from "@/components/wallet-connect-button"
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

export function ActivityInterface() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<ShieldedTransaction[]>([])
  const [filter, setFilter] = useState<TransactionType | 'all' | 'receive'>('all')
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Initialize and load transactions
  useEffect(() => {
    if (!wallet?.address) {
      setTransactions([])
      return
    }

    initTransactionHistory(wallet.address).then(() => {
      loadTransactions()
    }).catch(err => {
      console.warn('[Activity] Failed to init transaction history:', err)
      loadTransactions() // Still load from local storage
    })
  }, [wallet?.address])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  const loadTransactions = () => {
    // Always load all transactions - filtering happens in filteredTransactions
    const history = getTransactionHistory()
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
    toast({ title: "Copied!", description: "Transaction hash copied to clipboard", duration: 3000 })
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
      <Card className="p-6 mb-6 bg-muted/30 border border-muted">
        <div className="text-center py-8">
          <WalletIcon className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-display font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm font-body text-muted-foreground mb-6">
            Connect your wallet to view your transaction history
          </p>
          <WalletConnectButton />
        </div>
      </Card>
    )
  }

  const filteredTransactions = filter === 'all' 
    ? transactions
    : filter === 'receive'
    ? transactions.filter(tx => tx.type === 'transfer' && tx.isIncoming === true)
    : transactions.filter(tx => tx.type === filter)
  
  // Pagination constants and logic
  const itemsPerPage = 3
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  const typeCounts = {
    all: transactions.length,
    shield: getTransactionsByType('shield').length,
    transfer: getTransactionsByType('transfer').filter(tx => !tx.isIncoming).length,
    receive: getTransactionsByType('transfer').filter(tx => tx.isIncoming === true).length,
    swap: getTransactionsByType('swap').length,
    unshield: getTransactionsByType('unshield').length,
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold mb-1">Transaction History</h2>
          <p className="text-sm font-body text-white/70">View your shielded transactions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="font-body"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'shield', 'transfer', 'receive', 'swap', 'unshield'] as const).map((type) => {
          const count = typeCounts[type]
          const isActive = filter === type
          return (
            <Button
              key={type}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(type)}
              className="font-body"
            >
              {type === 'all' ? 'All' : type === 'receive' ? 'Receive' : formatTransactionType(type)}
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
          <h3 className="text-lg font-display font-bold mb-2">No Transactions</h3>
          <p className="text-sm font-body text-white/70 mb-4">
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
                        <span className="text-xs font-body font-medium text-primary">
                          {tx.type === 'transfer' && tx.isIncoming ? 'Receive' : formatTransactionType(tx.type)}
                        </span>
                        <span className="text-xs font-body text-white/70">
                          {tx.token}
                        </span>
                        <span className={`text-xs font-body ml-auto ${
                          tx.status === 'confirmed' 
                            ? 'text-white/70' 
                            : tx.status === 'failed' 
                            ? 'text-destructive' 
                            : 'text-white/60'
                        }`}>
                          {tx.status === 'confirmed' ? 'Confirmed' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>

                      {/* Amount and Details */}
                      <div className="space-y-1.5">
                        {tx.type === 'shield' && (
                          <p className="text-xl font-mono font-bold tracking-[-0.01em]">
                            +{Number(tx.amount).toFixed(4)} <span className="font-body text-sm text-white/70">{tx.token}</span>
                          </p>
                        )}
                        
                        {tx.type === 'transfer' && (
                          <>
                            <p className="text-xl font-mono font-bold tracking-[-0.01em]">
                              {tx.isIncoming ? '+' : '-'}{Number(tx.amount).toFixed(4)} <span className="font-body text-sm text-white/70">{tx.token}</span>
                            </p>
                            {tx.isIncoming ? (
                              <p className="text-xs font-body text-white/60">
                                Received
                              </p>
                            ) : (
                              <>
                                {tx.recipientAddress && (
                                  <p className="text-xs font-body text-white/60">
                                    To: <span className="font-mono">{shortenAddress(tx.recipientAddress, 12)}</span>
                                  </p>
                                )}
                                {tx.fee && parseFloat(tx.fee) > 0 && (
                                  <p className="text-xs font-body text-white/60">
                                    Fee: <span className="font-mono">{tx.fee}</span> <span className="font-body">{tx.token}</span>
                                  </p>
                                )}
                              </>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'swap' && (
                          <>
                            <p className="text-xl font-body font-bold">
                              {tx.inputToken} → {tx.outputToken}
                            </p>
                            {tx.amount && tx.outputAmount && (
                              <p className="text-xs font-body text-white/60">
                                <span className="font-mono">{tx.amount}</span> {tx.inputToken} → <span className="font-mono">{tx.outputAmount}</span> {tx.outputToken}
                              </p>
                            )}
                          </>
                        )}
                        
                        {tx.type === 'unshield' && (
                          <>
                            <p className="text-xl font-mono font-bold tracking-[-0.01em]">
                              +{Number(tx.amount).toFixed(4)} <span className="font-body text-sm text-white/70">{tx.token}</span>
                            </p>
                            {tx.recipientPublicAddress && (
                              <p className="text-xs font-body text-white/60">
                                To: <span className="font-mono">{tx.recipientPublicAddress.slice(0, 8)}...{tx.recipientPublicAddress.slice(-6)}</span>
                              </p>
                            )}
                            {tx.relayerFee && parseFloat(tx.relayerFee) > 0 && (
                              <p className="text-xs font-body text-white/60">
                                Fee: <span className="font-mono">{tx.relayerFee}</span> <span className="font-body">{tx.token}</span>
                              </p>
                            )}
                          </>
                        )}

                        {/* Timestamp and Hash */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t">
                          <span className="text-xs font-body text-white/60" title={formatFullTimestamp(tx.timestamp)}>
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
        <Card className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/60 mb-1">Total</p>
              <p className="text-2xl font-mono font-bold tracking-[-0.01em]">{transactions.length}</p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/60 mb-1">Shields</p>
              <p className="text-2xl font-mono font-bold tracking-[-0.01em]">{typeCounts.shield}</p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/60 mb-1">Transfers</p>
              <p className="text-2xl font-mono font-bold tracking-[-0.01em]">{typeCounts.transfer}</p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/60 mb-1">Receives</p>
              <p className="text-2xl font-mono font-bold tracking-[-0.01em]">{typeCounts.receive}</p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/60 mb-1">Unshields</p>
              <p className="text-2xl font-mono font-bold tracking-[-0.01em]">{typeCounts.unshield}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

