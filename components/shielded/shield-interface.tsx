"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Loader2, 
  Download, 
  AlertCircle, 
  Check, 
  Copy, 
  Eye, 
  EyeOff,
  ShieldPlus
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { prepareShield, completeShield } from "@/lib/shielded/shielded-service"
import { noteToShareableString, ShieldedNote } from "@/lib/shielded/shielded-note"
import { shieldedPool } from "@/lib/dogeos-config"
import { createPublicClient, http, parseAbiItem, type Address } from "viem"
import { dogeosTestnet } from "@/lib/dogeos-config"

// Use the deployed contract address
const SHIELDED_POOL_ADDRESS = shieldedPool.address

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
})

const DepositEventABI = parseAbiItem('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)')

interface ShieldInterfaceProps {
  onSuccess?: () => void
  publicBalance?: string // User's current public DOGE balance
}

export function ShieldInterface({ onSuccess, publicBalance = "0" }: ShieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState("")
  
  // Quick action: Shield all public balance
  const handleShieldAll = () => {
    const balance = parseFloat(publicBalance)
    if (balance <= 0.01) {
      toast({
        title: "Insufficient Balance",
        description: "You need at least 0.01 DOGE to shield",
        variant: "destructive",
      })
      return
    }
    // Leave a small amount for gas (0.001 DOGE)
    const shieldAmount = Math.max(0, balance - 0.001)
    setAmount(shieldAmount.toFixed(4))
  }
  const [status, setStatus] = useState<"idle" | "preparing" | "confirming" | "success" | "error">("idle")
  const [noteBackup, setNoteBackup] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [leafIndex, setLeafIndex] = useState<number | null>(null)
  const [pendingNote, setPendingNote] = useState<ShieldedNote | null>(null)
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false)
  
  const handleShield = async () => {
    // Prevent duplicate calls
    if (isSubmittingRef.current || status !== "idle") {
      return
    }
    
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
      isSubmittingRef.current = true
      setStatus("preparing")
      
      console.log("[Shield] Preparing shield for amount:", amountNum)
      
      // Prepare the shield (create note)
      const { note, commitment, amountWei } = await prepareShield(amountNum)
      
      console.log("[Shield] Note prepared, commitment:", commitment.slice(0, 20) + "...")
      console.log("[Shield] Amount in wei:", amountWei.toString())
      
      // Store note temporarily (NOT shown to user yet)
      setPendingNote(note)
      
      setStatus("confirming")
      
      // Send transaction
      const provider = (window as any).ethereum
      if (!provider) {
        console.error("[Shield] No wallet provider found!")
        throw new Error("No wallet provider - please install MetaMask")
      }
      
      console.log("[Shield] Sending transaction to:", SHIELDED_POOL_ADDRESS)
      console.log("[Shield] From:", wallet.address)
      console.log("[Shield] Value:", `0x${amountWei.toString(16)}`)
      
      const txRequest = {
        from: wallet.address,
        to: SHIELDED_POOL_ADDRESS,
        value: `0x${amountWei.toString(16)}`,
        data: `0x${encodeShieldNative(commitment)}`,
      }
      
      console.log("[Shield] TX Request:", JSON.stringify(txRequest, null, 2))
      
      // This should trigger MetaMask popup
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [txRequest],
      })
      
      console.log("[Shield] Transaction submitted! Hash:", hash)
      
      setTxHash(hash)
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        confirmations: 1,
      })
      
      // Get leafIndex from Deposit event
      // The correct event signature: keccak256("Deposit(bytes32,uint256,uint256)")
      const DEPOSIT_EVENT_SIG = '0x9b29a377f3cdb67f8d2b8c7f3a4d7d9d3b6f8a2c1e4d7a9b2c5e8f1a4d7b0c3e'.toLowerCase() // placeholder
      
      let actualLeafIndex: number | undefined
      
      // Method 1: Parse using viem's getLogs with proper ABI
      try {
        console.log("Fetching Deposit event from block", receipt.blockNumber)
        const logs = await publicClient.getLogs({
          address: SHIELDED_POOL_ADDRESS as Address,
          event: DepositEventABI,
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        })
        
        console.log(`Found ${logs.length} Deposit events in block`)
        
        // Find our commitment
        const commitmentHex = commitment.toLowerCase()
        for (const log of logs) {
          const logCommitment = log.args.commitment?.toString().toLowerCase()
          console.log(`Comparing: ${logCommitment} vs ${commitmentHex}`)
          if (logCommitment === commitmentHex) {
            actualLeafIndex = Number(log.args.leafIndex)
            console.log(`Found matching commitment at leafIndex: ${actualLeafIndex}`)
            break
          }
        }
      } catch (e) {
        console.warn("Method 1 (getLogs with ABI) failed:", e)
      }
      
      // Method 2: Parse raw logs manually if method 1 failed
      if (actualLeafIndex === undefined && receipt.logs) {
        console.log("Trying raw log parsing...")
        for (const log of receipt.logs) {
          // Look for logs from our contract with 3 topics (indexed event)
          if (
            log.address.toLowerCase() === SHIELDED_POOL_ADDRESS.toLowerCase() &&
            log.topics.length >= 3
          ) {
            // topics[1] = commitment (indexed), topics[2] = leafIndex (indexed)
            const logCommitment = log.topics[1]?.toLowerCase()
            const commitmentHex = commitment.toLowerCase()
            
            console.log(`Raw log check: ${logCommitment} vs ${commitmentHex}`)
            
            if (logCommitment === commitmentHex) {
              actualLeafIndex = parseInt(log.topics[2] || '0', 16)
              console.log(`Found via raw parsing at leafIndex: ${actualLeafIndex}`)
              break
            }
          }
        }
      }
      
      // NO FALLBACK - if we can't find the leafIndex, throw an error
      if (actualLeafIndex === undefined) {
        throw new Error(
          "Could not find Deposit event in transaction. " +
          "This shouldn't happen - please check the transaction on block explorer."
        )
      }
      
      setLeafIndex(actualLeafIndex)
      
      // Complete the shield (save note with leafIndex)
      completeShield(note, actualLeafIndex)
      
      // NOW show the note backup (after confirmation)
      const backup = noteToShareableString(note)
      setNoteBackup(backup)
      
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
    } finally {
      isSubmittingRef.current = false
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
    setPendingNote(null)
    isSubmittingRef.current = false
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
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount (DOGE)</Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={handleShieldAll}
              >
                Shield All ({publicBalance} DOGE)
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          
          {parseFloat(publicBalance) > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Auto-Shield:</strong> Click "Shield All" to protect your entire public balance
              </p>
            </div>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleShield}
            disabled={!wallet?.isConnected || status !== "idle"}
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
      
      {status === "confirming" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Waiting for transaction confirmation...</p>
            <p className="text-xs text-muted-foreground">
              Your note will appear after the transaction is confirmed
            </p>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mt-4">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                💡 <strong>No popup?</strong> Check if MetaMask is open and has a pending transaction.
                Click the MetaMask icon in your browser toolbar.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={reset}
          >
            Cancel and try again
          </Button>
        </div>
      )}
      
      {status === "success" && noteBackup && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Successfully shielded {amount} DOGE! Your funds are now private.
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
          
          {/* Show note backup ONLY after confirmation */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>SAVE THIS NOTE!</strong> You need it to recover your shielded funds.
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
  // Computed via: new ethers.Interface(['function shieldNative(bytes32)']).getFunction('shieldNative').selector
  const selector = "b13d48f2"
  const commitmentHex = commitment.slice(2).padStart(64, "0")
  return selector + commitmentHex
}


