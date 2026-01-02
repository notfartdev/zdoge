"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogOut, AlertCircle, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { prepareUnshield, completeUnshield, getNotes } from "@/lib/shielded/shielded-service"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool } from "@/lib/dogeos-config"
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem"
import { dogeosTestnet } from "@/lib/dogeos-config"

// Use deployed contract address
const SHIELDED_POOL_ADDRESS = shieldedPool.address

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
})

interface UnshieldInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
}

export function UnshieldInterface({ notes, onSuccess }: UnshieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<string>("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [status, setStatus] = useState<"idle" | "proving" | "confirming" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null)
  
  const spendableNotes = notes.filter(n => n.leafIndex !== undefined && n.amount > 0n)
  
  // Auto-fill recipient with connected wallet address
  const fillConnectedAddress = () => {
    if (wallet?.address) {
      setRecipientAddress(wallet.address)
    }
  }
  
  const handleUnshield = async () => {
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
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      })
      return
    }
    
    const selectedNote = spendableNotes[uiNoteIndex]
    
    // Validate amount
    if (!selectedNote.amount || selectedNote.amount <= 0n) {
      toast({
        title: "Invalid Amount",
        description: "The selected note has no valid amount",
        variant: "destructive",
      })
      return
    }
    
    // Find the actual index in the full notes array
    const allNotes = getNotes()
    const actualNoteIndex = allNotes.findIndex(n => 
      n.commitment === selectedNote.commitment && 
      n.leafIndex === selectedNote.leafIndex
    )
    
    if (actualNoteIndex === -1) {
      toast({
        title: "Note Not Found",
        description: "Could not find the selected note",
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      
      // Generate proof using the actual note index in the wallet
      const result = await prepareUnshield(
        recipientAddress,
        actualNoteIndex,
        SHIELDED_POOL_ADDRESS
      )
      
      setStatus("confirming")
      
      // Send transaction
      const provider = (window as any).ethereum
      if (!provider) throw new Error("No wallet provider")
      
      // Encode unshield call with proper function data
      const callData = encodeUnshieldCall(
        result.proof.proof,
        result.root,
        result.nullifierHash,
        recipientAddress,
        result.amount
      )
      
      const accounts = await provider.request({ method: "eth_accounts" })
      
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: accounts[0],
          to: SHIELDED_POOL_ADDRESS,
          data: callData,
        }],
      })
      
      setTxHash(hash)
      setWithdrawnAmount(formatWeiToAmount(result.amount).toFixed(4))
      
      // Wait for actual confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        confirmations: 1,
      })
      
      if (receipt.status === 'success') {
        // Complete unshield (remove note from local state)
        completeUnshield(actualNoteIndex)
        
        setStatus("success")
        
        toast({
          title: "Unshield Successful!",
          description: `${formatWeiToAmount(result.amount).toFixed(4)} DOGE sent to your wallet`,
        })
        
        onSuccess?.()
      } else {
        throw new Error("Transaction reverted")
      }
      
    } catch (error: any) {
      console.error("Unshield error:", error)
      setStatus("error")
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
        <h3 className="text-lg font-medium">Unshield DOGE</h3>
        <p className="text-sm text-muted-foreground">
          Withdraw shielded funds to a public address
        </p>
      </div>
      
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
          
          {selectedNoteIndex && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                You will receive:{" "}
                <span className="font-medium">
                  {formatWeiToAmount(spendableNotes[parseInt(selectedNoteIndex)]?.amount || 0n).toFixed(4)} DOGE
                </span>
              </p>
            </div>
          )}
          
          <Button className="w-full" onClick={handleUnshield}>
            <LogOut className="h-4 w-4 mr-2" />
            Unshield to Wallet
          </Button>
        </div>
      )}
      
      {status === "proving" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Generating zero-knowledge proof...</p>
          <p className="text-xs text-muted-foreground">This may take 20-40 seconds</p>
        </div>
      )}
      
      {status === "confirming" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Waiting for confirmation...</p>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Successfully unshielded {withdrawnAmount} DOGE to your wallet!
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
            Unshield More
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unshield failed. Your funds are safe and still shielded.
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

// Helper to encode unshieldNative function call
// Function: unshieldNative(bytes calldata _proof, bytes32 _root, bytes32 _nullifierHash, address _recipient, uint256 _amount, address _relayer, uint256 _fee)
function encodeUnshieldCall(
  proof: string[],
  root: `0x${string}`,
  nullifierHash: `0x${string}`,
  recipient: string,
  amount: bigint
): string {
  // Convert proof array to proper format for Groth16
  // proof = [a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]
  const proofBytes = encodeProofBytes(proof)
  
  // Function selector for unshieldNative(bytes,bytes32,bytes32,address,uint256,address,uint256)
  // keccak256("unshieldNative(bytes,bytes32,bytes32,address,uint256,address,uint256)").slice(0, 10)
  const selector = "0x2b7ac3f3"
  
  // Encode parameters
  // bytes is dynamic, so we use offset
  const offsetForBytes = 224 // 7 * 32 bytes for the other params
  
  const rootHex = root.slice(2).padStart(64, '0')
  const nullifierHex = nullifierHash.slice(2).padStart(64, '0')
  const recipientHex = recipient.slice(2).padStart(64, '0')
  const amountHex = amount.toString(16).padStart(64, '0')
  const relayerHex = "0".repeat(64) // zero address
  const feeHex = "0".repeat(64) // zero fee
  const bytesOffsetHex = offsetForBytes.toString(16).padStart(64, '0')
  
  // Encode the bytes data (proof)
  const proofLengthHex = (proofBytes.length / 2).toString(16).padStart(64, '0')
  const proofPadded = proofBytes.padEnd(Math.ceil(proofBytes.length / 64) * 64, '0')
  
  return selector + 
    bytesOffsetHex +
    rootHex + 
    nullifierHex + 
    recipientHex + 
    amountHex + 
    relayerHex + 
    feeHex +
    proofLengthHex +
    proofPadded
}

// Convert proof strings to packed bytes
function encodeProofBytes(proof: string[]): string {
  // Proof format: [a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]
  let result = ''
  for (const p of proof) {
    // Remove 0x prefix if present, pad to 64 chars (32 bytes)
    const hex = p.startsWith('0x') ? p.slice(2) : p
    result += hex.padStart(64, '0')
  }
  return result
}


