"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Shield,
  ShieldPlus,
  Send, 
  LogOut, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  Wallet,
  RefreshCw,
  Key,
  ArrowLeftRight,
  Lock
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
  clearNotes,
  type ShieldedWalletState,
} from "@/lib/shielded/shielded-service"
import { shieldedPool } from "@/lib/dogeos-config"
import { shortenAddress } from "@/lib/shielded/shielded-address"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { ShieldInterface } from "./shield-interface"
import { TransferInterface } from "./transfer-interface"
import { UnshieldInterface } from "./unshield-interface"
import { SwapInterface } from "./swap-interface"
import { ShieldedNotesList } from "./shielded-notes-list"

export function ShieldedWallet() {
  const { toast } = useToast()
  const { wallet } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [walletState, setWalletState] = useState<ShieldedWalletState | null>(null)
  const [showAddress, setShowAddress] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("shield")
  const [publicBalance, setPublicBalance] = useState<string>("0")
  
  // Ensure client-side only rendering to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Fetch public wallet balance
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
        // Convert hex to decimal and format
        const balanceWei = BigInt(balance)
        const balanceDoge = Number(balanceWei) / 1e18
        setPublicBalance(balanceDoge.toFixed(4))
      } catch (error) {
        console.error("Failed to fetch balance:", error)
      }
    }
    
    fetchBalance()
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  // Initialize shielded wallet only when main wallet is connected
  useEffect(() => {
    if (!mounted || !wallet?.isConnected) {
      setWalletState(null)
      setIsInitialized(false)
      return
    }
    
    async function init() {
      setIsLoading(true)
      try {
        await initializeShieldedWallet()
        setWalletState(getWalletState())
        setIsInitialized(true)
      } catch (error) {
        console.error("Failed to initialize shielded wallet:", error)
        toast({
          title: "Initialization Failed",
          description: "Could not initialize shielded wallet",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [mounted, wallet?.isConnected])
  
  // Refresh wallet state
  const refreshState = () => {
    setWalletState(getWalletState())
  }
  
  // Copy address to clipboard
  const copyAddress = async () => {
    if (!walletState?.identity) return
    
    await navigator.clipboard.writeText(walletState.identity.addressString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    
    toast({
      title: "Address Copied",
      description: "Shielded address copied to clipboard",
    })
  }
  
  // Backup wallet
  const handleBackup = () => {
    const key = backupWallet()
    if (!key) return
    
    // Create download
    const blob = new Blob([key], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "dogenado-shielded-backup.txt"
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: "Backup Downloaded",
      description: "Keep this file safe! It's the only way to recover your shielded funds.",
      variant: "default",
    })
  }
  
  // Sync notes with blockchain
  const [isSyncing, setIsSyncing] = useState(false)
  
  const handleSyncNotes = async () => {
    setIsSyncing(true)
    try {
      const result = await syncNotesWithChain(shieldedPool.address)
      
      if (result.synced > 0) {
        toast({
          title: "Notes Synced!",
          description: `Fixed ${result.synced} note(s) with correct on-chain data`,
        })
        refreshState()
      } else if (result.notFound > 0) {
        toast({
          title: "Sync Complete",
          description: `${result.notFound} note(s) not found on chain. These may be from a different pool.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "All Notes Valid",
          description: "All notes already have correct leaf indices",
        })
      }
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync notes with chain",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }
  
  // Clear all notes (for debugging / starting fresh)
  const handleClearNotes = () => {
    if (confirm("Are you sure? This will remove all stored notes. Only do this if notes are corrupted.")) {
      clearNotes()
      refreshState()
      toast({
        title: "Notes Cleared",
        description: "All stored notes have been removed. Shield new funds to create new notes.",
        variant: "destructive",
      })
    }
  }
  
  // Show loading state during SSR
  if (!mounted) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }
  
  // Show connect wallet prompt if not connected
  if (!wallet?.isConnected) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="p-4 rounded-full bg-muted">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-1">Connect Your Wallet</h3>
            <p className="text-sm text-muted-foreground">
              Connect your wallet to access shielded transactions
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Show loading while initializing shielded wallet
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }
  
  const balance = walletState ? getShieldedBalance() : 0n
  const notes = walletState ? getNotes() : []
  
  return (
    <div className="space-y-6">
      {/* Wallet Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Shielded Wallet</CardTitle>
                <CardDescription>Private DOGE transactions</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncNotes}
                disabled={isSyncing || notes.length === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleBackup}>
                <Key className="h-4 w-4 mr-2" />
                Backup
              </Button>
              <Button variant="outline" size="sm" onClick={refreshState}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {/* Clear notes button - for debugging corrupted notes */}
              {notes.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearNotes}
                  className="text-destructive hover:text-destructive"
                  title="Clear all notes (use if notes are corrupted)"
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            {/* Public Balance */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-3.5 w-3.5" />
                Public Balance
              </div>
              <div className="text-2xl font-bold">
                {publicBalance} DOGE
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Available to shield
              </div>
            </div>
            
            {/* Shielded Balance */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Lock className="h-3.5 w-3.5" />
                Shielded Balance
              </div>
              <div className="text-2xl font-bold">
                {formatWeiToAmount(balance).toFixed(4)} DOGE
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {notes.length} note{notes.length !== 1 ? "s" : ""} • Private
              </div>
            </div>
          </div>
          
          {/* Shielded Address */}
          <div className="p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Your Shielded Address</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddress(!showAddress)}
                >
                  {showAddress ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyAddress}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <code className="text-xs break-all">
              {showAddress
                ? walletState?.identity?.addressString
                : shortenAddress(walletState?.identity?.addressString || "", 8)}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Share this address to receive shielded DOGE
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Operations */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="shield" className="flex items-center gap-2">
                <ShieldPlus className="h-4 w-4" />
                Shield
              </TabsTrigger>
              <TabsTrigger value="swap" className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Swap
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send
              </TabsTrigger>
              <TabsTrigger value="unshield" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Unshield
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="shield" className="mt-6">
              <ShieldInterface onSuccess={refreshState} />
            </TabsContent>
            
            <TabsContent value="swap" className="mt-6">
              <SwapInterface 
                notes={notes}
                onSuccess={refreshState}
              />
            </TabsContent>
            
            <TabsContent value="transfer" className="mt-6">
              <TransferInterface 
                notes={notes} 
                onSuccess={refreshState}
              />
            </TabsContent>
            
            <TabsContent value="unshield" className="mt-6">
              <UnshieldInterface 
                notes={notes}
                onSuccess={refreshState}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Notes List */}
      <ShieldedNotesList notes={notes} onRefresh={refreshState} />
    </div>
  )
}

