"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, Copy, Check, Eye, EyeOff, Wallet, RefreshCw, Key, Lock, Radio
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import {
  initializeShieldedWallet,
  getWalletState,
  getShieldedBalance,
  getNotes,
  backupWallet,
  syncNotesWithChain,
  type ShieldedWalletState,
} from "@/lib/shielded/shielded-service"
import {
  startAutoDiscovery,
  stopAutoDiscovery,
  isAutoDiscoveryRunning,
} from "@/lib/shielded/auto-discovery"
import { shieldedPool } from "@/lib/dogeos-config"
import { shortenAddress } from "@/lib/shielded/shielded-address"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"

interface ShieldedHeaderProps {
  onStateChange?: () => void
}

export function ShieldedHeader({ onStateChange }: ShieldedHeaderProps) {
  const { toast } = useToast()
  const { wallet } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [walletState, setWalletState] = useState<ShieldedWalletState | null>(null)
  const [showAddress, setShowAddress] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publicBalance, setPublicBalance] = useState<string>("0")
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setPublicBalance("0")
      return
    }
    
    async function fetchBalance() {
      try {
        const provider = (window as any).ethereum
        if (!provider) return
        const balance = await provider.request({
          method: "eth_getBalance",
          params: [wallet.address, "latest"],
        })
        const balanceWei = BigInt(balance)
        const balanceDoge = Number(balanceWei) / 1e18
        setPublicBalance(balanceDoge.toFixed(4))
      } catch (error) {
        console.error("Failed to fetch balance:", error)
      }
    }
    
    fetchBalance()
    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  useEffect(() => {
    if (!mounted) return
    
    async function init() {
      try {
        const initialized = await initializeShieldedWallet()
        if (initialized) {
          setIsInitialized(true)
          refreshState()
          
          const identity = getWalletState()?.identity
          if (identity) {
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
              }
            )
          }
        }
      } catch (error) {
        console.error("Failed to check shielded wallet:", error)
      }
    }
    
    init()
    
    return () => {
      stopAutoDiscovery()
    }
  }, [mounted])
  
  const refreshState = () => {
    const state = getWalletState()
    setWalletState(state)
    onStateChange?.()
  }
  
  const handleSync = async () => {
    setIsLoading(true)
    try {
      await syncNotesWithChain()
      refreshState()
      toast({ title: "Synced!", description: "Notes synchronized with blockchain" })
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleBackup = async () => {
    const backup = backupWallet()
    if (backup) {
      const blob = new Blob([backup], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shielded-wallet-backup-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Backup created", description: "Save this file securely!" })
    }
  }
  
  const copyAddress = async () => {
    if (!walletState?.shieldedAddress) return
    await navigator.clipboard.writeText(`zdoge:${walletState.shieldedAddress}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Address copied!" })
  }
  
  if (!mounted) return null
  
  const shieldedBalance = walletState ? getShieldedBalance() : {}
  const notes = walletState ? getNotes() : []
  const totalDoge = shieldedBalance['DOGE'] || 0n
  const isAutoDiscovery = isAutoDiscoveryRunning()
  
  return (
    <Card className="p-6 mb-6 bg-card/50 backdrop-blur border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Shielded Wallet
              {isAutoDiscovery && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Auto-sync
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">Private DOGE transactions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button variant="outline" size="sm" onClick={handleBackup}>
            <Key className="h-4 w-4 mr-2" />
            Backup
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            Public Balance
          </div>
          <div className="text-2xl font-bold">{publicBalance} DOGE</div>
          <div className="text-xs text-muted-foreground">Available to shield</div>
        </div>
        
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Lock className="h-4 w-4" />
            Shielded Balance
          </div>
          <div className="text-2xl font-bold flex items-center gap-2">
            <span className="text-lg">🐕</span>
            DOGE
            <span className="ml-auto">{formatWeiToAmount(totalDoge).toFixed(4)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{notes.length} notes • Private</div>
        </div>
      </div>
      
      {walletState?.shieldedAddress && (
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Shield className="h-4 w-4" />
                Your Shielded Address
              </div>
              <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded block">
                {showAddress 
                  ? `zdoge:${walletState.shieldedAddress}`
                  : `zdoge:${shortenAddress(walletState.shieldedAddress)}`
                }
              </code>
              <p className="text-xs text-muted-foreground mt-1">Share this address to receive private payments</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowAddress(!showAddress)}>
                {showAddress ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
  const [balance, setBalance] = useState(getShieldedBalance())
  
  const refresh = () => {
    setNotes(getNotes())
    setBalance(getShieldedBalance())
  }
  
  return { notes, balance, refresh }
}

