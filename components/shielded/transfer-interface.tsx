"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, Send, AlertCircle, Check, Shield, ExternalLink, Copy, CheckCircle2, MoreHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { isValidShieldedAddress } from "@/lib/shielded/shielded-address"
import { prepareTransfer, completeTransfer, prepareBatchTransfer, completeBatchTransfer, prepareSequentialTransfers, getNotes, getShieldedBalancePerToken, getIdentity } from "@/lib/shielded/shielded-service"
import { parseShieldedAddress } from "@/lib/shielded/shielded-address"
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
import { ShieldProgressBar } from "@/components/shielded/shield-progress-bar"
import { cn } from "@/lib/utils"
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

// Utility function to truncate shielded address
function truncateShieldedAddress(address: string, startChars: number = 8, endChars: number = 6): string {
  if (!address || address.length <= startChars + endChars) return address
  if (address.startsWith('zdoge:')) {
    const prefix = 'zdoge:'
    const rest = address.slice(prefix.length)
    if (rest.length <= startChars + endChars) return address
    return `${prefix}${rest.slice(0, startChars)}…${rest.slice(-endChars)}`
  }
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`
}

export function TransferInterface({ notes, onSuccess, selectedToken = "DOGE", onTokenChange }: TransferInterfaceProps) {
  const { toast } = useToast()
  const { wallet } = useWallet()
  
  const [recipientAddress, setRecipientAddress] = useState("")
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  
  // Real-time address validation
  const isAddressValid = recipientAddress ? isValidShieldedAddress(recipientAddress) : null
  const showAddressError = recipientAddress && recipientAddress.trim() !== '' && !isAddressValid
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<TransactionStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [sequentialTxHashes, setSequentialTxHashes] = useState<string[]>([]) // For sequential transfers
  const [sequentialAmounts, setSequentialAmounts] = useState<string[]>([]) // Amounts for each sequential transfer
  const [tracker, setTracker] = useState<TransactionTrackerClass | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<(() => Promise<void>) | null>(null)
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
  const [sequentialProgress, setSequentialProgress] = useState<{
    current: number
    total: number
    amount: number
    stage: 'preparing' | 'generating' | 'submitting' | 'confirming' | 'complete' | 'finalized'
    txHash?: string
  } | null>(null)
  const [previousStage, setPreviousStage] = useState<string | null>(null)
  const [showProgressGlow, setShowProgressGlow] = useState(false)
  const [iconPulseKey, setIconPulseKey] = useState(0) // Force icon pulse on phase change
  
  // Single transfer progress phases
  const [transferPhase, setTransferPhase] = useState<{
    stage: 'preparing' | 'generating' | 'submitting' | 'confirming' | 'complete' | 'finalized'
    message?: string
  } | null>(null)
  
  const spendableNotes = notes.filter(n => n.leafIndex !== undefined && n.amount > BigInt(0) && (n.token || 'DOGE') === selectedToken)
  
  // Calculate total shielded balance for selected token
  const totalBalance = spendableNotes.reduce((sum, n) => sum + n.amount, BigInt(0))
  
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
    if (!relayerInfo) return { fee: BigInt(0), received: amount }
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let fee = (amount * feePercent) / BigInt(10000)
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (fee < minFee) fee = minFee
    
    return { fee, received: amount - fee }
  }
  
  // Find the best note that can cover the requested amount + fee
  const findBestNote = (requestedAmount: bigint): { note: ShieldedNote; noteIndex: number } | null => {
    if (!relayerInfo) return null
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    let requiredFee = (requestedAmount * feePercent) / BigInt(10000)
    if (requiredFee < minFee) requiredFee = minFee
    const requiredNoteAmount = requestedAmount + requiredFee
    
    // Get fresh notes - need full array for index calculation
    const freshNotes = getNotes()
    const filteredNotes = freshNotes.filter(n => n.leafIndex !== undefined && n.amount > BigInt(0) && (n.token || 'DOGE') === selectedToken)
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
  // Must account for fees: user can send up to (totalBalance - fee)
  // This ensures the note(s) can cover both the amount and the fee
  const calculateMaxSendable = (): bigint => {
    if (totalBalance === BigInt(0) || spendableNotes.length === 0) return BigInt(0)
    
    if (!relayerInfo) {
      // If no relayer info, return total balance (fees unknown)
      return totalBalance
    }
    
    // Calculate minimum fee that would be charged
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    
    // Maximum sendable = totalBalance - minFee
    // This ensures we can always cover the amount + fee
    const maxSendable = totalBalance > minFee ? totalBalance - minFee : BigInt(0)
    
    // For very small balances, ensure we return at least 0
    return maxSendable > BigInt(0) ? maxSendable : BigInt(0)
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
    
    // Validate against maximum sendable (accounts for fees)
    const maxSendable = calculateMaxSendable()
    if (amountWei > maxSendable) {
      toast({
        title: "Insufficient Balance",
        description: `You can send up to ${formatWeiToAmount(maxSendable).toFixed(4)} ${selectedToken} (after accounting for fees)`,
        variant: "destructive",
      })
      return
    }
    
    // Also validate against total balance as a safety check
    if (amountWei > totalBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Amount exceeds your total shielded balance of ${formatWeiToAmount(totalBalance).toFixed(4)} ${selectedToken}`,
        variant: "destructive",
      })
      return
    }
    
    // Try to find a single note that can cover this amount
    const bestNoteResult = findBestNote(amountWei)
    const useSequentialTransfer = !bestNoteResult && spendableNotes.length > 1
    
    if (!bestNoteResult && !useSequentialTransfer) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough funds across your notes to cover this amount plus fees.",
        variant: "destructive",
      })
      return
    }
    
    // Determine which transfer method to use
    let selectedNote: ShieldedNote | null = null
    let actualNoteIndex: number | null = null
    
    if (bestNoteResult) {
      selectedNote = bestNoteResult.note
      actualNoteIndex = bestNoteResult.noteIndex
    }
    
    // Store transaction details for success message
    setTransactionDetails({
      amountSent: amountNum,
      noteConsumed: selectedNote?.amount || BigInt(0),
      changeReceived: BigInt(0), // Will be updated after transaction
      selectedNote
    })
    
    try {
      setStatus("proving")
      
      // Calculate relayer fee
      const { fee: relayerFeeWei } = calculateFee(amountWei)
      const relayerFeeDoge = Number(relayerFeeWei) / 1e18
      
      if (useSequentialTransfer) {
        console.log('[Transfer] Using SEQUENTIAL transfer (auto-splitting large amount)...')
        console.log('[Transfer] Amount:', amountNum, selectedToken)
        console.log('[Transfer] Relayer fee:', relayerFeeDoge)
        
        // Use sequential transfers (Option D)
        const feePercent = relayerInfo ? relayerInfo.feePercent : 0.5
        const minFee = relayerInfo ? parseFloat(relayerInfo.minFee) : 0.001
        
        // Start with "Preparing transfer" stage
        setSequentialProgress({
          current: 0,
          total: 0, // Will be updated when we know the count
          amount: amountNum,
          stage: 'preparing'
        })
        
        // Small delay to show "Preparing transfer" phase
        await new Promise(resolve => setTimeout(resolve, 400))
        
        // Store original notes array BEFORE generating proofs (indices will shift after transfers)
        const originalNotes = getNotes()
        
        const sequentialResults = await prepareSequentialTransfers(
          recipientAddress,
          amountNum,
          SHIELDED_POOL_ADDRESS,
          relayerInfo?.address || '0x0000000000000000000000000000000000000000',
          feePercent,
          minFee,
          (transferIndex, totalTransfers, amount) => {
            setPreviousStage(sequentialProgress?.stage || null)
            setShowProgressGlow(true)
            setIconPulseKey(prev => prev + 1) // Trigger icon pulse on phase change
            setTimeout(() => setShowProgressGlow(false), 400)
            setSequentialProgress({ 
              current: transferIndex, 
              total: totalTransfers, 
              amount,
              stage: 'generating' // Proof generation stage
            })
            console.log(`[SequentialTransfer] Progress: ${transferIndex}/${totalTransfers} (${amount} DOGE)`)
          }
        )
        
        // Update total count now that we know it
        if (sequentialResults.length > 0) {
          setSequentialProgress(prev => prev ? {
            ...prev,
            total: sequentialResults.length,
            current: 1 // Start with first transfer (stage will be set in loop)
          } : null)
        }

        // Small delay after proof generation completes (show user the phase change)
        await new Promise(resolve => setTimeout(resolve, 400))
        
        console.log(`[SequentialTransfer] Generated ${sequentialResults.length} transfer proofs`)
        
        // Send each transfer sequentially
        setStatus("relaying")
        const txHashes: string[] = []
        
        for (let i = 0; i < sequentialResults.length; i++) {
          const result = sequentialResults[i]
          
          // Update progress: Submitting (for this specific transfer)
          // Skip "preparing" - already done once at start for all transfers
          setPreviousStage(sequentialProgress?.stage || null)
          setShowProgressGlow(true)
          setIconPulseKey(prev => prev + 1) // Trigger icon pulse on phase change
          setTimeout(() => setShowProgressGlow(false), 400)
          setSequentialProgress({
            current: i + 1,
            total: sequentialResults.length,
            amount: Number(result.amount) / 1e18,
            stage: 'submitting' // Go directly to submitting for each transfer
          })
          
          // Small delay to show "Submitting" phase
          await new Promise(resolve => setTimeout(resolve, 300))
          
          console.log(`[SequentialTransfer] Sending transfer ${i + 1}/${sequentialResults.length}...`)
          
          const relayerAddr = relayerInfo?.address || '0x0000000000000000000000000000000000000000'
          console.log(`[SequentialTransfer] Sending transfer ${i + 1} with relayer: ${relayerAddr}`)
          console.log(`[SequentialTransfer] Proof public signals:`, result.proof.publicInputs)
          console.log(`[SequentialTransfer] Relayer from public signals[4]:`, result.proof.publicInputs[4])
          
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
              fee: result.proof.publicInputs[5], // Fee is 6th public signal
              relayer: relayerAddr, // Relayer address used in proof
              publicInputs: result.proof.publicInputs, // Send full public inputs for backend to extract relayer
            }),
          })
          
          if (!response.ok) {
            let errorMessage = `Transfer ${i + 1} failed: ${response.statusText}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
              console.error(`[SequentialTransfer] Transfer ${i + 1} error:`, errorData);
            } catch (e) {
              const errorText = await response.text().catch(() => '');
              console.error(`[SequentialTransfer] Transfer ${i + 1} error (non-JSON):`, errorText);
              errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
          }
          
          const data = await response.json()
          txHashes.push(data.txHash)
          
          // Realistic delay: after submission, before confirming
          await new Promise(resolve => setTimeout(resolve, 150))
          
          // Update progress: Confirming
          setPreviousStage(sequentialProgress?.stage || null)
          setShowProgressGlow(true)
          setIconPulseKey(prev => prev + 1) // Trigger icon pulse on phase change
          setTimeout(() => setShowProgressGlow(false), 400)
          setSequentialProgress(prev => prev ? { 
            ...prev, 
            stage: 'confirming',
            txHash: data.txHash
          } : null)
          
          // Realistic delay: confirming phase (show user the phase change)
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log(`[SequentialTransfer] Transfer ${i + 1} sent: ${data.txHash}`)
          
          // Complete this transfer (remove spent note, add change note)
          // Get fresh notes before completing (notes array may have changed after previous transfers)
          const currentNotes = getNotes()
          
          // Find the original note that was used for this transfer
          // result.noteIndex is the index from the ORIGINAL notes array (before any transfers)
          // After previous transfers, notes are removed, so indices shift
          // Solution: Get the note from originalNotes array, then find it in currentNotes by commitment
          const originalNote = originalNotes[result.noteIndex]
          
          if (!originalNote) {
            console.error(`[SequentialTransfer] Transfer ${i + 1} original note not found at index ${result.noteIndex} in original notes array`)
            throw new Error(`Note for transfer ${i + 1} not found in original notes array`)
          }
          
          // Find the note in current notes by matching commitment (most reliable)
          let spentNote = currentNotes.find(n => n.commitment === originalNote.commitment)
          
          if (!spentNote) {
            // Note not found - it may have already been removed or doesn't exist
            console.error(`[SequentialTransfer] Transfer ${i + 1} note not found in current notes! Original note:`, {
              amount: Number(originalNote.amount) / 1e18 + ' DOGE',
              leafIndex: originalNote.leafIndex,
              commitment: originalNote.commitment.toString().slice(0, 20) + '...'
            })
            throw new Error(`Note for transfer ${i + 1} not found in current wallet. It may have already been spent.`)
          }
          
          console.log(`[SequentialTransfer] Transfer ${i + 1} found note by commitment match:`, {
            amount: Number(spentNote.amount) / 1e18 + ' DOGE',
            leafIndex: spentNote.leafIndex,
            commitment: spentNote.commitment.toString().slice(0, 20) + '...'
          })
          
          await completeTransfer(
            spentNote, // Always use note object (found by commitment match)
            result.changeNote,
            data.leafIndex2 || 0,
            result.recipientNote,
            data.leafIndex1 || 0,
            SHIELDED_POOL_ADDRESS // Pass pool address for on-chain verification
          )
          
          // Dispatch event to refresh UI after each transfer
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          
          // Don't set to 'complete' here - let the tracker handle final status
          // Just mark this individual transfer as done (we'll track via txHashes)
          
          // Wait a bit between transfers to avoid rate limiting
          if (i < sequentialResults.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        // After all transfers are submitted, keep the last one's status (confirming or complete)
        // Don't force 'complete' here - let tracker handle it
        
        // Clear progress after a short delay
        setTimeout(() => setSequentialProgress(null), 2000)
        
        // Calculate actual amount sent (recipient receives) from all sequential transfers
        // Sum all recipient amounts (result.amount is what recipient receives, excluding fees)
        const totalAmountSent = sequentialResults.reduce((sum, result) => sum + result.amount, BigInt(0))
        const totalAmountSentDOGE = Number(totalAmountSent) / 1e18
        
        // Set transaction details with actual amount sent (not the requested amount)
        setTransactionDetails({
          amountSent: totalAmountSentDOGE,
          noteConsumed: BigInt(0), // Not applicable for sequential transfers
          changeReceived: BigInt(0), // Change notes are added individually
          selectedNote: null
        })
        
        console.log(`[SequentialTransfer] Total amount sent to recipient: ${totalAmountSentDOGE.toFixed(4)} DOGE (from ${sequentialResults.length} transfers)`)
        
        // Store all transaction hashes and amounts for sequential transfers
        setSequentialTxHashes(txHashes)
        // Track amounts for each transfer (in human-readable format)
        const amounts = sequentialResults.map(result => (Number(result.amount) / 1e18).toFixed(4))
        setSequentialAmounts(amounts)
        // Use first tx hash for tracking (for status updates)
        setTxHash(txHashes[0])
        
        // Start tracking the first transaction
        const newTracker = new TransactionTrackerClass(1)
        let isConfirmed = false
        newTracker.onUpdate(async (trackerState) => {
          if (trackerState.status === 'confirmed' && !isConfirmed) {
            isConfirmed = true
            setStatus('confirmed')
            // Mark all transfers as complete first (only if not already finalized)
            if (sequentialProgress && sequentialProgress.stage !== 'finalized') {
              setSequentialProgress(prev => prev ? { ...prev, stage: 'complete' } : null)
            }
            
            // Show finalized micro-state (300-500ms) before success dialog
            setTimeout(() => {
              if (sequentialProgress) {
                setSequentialProgress(prev => prev ? { ...prev, stage: 'finalized' } : null)
              }

              // After finalized micro-state (500ms), fade out container (200ms), then delay before success dialog
              setTimeout(() => {
                // Start fade-out (opacity will be handled by CSS transition)
                // After fade-out completes (200ms), add additional delay before showing success dialog
                setTimeout(() => {
                  setShowSuccessDialog(true)
                }, 500) // Additional delay before success modal (500ms) + fade-out duration (200ms) = 700ms total
              }, 500) // Finalized micro-state duration (500ms)
            }, 100) // Small delay to show 'complete' first (100ms)
            
            // Refresh notes
            await getNotes()
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          } else if (trackerState.status === 'failed') {
            setStatus('failed')
          } else if (trackerState.status === 'pending') {
            setStatus('pending')
            // Only update to confirming if we're still in submitting stage
            // Don't override if already confirming, complete, or finalized
            if (sequentialProgress && sequentialProgress.stage === 'submitting') {
              setSequentialProgress(prev => prev ? { ...prev, stage: 'confirming' } : null)
            }
          }
        })
        
        setTracker(newTracker)
        newTracker.track(txHashes[0])
        
        // Add to transaction history
        for (const hash of txHashes) {
          const result = sequentialResults.find(r => txHashes.indexOf(hash) === sequentialResults.indexOf(r))
          const amountNum = result ? Number(result.amount) / 1e18 : 0
          await addTransaction({
            txHash: hash,
            type: 'transfer',
            amount: amountNum.toFixed(4), // Format to 4 decimals
            amountWei: result ? result.amount.toString() : BigInt(0).toString(),
            token: selectedToken,
            recipientAddress: recipientAddress,
            timestamp: Math.floor(Date.now() / 1000),
            status: 'confirmed',
          })
        }
        
        return // Exit early for sequential transfer
      }
      
      // Single note transfer (original logic)
      console.log('[Transfer] Using single note transfer...')
      console.log('[Transfer] Amount:', amountNum, selectedNote!.token || 'DOGE')
      console.log('[Transfer] Relayer fee:', relayerFeeDoge)
      
      // Phase 1: Preparing
      setPreviousStage(null)
      setShowProgressGlow(true)
      setIconPulseKey(prev => prev + 1)
      setTimeout(() => setShowProgressGlow(false), 400)
      setTransferPhase({ stage: 'preparing', message: 'Preparing transfer...' })
      
      // Phase 2: Generating proof
      setPreviousStage('preparing')
      setShowProgressGlow(true)
      setIconPulseKey(prev => prev + 1)
      setTimeout(() => setShowProgressGlow(false), 400)
      setTransferPhase({ stage: 'generating', message: 'Generating zero-knowledge proof...' })
      
      // Generate proof with fee (MUST use actual relayer address in proof!)
      const result = await prepareTransfer(
        recipientAddress,
        amountNum,
        SHIELDED_POOL_ADDRESS,
        actualNoteIndex!,
        relayerInfo?.address || '0x0000000000000000000000000000000000000000',
        relayerFeeDoge
      )
      
      
      console.log('[Transfer] Proof generated, simulating transaction before submission...')
      
      // Small delay after proof generation (show user the phase change)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Phase 3: Submitting
      setPreviousStage('generating')
      setShowProgressGlow(true)
      setIconPulseKey(prev => prev + 1)
      setTimeout(() => setShowProgressGlow(false), 400)
      setTransferPhase({ stage: 'submitting', message: 'Submitting transaction to relayer...' })
      
      // Small delay before submitting (show user the phase change)
      await new Promise(resolve => setTimeout(resolve, 300))
      
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
      
      // Phase 4: Confirming
      setPreviousStage('submitting')
      setShowProgressGlow(true)
      setIconPulseKey(prev => prev + 1)
      setTimeout(() => setShowProgressGlow(false), 400)
      setTransferPhase({ stage: 'confirming', message: 'Waiting for blockchain confirmation...' })
      
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
          relayer: relayerInfo?.address || '0x0000000000000000000000000000000000000000', // Relayer address used in proof
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
      if (actualNoteIndex === null) {
        throw new Error('Note index is required to complete transfer')
      }
      await completeTransfer(
        actualNoteIndex, 
        result.changeNote, 
        data.leafIndex2 || 0,
        result.recipientNote,  // Also pass recipient note
        data.leafIndex1 || 0,   // And its leaf index
        SHIELDED_POOL_ADDRESS // Pass pool address for on-chain verification
      )
      
      // Phase 5: Complete (will be set by tracker on confirmation)
      setPreviousStage('confirming')
      setShowProgressGlow(true)
      setIconPulseKey(prev => prev + 1)
      setTimeout(() => setShowProgressGlow(false), 400)
      setTransferPhase({ stage: 'complete', message: 'Transaction confirmed!' })
      
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
      const capturedFee = BigInt(0) // Fee is calculated from public inputs, not in result
      
      newTracker.onUpdate(async (trackerState) => {
        console.log('[Transfer] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[Transfer] Transaction confirmed! Setting status and showing dialog')
          setStatus('confirmed')
          setPreviousStage('confirming')
          setShowProgressGlow(true)
          setIconPulseKey(prev => prev + 1)
          setTimeout(() => setShowProgressGlow(false), 400)
          setTransferPhase({ stage: 'complete', message: 'Transfer complete!' })
          
          // Update transaction details with final change amount
          if (capturedSelectedNote) {
            setTransactionDetails({
              amountSent: capturedAmountNum,
              noteConsumed: capturedSelectedNote.amount,
              changeReceived: capturedChangeNote.amount,
              selectedNote: capturedSelectedNote
            })
          }
          
          // Add to transaction history
          if (capturedSelectedNote) {
            addTransaction({
              type: 'transfer',
              txHash: capturedTxHash,
              timestamp: Math.floor(Date.now() / 1000),
              token: capturedSelectedNote.token || 'DOGE',
              amount: capturedAmountNum.toFixed(4),
              amountWei: (BigInt(Math.floor(capturedAmountNum * 1e18))).toString(),
              recipientAddress: capturedRecipientAddress,
              fee: capturedFee.toString(),
              changeAmount: capturedChangeNote.amount > BigInt(0) ? (Number(capturedChangeNote.amount) / 1e18).toFixed(4) : undefined,
              status: 'confirmed',
            })
          }
          
          // AFTER CONFIRMATION: Shielded balance already updated optimistically (immediately after submission)
          // Sync notes with chain to ensure accuracy
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          
          // NOTE: Transfer doesn't change public balance, so no refresh needed
          // But we sync notes to catch any discrepancies from optimistic updates
          try {
            const { syncNotesWithChain } = await import('@/lib/shielded/shielded-service')
            await syncNotesWithChain(SHIELDED_POOL_ADDRESS)
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          } catch (syncError) {
            console.warn('[Transfer] Failed to sync notes after confirmation:', syncError)
          }
          
          // Show finalized micro-state (300-500ms) before success dialog (same as sequential)
          setTimeout(() => {
            if (transferPhase) {
              setTransferPhase(prev => prev ? { ...prev, stage: 'finalized' } : null)
            }

            // After finalized micro-state (500ms), fade out container (200ms), then delay before success dialog
            setTimeout(() => {
              // Start fade-out (opacity will be handled by CSS transition)
              // After fade-out completes (200ms), add additional delay before showing success dialog
              setTimeout(() => {
                setShowSuccessDialog(true)
              }, 500) // Additional delay before success modal (500ms) + fade-out duration (200ms) = 700ms total
            }, 500) // Finalized micro-state duration (500ms)
          }, 100) // Small delay to show 'complete' first (100ms)
          
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
      setStatus("failed")
      
      // Smart error suggestions
      const errorInfo = formatErrorWithSuggestion(error, {
        operation: 'transfer',
        token: selectedToken,
        hasShieldedBalance: totalBalance > BigInt(0),
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
    setSequentialTxHashes([])
    setSequentialAmounts([])
    setSequentialProgress(null)
    setTransferPhase(null)
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
  // Wait for finalized stage to complete before showing (matches sequential transfer pattern)
  useEffect(() => {
    if (status === "confirmed" && txHash && !showSuccessDialog) {
      // Check if we're in finalized stage (for single transfers)
      const isFinalized = transferPhase?.stage === 'finalized'
      
      // For sequential transfers, wait for finalized stage
      // For single transfers, wait for finalized stage or use delay
      if (sequentialProgress) {
        // Sequential transfer - wait for finalized stage
        if (sequentialProgress.stage === 'finalized') {
          console.log('[Transfer] useEffect: Sequential transfer finalized, showing success dialog')
          const timer = setTimeout(() => {
            setShowSuccessDialog(true)
            setShowConfirmDialog(false)
          }, 700) // Match sequential transfer delay (500ms finalized + 200ms fade)
          return () => clearTimeout(timer)
        }
      } else if (transferPhase) {
        // Single transfer - wait for finalized stage
        if (isFinalized) {
          console.log('[Transfer] useEffect: Single transfer finalized, showing success dialog')
          const timer = setTimeout(() => {
            setShowSuccessDialog(true)
            setShowConfirmDialog(false)
          }, 700) // Match sequential transfer delay (500ms finalized + 200ms fade)
          return () => clearTimeout(timer)
        }
      } else {
        // Fallback: no phase tracking, use shorter delay
        console.log('[Transfer] useEffect: Status is confirmed (no phase), showing success dialog')
        const timer = setTimeout(() => {
          setShowSuccessDialog(true)
          setShowConfirmDialog(false)
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [status, txHash, showSuccessDialog, sequentialProgress, transferPhase]) // Include phase states
  
  if (spendableNotes.length === 0) {
    return null
  }
  
  // Dim other content during transfer (premium touch)
  const isTransferInProgress = (sequentialProgress !== null && sequentialProgress.stage !== 'finalized') ||
                               (transferPhase !== null && transferPhase.stage !== 'finalized')

  return (
    <div className="space-y-4">
      <div className={cn("transition-opacity duration-300", isTransferInProgress ? "opacity-85" : "opacity-100")}>
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
        onClose={() => {
          // Smooth fade out on Done
          setShowSuccessDialog(false)
          setTimeout(() => reset(), 250)
        }}
        title="Transfer Complete"
        message=""
        details={
          <div className="space-y-2.5 text-sm">
            {transactionDetails?.amountSent != null && transactionDetails.amountSent > 0 && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-semibold">{Number(transactionDetails.amountSent).toFixed(4)} {selectedToken}</span>
              </div>
            )}
            {recipientAddress && recipientAddress.trim() !== '' && (() => {
              const truncated = recipientAddress.startsWith('zdoge:') 
                ? `zdoge:${recipientAddress.slice(6, 6 + 10)}…${recipientAddress.slice(-8)}`
                : `${recipientAddress.slice(0, 10)}…${recipientAddress.slice(-8)}`
              
              return (
                <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
                  <span className="text-gray-400">Destination</span>
                  <span 
                    className="text-white font-mono text-xs cursor-pointer hover:text-white transition-colors"
                    title={recipientAddress}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(recipientAddress)
                        toast({
                          title: "Copied",
                          description: "Address copied to clipboard",
                        })
                      } catch (err) {
                        console.error('Failed to copy:', err)
                      }
                    }}
                  >
                    {truncated}
                  </span>
                </div>
              )
            })()}
          </div>
        }
        txHash={txHash}
        txHashes={sequentialTxHashes.length > 0 ? sequentialTxHashes : undefined}
        txAmounts={sequentialAmounts.length > 0 ? sequentialAmounts : undefined}
        txToken={selectedToken}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Send Another Transfer"
        onAction={() => {
          // Fade out modal, then reset and focus address field
          setShowSuccessDialog(false)
          setTimeout(() => {
            reset()
            // Pre-focus the address field after reset
            setTimeout(() => {
              addressInputRef.current?.focus()
            }, 100)
          }, 250)
        }}
      />
      
      {status === "idle" && (
        <div className={cn("space-y-4 transition-opacity duration-300", isTransferInProgress ? "opacity-85" : "opacity-100")}>
          {/* 🆕 Simulation Warning */}
          {simulationWarning?.show && (
            <Alert className="bg-red-500/10 border-red-500/30 mb-4">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-50 space-y-2">
                <div className="font-semibold text-red-100">Transaction Validation Failed</div>
                <div className="text-red-100">{simulationWarning.suggestion || simulationWarning.message}</div>
                {simulationWarning.errorCode === 'UNKNOWN_ROOT' && (
                  <Button
                    onClick={async () => {
                      setIsSyncingNotes(true)
                      try {
                        await syncNotesWithChain(SHIELDED_POOL_ADDRESS)
                        // Trigger balance refresh
                        window.dispatchEvent(new Event('refresh-balance'))
                        window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
                        
                        // Refresh public balance - wallet.refreshBalance doesn't exist, balance updates automatically
                        
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
            <Label htmlFor="recipient" className="text-xs text-muted-foreground font-normal">
              Recipient (Private Address)
            </Label>
            <div className="relative">
              <style dangerouslySetInnerHTML={{__html: `
                #recipient {
                  background-color: transparent !important;
                  background: transparent !important;
                }
                #recipient:-webkit-autofill,
                #recipient:-webkit-autofill:hover,
                #recipient:-webkit-autofill:focus,
                #recipient:-webkit-autofill:active {
                  -webkit-box-shadow: 0 0 0 30px rgba(0, 0, 0, 0.4) inset !important;
                  -webkit-text-fill-color: white !important;
                  background-color: transparent !important;
                  background: transparent !important;
                }
              `}} />
              <div
                className={`
                  relative flex items-center gap-2
                  border border-white/10 rounded-md
                  transition-all duration-200
                  ${isAddressFocused 
                    ? 'ring-2 ring-[#C2A633]/30 ring-offset-0 ring-offset-black shadow-[0_0_0_1px_rgba(194,166,51,0.2),0_0_12px_rgba(194,166,51,0.1)] border-[#C2A633]/40' 
                    : showAddressError
                    ? 'border-red-400/50'
                    : isAddressValid
                    ? 'border-[#C2A633]/30'
                    : 'border-white/10'
                  }
                `}
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                }}
              >
                {/* Always show input field - keep it editable */}
                <input
                  ref={addressInputRef}
                  id="recipient"
                  type="text"
                  placeholder="zdoge:..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  onFocus={() => setIsAddressFocused(true)}
                  onBlur={() => setIsAddressFocused(false)}
                  className={`
                    flex-1 border-0 outline-none
                    px-4 py-2.5 text-sm
                    font-mono text-white placeholder:text-white/30
                    focus:ring-0 focus:outline-none
                  `}
                  style={{ 
                    caretColor: '#C2A633',
                    backgroundColor: 'transparent',
                    background: 'transparent',
                    color: 'white',
                  }}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
                {recipientAddress && (
                  <>
                    {/* Show validation indicator */}
                    {isAddressValid ? (
                      <CheckCircle2 className="h-4 w-4 text-[#C2A633] flex-shrink-0 mr-1" />
                    ) : showAddressError ? (
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mr-1" />
                    ) : null}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        try {
                          await navigator.clipboard.writeText(recipientAddress)
                          setAddressCopied(true)
                          toast({
                            title: "Copied",
                            description: "Address copied to clipboard",
                          })
                          setTimeout(() => setAddressCopied(false), 2000)
                        } catch (err) {
                          console.error('Failed to copy:', err)
                        }
                      }}
                      className="p-2 hover:bg-white/5 rounded transition-colors flex-shrink-0"
                      title="Copy full address"
                    >
                      {addressCopied ? (
                        <Check className="h-4 w-4 text-[#C2A633]" />
                      ) : (
                        <Copy className="h-4 w-4 text-white/50 hover:text-white/80" />
                      )}
                    </button>
                  </>
                )}
              </div>
              {showAddressError && (
                <p className="text-xs text-red-400 mt-1.5">
                  Invalid address. Must start with 'zdoge:' followed by a valid hex address.
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-1">
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
              <p className="text-xs text-muted-foreground">
                Max amount from total shielded balance (can use multiple notes)
              </p>
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            // User can send up to maxSendable (totalBalance - minFee)
            // This ensures notes can cover both amount and fees
            const hasInsufficientFunds = amountWei > maxSendable
            const exceedsSingleNote = false // Not used anymore - sequential transfer handles this

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
            // User can send up to maxSendable (totalBalance - minFee)
            // This ensures notes can cover both amount and fees
            const hasInsufficientFunds = amountWei > maxSendable
            const exceedsSingleNote = false // Not used anymore - sequential transfer handles this
            
            return (
              <>
                {exceedsSingleNote && !hasInsufficientFunds && largestNote && totalBalance > largestNote.amount && (
                  <Alert className="border-blue-500/50 bg-blue-500/10 py-2 px-3">
                    <ShieldPlus className="h-3 w-3 text-blue-500" />
                    <AlertDescription className="text-xs text-blue-200">
                      💡 <strong>Batch Transfer</strong> will be used: You're sending more than your largest note ({formatWeiToAmount(largestNote.amount).toFixed(4)} {selectedToken}). The system will automatically combine multiple notes (up to {spendableNotes.length} available) to send {formatWeiToAmount(maxSendable).toFixed(4)} {selectedToken} total.
                    </AlertDescription>
                  </Alert>
                )}
                {hasInsufficientFunds && (
                  <Alert className="border-red-500/30 bg-red-500/10 py-2 px-3">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    <AlertDescription className="text-xs text-red-100">
                      Insufficient balance. Available: {formatWeiToAmount(maxSendable).toFixed(4)} {selectedToken} (after fees)
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )
          })()}
          
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-zinc-900/70 border border-zinc-700/80 hover:border-[#C2A633]/50 transition-all duration-300 group py-3 sm:py-2 backdrop-blur-sm"
            onClick={() => {
              setSimulationWarning(null) // Clear any previous warnings
              setPendingTransfer(() => handleTransfer)
              setShowConfirmDialog(true)
            }}
            disabled={!relayerInfo?.available || totalBalance === BigInt(0) || !amount || parseFloat(amount) <= 0 || !isAddressValid || (() => {
              if (!amount) return true
              const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18))
              // User can send up to maxSendable (accounts for fees)
              const maxSendable = calculateMaxSendable()
              return amountWei > maxSendable
            })()}
            style={{
              boxShadow: '0 0 0 1px rgba(194, 166, 51, 0.08)',
              transition: 'all 0.3s ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(194, 166, 51, 0.25), 0 0 12px rgba(194, 166, 51, 0.1)'
              e.currentTarget.style.background = 'rgba(39, 39, 42, 0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(194, 166, 51, 0.08)'
              e.currentTarget.style.background = 'rgba(24, 24, 27, 0.7)'
            }}
          >
            {/* Subtle shimmer effect on hover */}
            <span 
              className="absolute inset-0 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-[1500ms] ease-out opacity-0 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(194, 166, 51, 0.05), transparent)',
                width: '100%',
              }}
            />
            <span className="relative z-10 flex items-center justify-center text-sm sm:text-base text-[#C2A633]/90 group-hover:text-[#C2A633] transition-colors duration-300 font-medium">
              <Send className="h-4 w-4 mr-2 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.05]" />
              Send Privately
            </span>
          </Button>
          
          {/* Confirmation Dialog */}
          <ConfirmationDialog
            open={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            title="Confirm Private Transfer"
            description={`You are about to send ${amount} ${selectedToken} privately.`}
            confirmText="Confirm Transfer"
            cancelText="Cancel"
            onConfirm={async () => {
              setShowConfirmDialog(false)
              if (pendingTransfer) {
                await pendingTransfer()
              }
              setPendingTransfer(() => null)
            }}
            isLoading={["proving", "relaying", "pending"].includes(status)}
            details={
              amount && parseFloat(amount) > 0 && relayerInfo ? (() => {
                const amountNum = parseFloat(amount || "0")
                const amountWei = BigInt(Math.floor(amountNum * 1e18))
                const { fee, received } = calculateFee(amountWei)
                return (
                  <div className="space-y-3 text-xs sm:text-sm">
                    {/* Recipient Address */}
                    <div className="space-y-1.5">
                      <span className="text-gray-400 text-[10px] sm:text-xs">To:</span>
                      <div className="font-mono text-[10px] sm:text-xs bg-zinc-900/60 px-2.5 py-1.5 rounded border border-[#C2A633]/20 break-all">
                        {recipientAddress}
                      </div>
                    </div>
                    
                    {/* Transaction Details */}
                    <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-zinc-700/30">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-white text-right break-all">{amount} {selectedToken}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-gray-400">Relayer Fee</span>
                        <span className="text-red-400 text-right break-all">-{formatWeiToAmount(fee).toFixed(4)} {selectedToken}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-zinc-700/20">
                        <span className="text-gray-400 font-medium">Recipient Receives</span>
                        <span className="text-green-400 font-semibold text-right break-all">{formatWeiToAmount(received).toFixed(4)} {selectedToken}</span>
                      </div>
                    </div>
                    
                    {/* Trust Cues / Micro-copy */}
                    <div className="pt-2 border-t border-zinc-700/30 space-y-1">
                      <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                        All transfers are private. Only the recipient sees the amount.
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                        Relayer fee ensures your transaction is processed securely.
                      </p>
                    </div>
                  </div>
                )
              })() : undefined
            }
          />
        </div>
      )}
      
      {/* Sequential Transfer Progress - Matches shield/unshield design */}
      {sequentialProgress && (status !== "confirmed" || sequentialProgress.stage === "finalized") && !showSuccessDialog && (
        <div 
          className={cn(
            "transition-opacity duration-200",
            status === "confirmed" && sequentialProgress.stage !== "finalized" ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="p-3 sm:p-4 bg-zinc-900/50 border border-[#C2A633]/20 rounded-lg">
            <div className="space-y-2 sm:space-y-3">
              {/* Icon on left, text on right - matches TransactionProgress layout */}
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Icon - Spinner (EXACT SAME as shield interface) */}
                <div className="flex-shrink-0">
                  {sequentialProgress.stage === 'finalized' ? (
                    // Checkmark on finalized - single soft pulse
                    <Check 
                      className="h-5 w-5 text-[#C2A633]" 
                      strokeWidth={2.5}
                      style={{
                        animation: 'softPulse 1.5s ease-in-out 1',
                        filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
                      }}
                    />
                  ) : (
                    // Loader2 spinner - EXACT SAME as shield interface
                    <Loader2 
                      className="h-5 w-5 animate-spin text-[#C2A633]" 
                      style={{
                        filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
                      }}
                    />
                  )}
                </div>
                
                {/* Text on right - EXACT SAME styling as shield interface */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white">
                    {(() => {
                      const { current, total, stage } = sequentialProgress
                      const isMultiple = total > 1
                      const txNum = isMultiple ? ` (${current}/${total})` : ''
                      
                      const stageMessages: Record<string, string> = {
                        preparing: `Preparing ${isMultiple ? `${total} transfers` : 'transfer'}`,
                        generating: `Generating privacy proof${isMultiple ? 's' : ''}`,
                        submitting: `Submitting${txNum}`,
                        confirming: `Confirming${txNum}`,
                        complete: `Finalizing transfer${txNum}`,
                        finalized: `✓ ${isMultiple ? `All ${total} transfers` : 'Transfer'} finalized`
                      }
                      return stageMessages[stage] || `Processing transfer...`
                    })()}
                  </p>
                  {(() => {
                    const { current, total, stage } = sequentialProgress
                    const isMultiple = total > 1
                    
                    const secondaryMessages: Record<string, string> = {
                      preparing: isMultiple 
                        ? `Splitting into ${total} separate transactions for privacy` 
                        : `Initializing transfer sequence`,
                      generating: `This typically takes a few seconds.`,
                      submitting: isMultiple 
                        ? `Sending transaction ${current} of ${total}...` 
                        : `Relayer is submitting your transaction...`,
                      confirming: isMultiple 
                        ? `Waiting for transaction ${current} of ${total} to confirm` 
                        : `Transaction is being confirmed on-chain`,
                      complete: `Finalizing shielded assets…`
                    }
                    const message = secondaryMessages[stage]
                    return message ? (
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">
                        {message}
                      </p>
                    ) : null
                  })()}
                </div>
              </div>
              
              {/* Progress Bar - Reuse EXACT SAME component as shield/unshield */}
              {(() => {
                // Stage-based progress mapping (internal only, never shown to user)
                const progressByPhase: Record<string, number> = {
                  preparing: 0.05,   // 5% - Start low, show preparing first
                  generating: 0.25,  // 25% - After preparing, move to generating
                  submitting: 0.55,  // 55% - After generating, move to submitting
                  confirming: 0.80,  // 80% - After submitting, move to confirming
                  complete: 0.95,    // 95% - After confirming, move to complete
                  finalized: 1.00    // 100% (stays full during micro-state)
                }
                
                // Calculate progress based on current transfer and stage
                let progressValue = 0
                
                if (sequentialProgress.total > 0) {
                  // Calculate base progress from transfer number (0 to total-1)
                  const baseProgress = (sequentialProgress.current - 1) / sequentialProgress.total
                  // Add stage progress for current transfer (0 to 1/total)
                  const stageProgress = progressByPhase[sequentialProgress.stage] || 0
                  const stageContribution = stageProgress / sequentialProgress.total
                  progressValue = Math.min(baseProgress + stageContribution, 1.0)
                } else {
                  // Before we know total transfers, just use stage progress directly
                  progressValue = progressByPhase[sequentialProgress.stage] || 0
                }
                
                return (
                  <ShieldProgressBar 
                    progress={progressValue}
                    showGlow={showProgressGlow}
                    flowingGradient={true}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* Single Transfer Progress - Matches sequential transfer design */}
      {!sequentialProgress && transferPhase && (status !== "confirmed" || transferPhase.stage === "finalized") && !showSuccessDialog && (
        <div 
          className={cn(
            "transition-opacity duration-200",
            status === "confirmed" && transferPhase.stage !== "finalized" ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="p-3 sm:p-4 bg-zinc-900/50 border border-[#C2A633]/20 rounded-lg">
            <div className="space-y-2 sm:space-y-3">
              {/* Icon on left, text on right - matches TransactionProgress layout */}
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Icon - Spinner (EXACT SAME as shield interface) */}
                <div className="flex-shrink-0">
                  {transferPhase.stage === 'finalized' ? (
                    // Checkmark on finalized - single soft pulse
                    <Check 
                      className="h-5 w-5 text-[#C2A633]" 
                      strokeWidth={2.5}
                      style={{
                        animation: 'softPulse 1.5s ease-in-out 1',
                        filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
                      }}
                    />
                  ) : (
                    // Loader2 spinner - EXACT SAME as shield interface
                    <Loader2 
                      className="h-5 w-5 animate-spin text-[#C2A633]" 
                      style={{
                        filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
                      }}
                    />
                  )}
                </div>
                
                {/* Text on right - EXACT SAME styling as shield interface */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white">
                    {(() => {
                      const stageMessages = {
                        preparing: `Preparing transfer`,
                        generating: `Generating privacy proof`,
                        submitting: `Submitting to network`,
                        confirming: `Confirming on-chain`,
                        complete: `Finalizing transfer`,
                        finalized: `✓ Transfer finalized`
                      }
                      return stageMessages[transferPhase.stage] || `Processing transfer...`
                    })()}
                  </p>
                  {(() => {
                    const secondaryMessages: Record<string, string> = {
                      preparing: `Initializing transfer`,
                      generating: `This typically takes a few seconds.`,
                      submitting: `Relayer is submitting your transaction...`,
                      confirming: `Transaction is being confirmed on-chain`,
                      complete: `Finalizing shielded assets…`
                    }
                    const message = secondaryMessages[transferPhase.stage]
                    return message ? (
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">
                        {message}
                      </p>
                    ) : null
                  })()}
                  {amount && (
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                      Amount: {amount} {selectedToken}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Progress Bar - Reuse EXACT SAME component as sequential/shield/unshield */}
              {(() => {
                // Stage-based progress mapping (0-1)
                const progressByPhase: Record<string, number> = {
                  preparing: 0.05,   // 5% - Start low, show preparing first
                  generating: 0.25,  // 25% - After preparing, move to generating
                  submitting: 0.55,  // 55% - After generating, move to submitting
                  confirming: 0.80,  // 80% - After submitting, move to confirming
                  complete: 0.95,    // 95% - After confirming, move to complete
                  finalized: 1.00    // 100% (stays full during micro-state)
                }
                const progressValue = progressByPhase[transferPhase.stage] || 0
                
                return (
                  <ShieldProgressBar 
                    progress={progressValue}
                    showGlow={showProgressGlow}
                    flowingGradient={true}
                  />
                )
              })()}
              
              {/* Transaction Hash if available */}
              {txHash && (transferPhase.stage === 'confirming' || transferPhase.stage === 'complete' || transferPhase.stage === 'finalized') && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pt-2 border-t border-[#C2A633]/10">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-mono break-all sm:break-normal">
                    {txHash.slice(0, 8)}...{txHash.slice(-6)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 sm:h-6 px-2 text-[10px] sm:text-xs self-start sm:self-auto min-h-[32px] sm:min-h-0"
                    onClick={() => window.open(`${dogeosTestnet.blockExplorers.default.url}/tx/${txHash}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                    View
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Standard Progress Indicator - Fallback for non-phase status */}
      {!sequentialProgress && !transferPhase && status !== "confirmed" && status !== "idle" && (
        <TransactionProgress
          status={status}
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
      
      {status === "failed" && (
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
