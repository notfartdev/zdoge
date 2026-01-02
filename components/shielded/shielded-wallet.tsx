"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ShieldPlus,
  ShieldCheck,
  Send, 
  ArrowDownToLine, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  Wallet2,
  RefreshCw,
  KeyRound,
  ArrowLeftRight,
  Sparkles,
  Lock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  initializeShieldedWallet,
  getWalletState,
  getShieldedBalance,
  getNotes,
  backupWallet,
  type ShieldedWalletState,
} from "@/lib/shielded/shielded-service"
import { shortenAddress } from "@/lib/shielded/shielded-address"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { ShieldInterface } from "./shield-interface"
import { TransferInterface } from "./transfer-interface"
import { UnshieldInterface } from "./unshield-interface"
import { SwapInterface } from "./swap-interface"
import { ShieldedNotesList } from "./shielded-notes-list"

export function ShieldedWallet() {
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [walletState, setWalletState] = useState<ShieldedWalletState | null>(null)
  const [showAddress, setShowAddress] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("shield")
  
  // Ensure client-side only rendering to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Initialize wallet on mount
  useEffect(() => {
    if (!mounted) return
    
    async function init() {
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
  }, [mounted])
  
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
  
  // Show loading state during SSR and initial mount
  if (!mounted || isLoading) {
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
      <Card className="border-emerald-500/20 bg-gradient-to-br from-black to-emerald-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Shielded Wallet
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                </CardTitle>
                <CardDescription>Private DOGE transactions</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBackup} className="border-emerald-500/30 hover:bg-emerald-500/10">
                <KeyRound className="h-4 w-4 mr-2" />
                Backup
              </Button>
              <Button variant="outline" size="sm" onClick={refreshState} className="border-emerald-500/30 hover:bg-emerald-500/10">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-sm text-emerald-400/80 mb-1">
              <Lock className="h-3.5 w-3.5" />
              Shielded Balance
            </div>
            <div className="text-3xl font-bold text-white">
              {formatWeiToAmount(balance).toFixed(4)} <span className="text-emerald-400">DOGE</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {notes.length} note{notes.length !== 1 ? "s" : ""} • Private
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
            <TabsList className="grid w-full grid-cols-4 bg-black/40">
              <TabsTrigger value="shield" className="flex items-center gap-2 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                <ShieldPlus className="h-4 w-4" />
                Shield
              </TabsTrigger>
              <TabsTrigger value="swap" className="flex items-center gap-2 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
                <ArrowLeftRight className="h-4 w-4" />
                Swap
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex items-center gap-2 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
                <Send className="h-4 w-4" />
                Send
              </TabsTrigger>
              <TabsTrigger value="unshield" className="flex items-center gap-2 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
                <ArrowDownToLine className="h-4 w-4" />
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

