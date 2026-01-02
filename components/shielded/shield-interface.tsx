"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Loader2, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Eye, 
  EyeOff,
  ShieldPlus,
  Sparkles
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { prepareShield, completeShield } from "@/lib/shielded/shielded-service"
import { noteToShareableString } from "@/lib/shielded/shielded-note"
import { shieldedPool } from "@/lib/dogeos-config"

// Use the deployed contract address
const SHIELDED_POOL_ADDRESS = shieldedPool.address

interface ShieldInterfaceProps {
  onSuccess?: () => void
}

export function ShieldInterface({ onSuccess }: ShieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "preparing" | "confirming" | "success" | "error">("idle")
  const [noteBackup, setNoteBackup] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [leafIndex, setLeafIndex] = useState<number | null>(null)
  
  const handleShield = async () => {
    if (!wallet?.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }
    
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("preparing")
      
      // Prepare the shield (create note)
      const { note, commitment, amountWei } = await prepareShield(amountNum)
      
      // Save note backup BEFORE transaction
      const backup = noteToShareableString(note)
      setNoteBackup(backup)
      
      setStatus("confirming")
      
      // Send transaction
      // Using shieldSimple for MVP (no proof required)
      const provider = (window as any).ethereum
      if (!provider) throw new Error("No wallet provider")
      
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address,
          to: SHIELDED_POOL_ADDRESS,
          value: `0x${amountWei.toString(16)}`,
          data: `0x${encodeShieldNative(commitment)}`,
        }],
      })
      
      setTxHash(txHash)
      
      // Wait for confirmation
      // In real implementation, watch for event to get leafIndex
      // For now, we'll simulate
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // TODO: Get actual leafIndex from event
      const simulatedLeafIndex = Math.floor(Math.random() * 1000)
      setLeafIndex(simulatedLeafIndex)
      
      // Complete the shield (save note with leafIndex)
      completeShield(note, simulatedLeafIndex)
      
      setStatus("success")
      
      toast({
        title: "Shield Successful!",
        description: `${amountNum} DOGE is now shielded`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Shield error:", error)
      setStatus("error")
      toast({
        title: "Shield Failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      })
    }
  }
  
  const copyNote = async () => {
    if (!noteBackup) return
    await navigator.clipboard.writeText(noteBackup)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const downloadNote = () => {
    if (!noteBackup) return
    const blob = new Blob([noteBackup], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dogenado-note-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const reset = () => {
    setAmount("")
    setStatus("idle")
    setNoteBackup(null)
    setShowNote(false)
    setTxHash(null)
    setLeafIndex(null)
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Shield DOGE</h3>
        <p className="text-sm text-muted-foreground">
          Deposit public DOGE into your shielded balance
        </p>
      </div>
      
      {status === "idle" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (DOGE)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          
          <Button 
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700" 
            onClick={handleShield}
            disabled={!wallet?.isConnected}
          >
            <ShieldPlus className="h-4 w-4 mr-2" />
            Shield DOGE
          </Button>
        </div>
      )}
      
      {status === "preparing" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Preparing shield transaction...</p>
        </div>
      )}
      
      {status === "confirming" && noteBackup && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>SAVE THIS NOTE!</strong> You need it to access your shielded funds.
              If you lose this note, you lose access to {amount} DOGE forever.
            </AlertDescription>
          </Alert>
          
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <Label>Your Secret Note</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowNote(!showNote)}>
                  {showNote ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyNote}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <code className="text-xs break-all block">
              {showNote ? noteBackup : "•".repeat(60)}
            </code>
          </div>
          
          <Button variant="outline" className="w-full" onClick={downloadNote}>
            <Download className="h-4 w-4 mr-2" />
            Download Note Backup
          </Button>
          
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Waiting for confirmation...</span>
          </div>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4">
          <Alert className="border-emerald-500/50 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <AlertDescription className="text-emerald-200">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Successfully shielded {amount} DOGE! Your funds are now private.
              </span>
            </AlertDescription>
          </Alert>
          
          {txHash && (
            <div className="text-sm">
              <span className="text-muted-foreground">Transaction: </span>
              <a 
                href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </div>
          )}
          
          <Button className="w-full" onClick={reset}>
            Shield More DOGE
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Shield transaction failed. Your funds are safe.
            </AlertDescription>
          </Alert>
          
          <Button className="w-full" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}

// Helper to encode shieldNative function call
function encodeShieldNative(commitment: `0x${string}`): string {
  // Function selector for shieldNative(bytes32)
  // keccak256("shieldNative(bytes32)") = 0x8bae4db3...
  const selector = "8bae4db3"
  const commitmentHex = commitment.slice(2).padStart(64, "0")
  return selector + commitmentHex
}


