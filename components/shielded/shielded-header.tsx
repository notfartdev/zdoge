"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Shield, Copy, Check, Eye, EyeOff, Wallet, Lock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import {
  initializeShieldedWallet,
  getWalletState,
  getShieldedBalance,
  getShieldedBalancePerToken,
  getNotes,
  getIdentity,
  type ShieldedWalletState,
} from "@/lib/shielded/shielded-service"
import {
  startAutoDiscovery,
  stopAutoDiscovery,
  isAutoDiscoveryRunning,
} from "@/lib/shielded/auto-discovery"
import { shieldedPool, tokens, ERC20ABI } from "@/lib/dogeos-config"
import { shortenAddress } from "@/lib/shielded/shielded-address"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { createPublicClient, http, type Address } from "viem"
import { dogeosTestnet } from "@/lib/dogeos-config"

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
})

// Token configuration with logos
const TOKEN_CONFIG: Record<string, { name: string; logo: string; address?: string; isNative?: boolean }> = {
  DOGE: { name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', isNative: true },
  USDC: { name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png', address: tokens.USDC.address },
  USDT: { name: 'Tether USD', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', address: tokens.USDT.address },
  USD1: { name: 'USD1', logo: 'https://assets.coingecko.com/coins/images/54977/standard/USD1_1000x1000_transparent.png', address: tokens.USD1.address },
  WETH: { name: 'Wrapped ETH', logo: 'https://assets.coingecko.com/coins/images/2518/large/weth.png', address: tokens.WETH.address },
  LBTC: { name: 'Liquid BTC', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', address: tokens.LBTC.address },
}

interface ShieldedHeaderProps {
  onStateChange?: () => void
  selectedToken?: string
  onTokenChange?: (token: string) => void
  compact?: boolean // Use smaller header on secondary pages
}

export function ShieldedHeader({ onStateChange, selectedToken = "DOGE", onTokenChange, compact = false }: ShieldedHeaderProps) {
  const { toast } = useToast()
  const { wallet, signMessage } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [walletState, setWalletState] = useState<ShieldedWalletState | null>(null)
  const [showAddress, setShowAddress] = useState(false)
  const [copied, setCopied] = useState(false)
  const [allPublicBalances, setAllPublicBalances] = useState<Record<string, string>>({})
  
  const tokenConfig = TOKEN_CONFIG[selectedToken] || TOKEN_CONFIG.DOGE
  const publicBalance = allPublicBalances[selectedToken] || "0"
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Fetch all public token balances
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setAllPublicBalances({})
      return
    }
    
    async function fetchAllBalances() {
      const balances: Record<string, string> = {}
      
      for (const [symbol, config] of Object.entries(TOKEN_CONFIG)) {
        try {
          if (config.isNative) {
            // Fetch native DOGE balance
            const provider = (window as any).ethereum
            if (provider) {
              const balance = await provider.request({
                method: "eth_getBalance",
                params: [wallet.address, "latest"],
              })
              const balanceWei = BigInt(balance)
              const balanceDoge = Number(balanceWei) / 1e18
              balances[symbol] = balanceDoge.toFixed(4)
            }
          } else if (config.address) {
            // Fetch ERC20 balance
            const balance = await publicClient.readContract({
              address: config.address as Address,
              abi: ERC20ABI,
              functionName: 'balanceOf',
              args: [wallet.address as Address],
            })
            balances[symbol] = (Number(balance) / 1e18).toFixed(4)
          }
        } catch (error) {
          console.error(`Failed to fetch ${symbol} balance:`, error)
          balances[symbol] = "0"
        }
      }
      
      setAllPublicBalances(balances)
    }
    
    fetchAllBalances()
    const interval = setInterval(fetchAllBalances, 10000)
    return () => clearInterval(interval)
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  // Initialize shielded wallet when wallet is connected
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setIsInitialized(false)
      setWalletState(null)
      return
    }
    
    async function init() {
      try {
        // Pass wallet address and sign message function to initialize
        const identity = await initializeShieldedWallet(
          wallet.address!,
          signMessage ? async (msg: string) => signMessage(msg) : undefined,
          shieldedPool.address
        )
        
        if (identity) {
          setIsInitialized(true)
          refreshState()
          
          // Start auto-discovery
          startAutoDiscovery(
            shieldedPool.address,
            identity,
            getNotes(),
            (note) => {
              toast({
                title: "🔔 Incoming Transfer!",
                description: `Received ${formatWeiToAmount(note.amount).toFixed(4)} DOGE`,
              })
              refreshState()
              onStateChange?.()
            }
          )
        }
      } catch (error) {
        console.error("Failed to initialize shielded wallet:", error)
      }
    }
    
    init()
    
    return () => {
      stopAutoDiscovery()
    }
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  const refreshState = () => {
    // Reload state from storage to ensure we have the latest notes
    if (wallet?.address) {
      const state = getWalletState()
      setWalletState(state)
    }
    onStateChange?.()
  }
  
  
  const copyAddress = async () => {
    if (!walletState?.shieldedAddress) return
    await navigator.clipboard.writeText(`zdoge:${walletState.shieldedAddress}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Address copied!" })
  }
  
  if (!mounted) return null
  
  // Show connect wallet prompt if not connected
  if (!wallet?.isConnected || !wallet?.address) {
    return (
      <Card className="p-6 mb-6 bg-card/50 backdrop-blur border-primary/20">
        <div className="text-center py-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to access your shielded balance
          </p>
        </div>
      </Card>
    )
  }
  
  const shieldedBalance = walletState ? getShieldedBalancePerToken() : {}
  const allNotes = walletState ? getNotes() : []
  const tokenNotes = allNotes.filter(note => (note.token || 'DOGE') === selectedToken)
  const isAutoDiscovery = isAutoDiscoveryRunning()
  
  return (
    <Card className={`${compact ? 'p-4' : 'p-6'} mb-6 bg-card/50 backdrop-blur border-primary/20`}>
      
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${compact ? '' : 'mb-4'}`}>
        <div className={`${compact ? 'p-3' : 'p-4'} rounded-lg bg-muted/30 border`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wallet className="h-3.5 w-3.5 opacity-85" strokeWidth={1.75} />
            Public Balance
          </div>
          {onTokenChange ? (
            <Select value={selectedToken} onValueChange={onTokenChange}>
              <SelectTrigger className="h-auto py-0 px-0 border-0 bg-transparent hover:bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 w-fit">
                <SelectValue>
                  <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold flex items-center gap-2`}>
                    <img 
                      src={tokenConfig.logo} 
                      alt={selectedToken} 
                      className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full`}
                    />
                    {publicBalance} {selectedToken}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TOKEN_CONFIG).map(([symbol, config]) => (
                  <SelectItem key={symbol} value={symbol}>
                    <div className="flex items-center gap-2">
                      <img 
                        src={config.logo} 
                        alt={symbol} 
                        className="w-5 h-5 rounded-full"
                      />
                      <span>{symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold flex items-center gap-2`}>
              <img 
                src={tokenConfig.logo} 
                alt={selectedToken} 
                className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full`}
              />
              {publicBalance} {selectedToken}
            </div>
          )}
          {!compact && <div className="text-xs text-muted-foreground">Available to shield</div>}
        </div>
        
        <div className={`${compact ? 'p-3' : 'p-4'} rounded-lg bg-primary/5 border border-primary/20`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Lock className="h-3.5 w-3.5 opacity-85" strokeWidth={1.75} />
            Shielded Balance
          </div>
          <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold flex items-center gap-2`}>
            <img 
              src={tokenConfig.logo} 
              alt={selectedToken} 
              className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full`}
            />
            {selectedToken}
            <span className="ml-auto">{formatWeiToAmount(shieldedBalance[selectedToken] || 0n).toFixed(4)}</span>
          </div>
          {!compact && <div className="text-xs text-muted-foreground">Private balance</div>}
        </div>
      </div>
      
      {walletState?.shieldedAddress && !compact && (
        <div className="p-4 rounded-lg bg-muted/30 border mt-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Shield className="h-3.5 w-3.5 opacity-85" strokeWidth={1.75} />
                Your Shielded Address
                <Badge variant="outline" className="text-[10px] ml-1">Permanent</Badge>
              </div>
              <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded block">
                {showAddress 
                  ? `zdoge:${walletState.shieldedAddress}`
                  : `zdoge:${shortenAddress(walletState.shieldedAddress)}`
                }
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                Share this address to receive private payments • This address never changes
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Button variant="ghost" size="icon" onClick={() => setShowAddress(!showAddress)}>
                {showAddress ? <EyeOff className="h-4 w-4 opacity-85" strokeWidth={1.75} /> : <Eye className="h-4 w-4 opacity-85" strokeWidth={1.75} />}
              </Button>
              <Button variant="ghost" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" strokeWidth={1.75} /> : <Copy className="h-4 w-4 opacity-85" strokeWidth={1.75} />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function useShieldedState() {
  const [notes, setNotes] = useState(getNotes())
  const [balance, setBalance] = useState(getShieldedBalancePerToken())
  
  const refresh = () => {
    setNotes(getNotes())
    setBalance(getShieldedBalancePerToken())
  }
  
  return { notes, balance, refresh }
}

