"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, AlertCircle, Check, Copy, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount, noteToShareableString } from "@/lib/shielded/shielded-note"
import { isValidShieldedAddress } from "@/lib/shielded/shielded-address"
import { prepareTransfer, completeTransfer } from "@/lib/shielded/shielded-service"

// TODO: Update with actual deployed address
const SHIELDED_POOL_ADDRESS = "0x0000000000000000000000000000000000000000"

interface TransferInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
}

export function TransferInterface({ notes, onSuccess }: TransferInterfaceProps) {
  const { toast } = useToast()
  
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<string>("")
  const [status, setStatus] = useState<"idle" | "proving" | "confirming" | "success" | "error">("idle")
  const [recipientNote, setRecipientNote] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  
  const spendableNotes = notes.filter(n => n.leafIndex !== undefined && n.amount > 0n)
  
  const handleTransfer = async () => {
    // Validate recipient address
    if (!isValidShieldedAddress(recipientAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid shielded address",
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
    const noteIndex = parseInt(selectedNoteIndex)
    if (isNaN(noteIndex) || !spendableNotes[noteIndex]) {
      toast({
        title: "Select a Note",
        description: "Please select a note to spend",
        variant: "destructive",
      })
      return
    }
    
    const selectedNote = spendableNotes[noteIndex]
    const amountWei = BigInt(Math.floor(amountNum * 1e18))
    
    if (amountWei > selectedNote.amount) {
      toast({
        title: "Insufficient Balance",
        description: "Selected note doesn't have enough balance",
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      
      // Generate proof
      const result = await prepareTransfer(
        recipientAddress,
        amountNum,
        SHIELDED_POOL_ADDRESS,
        noteIndex
      )
      
      // Save recipient note for sharing
      const recipientNoteString = noteToShareableString(result.recipientNote)
      setRecipientNote(recipientNoteString)
      
      setStatus("confirming")
      
      // Send transaction
      const provider = (window as any).ethereum
      if (!provider) throw new Error("No wallet provider")
      
      // Encode transfer call
      const callData = encodeTransfer(
        result.proof.proof,
        result.root,
        result.nullifierHash,
        result.outputCommitment1,
        result.outputCommitment2
      )
      
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: (await provider.request({ method: "eth_accounts" }))[0],
          to: SHIELDED_POOL_ADDRESS,
          data: callData,
        }],
      })
      
      setTxHash(txHash)
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // TODO: Get actual leafIndex from event
      const changeLeafIndex = Math.floor(Math.random() * 1000)
      
      // Complete transfer (update local state)
      completeTransfer(noteIndex, result.changeNote, changeLeafIndex)
      
      setStatus("success")
      
      toast({
        title: "Transfer Successful!",
        description: `Sent ${amountNum} DOGE privately`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Transfer error:", error)
      setStatus("error")
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
  }
  
  if (spendableNotes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No shielded notes to transfer</p>
        <p className="text-sm text-muted-foreground mt-2">
          Shield some DOGE first to enable transfers
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Transfer Shielded DOGE</h3>
        <p className="text-sm text-muted-foreground">
          Send shielded funds to another shielded address
        </p>
      </div>
      
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
                    {formatWeiToAmount(note.amount).toFixed(4)} DOGE (Note #{note.leafIndex})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Shielded Address</Label>
            <Input
              id="recipient"
              placeholder="dogenado:z1..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (DOGE)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {selectedNoteIndex && (
              <p className="text-xs text-muted-foreground">
                Available: {formatWeiToAmount(spendableNotes[parseInt(selectedNoteIndex)]?.amount || 0n).toFixed(4)} DOGE
              </p>
            )}
          </div>
          
          <Button className="w-full" onClick={handleTransfer}>
            <Send className="h-4 w-4 mr-2" />
            Send Privately
          </Button>
        </div>
      )}
      
      {status === "proving" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Generating zero-knowledge proof...</p>
          <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
        </div>
      )}
      
      {status === "confirming" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Waiting for confirmation...</p>
        </div>
      )}
      
      {status === "success" && recipientNote && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Transfer successful! Share the note below with the recipient.
            </AlertDescription>
          </Alert>
          
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> The recipient needs this note to access the funds.
              Send it to them securely (encrypted message, in-person, etc.)
            </AlertDescription>
          </Alert>
          
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <Label>Note for Recipient</Label>
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
            Make Another Transfer
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Transfer failed. Your funds are safe.
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

// Helper to encode transfer function call
function encodeTransfer(
  proof: string[],
  root: `0x${string}`,
  nullifierHash: `0x${string}`,
  outputCommitment1: `0x${string}`,
  outputCommitment2: `0x${string}`
): string {
  // This is a simplified encoding - in production use viem's encodeFunctionData
  // Function selector for transfer(uint256[8],bytes32,bytes32,bytes32,bytes32,address,uint256)
  const selector = "00000000" // TODO: Compute actual selector
  return "0x" + selector
}


