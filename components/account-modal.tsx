"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { User, X, Wallet, Globe, LogOut, ChevronDown, Check, Copy, Coins, Network, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { dogeosTestnet, tokens, shieldedPool } from "@/lib/dogeos-config"
import { syncNotesWithChain } from "@/lib/shielded/shielded-service"

// Available RPC endpoints for DogeOS
const RPC_OPTIONS = [
  { id: 'default', name: 'DogeOS RPC', url: 'https://rpc.testnet.dogeos.com' },
  { id: 'blockscout', name: 'Blockscout RPC', url: 'https://blockscout.testnet.dogeos.com/api/eth-rpc' },
  { id: 'custom', name: 'Custom', url: '' },
] as const

interface TokenBalance {
  symbol: string
  balance: string
  usdValue?: number
}

export function AccountModal() {
  const { wallet, disconnect } = useWallet()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [showRpcDropdown, setShowRpcDropdown] = useState(false)
  const [selectedRpc, setSelectedRpc] = useState(RPC_OPTIONS[0])
  const [customRpcUrl, setCustomRpcUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch token balances when modal opens
  useEffect(() => {
    if (isOpen && wallet?.isConnected && wallet.address) {
      fetchTokenBalances()
    }
  }, [isOpen, wallet?.isConnected, wallet?.address])

  const fetchTokenBalances = async () => {
    if (!wallet?.address || typeof window === 'undefined' || !window.ethereum) return
    
    setLoadingBalances(true)
    try {
      const balances: TokenBalance[] = []
      
      // Add native DOGE balance
      if (wallet.balance) {
        const balanceNum = typeof wallet.balance === 'bigint' 
          ? Number(wallet.balance) / 1e18 
          : Number(wallet.balance)
        balances.push({
          symbol: 'DOGE',
          balance: balanceNum.toFixed(4),
        })
      }

      // Fetch ERC20 balances
      const tokenConfigs = [
        { symbol: 'USDC', address: tokens.USDC.address, decimals: tokens.USDC.decimals },
        { symbol: 'USDT', address: tokens.USDT.address, decimals: tokens.USDT.decimals },
        { symbol: 'WETH', address: tokens.WETH.address, decimals: tokens.WETH.decimals },
        { symbol: 'WDOGE', address: tokens.WDOGE.address, decimals: tokens.WDOGE.decimals },
      ]

      for (const token of tokenConfigs) {
        try {
          // Call balanceOf on ERC20 contract
          const data = `0x70a08231000000000000000000000000${wallet.address.slice(2)}`
          const result = await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: token.address, data }, 'latest'],
          })
          
          const balanceBigInt = BigInt(result as string)
          const balanceNum = Number(balanceBigInt) / (10 ** token.decimals)
          
          balances.push({
            symbol: token.symbol,
            balance: balanceNum > 0 ? balanceNum.toFixed(4) : '0',
          })
        } catch (err) {
          balances.push({
            symbol: token.symbol,
            balance: '0',
          })
        }
      }

      setTokenBalances(balances)
    } catch (error) {
      console.error('Failed to fetch balances:', error)
    } finally {
      setLoadingBalances(false)
    }
  }

  const copyAddress = async () => {
    if (wallet?.address) {
      await navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      toast({ title: "Copied!", description: "Address copied to clipboard" })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRpcChange = (rpc: typeof RPC_OPTIONS[number]) => {
    setSelectedRpc(rpc)
    setShowRpcDropdown(false)
    
    if (rpc.id !== 'custom') {
      localStorage.setItem('zdoge-rpc', rpc.url)
      toast({ 
        title: "RPC Changed", 
        description: `Now using ${rpc.name}` 
      })
    }
  }

  const handleCustomRpcSave = () => {
    if (customRpcUrl) {
      localStorage.setItem('zdoge-rpc', customRpcUrl)
      toast({ 
        title: "Custom RPC Saved", 
        description: "Using your custom RPC endpoint" 
      })
      setShowRpcDropdown(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setIsOpen(false)
    toast({ title: "Disconnected", description: "Wallet disconnected successfully" })
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncNotesWithChain(shieldedPool.address)
      toast({ title: "Synced!", description: "Notes synchronized with blockchain" })
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message || "Failed to sync notes", variant: "destructive" })
    } finally {
      setIsSyncing(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Button to open modal
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="font-mono text-sm text-gray-400 hover:text-white hover:bg-transparent flex items-center gap-2"
      >
        <User className="w-4 h-4" />
        Account
      </Button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-zinc-900 border border-[#C2A633]/30 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="font-mono text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#C2A633]" />
              Account
            </h2>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            
            {/* Wallet Address Section */}
            {wallet?.isConnected && (
              <div className="p-4 bg-black border border-[#C2A633]/30 space-y-3">
                <div className="flex items-center gap-2 text-[#C2A633]">
                  <Wallet className="w-4 h-4" />
                  <span className="font-mono text-xs uppercase tracking-wider font-bold">Connected Wallet</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-900 p-3 border border-zinc-800">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-gray-500 mb-1">Address</p>
                    <p className="font-mono text-sm text-white break-all">
                      {wallet.address}
                    </p>
                  </div>
                  <button
                    onClick={copyAddress}
                    className="ml-3 text-gray-500 hover:text-[#C2A633] p-2 transition-colors flex-shrink-0"
                    title="Copy address"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Wallet Balance Section */}
            {wallet?.isConnected && (
              <div className="p-4 bg-black border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Coins className="w-4 h-4" />
                    <span className="font-mono text-xs uppercase tracking-wider">Wallet Balance</span>
                  </div>
                  <button 
                    onClick={fetchTokenBalances}
                    className="text-[10px] font-mono text-[#C2A633] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                
                <div className="space-y-2">
                  {loadingBalances ? (
                    <div className="text-center py-3">
                      <span className="font-mono text-xs text-gray-500">Loading balances...</span>
                    </div>
                  ) : tokenBalances.length > 0 ? (
                    tokenBalances.map((token, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                            <span className="font-mono text-[10px] text-[#C2A633] font-bold">
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-white">{token.symbol}</span>
                        </div>
                        <span className="font-mono text-sm text-gray-400">{token.balance}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3">
                      <span className="font-mono text-xs text-gray-500">No balances found</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Network Section */}
            <div className="p-4 bg-black border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-gray-400">
                <Network className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-wider">Network</span>
              </div>
              
              <div className="flex items-center justify-between bg-zinc-900 p-3 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C2A633] flex items-center justify-center">
                    <span className="font-mono text-black font-bold text-sm">Ð</span>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">{dogeosTestnet.name}</p>
                    <p className="font-mono text-[10px] text-gray-500">Chain ID: {dogeosTestnet.id}</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
              </div>
            </div>

            {/* RPC Section */}
            <div className="p-4 bg-black border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-wider">RPC Endpoint</span>
              </div>
              
              {/* RPC Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowRpcDropdown(!showRpcDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-900 border border-zinc-700 hover:border-[#C2A633]/50 transition-colors"
                >
                  <span className="font-mono text-sm text-white">{selectedRpc.name}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRpcDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRpcDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 z-10 shadow-lg">
                    {RPC_OPTIONS.map((rpc) => (
                      <button
                        key={rpc.id}
                        onClick={() => handleRpcChange(rpc)}
                        className={`w-full text-left p-3 font-mono text-sm hover:bg-[#C2A633]/20 transition-colors flex items-center justify-between ${
                          selectedRpc.id === rpc.id ? 'bg-[#C2A633]/10 text-[#C2A633]' : 'text-white'
                        }`}
                      >
                        {rpc.name}
                        {selectedRpc.id === rpc.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom RPC Input */}
              {selectedRpc.id === 'custom' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={customRpcUrl}
                    onChange={(e) => setCustomRpcUrl(e.target.value)}
                    placeholder="https://your-rpc-url.com"
                    className="w-full p-3 bg-zinc-800 border border-zinc-700 font-mono text-sm text-white placeholder:text-gray-500 focus:border-[#C2A633]/50 focus:outline-none"
                  />
                  <Button
                    onClick={handleCustomRpcSave}
                    disabled={!customRpcUrl}
                    className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold"
                  >
                    Save Custom RPC
                  </Button>
                </div>
              )}
            </div>

            {/* Sync Button */}
            {wallet?.isConnected && (
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full font-mono text-sm border-[#C2A633]/50 text-[#C2A633] hover:bg-[#C2A633]/10 hover:text-[#C2A633] flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Shielded Notes'}
              </Button>
            )}

            {/* Disconnect Button */}
            {wallet?.isConnected && (
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="w-full font-mono text-sm border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

