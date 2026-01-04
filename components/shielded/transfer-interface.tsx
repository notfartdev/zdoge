"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, AlertCircle, Check, Copy, Eye, EyeOff, Zap, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount, noteToShareableString } from "@/lib/shielded/shielded-note"
import { isValidShieldedAddress } from "@/lib/shielded/shielded-address"
import { prepareTransfer, completeTransfer, getNotes } from "@/lib/shielded/shielded-service"
import { shieldedPool } from "@/lib/dogeos-config"

const SHIELDED_POOL_ADDRESS = shieldedPool.address
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

interface RelayerInfo {
  available: boolean
  address: string | null
  feePercent: number
  minFee: string
}

interface TransferInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
}

export function TransferInterface({ notes, onSuccess }: TransferInterfaceProps) {
  const { toast } = useToast()
  
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<string>("")
  const [status, setStatus] = useState<"idle" | "proving" | "relaying" | "success" | "error">("idle")
  const [recipientNote, setRecipientNote] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
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
  
  // Calculate fee
  const calculateFee = (amount: bigint): { fee: bigint; received: bigint } => {
    if (!relayerInfo) return { fee: 0n, received: amount }
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let fee = (amount * feePercent) / 10000n
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (fee < minFee) fee = minFee
    
    return { fee, received: amount - fee }
  }
  
  const handleTransfer = async () => {
    setErrorMessage(null)
    
    // Validate recipient address
    if (!isValidShieldedAddress(recipientAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid shielded address (starts with 'zdoge:')",
        variant: "destructive",
      })
      return
    }
    
    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }
    
    // Validate note selection
    const uiNoteIndex = parseInt(selectedNoteIndex)
    if (isNaN(uiNoteIndex) || !spendableNotes[uiNoteIndex]) {
      toast({
        title: "Select a Note",
        description: "Please select a note to spend",
        variant: "destructive",
      })
      return
    }
    
    const selectedNote = spendableNotes[uiNoteIndex]
    const amountWei = BigInt(Math.floor(amountNum * 1e18))
    
    if (amountWei > selectedNote.amount) {
      toast({
        title: "Insufficient Balance",
        description: "Selected note doesn't have enough balance",
        variant: "destructive",
      })
      return
    }
    
    // Get fresh notes to ensure correct leafIndex
    const freshNotes = getNotes()
    const freshSpendable = freshNotes.filter(n => n.leafIndex !== undefined && n.amount > 0n)
    const actualNote = freshSpendable[uiNoteIndex]
    
    if (!actualNote || actualNote.leafIndex === undefined) {
      toast({
        title: "Note Sync Error",
        description: "Please refresh the page and try again",
        variant: "destructive",
      })
      return
    }
    
    // Find actual index in full notes array
    const actualNoteIndex = freshNotes.findIndex(n => 
      n.commitment === actualNote.commitment && n.leafIndex === actualNote.leafIndex
    )
    
    if (actualNoteIndex === -1) {
      toast({
        title: "Note Not Found",
        description: "Could not find note in wallet",
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      
      // Calculate relayer fee
      const { fee: relayerFeeWei } = calculateFee(amountWei)
      const relayerFeeDoge = Number(relayerFeeWei) / 1e18
      
      console.log('[Transfer] Generating proof...')
      console.log('[Transfer] Amount:', amountNum, selectedNote.token || 'DOGE')
      console.log('[Transfer] Relayer fee:', relayerFeeDoge)
      
      // Generate proof with fee (MUST use actual relayer address in proof!)
      const result = await prepareTransfer(
        recipientAddress,
        amountNum,
        SHIELDED_POOL_ADDRESS,
        actualNoteIndex,
        relayerInfo?.address || '0x0000000000000000000000000000000000000000',
        relayerFeeDoge
      )
      
      // Save recipient note for sharing (they'll need this to discover the note)
      const recipientNoteString = noteToShareableString(result.recipientNote)
      setRecipientNote(recipientNoteString)
      
      console.log('[Transfer] Proof generated, sending to relayer...')
      setStatus("relaying")
      
      // Send to relayer
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolAddress: SHIELDED_POOL_ADDRESS,
          proof: result.proof.proof,
          root: result.root,
          nullifierHash: result.nullifierHash,
          outputCommitment1: result.outputCommitment1,
          outputCommitment2: result.outputCommitment2,
          encryptedMemo1: result.encryptedMemo1 || '',
          encryptedMemo2: result.encryptedMemo2 || '',
          fee: relayerFeeWei.toString(),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Relayer transaction failed')
      }
      
      setTxHash(data.txHash)
      
      // Complete transfer (remove input note, add recipient note if sent to self, add change note)
      completeTransfer(
        actualNoteIndex, 
        result.changeNote, 
        data.leafIndex2 || 0,
        result.recipientNote,  // Also pass recipient note
        data.leafIndex1 || 0   // And its leaf index
      )
      
      setStatus("success")
      
      toast({
        title: "Transfer Successful!",
        description: `Sent ${amountNum} ${selectedNote.token || 'DOGE'} privately (0% gas paid by you!)`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Transfer error:", error)
      setStatus("error")
      setErrorMessage(error.message || "Transaction failed")
      toast({
        title: "Transfer Failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      })
    }
  }
  
  const copyNote = async () => {
    if (!recipientNote) return
    await navigator.clipboard.writeText(recipientNote)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const reset = () => {
    setRecipientAddress("")
    setAmount("")
    setSelectedNoteIndex("")
    setStatus("idle")
    setRecipientNote(null)
    setShowNote(false)
    setTxHash(null)
    setErrorMessage(null)
  }
  
  if (spendableNotes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No shielded notes to transfer</p>
        <p className="text-sm text-muted-foreground mt-2">
          Shield some tokens first to enable transfers
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          Private Transfer
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-3 w-3" /> Gas-Free
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Send shielded tokens to another shielded address privately
        </p>
      </div>
      
      {/* Relayer Status */}
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
            Fee: {relayerInfo.feePercent}% (min {relayerInfo.minFee}) • Your wallet never signs
          </p>
        </div>
      )}
      
      {status === "idle" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Note to Spend</Label>
            <Select value={selectedNoteIndex} onValueChange={setSelectedNoteIndex}>
              <SelectTrigger>
                <SelectValue placeholder="Select a note" />
              </SelectTrigger>
              <SelectContent>
                {spendableNotes.map((note, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {formatWeiToAmount(note.amount).toFixed(4)} {note.token || 'DOGE'} (Note #{note.leafIndex})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Shielded Address</Label>
            <Input
              id="recipient"
              placeholder="zdoge:..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the recipient's shielded address (starts with 'zdoge:')
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              {selectedNoteIndex && spendableNotes[parseInt(selectedNoteIndex)] && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    const note = spendableNotes[parseInt(selectedNoteIndex)]
                    // Calculate max sendable amount accounting for fee
                    // max + fee(max) = note.amount
                    // max * (1 + feePercent) = note.amount
                    // max = note.amount / (1 + feePercent)
                    let maxSendable: bigint
                    if (relayerInfo) {
                      const feeMultiplier = 1 + relayerInfo.feePercent / 100
                      maxSendable = BigInt(Math.floor(Number(note.amount) / feeMultiplier))
                      // Also ensure fee >= minFee
                      const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
                      if (note.amount > minFee) {
                        const maxWithMinFee = note.amount - minFee
                        if (maxWithMinFee < maxSendable) {
                          maxSendable = maxWithMinFee
                        }
                      }
                    } else {
                      maxSendable = note.amount
                    }
                    setAmount(formatWeiToAmount(maxSendable).toFixed(4))
                  }}
                >
                  Max: {(() => {
                    const note = spendableNotes[parseInt(selectedNoteIndex)]
                    if (relayerInfo) {
                      const feeMultiplier = 1 + relayerInfo.feePercent / 100
                      let maxSendable = BigInt(Math.floor(Number(note.amount) / feeMultiplier))
                      const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
                      if (note.amount > minFee) {
                        const maxWithMinFee = note.amount - minFee
                        if (maxWithMinFee < maxSendable) {
                          maxSendable = maxWithMinFee
                        }
                      }
                      return formatWeiToAmount(maxSendable).toFixed(4)
                    }
                    return formatWeiToAmount(note.amount).toFixed(4)
                  })()}
                </Button>
              )}
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          
          {/* Fee Preview */}
          {selectedNoteIndex && amount && relayerInfo && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              {(() => {
                const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
                const selectedNote = spendableNotes[parseInt(selectedNoteIndex)]
                const tokenSymbol = selectedNote?.token || 'DOGE'
                const { fee, received } = calculateFee(amountWei)
                const totalNeeded = amountWei + fee
                const hasInsufficientFunds = totalNeeded > selectedNote.amount
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Send amount:</span>
                      <span>{amount} {tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Relayer fee:</span>
                      <span className="text-orange-500">-{formatWeiToAmount(fee).toFixed(4)} {tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total from note:</span>
                      <span className={hasInsufficientFunds ? "text-red-500" : ""}>
                        {formatWeiToAmount(totalNeeded).toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                    {hasInsufficientFunds && (
                      <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        Exceeds note balance ({formatWeiToAmount(selectedNote.amount).toFixed(4)} {tokenSymbol}). Reduce amount.
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1">
                      <span>Recipient receives:</span>
                      <span className="text-green-500">{formatWeiToAmount(received).toFixed(4)} {tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gas you pay:</span>
                      <span className="text-primary">0 ✓</span>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleTransfer}
            disabled={!relayerInfo?.available || (() => {
              if (!selectedNoteIndex || !amount) return false
              const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
              const selectedNote = spendableNotes[parseInt(selectedNoteIndex)]
              if (!selectedNote) return false
              const { fee } = calculateFee(amountWei)
              return amountWei + fee > selectedNote.amount
            })()}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Privately
          </Button>
        </div>
      )}
      
      {status === "proving" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Generating ZK proof...</p>
          <p className="text-xs text-muted-foreground">This may take 10-30 seconds</p>
        </div>
      )}
      
      {status === "relaying" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Relayer submitting transaction...</p>
          <p className="text-xs text-muted-foreground">Your wallet never signs - complete privacy!</p>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Transfer successful! Share the note with the recipient.
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
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Share this note with the recipient!</strong> They need it to claim the funds.
            </AlertDescription>
          </Alert>
          
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <Label>Recipient's Note</Label>
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
              {showNote ? recipientNote : "•".repeat(60)}
            </code>
          </div>
          
          <Button className="w-full" onClick={reset}>
            Send Another Transfer
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Transfer failed. Your funds are safe.
              {errorMessage && <p className="mt-1 text-xs">{errorMessage}</p>}
            </AlertDescription>
          </Alert>
          
          {errorMessage?.includes('ownership mismatch') && (
            <Alert className="border-yellow-500 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-200">
                <strong>How to fix:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Scroll down to "Shielded Notes"</li>
                  <li>Click the × button to clear notes</li>
                  <li>Shield new DOGE (creates notes with correct identity)</li>
                  <li>Try transfer again</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}
          
          <Button className="w-full" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
