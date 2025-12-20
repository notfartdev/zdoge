"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { api, tokenPools, links, type SupportedToken } from "@/lib/dogeos-config"
import { Loader2, ExternalLink, Clock, CheckCircle, AlertCircle, Inbox as InboxIcon, Copy, ArrowDownLeft, ArrowUpRight, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DepositRecord {
  poolAddress: string
  token: string
  amount: string
  commitment: string
  leafIndex: number
  timestamp: number
  txHash: string
  poolStats?: {
    totalDeposits: number
    totalWithdrawals: number
  }
}

interface ScheduledWithdrawal {
  nullifierHash: string
  poolAddress: string
  token: string
  amount: string
  recipient: string
  unlockTime: number
  status: 'pending' | 'ready' | 'executed'
  scheduledTxHash?: string
  executedTxHash?: string
}

interface WithdrawalRecord {
  poolAddress: string
  recipient: string
  nullifierHash: string
  relayer: string
  fee: string
  timestamp: number
  txHash: string
  blockNumber: number
}

// Helper to find token info from pool address
function getPoolInfo(poolAddress: string): { token: SupportedToken; amount: string } | null {
  for (const [tokenSymbol, config] of Object.entries(tokenPools)) {
    for (const [amount, address] of Object.entries(config.pools)) {
      if (address.toLowerCase() === poolAddress.toLowerCase()) {
        return { token: tokenSymbol as SupportedToken, amount }
      }
    }
  }
  return null
}

const ITEMS_PER_PAGE = 5

export function InboxPanel() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [scheduledWithdrawals, setScheduledWithdrawals] = useState<ScheduledWithdrawal[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // Pagination states
  const [showAllDeposits, setShowAllDeposits] = useState(false)
  const [showAllWithdrawals, setShowAllWithdrawals] = useState(false)

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast({ title: "Copied!", description: "Hash copied to clipboard" })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }

  useEffect(() => {
    if (!wallet?.isConnected || !wallet.address) {
      setDeposits([])
      setScheduledWithdrawals([])
      setWithdrawals([])
      setLoading(false)
      return
    }

    const fetchInboxData = async () => {
      try {
        // Fetch deposits for this wallet
        const depositsRes = await fetch(`${api.indexer}/api/wallet/${wallet.address}/deposits`)
        if (depositsRes.ok) {
          const data = await depositsRes.json()
          setDeposits(data.deposits || [])
        }

        // Fetch scheduled withdrawals for this wallet
        const scheduledRes = await fetch(`${api.indexer}/api/wallet/${wallet.address}/scheduled`)
        if (scheduledRes.ok) {
          const data = await scheduledRes.json()
          // Update status based on current time
          const now = Math.floor(Date.now() / 1000)
          const updated = (data.scheduled || []).map((sw: ScheduledWithdrawal) => ({
            ...sw,
            status: sw.status === 'executed' ? 'executed' : sw.unlockTime <= now ? 'ready' : 'pending'
          }))
          setScheduledWithdrawals(updated)
        }

        // Fetch instant withdrawals for this wallet (as recipient)
        const withdrawalsRes = await fetch(`${api.indexer}/api/wallet/${wallet.address}/withdrawals`)
        if (withdrawalsRes.ok) {
          const data = await withdrawalsRes.json()
          setWithdrawals(data.withdrawals || [])
        }

        setLoading(false)
      } catch (error) {
        console.error("[Inbox] Failed to fetch:", error)
        setLoading(false)
      }
    }

    fetchInboxData()
    const interval = setInterval(fetchInboxData, 10000) // Refresh every 10s

    return () => clearInterval(interval)
  }, [wallet?.isConnected, wallet?.address])

  const handleExecute = async (withdrawal: ScheduledWithdrawal) => {
    setExecuting(withdrawal.nullifierHash)
    try {
      const res = await fetch(`${api.indexer}/api/relay/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool: withdrawal.poolAddress,
          nullifierHash: withdrawal.nullifierHash,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to execute')
      }

      const result = await res.json()
      
      // Update local state
      setScheduledWithdrawals(prev => prev.map(sw => 
        sw.nullifierHash === withdrawal.nullifierHash 
          ? { ...sw, status: 'executed' as const, executedTxHash: result.txHash }
          : sw
      ))

      toast({
        title: "Withdrawal Executed!",
        description: "Your funds have been sent to the recipient.",
      })
    } catch (error: any) {
      toast({
        title: "Execution Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setExecuting(null)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  const formatTimeUntil = (timestamp: number) => {
    const seconds = timestamp - Math.floor(Date.now() / 1000)
    if (seconds <= 0) return 'Ready!'
    
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  const formatHash = (hash: string) => {
    if (!hash) return '-----'
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  if (!wallet?.isConnected) {
    return (
      <Card className="bg-black border-[#C2A633]/20 p-6 rounded-none">
        <div className="text-center py-8">
          <InboxIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="font-mono text-sm text-gray-500">Connect wallet to view inbox</p>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="bg-black border-[#C2A633]/20 p-6 rounded-none">
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-[#C2A633] mx-auto mb-4 animate-spin" />
          <p className="font-mono text-sm text-gray-500">Loading inbox...</p>
        </div>
      </Card>
    )
  }

  const pendingWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'pending')
  const readyWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'ready')
  const executedWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'executed')

  return (
    <Card className="bg-black border-[#C2A633]/20 p-0 rounded-none overflow-hidden">
      <div className="p-4 border-b border-[#C2A633]/20">
        <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <InboxIcon className="w-4 h-4 text-[#C2A633]" />
          Inbox
        </h3>
      </div>

      <div className="divide-y divide-[#C2A633]/10">
        {/* Ready to Execute - Highlighted */}
        {readyWithdrawals.length > 0 && (
          <div className="p-4 bg-green-500/5">
            <h4 className="font-mono text-xs text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Ready to Execute ({readyWithdrawals.length})
            </h4>
            <div className="space-y-2">
              {readyWithdrawals.map((sw) => {
                const poolInfo = getPoolInfo(sw.poolAddress)
                return (
                  <div key={sw.nullifierHash} className="p-3 bg-black border border-green-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-white font-bold">
                        {poolInfo ? `${poolInfo.amount} ${poolInfo.token}` : 'Unknown Pool'}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        To: {formatHash(sw.recipient)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleExecute(sw)}
                      disabled={executing === sw.nullifierHash}
                      className="bg-green-500 hover:bg-green-600 text-black font-mono text-xs"
                    >
                      {executing === sw.nullifierHash ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Execute'
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending Withdrawals */}
        {pendingWithdrawals.length > 0 && (
          <div className="p-4">
            <h4 className="font-mono text-xs text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Pending ({pendingWithdrawals.length})
            </h4>
            <div className="space-y-2">
              {pendingWithdrawals.map((sw) => {
                const poolInfo = getPoolInfo(sw.poolAddress)
                return (
                  <div key={sw.nullifierHash} className="p-3 bg-zinc-950 border border-[#C2A633]/20 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-white font-bold">
                        {poolInfo ? `${poolInfo.amount} ${poolInfo.token}` : 'Unknown Pool'}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        To: {formatHash(sw.recipient)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-yellow-400">
                        {formatTimeUntil(sw.unlockTime)}
                      </div>
                      <div className="font-mono text-[10px] text-gray-600">until ready</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Deposit History */}
        {deposits.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ArrowDownLeft className="w-3 h-3 text-[#C2A633]" />
                Deposit History
              </h4>
              <span className="font-mono text-[10px] px-2 py-0.5 bg-[#C2A633]/20 text-[#C2A633] rounded">
                {deposits.length} deposits
              </span>
            </div>
            <div className="space-y-2">
              {(showAllDeposits ? deposits : deposits.slice(0, ITEMS_PER_PAGE)).map((deposit, i) => {
                const poolInfo = getPoolInfo(deposit.poolAddress)
                return (
                  <div key={i} className="p-3 bg-zinc-950 border border-[#C2A633]/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                          <span className="font-mono text-xs text-[#C2A633] font-bold">D</span>
                        </div>
                        <div>
                          <div className="font-mono text-sm text-white font-bold">
                            {poolInfo ? `${poolInfo.amount} ${poolInfo.token}` : 'Unknown Pool'}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                              Deposited
                            </span>
                            {deposit.poolStats && deposit.poolStats.totalWithdrawals > 0 && (
                              <span className="font-mono text-[10px] text-gray-500">
                                Pool: {deposit.poolStats.totalWithdrawals}/{deposit.poolStats.totalDeposits} withdrawn
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[10px] text-gray-500">
                          TX: {formatHash(deposit.txHash)}
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          {new Date(deposit.timestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Commitment info */}
                    <div className="mt-2 pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-gray-500">Commitment:</span>
                          <span className="font-mono text-[10px] text-gray-400" title={deposit.commitment}>
                            {formatHash(deposit.commitment)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(deposit.commitment, `commit-${i}`)}
                            className="text-gray-500 hover:text-[#C2A633] p-1"
                            title="Copy commitment hash"
                          >
                            {copiedId === `commit-${i}` ? (
                              <CheckCircle className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(deposit.txHash, `tx-${i}`)}
                            className="text-gray-500 hover:text-[#C2A633] p-1"
                            title="Copy TX hash"
                          >
                            {copiedId === `tx-${i}` ? (
                              <CheckCircle className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={`${links.explorer}/tx/${deposit.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-[#C2A633] p-1"
                            title="View on Explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Show more/less button for deposits */}
            {deposits.length > ITEMS_PER_PAGE && (
              <button
                onClick={() => setShowAllDeposits(!showAllDeposits)}
                className="w-full mt-2 py-2 text-center font-mono text-xs text-[#C2A633] hover:text-[#C2A633]/80 border border-[#C2A633]/20 hover:border-[#C2A633]/40 transition-colors"
              >
                {showAllDeposits 
                  ? `Show Less` 
                  : `Show All ${deposits.length} Deposits`
                }
              </button>
            )}
            
            {/* Info about commitment */}
            <div className="mt-3 p-2 bg-zinc-900 border border-zinc-800 rounded">
              <div className="flex items-start gap-2">
                <Info className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="font-mono text-[10px] text-gray-500">
                  <span className="text-gray-400">Commitment</span> is a unique cryptographic hash for your deposit. 
                  Your secret note proves you own this commitment to withdraw later.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Executed Withdrawals */}
        {executedWithdrawals.length > 0 && (
          <div className="p-4">
            <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Completed ({executedWithdrawals.length})
            </h4>
            <div className="space-y-2">
              {executedWithdrawals.slice(0, 3).map((sw) => {
                const poolInfo = getPoolInfo(sw.poolAddress)
                return (
                  <div key={sw.nullifierHash} className="p-3 bg-zinc-950 border border-green-500/10 flex items-center justify-between opacity-60">
                    <div>
                      <div className="font-mono text-sm text-white">
                        {poolInfo ? `${poolInfo.amount} ${poolInfo.token}` : 'Unknown Pool'}
                      </div>
                      <div className="font-mono text-[10px] text-green-400">Executed</div>
                    </div>
                    {sw.executedTxHash && (
                      <a
                        href={`${links.explorer}/tx/${sw.executedTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#C2A633] hover:text-[#C2A633]/80"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Withdrawal History (instant withdrawals received) */}
        {withdrawals.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ArrowUpRight className="w-3 h-3 text-green-500" />
                Withdrawal History
              </h4>
              <span className="font-mono text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                {withdrawals.length} received
              </span>
            </div>
            <div className="space-y-2">
              {(showAllWithdrawals ? withdrawals : withdrawals.slice(0, ITEMS_PER_PAGE)).map((withdrawal, i) => {
                const poolInfo = getPoolInfo(withdrawal.poolAddress)
                return (
                  <div key={i} className="p-3 bg-zinc-950 border border-green-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <div className="font-mono text-sm text-white font-bold">
                          {poolInfo ? `${poolInfo.amount} ${poolInfo.token}` : 'Unknown Pool'}
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                          Received
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-[10px] text-gray-500">
                          TX: {formatHash(withdrawal.txHash)}
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          {new Date(withdrawal.timestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                      <a
                        href={`${links.explorer}/tx/${withdrawal.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-400 p-1"
                        title="View on Explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Show more/less button for withdrawals */}
            {withdrawals.length > ITEMS_PER_PAGE && (
              <button
                onClick={() => setShowAllWithdrawals(!showAllWithdrawals)}
                className="w-full mt-2 py-2 text-center font-mono text-xs text-green-400 hover:text-green-300 border border-green-500/20 hover:border-green-500/40 transition-colors"
              >
                {showAllWithdrawals 
                  ? `Show Less` 
                  : `Show All ${withdrawals.length} Withdrawals`
                }
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {deposits.length === 0 && scheduledWithdrawals.length === 0 && withdrawals.length === 0 && (
          <div className="p-8 text-center">
            <InboxIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="font-mono text-sm text-gray-500">No activity yet</p>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Your deposits and withdrawals will appear here
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

