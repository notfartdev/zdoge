"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, LogOut, AlertCircle, Check, Shield, ShieldOff, Info, Coins, Layers, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { prepareUnshield, completeUnshield, getNotes } from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool, dogeosTestnet } from "@/lib/dogeos-config"
import { getUSDValue, formatUSD } from "@/lib/price-service"
import { parseUnits, formatUnits } from "viem"
import { TransactionProgress, type TransactionStatus } from "@/components/shielded/transaction-progress"
import { TransactionTrackerClass } from "@/lib/shielded/transaction-tracker"
import { EstimatedFees } from "@/components/shielded/estimated-fees"
import { ConfirmationDialog } from "@/components/shielded/confirmation-dialog"
import { SuccessDialog } from "@/components/shielded/success-dialog"
import { formatErrorWithSuggestion } from "@/lib/shielded/error-suggestions"

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'
import Link from "next/link"
import { ShieldPlus } from "lucide-react"

const SHIELDED_POOL_ADDRESS = shieldedPool.address
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

// Helper to get token decimals
function getTokenDecimals(tokenSymbol: string): number {
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens]
  return token?.decimals || 18 // Default to 18 if not found
}

// Helper to get token metadata
function getTokenMetadata(tokenSymbol: string): { symbol: string; address: `0x${string}`; decimals: number } {
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  
  if (tokenSymbol === 'DOGE') {
    return {
      symbol: 'DOGE',
      address: NATIVE_TOKEN,
      decimals: 18,
    };
  }
  
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found in shieldedPool.supportedTokens`);
  }
  
  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals,
  };
}

interface RelayerInfo {
  available: boolean
  address: string | null
  feePercent: number
  minFee: string
}

interface UnshieldInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
  selectedToken?: string
  onTokenChange?: (token: string) => void
}

export function UnshieldInterface({ notes, onSuccess, selectedToken = "DOGE", onTokenChange }: UnshieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  // Initialize transaction history
  useEffect(() => {
    if (wallet?.address) {
      initTransactionHistory(wallet.address).catch(err => {
        console.warn('[Unshield] Failed to init transaction history:', err)
      })
    }
  }, [wallet?.address])
  
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [status, setStatus] = useState<TransactionStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [tracker, setTracker] = useState<TransactionTrackerClass | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [pendingUnshield, setPendingUnshield] = useState<() => Promise<void> | null>(null)
  const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null)
  const [fee, setFee] = useState<string | null>(null)

  // Show success dialog when transaction is confirmed (but only if not already shown and not closed)
  useEffect(() => {
    if (status === "confirmed" && txHash && !showSuccessDialog) {
      console.log('[Unshield] useEffect: Status is confirmed, showing success dialog')
      // Use a small delay to ensure all state updates are processed
      const timer = setTimeout(() => {
        setShowSuccessDialog(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [status, txHash, showSuccessDialog]) // Include showSuccessDialog to prevent duplicate
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [isLoadingRelayerInfo, setIsLoadingRelayerInfo] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [consolidateProgress, setConsolidateProgress] = useState<{ current: number; total: number; totalReceived: number } | null>(null)
  const [consolidateTxHashes, setConsolidateTxHashes] = useState<string[]>([])
  const [consolidateTotalReceived, setConsolidateTotalReceived] = useState<number>(0)
  const [usdValue, setUsdValue] = useState<string | null>(null)
  
  const spendableNotes = useMemo(() => {
    // Get token metadata for filtering
    const tokenMeta = getTokenMetadata(selectedToken)
    
    return notes
      .filter(note => {
        // Handle legacy notes (without tokenAddress/decimals)
        if (!note.tokenAddress || note.decimals == null) {
          // Legacy note: match by token symbol
          // For USDC, check if note.token is 'USDC'
          // For DOGE, check if note.token is 'DOGE' or missing
          if (selectedToken === 'DOGE') {
            return !note.token || note.token === 'DOGE'
          }
          return note.token === selectedToken
        }
        // Modern note: match by tokenAddress (more reliable)
        return note.tokenAddress.toLowerCase() === tokenMeta.address.toLowerCase()
      })
      .filter(n => n.leafIndex !== undefined && n.amount > 0n)
      .sort((a, b) => Number(b.amount - a.amount))
  }, [notes, selectedToken])
  
  const totalBalance = useMemo(() => 
    spendableNotes.reduce((sum, n) => sum + n.amount, 0n),
    [spendableNotes]
  )
  
  const largestNote = useMemo(() => 
    spendableNotes.length > 0 ? spendableNotes[0] : null,
    [spendableNotes]
  )
  
  // Get token decimals for fee calculation
  const tokenDecimals = getTokenDecimals(selectedToken)
  
  const calculateFeeForNote = (amountWei: bigint): { fee: bigint; received: bigint; error?: string } => {
    if (!relayerInfo) return { fee: 0n, received: amountWei }
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let feeAmt = (amountWei * feePercent) / 10000n
    // Convert minFee from human-readable to token base units using token decimals
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    if (feeAmt < minFee) feeAmt = minFee
    
    // Check if note is too small to unshield (fee would exceed or equal note amount)
    if (amountWei <= feeAmt) {
      const noteAmountHuman = formatUnits(amountWei, tokenDecimals)
      const feeAmountHuman = formatUnits(feeAmt, tokenDecimals)
      return { 
        fee: amountWei, 
        received: 0n,
        error: `Note too small to unshield. Note: ${noteAmountHuman} ${selectedToken}, Minimum fee: ${feeAmountHuman} ${selectedToken}`
      }
    }
    return { fee: feeAmt, received: amountWei - feeAmt }
  }
  
  const totalReceivableAfterFees = useMemo(() => {
    if (!relayerInfo) return totalBalance
    let total = 0n
    // Filter out notes that are too small to unshield
    for (const note of spendableNotes) {
      const feeResult = calculateFeeForNote(note.amount)
      if (!feeResult.error) {
        total += feeResult.received
      }
    }
    
    // Debug logging
    if (spendableNotes.length > 0) {
      console.log(`[Consolidate] Total calculation:`, {
        notesCount: spendableNotes.length,
        totalWei: total.toString(),
        totalHuman: formatUnits(total, tokenDecimals),
        selectedToken,
        tokenDecimals,
        notes: spendableNotes.map(n => ({
          amountWei: n.amount.toString(),
          amountHuman: formatUnits(n.amount, n.decimals ?? tokenDecimals),
          fee: calculateFeeForNote(n.amount).fee.toString(),
          received: calculateFeeForNote(n.amount).received.toString(),
        })),
      })
    }
    
    return total
  }, [spendableNotes, relayerInfo, tokenDecimals, selectedToken])
  
  // Calculate USD value
  useEffect(() => {
    async function calculateUSD() {
      const tokenAmount = Number(formatUnits(totalReceivableAfterFees, tokenDecimals))
      try {
        // Use selectedToken instead of hardcoded "DOGE"
        const usd = await getUSDValue(tokenAmount, selectedToken)
        setUsdValue(formatUSD(usd))
      } catch (error) {
        console.error('Failed to calculate USD value:', error)
        setUsdValue(null)
      }
    }
    if (totalReceivableAfterFees > 0n) {
      calculateUSD()
    } else {
      setUsdValue(null)
    }
  }, [totalReceivableAfterFees, selectedToken, tokenDecimals])
  
  useEffect(() => {
    async function fetchRelayerInfo() {
      setIsLoadingRelayerInfo(true)
      try {
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/info`)
        if (response.ok) {
          setRelayerInfo(await response.json())
        }
      } catch (error) {
        console.warn('Could not fetch relayer info:', error)
      } finally {
        setIsLoadingRelayerInfo(false)
      }
    }
    fetchRelayerInfo()
  }, [])
  
  const fillConnectedAddress = () => {
    if (wallet?.address) setRecipientAddress(wallet.address)
  }
  
  const calculateMaxUnshieldable = (): bigint => {
    if (!largestNote || !relayerInfo) return 0n
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    if (largestNote.amount <= minFee) return 0n
    const feeResult = calculateFeeForNote(largestNote.amount)
    if (feeResult.error) return 0n
    return feeResult.received
  }
  
  const findBestNote = (requestedAmount: bigint): { note: ShieldedNote; noteIndex: number } | null => {
    if (!relayerInfo) return null
    
    // Get token metadata for filtering
    const tokenMeta = getTokenMetadata(selectedToken)
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    let requiredFee = (requestedAmount * feePercent) / 10000n
    if (requiredFee < minFee) requiredFee = minFee
    const requiredNoteAmount = requestedAmount + requiredFee
    
    // Get all notes and filter by token address (not just symbol)
    const allNotes = getNotes()
    const candidateNotes = allNotes
      .map((note, originalIndex) => ({ note, originalIndex }))
      .filter(({ note }) => {
        // Filter by token address - handle missing tokenAddress (legacy notes)
        if (!note.tokenAddress) {
          // Legacy note: check if it's DOGE and selectedToken is DOGE
          if (selectedToken === 'DOGE' && (!note.token || note.token === 'DOGE')) {
            return true
          }
          return false
        }
        // Modern note: match by tokenAddress
        return note.tokenAddress.toLowerCase() === tokenMeta.address.toLowerCase()
      })
      .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n)
    
    if (candidateNotes.length === 0) {
      return null
    }
    
    // Sort by amount ascending (smallest first that covers the amount)
    const sortedCandidates = [...candidateNotes].sort((a, b) => Number(a.note.amount - b.note.amount))
    
    for (const { note, originalIndex } of sortedCandidates) {
      if (note.amount >= requiredNoteAmount) {
        // Return the original index in allNotes array (not filtered array index)
        return { note, noteIndex: originalIndex }
      }
    }
    return null
  }
  
  const parseInputAmount = (): bigint => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0n
    // Use token decimals for parsing
    return parseUnits(amountNum.toString(), tokenDecimals)
  }
  
  const getSelectedNoteInfo = () => {
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) return null
    const result = findBestNote(requestedWei)
    if (!result) return { error: "No single note large enough. Use 'Consolidate All' to unshield everything." }
    const { fee } = calculateFeeForNote(result.note.amount)
    return {
      note: result.note,
      noteAmount: result.note.amount,
      fee,
      youReceive: requestedWei,
      change: result.note.amount - fee - requestedWei,
    }
  }
  
  // Helper function to check if a nullifier is already spent
  const checkNullifierSpent = async (nullifierHash: string): Promise<boolean> => {
    try {
      const response = await fetch(`${RELAYER_URL}/api/shielded/pool/${SHIELDED_POOL_ADDRESS}/nullifier/${nullifierHash}`)
      if (!response.ok) return false // If check fails, assume not spent (safer to try)
      const data = await response.json()
      return data.isSpent === true
    } catch (error) {
      console.warn('[Consolidate] Failed to check nullifier status:', error)
      return false // If check fails, assume not spent (safer to try)
    }
  }

  const handleConsolidateAll = async () => {
    if (!wallet?.address) {
      toast({ title: "Wallet Required", description: "Please connect your wallet first", variant: "destructive" })
      return
    }
    if (!relayerInfo?.available) {
      toast({ title: "Relayer Offline", description: "Cannot consolidate while relayer is offline", variant: "destructive" })
      return
    }
    // Get token metadata for validation
    const tokenMeta = getTokenMetadata(selectedToken)
    
    // Only consolidate notes for the selected token
    // Also validate that notes have correct tokenAddress and reasonable amounts
    const freshNotes = getNotes().filter(n => {
      if (n.leafIndex === undefined || n.amount <= 0n) return false
      
      // Check token symbol match
      const noteToken = n.token || 'DOGE'
      if (noteToken !== selectedToken) return false
      
      // For ERC20 tokens, also check tokenAddress matches
      if (selectedToken !== 'DOGE') {
        const noteTokenAddress = n.tokenAddress?.toLowerCase()
        const expectedTokenAddress = tokenMeta.address.toLowerCase()
        if (noteTokenAddress && noteTokenAddress !== expectedTokenAddress) {
          console.warn(`[Consolidate] Note tokenAddress mismatch: ${noteTokenAddress} vs ${expectedTokenAddress}, skipping`)
          return false
        }
      }
      
      return true
    })
    
    // Log all notes found for debugging
    console.log(`[Consolidate] Found ${freshNotes.length} notes for ${selectedToken}:`, 
      freshNotes.map(n => {
        const commitmentStr = typeof n.commitment === 'bigint'
          ? '0x' + n.commitment.toString(16).padStart(64, '0')
          : String(n.commitment)
        const noteDecimals = n.decimals ?? tokenDecimals
        return {
          commitment: commitmentStr.slice(0, 12) + '...',
          amountWei: n.amount.toString(),
          amountHuman: formatUnits(n.amount, noteDecimals),
          token: n.token || 'DOGE',
          tokenAddress: n.tokenAddress || 'N/A',
          decimals: n.decimals ?? 'N/A',
        }
      })
    )
    
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    const worthyNotes = freshNotes.filter(n => {
      const noteDecimals = n.decimals ?? tokenDecimals
      // Validate note amount is reasonable (at least 0.0001 tokens)
      const minReasonableAmount = parseUnits('0.0001', noteDecimals)
      if (n.amount < minReasonableAmount) {
        console.warn(`[Consolidate] Note amount too small (${formatUnits(n.amount, noteDecimals)} ${n.token || 'DOGE'}), skipping`)
        return false
      }
      return n.amount > minFee
    })
    
    console.log(`[Consolidate] After filtering (minFee: ${formatUnits(minFee, tokenDecimals)}), ${worthyNotes.length} notes to consolidate`)
    
    if (worthyNotes.length === 0) {
      toast({ title: "No Notes to Consolidate", description: "All notes are too small (dust)", variant: "destructive" })
      return
    }
    setStatus("consolidating")
    // Start at 0 - shows "Processing note 0 of X" (0 notes completed)
    setConsolidateProgress({ current: 0, total: worthyNotes.length, totalReceived: 0 })
    setConsolidateTxHashes([])
    setErrorMessage(null)
    let totalReceived = 0
    const txHashes: string[] = []
    const skippedNotes: number[] = [] // Track notes that were already spent
    
    for (let i = 0; i < worthyNotes.length; i++) {
      const note = worthyNotes[i]
      let originalNoteIndex: number | undefined = undefined // Declare outside try for catch block access
      
      try {
        const commitmentStr = typeof note.commitment === 'bigint'
          ? '0x' + note.commitment.toString(16).padStart(64, '0')
          : String(note.commitment)
        // Use note's decimals if available, otherwise use tokenDecimals from selectedToken
        const noteDecimals = note.decimals ?? tokenDecimals
        console.log(`[Consolidate] Processing note ${i + 1}/${worthyNotes.length}:`, {
          commitment: commitmentStr.slice(0, 12) + '...',
          amountWei: note.amount.toString(),
          amountHuman: formatUnits(note.amount, noteDecimals),
          token: note.token || 'DOGE',
          tokenAddress: note.tokenAddress || 'N/A',
          noteDecimals: note.decimals ?? 'N/A',
          selectedToken,
          selectedTokenDecimals: tokenDecimals,
        })
        
        // Find the note's index in the ORIGINAL walletState.notes array (not filtered)
        // This is critical: prepareUnshield uses walletState.notes[noteIndex], so we need the original index
        const allNotes = getNotes() // Get all notes (unfiltered)
        originalNoteIndex = allNotes.findIndex(n => n.commitment === note.commitment)
        if (originalNoteIndex === -1) {
          console.warn(`[Consolidate] Note ${i + 1} not found in wallet notes, skipping (may have been removed)`)
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        
        // Verify the note at this index matches what we expect
        const foundNote = allNotes[originalNoteIndex]
        if (foundNote.commitment !== note.commitment || foundNote.amount !== note.amount) {
          console.error(`[Consolidate] Note mismatch at index ${originalNoteIndex}:`, {
            expected: { commitment: note.commitment.toString().slice(0, 20), amount: note.amount.toString() },
            found: { commitment: foundNote.commitment.toString().slice(0, 20), amount: foundNote.amount.toString() },
          })
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        
        // Get token address for consolidation
        const tokenAddress = selectedToken === 'DOGE' 
          ? NATIVE_TOKEN
          : shieldedPool.supportedTokens[selectedToken]?.address
        
        if (!tokenAddress && selectedToken !== 'DOGE') {
          throw new Error(`Token ${selectedToken} not configured`)
        }
        
        // Check if note is already spent BEFORE generating proof
        // noteDecimals is already defined above, use it for fee calculation
        const { fee: relayerFeeWei, error: feeError } = calculateFeeForNote(note.amount)
        
        if (feeError) {
          console.warn(`[Consolidate] Note ${i + 1} too small: ${feeError}`)
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue // Skip this note, continue with others
        }
        
        // Pass fee directly in wei to avoid precision loss during conversion
        // Use originalNoteIndex (index in walletState.notes array, not filtered array)
        const proofResult = await prepareUnshield(wallet.address, originalNoteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, 0, relayerFeeWei)
        
        // Check if nullifier is already spent
        const isSpent = await checkNullifierSpent(proofResult.nullifierHash)
        if (isSpent) {
          console.warn(`[Consolidate] Note ${i + 1} already spent, removing from local state`)
          skippedNotes.push(i + 1)
          // Remove the spent note from local state (use originalNoteIndex)
          completeUnshield(originalNoteIndex)
          // Update progress (note was processed, just skipped)
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: proofResult.proof.proof,
            root: proofResult.root,
            nullifierHash: proofResult.nullifierHash,
            recipient: wallet.address,
            amount: proofResult.amount.toString(),  // Recipient net amount
            fee: relayerFeeWei.toString(),  // Relayer fee
            token: tokenAddress,  // Token address (native = 0x0...0)
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          // Check if error is due to already spent
          if (data.error?.includes('already') || data.error?.includes('spent') || data.message?.includes('already') || data.message?.includes('spent')) {
            console.warn(`[Consolidate] Note ${i + 1} already spent (from relayer), removing from local state`)
            skippedNotes.push(i + 1)
            completeUnshield(originalNoteIndex) // Use originalNoteIndex
            setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
            continue
          }
          throw new Error(data.message || data.error || 'Relayer failed')
        }
        txHashes.push(data.txHash)
        // Convert amountReceived from token base units to human-readable using token decimals
        const receivedAmount = Number(formatUnits(BigInt(data.amountReceived), tokenDecimals))
        totalReceived += receivedAmount
        completeUnshield(originalNoteIndex) // Use originalNoteIndex
        
        console.log(`[Consolidate] Successfully processed note ${i + 1}/${worthyNotes.length}:`, {
          txHash: data.txHash,
          received: receivedAmount,
          totalReceived,
        })
        
        // Add to transaction history
        addTransaction({
          type: 'unshield',
          txHash: data.txHash,
          timestamp: Math.floor(Date.now() / 1000),
          token: selectedToken,
          amount: Number(formatUnits(BigInt(data.amountReceived), tokenDecimals)).toFixed(4),
          amountWei: data.amountReceived,
          recipientPublicAddress: wallet.address,
          relayerFee: Number(formatUnits(relayerFeeWei, tokenDecimals)).toFixed(4),
          status: 'confirmed',
        })
        
        // Update progress AFTER successful processing - shows how many notes completed
        // i + 1 because we just completed note at index i (0-indexed), so we've completed i+1 notes
        setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
        setConsolidateTxHashes([...txHashes])
      } catch (error: any) {
        console.error(`[Consolidate] Error on note ${i + 1}/${worthyNotes.length}:`, error)
        // Check if error is due to already spent
        if (error.message?.includes('already') || error.message?.includes('spent') || error.message?.includes('NullifierAlreadySpent')) {
          console.warn(`[Consolidate] Note ${i + 1} already spent, removing from local state`)
          skippedNotes.push(i + 1)
          // Try to remove the note if we can find it (use originalNoteIndex if available)
          try {
            if (originalNoteIndex !== undefined && originalNoteIndex !== -1) {
              completeUnshield(originalNoteIndex)
            } else {
              // Fallback: find note in full array
              const allNotes = getNotes()
              const foundIndex = allNotes.findIndex(n => n.commitment === note.commitment)
              if (foundIndex !== -1) {
                completeUnshield(foundIndex)
              }
            }
          } catch (e) {
            console.warn('[Consolidate] Could not remove spent note:', e)
          }
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        // For other errors, log but continue processing remaining notes
        console.error(`[Consolidate] Failed to process note ${i + 1}, continuing with remaining notes:`, error.message)
        setErrorMessage(`Failed on note ${i + 1}: ${error.message}. Continuing with remaining notes...`)
        setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
        // Continue to next note instead of stopping
        continue
      }
    }
    
    // Show info about skipped notes if any
    if (skippedNotes.length > 0) {
      console.log(`[Consolidate] Skipped ${skippedNotes.length} already-spent note(s): ${skippedNotes.join(', ')}`)
      toast({
        title: "Note Cleanup",
        description: `Removed ${skippedNotes.length} already-spent note(s) from your wallet. Your balance has been updated.`,
        variant: "default",
      })
    }
    
    // Log final consolidation summary
    console.log(`[Consolidate] Consolidation complete:`, {
      totalNotes: worthyNotes.length,
      processed: txHashes.length,
      skipped: skippedNotes.length,
      totalReceived,
      txHashes,
    })
    
    setConsolidateTotalReceived(totalReceived)
    setWithdrawnAmount(totalReceived.toFixed(4))
      setStatus("confirmed")
      setShowSuccessDialog(true)
      onSuccess?.()
  }
  
  // Execute unshield (internal - called after confirmation)
  const executeUnshield = async () => {
    setErrorMessage(null)
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    if (!recipientAddress || !recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      toast({ title: "Invalid Address", description: "Please enter a valid wallet address", variant: "destructive" })
      return
    }
    const result = findBestNote(requestedWei)
    if (!result) {
      toast({ title: "Insufficient Balance", description: "No single note large enough. Use 'Consolidate All'.", variant: "destructive" })
      return
    }
    const { note: selectedNote, noteIndex: actualNoteIndex } = result
    
    // Check if note is too small to unshield
    const feeCheck = calculateFeeForNote(selectedNote.amount)
    if (feeCheck.error) {
      toast({
        title: "Note Too Small",
        description: feeCheck.error,
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      const { fee: relayerFeeWei } = feeCheck
      // Pass fee directly in wei to avoid precision loss during conversion
      // All tokens on DogeOS testnet use 18 decimals, so this works for all tokens
      const proofResult = await prepareUnshield(recipientAddress, actualNoteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, 0, relayerFeeWei)
      
      // Get token address for the request
      const tokenAddress = selectedToken === 'DOGE' 
        ? NATIVE_TOKEN
        : shieldedPool.supportedTokens[selectedToken]?.address
      
      // Log for debugging
      console.log(`[Unshield] Token selection:`, {
        selectedToken,
        tokenAddress,
        isNative: selectedToken === 'DOGE',
        supportedTokens: Object.keys(shieldedPool.supportedTokens),
        tokenConfig: shieldedPool.supportedTokens[selectedToken],
      })
      
      if (!tokenAddress && selectedToken !== 'DOGE') {
        console.error(`[Unshield] Token ${selectedToken} not found in config:`, shieldedPool.supportedTokens)
        throw new Error(`Token ${selectedToken} not configured`)
      }
      
      // Validate token address format
      if (tokenAddress && !tokenAddress.startsWith('0x')) {
        console.error(`[Unshield] Invalid token address format:`, tokenAddress)
        throw new Error(`Invalid token address format for ${selectedToken}`)
      }
      
      setStatus("relaying")
      
      // Prepare request body - ALWAYS include token parameter
      // This is critical: backend uses token parameter to determine which function to call
      const requestBody = {
        poolAddress: SHIELDED_POOL_ADDRESS,
        proof: proofResult.proof.proof,
        root: proofResult.root,
        nullifierHash: proofResult.nullifierHash,
        recipient: recipientAddress,
        amount: proofResult.amount.toString(),  // Recipient net amount
        fee: relayerFeeWei.toString(),  // Relayer fee
        token: tokenAddress || NATIVE_TOKEN,  // Token address - ALWAYS include (native = 0x0...0)
      }
      
      // Validate token address is set
      if (!requestBody.token) {
        console.error(`[Unshield] CRITICAL: token address is missing!`, {
          selectedToken,
          tokenAddress,
          supportedTokens: Object.keys(shieldedPool.supportedTokens),
        })
        throw new Error(`Token address is missing for ${selectedToken}`)
      }
      
      // Log the exact request being sent - EXPANDED to show full token info
      console.log(`[Unshield] Sending request to relayer:`, {
        poolAddress: requestBody.poolAddress,
        proof: `[${requestBody.proof.length} elements]`, // Don't log full proof
        root: requestBody.root,
        nullifierHash: requestBody.nullifierHash,
        recipient: requestBody.recipient,
        amount: requestBody.amount,
        fee: requestBody.fee,
        token: requestBody.token,  // CRITICAL: This must be the USDC address for USDC unshield
        tokenType: requestBody.token === NATIVE_TOKEN ? 'NATIVE' : 'ERC20',
        selectedToken,
        expectedToken: selectedToken === 'DOGE' ? NATIVE_TOKEN : shieldedPool.supportedTokens[selectedToken]?.address,
      })
      
      // Also log the FULL request body as JSON to verify token is included
      console.log(`[Unshield] FULL REQUEST BODY (JSON):`, JSON.stringify({
        ...requestBody,
        proof: `[${requestBody.proof.length} elements]`, // Don't log full proof array
      }, null, 2))
      
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'Relayer failed')
      setTxHash(data.txHash)
      
      // Convert from token base units to human-readable using token decimals
      const receivedAmount = formatUnits(BigInt(data.amountReceived), tokenDecimals)
      const feeAmount = formatUnits(BigInt(data.fee), tokenDecimals)
      setWithdrawnAmount(Number(receivedAmount).toFixed(4))
      setFee(Number(feeAmount).toFixed(4))
      
      // Complete unshield immediately (removes note from wallet)
      await completeUnshield(actualNoteIndex)
      
      // Trigger balance refresh immediately after note removal
      window.dispatchEvent(new Event('refresh-balance'))
      window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
      
      // Update status to pending (tracker will update to confirmed)
      setStatus("pending")
      
      // Start tracking transaction
      const newTracker = new TransactionTrackerClass(1)
      let isConfirmed = false
      newTracker.onUpdate((trackerState) => {
        console.log('[Unshield] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[Unshield] Transaction confirmed! Setting status and showing dialog')
          // Set status first
          setStatus('confirmed')
          // Add to transaction history
          addTransaction({
            type: 'unshield',
            txHash: data.txHash,
            timestamp: Math.floor(Date.now() / 1000),
            token: selectedToken,
            amount: receivedAmount,
            amountWei: data.amountReceived,
            recipientPublicAddress: wallet.address,
            relayerFee: feeAmount,
            status: 'confirmed',
          })
          // Note: Success dialog will be shown by useEffect when status === "confirmed"
          // Trigger balance refresh immediately and again after delay
          window.dispatchEvent(new Event('refresh-balance'))
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          setTimeout(() => {
            window.dispatchEvent(new Event('refresh-balance'))
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          }, 1000)
        } else if (trackerState.status === 'failed') {
          setStatus('failed')
        } else if (trackerState.status === 'pending') {
          setStatus('pending')
        }
      })
      setTracker(newTracker)
      // Start tracking (non-blocking - callback will handle updates)
      newTracker.track(data.txHash).catch((error) => {
        console.error('[Unshield] Tracker error:', error)
        setStatus('error')
      })
    } catch (error: any) {
      setStatus("error")
      
      // Smart error suggestions
      const errorInfo = formatErrorWithSuggestion(error, {
        operation: 'unshield',
        token: selectedToken,
        hasShieldedBalance: totalBalance > 0n,
      })
      
      setErrorMessage(errorInfo.suggestion ? `${errorInfo.description} ${errorInfo.suggestion}` : errorInfo.description)
      toast({ 
        title: errorInfo.title, 
        description: errorMessage, 
        variant: "destructive" 
      })
    }
  }
  
  const reset = () => {
    setAmount("")
    setRecipientAddress("")
    setStatus("idle")
    setTxHash(null)
    setWithdrawnAmount(null)
    setFee(null)
    setErrorMessage(null)
    setConsolidateProgress(null)
    setConsolidateTxHashes([])
    setShowSuccessDialog(false) // Clear success dialog state
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
  
  const handleSetMax = () => {
    const maxReceivable = calculateMaxUnshieldable()
    if (maxReceivable > 0n) {
      // Convert from token base units to human-readable using token decimals
      const maxAmount = formatUnits(maxReceivable, tokenDecimals)
      // Round DOWN to avoid exceeding the actual receivable amount
      // Parse the string to avoid floating-point precision issues
      const parts = maxAmount.split('.')
      if (parts.length === 1) {
        // No decimal part
        setAmount(parts[0])
      } else {
        // Has decimal part - truncate to tokenDecimals places (no rounding)
        const integerPart = parts[0]
        const decimalPart = parts[1].slice(0, tokenDecimals).padEnd(Math.min(tokenDecimals, parts[1].length), '0')
        // Format with appropriate decimal places (max 8 for display)
        const displayDecimals = Math.min(tokenDecimals, 8)
        const truncatedDecimal = decimalPart.slice(0, displayDecimals)
        setAmount(`${integerPart}.${truncatedDecimal}`)
      }
    }
  }
  
  // Don't return early if we're showing success/confirmed state, success dialog, or have a pending transaction (even if no notes left)
  if (spendableNotes.length === 0 && status !== "success" && status !== "confirmed" && !showSuccessDialog && !txHash) {
    return null
  }
  
  const selectedInfo = getSelectedNoteInfo()
  const needsConsolidation = spendableNotes.length > 1
  
  return (
    <>
      {/* Success Dialog - Render outside main content div so it always shows */}
      {showSuccessDialog && (
        <SuccessDialog
          open={showSuccessDialog}
          onOpenChange={(open) => {
            if (!open) {
              // User is closing the dialog - properly reset state
              setShowSuccessDialog(false)
              reset()
              onSuccess?.()
            }
          }}
          title="Unshield Successful!"
          message={`Successfully unshielded ${withdrawnAmount ? Number(withdrawnAmount).toFixed(4) : (amount ? Number(amount).toFixed(4) : '0')} ${selectedToken} to your public wallet.`}
          onClose={() => {
            setShowSuccessDialog(false)
            reset()
            onSuccess?.()
          }}
          txHash={txHash}
          blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
          actionText="Unshield More"
          onAction={() => {
            setShowSuccessDialog(false)
            reset()
            onSuccess?.()
          }}
          details={
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Unshielded Amount</span>
                <span className="text-green-400 font-semibold">{withdrawnAmount ? Number(withdrawnAmount).toFixed(4) : (amount ? Number(amount).toFixed(4) : '0')} {selectedToken}</span>
              </div>
            </div>
          }
        />
      )}
      
      <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display font-medium">Send to Public Address</h3>
        <p className="text-sm font-body text-muted-foreground">Unshield your shielded {selectedToken} to any public wallet address</p>
      </div>
      
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-medium">Available to Unshield</span>
          </div>
          <div className="text-right">
            {notes.length === 0 && wallet?.isConnected ? (
              <div className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading balance...</span>
              </div>
            ) : (
              <div className="text-xl font-mono font-bold tracking-[-0.01em]">{Number(formatUnits(totalBalance, tokenDecimals)).toFixed(4)} <span className="font-body text-sm text-white/70">{selectedToken}</span></div>
            )}
          </div>
        </div>
        {largestNote && (
          <div className="mt-2 pt-2 border-t border-muted text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Max single unshield: {Number(formatUnits(largestNote.amount, tokenDecimals)).toFixed(4)} {selectedToken}
          </div>
        )}
      </div>
      
      {needsConsolidation && status === "idle" && (
        <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium flex items-center gap-2">
                Consolidate All Notes
                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Recommended</span>
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Unshield all available notes directly to your connected wallet
              </p>
              <div className="mt-2 text-sm">
                {isLoadingRelayerInfo ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Computing notes...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">You'll receive:</span>
                      <span className="font-medium text-green-500">~{Number(formatUnits(totalReceivableAfterFees, tokenDecimals)).toFixed(4)} {selectedToken}</span>
                    </div>
                    {usdValue && (
                      <div className="text-muted-foreground mt-1">
                        {usdValue}
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button 
                className="mt-3 w-full" 
                variant="outline" 
                onClick={handleConsolidateAll} 
                disabled={isLoadingRelayerInfo || !relayerInfo?.available || !wallet?.address}
              >
                {isLoadingRelayerInfo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Computing notes...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Consolidate All to {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'Wallet'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      
      {status === "idle" && (
        <div className="space-y-4">
          {needsConsolidation && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or unshield specific amount</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount to Unshield</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSetMax}>
                Max: {Number(formatUnits(calculateMaxUnshieldable(), tokenDecimals)).toFixed(4)}
              </Button>
            </div>
            <Input id="amount" type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={fillConnectedAddress}>Use my wallet</Button>
            </div>
            <Input id="recipient" placeholder="0x... (any wallet address)" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
            <p className="text-xs text-muted-foreground">You can send unshield to any public wallet address</p>
          </div>
          {amount && relayerInfo && selectedInfo && !('error' in selectedInfo) && (
            <EstimatedFees
              amount={selectedInfo.noteAmount}
              fee={selectedInfo.fee}
              received={BigInt(Math.floor(parseFloat(amount) * (10 ** tokenDecimals)))}
              token={selectedToken}
              tokenDecimals={tokenDecimals}
            />
          )}
          
          {amount && relayerInfo && selectedInfo && 'error' in selectedInfo && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {selectedInfo.error}
              </div>
            </div>
          )}
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-white/10 border border-white/20 hover:border-[#B89A2E]/50 transition-all duration-500 group py-3 sm:py-2"
            onClick={() => {
              if (selectedInfo && !('error' in selectedInfo)) {
                setPendingUnshield(() => executeUnshield)
                setShowConfirmDialog(true)
              }
            }} 
            disabled={!relayerInfo?.available || !selectedInfo || 'error' in selectedInfo}
          >
            {/* Fill animation from left to right - slower and more natural */}
            <span className="absolute inset-0 bg-[#B89A2E] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-[1300ms] ease-in-out" />
            <span className="relative z-10 flex items-center justify-center text-sm sm:text-base text-white group-hover:text-black transition-colors duration-[1300ms] ease-in-out">
              <ShieldOff className="h-4 w-4 mr-2 flex-shrink-0" strokeWidth={1.75} />
              Unshield to Public Wallet
            </span>
          </Button>
          
          {/* Confirmation Dialog */}
          <ConfirmationDialog
            open={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            title="Confirm Unshield"
            description={`You are about to unshield ${amount ? Number(amount).toFixed(4) : '0'} ${selectedToken} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}. A relayer fee will be deducted.`}
            confirmText="Confirm Unshield"
            cancelText="Cancel"
            onConfirm={async () => {
              if (pendingUnshield) {
                await pendingUnshield()
              }
              setPendingUnshield(null)
            }}
            isLoading={status === "proving" || status === "relaying"}
            details={
              selectedInfo && !('error' in selectedInfo) ? (
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-400">Note Amount</span>
                    <span className="text-white text-right break-all">{Number(formatUnits(selectedInfo.noteAmount, tokenDecimals)).toFixed(4)} {selectedToken}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-400">Relayer Fee</span>
                    <span className="text-red-400 text-right break-all">-{Number(formatUnits(selectedInfo.fee, tokenDecimals)).toFixed(4)} {selectedToken}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#C2A633]/10">
                    <span className="text-gray-400">You Receive</span>
                    <span className="text-green-400 font-semibold text-right break-all">{amount ? Number(amount).toFixed(4) : '0'} {selectedToken}</span>
                  </div>
                  {selectedInfo.change > 0n && (
                    <div className="flex justify-between items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                      <span>Change (returned to shielded)</span>
                      <span className="text-right break-all">{Number(formatUnits(selectedInfo.change, tokenDecimals)).toFixed(4)} {selectedToken}</span>
                    </div>
                  )}
                </div>
              ) : undefined
            }
          />
        </div>
      )}
      
      {status === "consolidating" && consolidateProgress && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Layers className="h-8 w-8 text-white/80 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C2A633] flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-black animate-spin" />
                </div>
              </div>
              
              {/* Progress Info */}
              <div className="w-full max-w-xs space-y-3">
                <div className="text-center space-y-2">
                  <h4 className="text-base font-display font-semibold text-white">
                    Consolidating Notes
                  </h4>
                  <p className="text-sm font-body text-white/70">
                    Processing note {consolidateProgress.current} of {consolidateProgress.total}...
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full origin-left transition-transform duration-300"
                    style={{ 
                      width: `${(consolidateProgress.current / consolidateProgress.total) * 100}%`
                    }}
                  />
                </div>
                
                {/* Received Amount */}
                <div className="text-center">
                  <p className="text-sm font-body text-white/60">Received so far:</p>
                  <p className="text-lg font-display font-semibold text-[#C2A633]">
                    {consolidateProgress.totalReceived.toFixed(4)} {selectedToken}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress Indicator - Only show during processing, hide when confirmed/success */}
      {status !== "confirmed" && status !== "success" && (
        <TransactionProgress
          status={status === "idle" ? "idle" : (status === "error" ? "failed" : status)}
          message={
            status === "proving" ? "This may take 10-30 seconds..."
            : status === "relaying" ? "Relayer is submitting your transaction..."
            : status === "pending" ? "Waiting for blockchain confirmation..."
            : status === "consolidating" ? `Consolidating notes (${consolidateProgress?.current || 0}/${consolidateProgress?.total || 0})...`
            : undefined
          }
          txHash={txHash}
          blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        />
      )}
      
      {status === "success" && consolidateTxHashes.length > 0 && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-[#C2A633]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-lg font-display font-semibold text-white mb-2">
                    Consolidation Complete!
                  </h4>
                  <p className="text-sm font-body text-white/70 leading-relaxed">
                    Successfully consolidated {consolidateTxHashes.length} note{consolidateTxHashes.length > 1 ? 's' : ''} and received {consolidateTotalReceived.toFixed(4)} {selectedToken}.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <p className="text-xs font-medium text-white/60">
                    Transaction Links ({consolidateTxHashes.length}):
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {consolidateTxHashes.map((hash, i) => (
                      <a 
                        key={hash} 
                        href={`https://blockscout.testnet.dogeos.com/tx/${hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 text-xs text-[#C2A633] hover:text-[#C2A633]/80 transition-colors group font-medium"
                      >
                        <span className="font-mono">Transaction {i + 1}: {hash.slice(0, 10)}...{hash.slice(-8)}</span>
                        <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-white/5 hover:bg-white/10 text-[#C2A633] border border-[#C2A633]/50 hover:border-[#C2A633] font-body font-medium transition-all" 
            onClick={reset}
          >
            Done
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
                  Unshield Failed
                </p>
                <p className="text-sm text-orange-400/90">
                  {errorMessage || "Unshield failed. Your funds are safe."}
                </p>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={reset}>Try Again</Button>
        </div>
      )}
      </div>
    </>
  )
}
