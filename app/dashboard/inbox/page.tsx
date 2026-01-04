"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { api, tokenPools, links, type SupportedToken } from "@/lib/dogeos-config"
import { Loader2, ExternalLink, Clock, CheckCircle, AlertCircle, Inbox, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DepositRecord {
  poolAddress: string
  commitment: string
  leafIndex: number
  timestamp: number
  blockNumber: number
  txHash: string
}

interface ScheduledWithdrawal {
  nullifierHash: string
  poolAddress: string
  recipient: string
  unlockTime: number
  status: 'pending' | 'ready' | 'executed'
  scheduledTxHash?: string
  executedTxHash?: string
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

export default function InboxPage() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [scheduledWithdrawals, setScheduledWithdrawals] = useState<ScheduledWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet?.isConnected || !wallet.address) {
      setDeposits([])
      setScheduledWithdrawals([])
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
          const now = Math.floor(Date.now() / 1000)
          const updated = (data.scheduled || []).map((sw: ScheduledWithdrawal) => ({
            ...sw,
            status: sw.status === 'executed' ? 'executed' : sw.unlockTime <= now ? 'ready' : 'pending'
          }))
          setScheduledWithdrawals(updated)
        }

        setLoading(false)
      } catch (error) {
        console.error("[Inbox] Failed to fetch:", error)
        setLoading(false)
      }
    }

    fetchInboxData()
    const interval = setInterval(fetchInboxData, 10000)

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(id)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const formatTimeUntil = (timestamp: number) => {
    const seconds = timestamp - Math.floor(Date.now() / 1000)
    if (seconds <= 0) return 'Ready!'
    
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h remaining`
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`
    if (minutes > 0) return `${minutes}m remaining`
    return `${seconds}s remaining`
  }

  const formatHash = (hash: string) => {
    if (!hash) return '-----'
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount)
    if (num >= 1000) return num.toLocaleString()
    return amount
  }

  const pendingWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'pending')
  const readyWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'ready')
  const executedWithdrawals = scheduledWithdrawals.filter(sw => sw.status === 'executed')

  return (
    <div className="min-h-screen bg-black">
      <DashboardNav />
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Deposit Inbox</h1>
          <p className="text-gray-500 font-mono text-sm">
            Track your deposits, scheduled withdrawals, and execute when ready
          </p>
        </div>

        {!wallet?.isConnected ? (
          <Card className="bg-zinc-950 border-[#C2A633]/20 p-12 rounded-xl">
            <div className="text-center">
              <Inbox className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-500 font-mono text-sm">
                Connect your wallet to view your deposit history and pending withdrawals
              </p>
            </div>
          </Card>
        ) : loading ? (
          <Card className="bg-zinc-950 border-[#C2A633]/20 p-12 rounded-xl">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-[#C2A633] mx-auto mb-4 animate-spin" />
              <p className="text-gray-500 font-mono text-sm">Loading your inbox...</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Ready to Execute Section */}
            {readyWithdrawals.length > 0 && (
              <Card className="bg-zinc-950 border-green-500/30 p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-bold text-white">Ready to Execute</h2>
                  <span className="ml-auto bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-mono">
                    {readyWithdrawals.length} ready
                  </span>
                </div>
                <div className="space-y-3">
                  {readyWithdrawals.map((sw) => {
                    const poolInfo = getPoolInfo(sw.poolAddress)
                    return (
                      <div key={sw.nullifierHash} className="bg-black/50 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-white">
                                  {poolInfo ? `${formatAmount(poolInfo.amount)} ${poolInfo.token}` : 'Unknown'}
                                </span>
                                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-mono">
                                  Ready
                                </span>
                              </div>
                              <p className="text-gray-500 text-sm font-mono">
                                To: {formatHash(sw.recipient)}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleExecute(sw)}
                            disabled={executing === sw.nullifierHash}
                            className="bg-green-500 hover:bg-green-600 text-black font-mono font-bold"
                          >
                            {executing === sw.nullifierHash ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Execute Now'
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Pending Withdrawals Section */}
            {pendingWithdrawals.length > 0 && (
              <Card className="bg-zinc-950 border-yellow-500/30 p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-bold text-white">Pending Withdrawals</h2>
                  <span className="ml-auto bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs font-mono">
                    {pendingWithdrawals.length} pending
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingWithdrawals.map((sw) => {
                    const poolInfo = getPoolInfo(sw.poolAddress)
                    return (
                      <div key={sw.nullifierHash} className="bg-black/50 border border-yellow-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                              <Clock className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-white">
                                  {poolInfo ? `${formatAmount(poolInfo.amount)} ${poolInfo.token}` : 'Unknown'}
                                </span>
                                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs font-mono">
                                  Pending
                                </span>
                              </div>
                              <p className="text-gray-500 text-sm font-mono">
                                {formatTimeUntil(sw.unlockTime)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400 font-mono">Unlocks</p>
                            <p className="text-sm text-white font-mono">{formatDate(sw.unlockTime)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Deposit History Section */}
            <Card className="bg-zinc-950 border-[#C2A633]/20 p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Inbox className="w-5 h-5 text-[#C2A633]" />
                <h2 className="text-lg font-bold text-white">Deposit History</h2>
                <span className="ml-auto bg-[#C2A633]/20 text-[#C2A633] px-2 py-0.5 rounded text-xs font-mono">
                  {deposits.length} deposits
                </span>
              </div>
              
              {deposits.length === 0 ? (
                <div className="text-center py-8">
                  <Inbox className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 font-mono text-sm">No deposits yet</p>
                  <p className="text-gray-600 font-mono text-xs mt-1">
                    Your deposits will appear here after you make them
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deposits.map((deposit, i) => {
                    const poolInfo = getPoolInfo(deposit.poolAddress)
                    return (
                      <div key={i} className="bg-black/50 border border-[#C2A633]/20 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                              <span className="text-[#C2A633] font-bold text-lg">Ð</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-white">
                                  {poolInfo ? `${formatAmount(poolInfo.amount)} ${poolInfo.token}` : 'Unknown'}
                                </span>
                                <span className="bg-[#C2A633]/20 text-[#C2A633] px-2 py-0.5 rounded text-xs font-mono">
                                  Deposited
                                </span>
                              </div>
                              <p className="text-gray-500 text-sm font-mono">
                                Commitment: {formatHash(deposit.commitment)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm text-gray-400 font-mono">TX: {formatHash(deposit.txHash)}</p>
                              <p className="text-sm text-white font-mono">{formatDate(deposit.timestamp)}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => copyToClipboard(deposit.commitment, deposit.commitment)}
                                className="p-2 hover:bg-zinc-800 rounded transition-colors"
                                title="Copy commitment"
                              >
                                {copiedHash === deposit.commitment ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                              <a
                                href={`${links.explorer}/tx/${deposit.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-zinc-800 rounded transition-colors"
                              >
                                <ExternalLink className="w-4 h-4 text-[#C2A633]" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Executed Withdrawals Section */}
            {executedWithdrawals.length > 0 && (
              <Card className="bg-zinc-950 border-gray-700 p-6 rounded-xl opacity-75">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-gray-500" />
                  <h2 className="text-lg font-bold text-gray-400">Completed Withdrawals</h2>
                  <span className="ml-auto bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-xs font-mono">
                    {executedWithdrawals.length} completed
                  </span>
                </div>
                <div className="space-y-3">
                  {executedWithdrawals.slice(0, 5).map((sw) => {
                    const poolInfo = getPoolInfo(sw.poolAddress)
                    return (
                      <div key={sw.nullifierHash} className="bg-black/30 border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <span className="text-lg text-gray-400">
                                {poolInfo ? `${formatAmount(poolInfo.amount)} ${poolInfo.token}` : 'Unknown'}
                              </span>
                              <p className="text-gray-600 text-xs font-mono">Executed</p>
                            </div>
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
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Empty State */}
            {deposits.length === 0 && scheduledWithdrawals.length === 0 && (
              <Card className="bg-zinc-950 border-[#C2A633]/20 p-12 rounded-xl">
                <div className="text-center">
                  <Inbox className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Your inbox is empty</h3>
                  <p className="text-gray-500 font-mono text-sm mb-6">
                    Shield some DOGE to start using private transactions
                  </p>
                  <a href="/shield">
                    <Button className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold">
                      Go to Shielded
                    </Button>
                  </a>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

