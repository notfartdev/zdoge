"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogOut, AlertCircle, Check, Zap, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { prepareUnshield, completeUnshield, getNotes } from "@/lib/shielded/shielded-service"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool } from "@/lib/dogeos-config"

// Use deployed contract address
const SHIELDED_POOL_ADDRESS = shieldedPool.address

// Relayer API (backend)
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

interface RelayerInfo {
  available: boolean
  address: string | null
  feePercent: number
  minFee: string
}

interface UnshieldInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
}

export function UnshieldInterface({ notes, onSuccess }: UnshieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<string>("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [status, setStatus] = useState<"idle" | "proving" | "relaying" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null)
  const [fee, setFee] = useState<string | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const spendableNotes = notes.filter(n => n.leafIndex !== undefined && n.amount > 0n)
  
  // Fetch relayer info on mount
  useEffect(() => {
    async function fetchRelayerInfo() {
      try {
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/info`)
        if (response.ok) {
          const data = await response.json()
          setRelayerInfo(data)
        }
      } catch (error) {
        console.warn('Could not fetch relayer info:', error)
      }
    }
    fetchRelayerInfo()
  }, [])
  
  // Auto-fill recipient with connected wallet address
  const fillConnectedAddress = () => {
    if (wallet?.address) {
      setRecipientAddress(wallet.address)
    }
  }
  
  // Calculate fee for display
  const calculateFee = (amount: bigint): { fee: bigint; received: bigint } => {
    if (!relayerInfo) return { fee: 0n, received: amount }
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let fee = (amount * feePercent) / 10000n
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (fee < minFee) fee = minFee
    
    return { fee, received: amount - fee }
  }
  
  const handleUnshield = async () => {
    setErrorMessage(null)
    
    // Validate note selection
    const uiNoteIndex = parseInt(selectedNoteIndex)
    if (isNaN(uiNoteIndex) || !spendableNotes[uiNoteIndex]) {
      toast({
        title: "Select a Note",
        description: "Please select a note to unshield",
        variant: "destructive",
      })
      return
    }
    
    // Validate recipient address
    if (!recipientAddress || !recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid wallet address",
        variant: "destructive",
      })
      return
    }
    
    const selectedNoteFromProps = spendableNotes[uiNoteIndex]
    
    // Validate amount
    if (!selectedNoteFromProps.amount || selectedNoteFromProps.amount <= 0n) {
      toast({
        title: "Invalid Amount",
        description: "The selected note has no valid amount",
        variant: "destructive",
      })
      return
    }
    
    // Get fresh notes from service (in case sync updated them)
    const freshNotes = getNotes()
    
    // Find the note by commitment (unique identifier)
    const actualNoteIndex = freshNotes.findIndex(n => 
      n.commitment === selectedNoteFromProps.commitment
    )
    
    if (actualNoteIndex === -1) {
      toast({
        title: "Note Not Found",
        description: "Could not find the selected note. Try refreshing.",
        variant: "destructive",
      })
      return
    }
    
    // Use the fresh note with updated leafIndex
    const selectedNote = freshNotes[actualNoteIndex]
    
    console.log(`[Unshield] Note: commitment=${selectedNote.commitment.toString(16).slice(0,16)}..., leafIndex=${selectedNote.leafIndex}`)
    
    try {
      setStatus("proving")
      
      // Generate proof locally
      const result = await prepareUnshield(
        recipientAddress,
        actualNoteIndex,
        SHIELDED_POOL_ADDRESS
      )
      
      console.log('[Unshield] Proof generated, sending to relayer...')
      setStatus("relaying")
      
      // Send to relayer (USER NEVER SIGNS, NEVER PAYS GAS!)
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolAddress: SHIELDED_POOL_ADDRESS,
          proof: result.proof.proof, // string[] of 8 elements
          root: result.root,
          nullifierHash: result.nullifierHash,
          recipient: recipientAddress,
          amount: result.amount.toString(),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Relayer failed')
      }
      
      // Success!
      setTxHash(data.txHash)
      setWithdrawnAmount((Number(data.amountReceived) / 1e18).toFixed(4))
      setFee((Number(data.fee) / 1e18).toFixed(4))
      
      // Complete unshield (remove note from local state)
      completeUnshield(actualNoteIndex)
      
      setStatus("success")
      
      toast({
        title: "Unshield Successful!",
        description: `Received ${(Number(data.amountReceived) / 1e18).toFixed(4)} DOGE (0% gas paid by you!)`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Unshield error:", error)
      setStatus("error")
      setErrorMessage(error.message || "Transaction failed")
      toast({
        title: "Unshield Failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      })
    }
  }
  
  const reset = () => {
    setSelectedNoteIndex("")
    setRecipientAddress("")
    setStatus("idle")
    setTxHash(null)
    setWithdrawnAmount(null)
    setFee(null)
    setErrorMessage(null)
  }
  
  if (spendableNotes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No shielded notes to unshield</p>
        <p className="text-sm text-muted-foreground mt-2">
          Shield some DOGE first or import a received note
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          Send to Public Address
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-3 w-3" /> Gas-Free
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Send shielded DOGE to <strong>any</strong> public wallet. You never sign or pay gas.
        </p>
      </div>
      
      {/* Relayer Status Banner */}
      {relayerInfo && (
        <div className="p-3 rounded-lg bg-muted/30 border border-muted text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-medium">Privacy-Preserving Relayer</span>
            {relayerInfo.available ? (
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Active</span>
            ) : (
              <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full">Offline</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Fee: {relayerInfo.feePercent}% (min {relayerInfo.minFee} DOGE) • Your wallet never signs
          </p>
        </div>
      )}
      
      {status === "idle" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Note to Unshield</Label>
            <Select value={selectedNoteIndex} onValueChange={setSelectedNoteIndex}>
              <SelectTrigger>
                <SelectValue placeholder="Select a note" />
              </SelectTrigger>
              <SelectContent>
                {spendableNotes.map((note, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {formatWeiToAmount(note.amount).toFixed(4)} DOGE (Note #{note.leafIndex})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0"
                onClick={fillConnectedAddress}
              >
                Use connected wallet
              </Button>
            </div>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
            />
          </div>
          
          {selectedNoteIndex && relayerInfo && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              {(() => {
                const amount = spendableNotes[parseInt(selectedNoteIndex)]?.amount || 0n
                const { fee, received } = calculateFee(amount)
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Note amount:</span>
                      <span>{formatWeiToAmount(amount).toFixed(4)} DOGE</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Relayer fee:</span>
                      <span className="text-orange-500">-{formatWeiToAmount(fee).toFixed(4)} DOGE</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1">
                      <span>You receive:</span>
                      <span className="text-green-500">{formatWeiToAmount(received).toFixed(4)} DOGE</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gas you pay:</span>
                      <span className="text-primary">0 DOGE ✓</span>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleUnshield}
            disabled={!relayerInfo?.available}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Unshield via Relayer
          </Button>
          
          {!relayerInfo?.available && (
            <p className="text-xs text-center text-muted-foreground">
              Relayer is currently offline. Please try again later.
            </p>
          )}
        </div>
      )}
      
      {status === "proving" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Generating zero-knowledge proof...</p>
          <p className="text-xs text-muted-foreground">This may take 20-40 seconds</p>
        </div>
      )}
      
      {status === "relaying" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Relayer submitting transaction...</p>
          <p className="text-xs text-muted-foreground">You don't need to sign anything</p>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Successfully unshielded {withdrawnAmount} DOGE!
              {fee && <span className="text-muted-foreground"> (Fee: {fee} DOGE)</span>}
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
          
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
            <p className="font-medium text-green-500">🎉 Zero Gas Paid</p>
            <p className="text-muted-foreground text-xs">
              Your wallet address never appeared in the transaction — maximum privacy!
            </p>
          </div>
          
          <Button className="w-full" onClick={reset}>
            Unshield More
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage || "Unshield failed. Your funds are safe and still shielded."}
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
