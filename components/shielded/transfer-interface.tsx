"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, Send, AlertCircle, Check, Shield, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { isValidShieldedAddress } from "@/lib/shielded/shielded-address"
import { prepareTransfer, completeTransfer, getNotes, getShieldedBalancePerToken } from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool } from "@/lib/dogeos-config"
import Link from "next/link"
import { ShieldPlus } from "lucide-react"

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
  selectedToken?: string
  onTokenChange?: (token: string) => void
}

export function TransferInterface({ notes, onSuccess, selectedToken = "DOGE", onTokenChange }: TransferInterfaceProps) {
  const { toast } = useToast()
  
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "proving" | "relaying" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transactionDetails, setTransactionDetails] = useState<{
    amountSent: number
    noteConsumed: bigint
    changeReceived: bigint
    selectedNote: ShieldedNote | null
  } | null>(null)
  
  const spendableNotes = notes.filter(n => n.leafIndex !== undefined && n.amount > 0n && (n.token || 'DOGE') === selectedToken)
  
  // Calculate total shielded balance for selected token
  const totalBalance = spendableNotes.reduce((sum, n) => sum + n.amount, 0n)
  
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
  
  // Find the best note that can cover the requested amount + fee
  const findBestNote = (requestedAmount: bigint): { note: ShieldedNote; noteIndex: number } | null => {
    if (!relayerInfo) return null
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    let requiredFee = (requestedAmount * feePercent) / 10000n
    if (requiredFee < minFee) requiredFee = minFee
    const requiredNoteAmount = requestedAmount + requiredFee
    
    // Get fresh notes - need full array for index calculation
    const freshNotes = getNotes()
    const filteredNotes = freshNotes.filter(n => n.leafIndex !== undefined && n.amount > 0n && (n.token || 'DOGE') === selectedToken)
    const sortedAsc = [...filteredNotes].sort((a, b) => Number(a.amount - b.amount))
    
    // Find smallest note that can cover the amount + fee
    for (const note of sortedAsc) {
      if (note.amount >= requiredNoteAmount) {
        // Find index in full notes array (prepareTransfer expects this)
        const actualIndex = freshNotes.findIndex(n => 
          n.commitment === note.commitment && n.leafIndex === note.leafIndex
        )
        if (actualIndex !== -1) {
          return { note, noteIndex: actualIndex }
        }
      }
    }
    
    return null
  }
  
  // Calculate maximum sendable from total balance
  // Note: In UTXO system, can only send from one note at a time
  // So max is the largest single note amount (minus fees)
  const calculateMaxSendable = (): bigint => {
    if (totalBalance === 0n || spendableNotes.length === 0) return 0n
    
    // Find the largest note
    const largestNote = spendableNotes.reduce((max, note) => 
      note.amount > max.amount ? note : max, spendableNotes[0]
    )
    
    if (!relayerInfo) {
      // If relayer info not loaded, return largest note amount (will be adjusted when relayer loads)
      return largestNote.amount
    }
    
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (largestNote.amount <= minFee) return 0n
    
    const feePercentScaled = BigInt(Math.floor(relayerInfo.feePercent * 100))
    const maxWithPercentFee = (largestNote.amount * 10000n) / (10000n + feePercentScaled)
    const percentFeeAtMax = (maxWithPercentFee * feePercentScaled) / 10000n
    
    if (percentFeeAtMax >= minFee) {
      return maxWithPercentFee
    } else {
      return largestNote.amount - minFee
    }
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
    
    const amountWei = BigInt(Math.floor(amountNum * 1e18))
    
    // Validate total balance
    if (amountWei > totalBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough ${selectedToken} in your shielded balance`,
        variant: "destructive",
      })
      return
    }
    
    // Automatically find the best note
    const bestNoteResult = findBestNote(amountWei)
    if (!bestNoteResult) {
      toast({
        title: "Insufficient Balance",
        description: "No single note can cover this amount after fees. Try a smaller amount.",
        variant: "destructive",
      })
      return
    }
    
    const { note: selectedNote, noteIndex: actualNoteIndex } = bestNoteResult
    
    // Store transaction details for success message
    setTransactionDetails({
      amountSent: amountNum,
      noteConsumed: selectedNote.amount,
      changeReceived: 0n, // Will be updated after transaction
      selectedNote
    })
    
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
      
      // Update transaction details with change amount
      if (transactionDetails) {
        setTransactionDetails({
          ...transactionDetails,
          changeReceived: result.changeNote.amount
        })
      }
      
      // Complete transfer (remove input note, add recipient note if sent to self, add change note)
      completeTransfer(
        actualNoteIndex, 
        result.changeNote, 
        data.leafIndex2 || 0,
        result.recipientNote,  // Also pass recipient note
        data.leafIndex1 || 0   // And its leaf index
      )
      
      // Add to transaction history
      addTransaction({
        type: 'transfer',
        txHash: data.txHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: selectedNote.token || 'DOGE',
        amount: amountNum.toFixed(4),
        amountWei: (BigInt(Math.floor(amountNum * 1e18))).toString(),
        recipientAddress: recipientAddress,
        fee: (result.fee || 0n).toString(),
        changeAmount: result.changeNote.amount > 0n ? (Number(result.changeNote.amount) / 1e18).toFixed(4) : undefined,
        status: 'confirmed',
      })
      
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
    setStatus("idle")
    setRecipientNote(null)
    setShowNote(false)
    setTxHash(null)
    setErrorMessage(null)
  }
  
  if (spendableNotes.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div>
          <p className="text-muted-foreground">No shielded notes to transfer</p>
          <p className="text-sm text-muted-foreground mt-2">
            Shield some {selectedToken} first to enable transfers
          </p>
        </div>
        <Link href={`/shield?token=${selectedToken}`}>
          <Button className="mt-4">
            <ShieldPlus className="h-4 w-4 mr-2" />
            Shield {selectedToken}
          </Button>
        </Link>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display font-medium">Private Transfer</h3>
        <p className="text-sm font-body text-muted-foreground">
          Send shielded tokens to another shielded address privately
        </p>
      </div>
      
      {status === "idle" && (
        <div className="space-y-4">
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
              <Label htmlFor="amount">Amount ({selectedToken})</Label>
              {relayerInfo ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    const maxWei = calculateMaxSendable()
                    const maxDoge = Math.floor(formatWeiToAmount(maxWei) * 10000) / 10000
                    setAmount(maxDoge.toFixed(4))
                  }}
                >
                  Max: {formatWeiToAmount(calculateMaxSendable()).toFixed(4)}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Calculating max...</span>
                </div>
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
          {amount && relayerInfo && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              {(() => {
                const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
                const { fee, received } = calculateFee(amountWei)
                const maxSendable = calculateMaxSendable()
                const largestNote = spendableNotes.reduce((max, note) => 
                  note.amount > max.amount ? note : max, spendableNotes[0]
                )
                const hasInsufficientFunds = amountWei + fee > totalBalance
                const exceedsSingleNote = amountWei > maxSendable && spendableNotes.length > 0
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Send amount:</span>
                      <span>{amount} {selectedToken}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Relayer fee:</span>
                      <span className="text-orange-500">-{formatWeiToAmount(fee).toFixed(4)} {selectedToken}</span>
                    </div>
                    {exceedsSingleNote && !hasInsufficientFunds && (
                      <Alert className="border-yellow-500/50 bg-yellow-500/10 py-2 px-3 mt-2">
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                        <AlertDescription className="text-xs text-yellow-200">
                          You have {spendableNotes.length} note{spendableNotes.length > 1 ? 's' : ''} but can only send {formatWeiToAmount(maxSendable).toFixed(4)} {selectedToken} per transaction (largest note: {formatWeiToAmount(largestNote.amount).toFixed(4)} {selectedToken}). Make multiple transactions to send more.
                        </AlertDescription>
                      </Alert>
                    )}
                    {hasInsufficientFunds && (
                      <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        Insufficient balance. Available: {formatWeiToAmount(totalBalance).toFixed(4)} {selectedToken}
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1">
                      <span>Recipient receives:</span>
                      <span className="text-green-500">{formatWeiToAmount(received).toFixed(4)} {selectedToken}</span>
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
            disabled={!relayerInfo?.available || !amount || parseFloat(amount) <= 0 || (() => {
              if (!amount || !relayerInfo) return true
              const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
              const { fee } = calculateFee(amountWei)
              return amountWei + fee > totalBalance
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
          <div className="w-full max-w-xs space-y-2">
            <Progress value={33} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">Generating ZK proof...</p>
            <p className="text-xs text-muted-foreground text-center">This may take 10-30 seconds</p>
          </div>
        </div>
      )}
      
      {status === "relaying" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="w-full max-w-xs space-y-2">
            <Progress value={66} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">Submitting transaction...</p>
            <p className="text-xs text-muted-foreground text-center">Your wallet never signs!</p>
          </div>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4" ref={(el) => {
          if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }
        }}>
          <div className="p-5 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-base font-semibold text-green-300 mb-1.5">
                    Transfer Successful!
                  </h4>
                  <p className="text-sm text-green-400/90 leading-relaxed">
                    {transactionDetails?.amountSent} {selectedToken} sent privately to recipient.
                  </p>
                </div>
                {transactionDetails && (
                  <div className="pt-3 border-t border-green-500/20 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400/70">Amount sent:</span>
                      <span className="text-green-300 font-medium">{formatWeiToAmount(BigInt(Math.floor(transactionDetails.amountSent * 1e18))).toFixed(4)} {selectedToken}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400/70">Note consumed:</span>
                      <span className="text-green-300 font-medium">{formatWeiToAmount(transactionDetails.noteConsumed).toFixed(4)} {selectedToken}</span>
                    </div>
                    {transactionDetails.changeReceived > 0n && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-400/70">Change received:</span>
                        <span className="text-green-300 font-medium">{formatWeiToAmount(transactionDetails.changeReceived).toFixed(4)} {selectedToken}</span>
                      </div>
                    )}
                  </div>
                )}
                {txHash && (
                  <a
                    href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-green-300 hover:text-green-200 transition-colors group"
                  >
                    <span className="font-medium">View transaction on Blockscout</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
              </div>
            </div>
          </div>
          
          <Button className="w-full" onClick={reset}>
            Send Another Transfer
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-300 mb-1">
                  Transfer Failed
                </p>
                <p className="text-sm text-orange-400/90">
                  Transfer failed. Your funds are safe.
                  {errorMessage && <span className="block mt-1 text-xs">{errorMessage}</span>}
                </p>
              </div>
            </div>
          </div>
          
          {errorMessage?.includes('ownership mismatch') && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-300 mb-2">
                    How to fix:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-400/90">
                    <li>Scroll down to "Shielded Notes"</li>
                    <li>Click the × button to clear notes</li>
                    <li>Shield new DOGE (creates notes with correct identity)</li>
                    <li>Try transfer again</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
          
          <Button className="w-full" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
