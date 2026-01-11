"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, Send, AlertCircle, Check, Shield, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { isValidShieldedAddress } from "@/lib/shielded/shielded-address"
import { prepareTransfer, completeTransfer, getNotes, getShieldedBalancePerToken } from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool, dogeosTestnet } from "@/lib/dogeos-config"
import { TransactionProgress, type TransactionStatus } from "@/components/shielded/transaction-progress"
import { TransactionTrackerClass } from "@/lib/shielded/transaction-tracker"
import { EstimatedFees } from "@/components/shielded/estimated-fees"
import { ConfirmationDialog } from "@/components/shielded/confirmation-dialog"
import { SuccessDialog } from "@/components/shielded/success-dialog"
import { formatErrorWithSuggestion } from "@/lib/shielded/error-suggestions"
import { syncNotesWithChain } from "@/lib/shielded/shielded-service"
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
  const [status, setStatus] = useState<TransactionStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [tracker, setTracker] = useState<TransactionTrackerClass | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<() => Promise<void> | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [simulationWarning, setSimulationWarning] = useState<{
    show: boolean
    message: string
    errorCode?: string
    suggestion?: string
  } | null>(null)
  const [isSyncingNotes, setIsSyncingNotes] = useState(false)
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
    const amountNum = parseFloat(amount || "0")
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
      
      
      console.log('[Transfer] Proof generated, simulating transaction before submission...')
      
      // 🆕 Simulate transaction before submitting to relayer
      try {
        const simResponse = await fetch(`${RELAYER_URL}/api/shielded/relay/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'transfer',
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: result.proof.proof,
            root: result.root,
            nullifierHash: result.nullifierHash,
            outputCommitment1: result.outputCommitment1,
            outputCommitment2: result.outputCommitment2,
            fee: relayerFeeWei.toString(),
            encryptedMemo: (result.encryptedMemo1 || '') + (result.encryptedMemo2 || ''),
          }),
        })
        
        const simResult = await simResponse.json()
        
        // If simulation fails, show warning and stop
        // BUT: If all checks pass (proofFormat, nullifierSpent, rootValid), allow it through
        // (Contract simulation might fail due to RPC issues, but basic validation passed)
        if (!simResult.wouldPass) {
          const allChecksPass = simResult.checks?.proofFormat === true && 
                                 simResult.checks?.nullifierSpent === true && 
                                 simResult.checks?.rootValid === true
          
          if (allChecksPass) {
            // All basic checks passed, contract simulation might have failed due to RPC issues
            // Allow transaction to proceed - relayer will catch actual contract errors
            console.warn('[Transfer] Simulation returned false but all checks passed - proceeding anyway:', simResult)
            setSimulationWarning(null)
          } else {
            // Basic checks failed - block transaction
            console.warn('[Transfer] Simulation failed:', simResult)
            setSimulationWarning({
              show: true,
              message: simResult.error || 'Transaction validation failed',
              errorCode: simResult.errorCode,
              suggestion: simResult.suggestion,
            })
            setStatus("idle")
            return // Don't submit to relayer
          }
        }
        
        // ✅ If simulation passes, clear any previous warning (silent success)
        setSimulationWarning(null)
        console.log('[Transfer] Simulation passed, proceeding with submission')
      } catch (simError: any) {
        // Don't block on simulation errors, just log and continue
        console.warn('[Transfer] Simulation check failed, continuing anyway:', simError)
      }
      
      console.log('[Transfer] Sending to relayer...')
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
      await completeTransfer(
        actualNoteIndex, 
        result.changeNote, 
        data.leafIndex2 || 0,
        result.recipientNote,  // Also pass recipient note
        data.leafIndex1 || 0   // And its leaf index
      )
      
      // Update status to pending (tracker will update to confirmed)
      setStatus("pending")
      
      // Start tracking transaction
      const newTracker = new TransactionTrackerClass(1)
      let isConfirmed = false
      // Capture variables for use in callback
      const capturedAmountNum = amountNum
      const capturedSelectedNote = selectedNote
      const capturedSelectedToken = selectedToken
      const capturedRecipientAddress = recipientAddress
      const capturedTxHash = data.txHash
      const capturedChangeNote = result.changeNote
      const capturedFee = result.fee || 0n
      
      newTracker.onUpdate((trackerState) => {
        console.log('[Transfer] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[Transfer] Transaction confirmed! Setting status and showing dialog')
          setStatus('confirmed')
          
          // Update transaction details with final change amount
          setTransactionDetails({
            amountSent: capturedAmountNum,
            noteConsumed: capturedSelectedNote.amount,
            changeReceived: capturedChangeNote.amount,
            selectedNote: capturedSelectedNote
          })
          
          // Add to transaction history
          addTransaction({
            type: 'transfer',
            txHash: capturedTxHash,
            timestamp: Math.floor(Date.now() / 1000),
            token: capturedSelectedNote.token || 'DOGE',
            amount: capturedAmountNum.toFixed(4),
            amountWei: (BigInt(Math.floor(capturedAmountNum * 1e18))).toString(),
            recipientAddress: capturedRecipientAddress,
            fee: capturedFee.toString(),
            changeAmount: capturedChangeNote.amount > 0n ? (Number(capturedChangeNote.amount) / 1e18).toFixed(4) : undefined,
            status: 'confirmed',
          })
          
          // Trigger balance refresh
          window.dispatchEvent(new Event('refresh-balance'))
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          
          // Note: Success dialog will be shown by useEffect when status === "confirmed"
        } else if (trackerState.status === 'failed') {
          setStatus('failed')
        } else if (trackerState.status === 'pending') {
          setStatus('pending')
        }
      })
      setTracker(newTracker)
      await newTracker.track(data.txHash)
      
      // Don't show toast - success dialog will show instead
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Transfer error:", error)
      setStatus("error")
      
      // Smart error suggestions
      const errorInfo = formatErrorWithSuggestion(error, {
        operation: 'transfer',
        token: selectedToken,
        hasShieldedBalance: totalBalance > 0n,
      })
      
      setErrorMessage(errorInfo.suggestion ? `${errorInfo.description} ${errorInfo.suggestion}` : errorInfo.description)
      toast({
        title: errorInfo.title,
        description: errorInfo.suggestion ? `${errorInfo.description} ${errorInfo.suggestion}` : errorInfo.description,
        variant: "destructive",
      })
    }
  }
  
  const reset = () => {
    setRecipientAddress("")
    setAmount("")
    setStatus("idle")
    setTxHash(null)
    setErrorMessage(null)
    setShowConfirmDialog(false)
    setShowSuccessDialog(false)
    setPendingTransfer(null)
    setTransactionDetails(null)
    if (tracker) {
      tracker.stop()
      tracker.reset()
      setTracker(null)
    }
  }
  
  // Cleanup tracker on unmount
  useEffect(() => {
    return () => {
      if (tracker) {
        tracker.stop()
      }
    }
  }, [tracker])
  
  // Show success dialog when transaction is confirmed (but only if not already shown and not closed)
  useEffect(() => {
    if (status === "confirmed" && txHash && !showSuccessDialog) {
      console.log('[Transfer] useEffect: Status is confirmed, showing success dialog')
      // Use a small delay to ensure all state updates are processed
      const timer = setTimeout(() => {
        setShowSuccessDialog(true)
        setShowConfirmDialog(false) // Ensure confirmation dialog is closed
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [status, txHash, showSuccessDialog]) // Include showSuccessDialog to prevent duplicate
  
  if (spendableNotes.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display font-medium">Private Transfer</h3>
        <p className="text-sm font-body text-muted-foreground">
          Send shielded tokens to another shielded address privately
        </p>
      </div>
      
      {/* Success Dialog - Show when confirmed */}
      <SuccessDialog
        open={showSuccessDialog && status === "confirmed"}
        onOpenChange={(open) => {
          // Only allow closing via buttons, not by clicking outside or scrolling
          if (!open && status === "confirmed") {
            reset()
          } else if (status === "confirmed") {
            setShowSuccessDialog(true)
          }
        }}
        onClose={reset}
        title="Transfer Successful!"
        message={`Successfully sent ${transactionDetails?.amountSent ? Number(transactionDetails.amountSent).toFixed(4) : (amount ? Number(amount).toFixed(4) : '0')} ${selectedToken} to ${recipientAddress ? recipientAddress.slice(0, 10) + '...' + recipientAddress.slice(-8) : 'recipient'} privately.`}
        txHash={txHash}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Send Another"
        onAction={reset}
        details={
          transactionDetails?.changeReceived && 
          transactionDetails.changeReceived > 0n && 
          Number(formatWeiToAmount(transactionDetails.changeReceived, 18).toFixed(4)) > 0 ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Change Returned</span>
                <span className="text-green-400 font-semibold">{formatWeiToAmount(transactionDetails.changeReceived, 18).toFixed(4)} {selectedToken}</span>
              </div>
            </div>
          ) : undefined
        }
      />
      
      {status === "idle" && (
        <div className="space-y-4">
          {/* 🆕 Simulation Warning */}
          {simulationWarning?.show && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div className="font-semibold">Transaction Validation Failed</div>
                <div>{simulationWarning.suggestion || simulationWarning.message}</div>
                {simulationWarning.errorCode === 'UNKNOWN_ROOT' && (
                  <Button
                    onClick={async () => {
                      setIsSyncingNotes(true)
                      try {
                        await syncNotesWithChain(SHIELDED_POOL_ADDRESS)
                        // Trigger balance refresh
                        window.dispatchEvent(new Event('refresh-balance'))
                        window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
                        toast({
                          title: "Notes Synced",
                          description: "Your notes have been synced. Please try again.",
                        })
                        // Clear warning
                        setSimulationWarning(null)
                      } catch (error: any) {
                        toast({
                          title: "Sync Failed",
                          description: error.message || "Failed to sync notes",
                          variant: "destructive",
                        })
                      } finally {
                        setIsSyncingNotes(false)
                      }
                    }}
                    className="mt-2"
                    variant="outline"
                    size="sm"
                    disabled={isSyncingNotes}
                  >
                    {isSyncingNotes ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync Notes"
                    )}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Send amount:</span>
                <span>{amount} {selectedToken}</span>
              </div>
            </div>
          )}
          
          {/* Estimated Fees */}
          {amount && relayerInfo && parseFloat(amount) > 0 && (() => {
            const amountNum = parseFloat(amount || "0")
            const amountWei = BigInt(Math.floor(amountNum * 1e18))
            const { fee, received } = calculateFee(amountWei)
            const maxSendable = calculateMaxSendable()
            const largestNote = spendableNotes.length > 0 ? spendableNotes.reduce((max, note) => 
              note.amount > max.amount ? note : max, spendableNotes[0]
            ) : null
            const hasInsufficientFunds = amountWei + fee > totalBalance
            const exceedsSingleNote = amountWei > maxSendable && spendableNotes.length > 0
            
            if (hasInsufficientFunds) return null
            
            return (
              <EstimatedFees
                amount={amountWei}
                fee={fee}
                received={received}
                token={selectedToken}
                tokenDecimals={18}
              />
            )
          })()}
          
          {/* Warnings */}
          {amount && relayerInfo && parseFloat(amount) > 0 && (() => {
            const amountNum = parseFloat(amount || "0")
            const amountWei = BigInt(Math.floor(amountNum * 1e18))
            const { fee } = calculateFee(amountWei)
            const maxSendable = calculateMaxSendable()
            const largestNote = spendableNotes.length > 0 ? spendableNotes.reduce((max, note) => 
              note.amount > max.amount ? note : max, spendableNotes[0]
            ) : null
            const hasInsufficientFunds = amountWei + fee > totalBalance
            const exceedsSingleNote = amountWei > maxSendable && spendableNotes.length > 0
            
            return (
              <>
                {exceedsSingleNote && !hasInsufficientFunds && largestNote && (
                  <Alert className="border-yellow-500/50 bg-yellow-500/10 py-2 px-3">
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-200">
                      You have {spendableNotes.length} note{spendableNotes.length > 1 ? 's' : ''} but can only send {formatWeiToAmount(maxSendable).toFixed(4)} {selectedToken} per transaction (largest note: {formatWeiToAmount(largestNote.amount).toFixed(4)} {selectedToken}). Make multiple transactions to send more.
                    </AlertDescription>
                  </Alert>
                )}
                {hasInsufficientFunds && (
                  <Alert className="border-red-500/50 bg-red-500/10 py-2 px-3">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <AlertDescription className="text-xs text-red-200">
                      Insufficient balance. Available: {formatWeiToAmount(totalBalance).toFixed(4)} {selectedToken}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )
          })()}
          
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-white/10 border border-white/20 hover:border-[#B89A2E]/50 transition-all duration-500 group py-3 sm:py-2"
            onClick={() => {
              setSimulationWarning(null) // Clear any previous warnings
              setPendingTransfer(() => handleTransfer)
              setShowConfirmDialog(true)
            }}
            disabled={!relayerInfo?.available || !amount || parseFloat(amount) <= 0 || (() => {
              if (!amount || !relayerInfo) return true
              const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
              const { fee } = calculateFee(amountWei)
              return amountWei + fee > totalBalance
            })()}
          >
            {/* Fill animation from left to right - slower and more natural */}
            <span className="absolute inset-0 bg-[#B89A2E] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-[1300ms] ease-in-out" />
            <span className="relative z-10 flex items-center justify-center text-sm sm:text-base text-white group-hover:text-black transition-colors duration-[1300ms] ease-in-out">
              <Send className="h-4 w-4 mr-2 flex-shrink-0" />
              Send Privately
            </span>
          </Button>
          
          {/* Confirmation Dialog */}
          <ConfirmationDialog
            open={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            title="Confirm Private Transfer"
            description={`You are about to send ${amount} ${selectedToken} to ${recipientAddress.slice(0, 10)}...${recipientAddress.slice(-8)} privately. A relayer fee will be deducted.`}
            confirmText="Confirm Transfer"
            cancelText="Cancel"
            onConfirm={async () => {
              setShowConfirmDialog(false)
              if (pendingTransfer) {
                await pendingTransfer()
              }
              setPendingTransfer(null)
            }}
            isLoading={status === "proving" || status === "relaying"}
            details={
              amount && parseFloat(amount) > 0 && relayerInfo ? (() => {
                const amountNum = parseFloat(amount || "0")
                const amountWei = BigInt(Math.floor(amountNum * 1e18))
                const { fee, received } = calculateFee(amountWei)
                return (
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-gray-400">Amount</span>
                      <span className="text-white text-right break-all">{amount} {selectedToken}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-gray-400">Relayer Fee</span>
                      <span className="text-red-400 text-right break-all">-{formatWeiToAmount(fee).toFixed(4)} {selectedToken}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#C2A633]/10">
                      <span className="text-gray-400">Recipient Receives</span>
                      <span className="text-green-400 font-semibold text-right break-all">{formatWeiToAmount(received).toFixed(4)} {selectedToken}</span>
                    </div>
                  </div>
                )
              })() : undefined
            }
          />
        </div>
      )}
      
      {/* Progress Indicator - Only show during processing, hide when confirmed */}
      {status !== "confirmed" && (
        <TransactionProgress
          status={status === "idle" ? "idle" : (status === "error" ? "failed" : status)}
          message={
            status === "proving" ? "Generating zero-knowledge proof..."
            : status === "relaying" ? "Relayer is submitting your transaction..."
            : status === "pending" ? "Waiting for blockchain confirmation..."
            : undefined
          }
          txHash={txHash}
          blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        />
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
