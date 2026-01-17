"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, LogOut, AlertCircle, Check, Shield, ShieldOff, Info, ExternalLink, CheckCircle2, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { prepareUnshield, prepareBatchUnshield, completeUnshield, completeBatchUnshield, getNotes } from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory, updateTransactionStatus } from "@/lib/shielded/transaction-history"
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
import { syncNotesWithChain } from "@/lib/shielded/shielded-service"
import Link from "next/link"
import { ShieldPlus } from "lucide-react"

const SHIELDED_POOL_ADDRESS = shieldedPool.address
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

// Native token address constant (accessible throughout the module)
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`

// Helper to get token decimals
function getTokenDecimals(tokenSymbol: string): number {
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens]
  return token?.decimals || 18 // Default to 18 if not found
}

// Helper to get token metadata
function getTokenMetadata(tokenSymbol: string): { symbol: string; address: `0x${string}`; decimals: number } {
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
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<TransactionStatus>("idle")
  
  // Real-time address validation for public addresses (0x...)
  const isValidPublicAddress = (addr: string): boolean => {
    if (!addr || addr.trim() === '') return false
    // Must start with 0x and be 42 characters (0x + 40 hex chars)
    return /^0x[a-fA-F0-9]{40}$/.test(addr.trim())
  }
  const isAddressValid = recipientAddress ? isValidPublicAddress(recipientAddress) : null
  const showAddressError = recipientAddress && recipientAddress.trim() !== '' && !isAddressValid
  const [txHash, setTxHash] = useState<string | null>(null)
  const [allTxHashes, setAllTxHashes] = useState<string[]>([]) // Track all transaction hashes for multi-tx unshields
  const [tracker, setTracker] = useState<TransactionTrackerClass | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [pendingUnshield, setPendingUnshield] = useState<() => Promise<void> | null>(null)
  const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null)
  const [fee, setFee] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false) // Prevent duplicate execution
  const isExecutingRef = useRef(false) // Synchronous guard to prevent duplicate submissions
  const [simulationWarning, setSimulationWarning] = useState<{
    show: boolean
    message: string
    errorCode?: string
    suggestion?: string
  } | null>(null)
  const [isSyncingNotes, setIsSyncingNotes] = useState(false)

  // Show success dialog when transaction is confirmed (but only if not already shown and not closed)
  useEffect(() => {
    if (status === "confirmed" && txHash && !showSuccessDialog) {
      // Validate that we have a valid withdrawn amount before showing dialog
      const validAmount = withdrawnAmount && Number(withdrawnAmount) > 0
      if (!validAmount) {
        console.warn('[Unshield] Not showing success dialog: withdrawnAmount is invalid or zero', { withdrawnAmount, status, txHash })
        return
      }
      console.log('[Unshield] useEffect: Status is confirmed, showing success dialog', { withdrawnAmount })
      // Use a small delay to ensure all state updates are processed
      const timer = setTimeout(() => {
        setShowSuccessDialog(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [status, txHash, showSuccessDialog, withdrawnAmount]) // Include withdrawnAmount to validate
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [isLoadingRelayerInfo, setIsLoadingRelayerInfo] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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
    // V3: Return total shielded balance (what user can request to unshield)
    // Fees will be deducted automatically, so user can unshield their full balance
    // This allows custom amount unshield from total balance
    // Consistent with transfer interface - Max shows full balance, fees computed separately
    return totalBalance
  }
  
  // Helper function to get max unshieldable amount (used in error messages)
  const getMaxUnshieldAmount = (): bigint => {
    return totalReceivableAfterFees
  }
  
  // Get the maximum amount that can be safely entered (rounded down to 4 decimals)
  // This ensures when parsed back, it will never exceed totalBalance
  const getMaxAmountSafe = (): string => {
    if (totalBalance === 0n) return "0"
    const maxAmount = formatUnits(totalBalance, tokenDecimals)
    // Round DOWN to 4 decimals to ensure parsed value <= totalBalance
    const rounded = Math.floor(Number(maxAmount) * 10000) / 10000
    return rounded.toFixed(4)
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
  
  // V3: Find optimal note combination for custom amount unshield
  const findOptimalNoteCombination = (requestedAmount: bigint): {
    fullNotes: Array<{ note: ShieldedNote; index: number }>;
    partialNote: { note: ShieldedNote; index: number; unshieldAmount: bigint } | null;
    totalFee: bigint;
    changeAmount: bigint;
    actualRequestedAmount?: bigint; // Adjusted amount if full balance was requested
  } | null => {
    if (!relayerInfo) return null
    
    // Check if requested amount exceeds total balance
    // Allow small tolerance for rounding (0.0001 DOGE)
    const roundingTolerance = parseUnits("0.0001", tokenDecimals)
    if (requestedAmount > totalBalance + roundingTolerance) {
      return null // Will trigger error message in getSelectedNoteInfo
    }
    
    // If requested amount is slightly above totalBalance due to rounding, clamp it to totalBalance
    const clampedRequestedAmount = requestedAmount > totalBalance ? totalBalance : requestedAmount
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    
    // Track if this is a full balance request (needed for tolerance check later)
    // Use tolerance check to account for floating point precision differences
    // If requested amount is within 0.01% of total balance, treat it as full balance request
    const tolerance = totalBalance / 10000n // 0.01% tolerance
    const isFullBalanceRequest = clampedRequestedAmount >= (totalBalance - tolerance) && clampedRequestedAmount <= totalBalance
    
    // If user wants to unshield full balance, we need to account for fees
    // The key insight: when user requests full balance, they want to unshield everything possible
    // So we should set actualRequestedAmount to a value that will be satisfied by the note's net value
    let actualRequestedAmount = clampedRequestedAmount
    if (isFullBalanceRequest) {
      // User wants to unshield full balance - calculate what they can actually receive
      // We'll use the total balance minus the estimated fee as the target
      // This ensures the note's net value will satisfy the request
      let estimatedFee = (clampedRequestedAmount * feePercent) / 10000n
      if (estimatedFee < minFee) estimatedFee = minFee
      actualRequestedAmount = clampedRequestedAmount - estimatedFee
      
      // Ensure it's still positive
      if (actualRequestedAmount <= 0n) {
        return null // Can't unshield - balance too small after fees
      }
      
      // For full balance requests, we want to use the note's net value
      // So set the target to be slightly less than the note's net value to ensure it fits
      // But actually, we should just use the note's net value directly
      // The note selection will use netFromNote, so we need actualRequestedAmount <= netFromNote
      // Since we don't know the note's net value yet, we'll use a conservative estimate
      // and let the note selection handle it
    }
    
    // Get all notes for this token
    const tokenMeta = getTokenMetadata(selectedToken)
    const allNotes = getNotes()
    const candidateNotes = allNotes
      .map((note, idx) => ({ note, index: idx }))
      .filter(({ note }) => {
        if (!note.tokenAddress) {
          return selectedToken === 'DOGE' && (!note.token || note.token === 'DOGE')
        }
        return note.tokenAddress.toLowerCase() === tokenMeta.address.toLowerCase()
      })
      .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n)
      .sort((a, b) => Number(a.note.amount - b.note.amount)) // Smallest first
    
    if (candidateNotes.length === 0) return null
    
    const fullNotes: Array<{ note: ShieldedNote; index: number }> = []
    let remainingAmount = actualRequestedAmount
    let totalFee = 0n
    
    console.log(`[CustomAmount] Finding optimal combination for ${formatUnits(actualRequestedAmount, tokenDecimals)} ${selectedToken}:`, {
      requestedAmountWei: requestedAmount.toString(),
      requestedAmountHuman: formatUnits(requestedAmount, tokenDecimals),
      actualRequestedAmountWei: actualRequestedAmount.toString(),
      actualRequestedAmountHuman: formatUnits(actualRequestedAmount, tokenDecimals),
      isFullBalanceRequest,
      candidateNotesCount: candidateNotes.length,
    })
    
    // Step 1: Use full notes (unshield entire note)
    // IMPORTANT: Limit to 100 full notes to respect contract batch limit
    const MAX_BATCH_NOTES = 100
    
    // First pass: Collect potentially usable notes (including small ones that might work in groups)
    // For batch unshield, we need to estimate the fee per note in a batch
    // The batch fee is calculated as: (totalFee / batchSize) * batchSize, then divided by batchSize
    // So fee per note = (totalFee / batchSize) rounded down, then divided by batchSize
    // This can be higher than individual minFee, so we need to check notes against batch fee per note
    
    // Estimate: if we batch unshield all notes, what would be the fee per note?
    // Total fee for all notes = sum of individual fees (but in batch it's calculated differently)
    // For estimation, use: totalBalance * feePercent / 10000, then divide by estimated batch size
    const estimatedTotalFee = (totalBalance * feePercent) / 10000n
    const estimatedTotalFeeWithMin = estimatedTotalFee > minFee ? estimatedTotalFee : minFee
    // Estimate batch size (will be refined as we select notes, but use conservative estimate)
    const estimatedBatchSize = BigInt(Math.min(candidateNotes.length, 100))
    // In batch, fee is: (totalFee / batchSize) * batchSize (rounded down for divisibility)
    // Then fee per note = adjustedTotalFee / batchSize
    // For estimation, use: totalFee / batchSize (this is the fee per note)
    const estimatedBatchFeePerNote = estimatedTotalFeeWithMin / estimatedBatchSize
    // Use the higher of individual minFee or estimated batch fee per note
    // Add 10% buffer to account for rounding differences
    const effectiveMinFee = estimatedBatchFeePerNote > minFee 
      ? (estimatedBatchFeePerNote * 110n) / 100n  // 10% buffer
      : minFee
    
    const usableNotes: Array<{ note: ShieldedNote; index: number; noteFee: bigint; netFromNote: bigint }> = []
    const dustNotes: Array<{ note: ShieldedNote; index: number; noteFee: bigint }> = []
    
    for (const { note, index } of candidateNotes) {
      // Calculate fee for this note (based on full note amount)
      let noteFee = (note.amount * feePercent) / 10000n
      if (noteFee < minFee) noteFee = minFee
      
      // For batch unshield, check if note can cover the batch fee per note
      // This is critical: in batch, fee per note = totalFee / batchSize, which can be higher than individual minFee
      if (note.amount <= effectiveMinFee) {
        // Note is too small for batch unshield - treat as dust
        dustNotes.push({ note, index, noteFee })
        continue
      }
      
      const netFromNote = note.amount - noteFee
      
      if (netFromNote <= 0n) {
        // Individual dust note - but might be usable in a group
        dustNotes.push({ note, index, noteFee })
      } else {
        // Usable note (can cover batch fee per note)
        usableNotes.push({ note, index, noteFee, netFromNote })
      }
    }
    
    // Sort usable notes by net value (smallest first, to use smaller notes first)
    usableNotes.sort((a, b) => Number(a.netFromNote - b.netFromNote))
    
    // Try to use dust notes as a group if they become profitable together
    // CRITICAL: For batch unshield, we need to check if each dust note can cover the batch fee per note
    // The key insight: feePerProof = totalFee / batchSize, so larger batches = lower per-note fees
    // For full balance requests, we should estimate with dust notes included to get accurate feePerProof
    let dustGroupNetValue = 0n
    if (dustNotes.length > 0 && dustNotes.length <= MAX_BATCH_NOTES) {
      const totalDustValue = dustNotes.reduce((sum, d) => sum + d.note.amount, 0n)
      const totalDustFees = dustNotes.reduce((sum, d) => sum + d.noteFee, 0n)
      dustGroupNetValue = totalDustValue - totalDustFees
      
      // KEY INSIGHT: feePerProof = totalFee / batchSize
      // Larger batches = smaller feePerProof = dust notes might become viable
      // For full balance requests, estimate batch size INCLUDING dust notes + usable notes
      // This gives us the actual (lower) feePerProof that dust notes would pay
      const estimatedUsableNotesToUse = Math.min(usableNotes.length, MAX_BATCH_NOTES - dustNotes.length)
      const estimatedFinalBatchSizeWithDust = BigInt(dustNotes.length + estimatedUsableNotesToUse)
      
      // Estimate total fee based on total balance (matches prepareBatchUnshield)
      const estimatedTotalFeeFromBalance = (totalBalance * feePercent) / 10000n
      const estimatedTotalFeeWithMin = estimatedTotalFeeFromBalance > minFee ? estimatedTotalFeeFromBalance : minFee
      
      // Calculate feePerProof for batch WITH dust notes (this is what dust notes would actually pay)
      const estimatedFeePerProofWithDust = estimatedTotalFeeWithMin / estimatedFinalBatchSizeWithDust
      
      // Add 20% buffer to account for rounding differences
      const estimatedFeePerProofWithDustBuffered = (estimatedFeePerProofWithDust * 120n) / 100n
      
      // Check if ALL dust notes can cover the feePerProof when batched with larger notes
      const allDustNotesCanCoverFeeWithDust = dustNotes.every(d => d.note.amount >= estimatedFeePerProofWithDustBuffered)
      
      // For comparison: what if we DON'T include dust (smaller batch = higher feePerProof)
      const estimatedFinalBatchSizeWithoutDust = BigInt(Math.min(usableNotes.length, MAX_BATCH_NOTES))
      const estimatedFeePerProofWithoutDust = estimatedTotalFeeWithMin / estimatedFinalBatchSizeWithoutDust
      
      // Include dust if:
      // 1. They're profitable as a group, AND
      // 2. Each can cover feePerProof when batched (lower fee due to larger batch), OR
      // 3. For full balance requests, if they're profitable and batch includes larger notes (to reduce fee)
      const shouldIncludeDust = dustGroupNetValue > 0n && (
        allDustNotesCanCoverFeeWithDust || 
        (isFullBalanceRequest && estimatedFinalBatchSizeWithDust > BigInt(dustNotes.length) && 
         estimatedFeePerProofWithDust < estimatedFeePerProofWithoutDust && // Larger batch helps
         allDustNotesCanCoverFeeWithDust) // Still need to cover the lower fee
      )
      
      if (shouldIncludeDust) {
        console.log(`[CustomAmount] Including ${dustNotes.length} dust notes in batch (${dustNotes.length} + ${estimatedUsableNotesToUse} usable = ${estimatedFinalBatchSizeWithDust} total):`, {
          totalValue: formatUnits(totalDustValue, tokenDecimals),
          totalFees: formatUnits(totalDustFees, tokenDecimals),
          netValue: formatUnits(dustGroupNetValue, tokenDecimals),
          feePerProofWithDust: formatUnits(estimatedFeePerProofWithDust, tokenDecimals),
          feePerProofWithDustBuffered: formatUnits(estimatedFeePerProofWithDustBuffered, tokenDecimals),
          feePerProofWithoutDust: formatUnits(estimatedFeePerProofWithoutDust, tokenDecimals),
          note: `Batch size ${estimatedFinalBatchSizeWithDust} reduces feePerProof from ${formatUnits(estimatedFeePerProofWithoutDust, tokenDecimals)} to ${formatUnits(estimatedFeePerProofWithDust, tokenDecimals)}`,
        })
        
        // Add all dust notes to fullNotes as a group (they must be used together)
        // Check if we have room and if the group net value helps satisfy the request
        if (fullNotes.length + dustNotes.length <= MAX_BATCH_NOTES && dustGroupNetValue <= remainingAmount) {
          for (const dust of dustNotes) {
            fullNotes.push({ note: dust.note, index: dust.index })
            totalFee += dust.noteFee
          }
          remainingAmount -= dustGroupNetValue
          console.log(`[CustomAmount] Added ${dustNotes.length} dust notes as a group, remaining: ${formatUnits(remainingAmount, tokenDecimals)}`)
        }
      } else {
        if (dustGroupNetValue <= 0n) {
          console.log(`[CustomAmount] ${dustNotes.length} dust notes together still unprofitable (total: ${formatUnits(totalDustValue, tokenDecimals)}, fees: ${formatUnits(totalDustFees, tokenDecimals)}, net: ${formatUnits(dustGroupNetValue, tokenDecimals)})`)
        } else {
          console.log(`[CustomAmount] ${dustNotes.length} dust notes cannot cover batch fee per note (${formatUnits(estimatedFeePerProofWithDustBuffered, tokenDecimals)}), skipping from batch`)
        }
      }
    }
    
    // Now process usable notes (normal notes with positive net value)
    for (const { note, index, noteFee, netFromNote } of usableNotes) {
      // CRITICAL: Stop if we've already satisfied the request
      if (remainingAmount <= 0n) break
      
      // Contract limit: Cannot batch unshield more than 100 notes
      if (fullNotes.length >= MAX_BATCH_NOTES) {
        // We've reached the limit, use partial unshield for remainder
        break
      }
      
      // If this note's net (after fee) is more than remaining, use it partially
      if (netFromNote > remainingAmount) {
        // This note will be partial - we'll handle it separately
        break
      }
      
      // Check if this note is already in fullNotes (shouldn't happen, but safeguard)
      const alreadyAdded = fullNotes.some(fn => 
        fn.note.commitment === note.commitment || 
        (fn.note.leafIndex !== undefined && note.leafIndex !== undefined && fn.note.leafIndex === note.leafIndex)
      )
      if (alreadyAdded) {
        console.warn(`[CustomAmount] Skipping duplicate note: commitment=${note.commitment.toString(16).slice(0, 16)}..., leafIndex=${note.leafIndex}`)
        continue
      }
      
      // Use this note fully (netFromNote <= remainingAmount, including exact match)
      fullNotes.push({ note, index })
      totalFee += noteFee
      const oldRemaining = remainingAmount
      remainingAmount -= netFromNote // Reduce by net amount after fee
      
      // If we've exactly satisfied the request, we're done
      if (remainingAmount === 0n) {
        break
      }
      
      console.log(`[CustomAmount] Using full note ${fullNotes.length}:`, {
        noteAmount: formatUnits(note.amount, tokenDecimals),
        noteFee: formatUnits(noteFee, tokenDecimals),
        netFromNote: formatUnits(netFromNote, tokenDecimals),
        remainingBefore: formatUnits(oldRemaining, tokenDecimals),
        remainingAfter: formatUnits(remainingAmount, tokenDecimals),
      })
      
      // SAFETY CHECK: Stop immediately if we've overshot (shouldn't happen, but protect against bugs)
      if (remainingAmount < 0n) {
        console.warn(`[CustomAmount] OVERSHOT! remainingAmount became negative: ${remainingAmount.toString()} (${formatUnits(remainingAmount, tokenDecimals)})`)
        // Remove the last note that caused overshoot
        fullNotes.pop()
        totalFee -= noteFee
        remainingAmount = oldRemaining
        break
      }
    }
    
    console.log(`[CustomAmount] After full notes selection:`, {
      fullNotesCount: fullNotes.length,
      remainingAmount: formatUnits(remainingAmount, tokenDecimals),
      totalFeeSoFar: formatUnits(totalFee, tokenDecimals),
    })
    
    // Step 2: Find note for partial unshield (if needed)
    let partialNote: { note: ShieldedNote; index: number; unshieldAmount: bigint } | null = null
    let changeAmount = 0n
    
    if (remainingAmount > 0n) {
      // Find smallest note that can cover remaining amount + fee
      for (const { note, index } of candidateNotes) {
        // Skip if already used as full note
        if (fullNotes.some(fn => fn.index === index)) continue
        
        // CRITICAL: Skip dust notes (notes where amount <= minFee)
        // For partial unshield, we need at least remainingAmount + fee, so check if note can cover that
        let partialFee = (remainingAmount * feePercent) / 10000n
        if (partialFee < minFee) partialFee = minFee
        
        // Skip if note is too small to cover even the minimum fee
        if (note.amount <= minFee) {
          console.log(`[CustomAmount] Skipping dust note for partial: ${formatUnits(note.amount, tokenDecimals)} ${selectedToken} (minFee: ${formatUnits(minFee, tokenDecimals)})`)
          continue
        }
        
        // Check if note can cover remaining amount + fee
        if (note.amount >= remainingAmount + partialFee) {
          partialNote = {
            note,
            index,
            unshieldAmount: remainingAmount, // Unshield this amount
          }
          totalFee += partialFee
          changeAmount = note.amount - remainingAmount - partialFee
          break
        }
      }
      
      // If no note can cover remaining amount, check if it's acceptable for full balance request
      if (!partialNote && remainingAmount > 0n) {
        // For full balance requests, if we've used all available notes and there's a remainder,
        // it means the remainder is unusable dust notes (too small to cover fees)
        // The user will receive the net value from usable notes, which is acceptable
        if (isFullBalanceRequest && fullNotes.length > 0) {
          // For full balance requests, we've used all usable notes
          // The remainder is dust notes that can't be unshielded - this is acceptable
          // User will receive the net value from all usable notes (which is what they can actually unshield)
          console.log(`[CustomAmount] Full balance request: allowing remainder ${formatUnits(remainingAmount, tokenDecimals)} ${selectedToken} (unusable dust notes that can't cover fees)`)
          remainingAmount = 0n // Treat as satisfied - user gets net value from usable notes
        } else {
          return null // Can't satisfy the request
        }
      }
    }
    
    return { fullNotes, partialNote, totalFee, changeAmount, actualRequestedAmount, isFullBalanceRequest }
  }
  
  const getSelectedNoteInfo = () => {
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) return null
    
    // V3: Try optimal note combination (supports custom amount from total balance)
    const combination = findOptimalNoteCombination(requestedWei)
    
    if (!combination) {
      // Fallback to single note check (for backward compatibility)
      const result = findBestNote(requestedWei)
      if (!result) {
        // Show total balance (what user can request), not net after fees
        // Consistent with transfer interface behavior
        return { 
          error: `Insufficient balance. You have ${formatUnits(totalBalance, tokenDecimals)} ${selectedToken} available to unshield.` 
        }
      }
      
      // Single note partial unshield
      const { fee } = calculateFeeForNote(requestedWei)
      if (result.note.amount < requestedWei + fee) {
        return { error: `Note too small. Need ${formatUnits(requestedWei + fee, tokenDecimals)} ${selectedToken} (requested + fee).` }
      }
      
      const changeAmount = result.note.amount - requestedWei - fee
      return {
        note: result.note,
        noteAmount: result.note.amount,
        fee,
        youReceive: requestedWei - fee, // Amount you actually receive (requested - fees)
        requestedAmount: requestedWei,
        changeAmount: changeAmount > 0n ? changeAmount : 0n,
        isSingleNote: true,
      }
    }
    
    // Custom amount using optimal combination
    const { fullNotes, partialNote, totalFee, changeAmount, actualRequestedAmount } = combination
    const totalNotes = fullNotes.length + (partialNote ? 1 : 0)
    
    // For user clarity: show fees as deducted from requested amount
    // If user requested full balance, they'll receive the actualRequestedAmount (already adjusted for fees)
    // Otherwise, they'll receive requested - fees
    const finalYouReceive = actualRequestedAmount !== undefined && requestedWei === totalBalance
      ? actualRequestedAmount  // Full balance: user receives the adjusted amount (already has fees deducted)
      : requestedWei - totalFee  // Partial: show requested - fees
    
    return {
      fullNotes,
      partialNote,
      totalFee,
      youReceive: finalYouReceive,
      requestedAmount: requestedWei, // Keep original requested amount for display
      changeAmount: changeAmount > 0n ? changeAmount : 0n,
      noteCount: totalNotes,
      isCustomAmount: true,
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

  // Batch unshield removed - use custom amount unshield with max instead
  
  // V3: Execute custom amount unshield (mixed batch: full notes + partial note)
  const executeCustomAmountUnshield = async (
    combination: NonNullable<ReturnType<typeof findOptimalNoteCombination>>,
    requestedAmount: bigint
  ) => {
    setStatus("proving")
    setErrorMessage(null)
    
    try {
      const tokenAddress = selectedToken === 'DOGE' 
        ? NATIVE_TOKEN
        : shieldedPool.supportedTokens[selectedToken]?.address
      
      if (!tokenAddress && selectedToken !== 'DOGE') {
        throw new Error(`Token ${selectedToken} not configured`)
      }
      
      const txHashes: string[] = [] // Track all transaction hashes
      let totalReceived = 0n
      
      // Step 1: Batch unshield full notes (if any)
      if (combination.fullNotes.length > 0) {
        // Deduplicate notes by commitment/leafIndex to prevent using same note twice
        const uniqueFullNotes = combination.fullNotes.filter((fn, idx, arr) => 
          arr.findIndex(n => n.note.commitment === fn.note.commitment || 
                            (n.note.leafIndex !== undefined && fn.note.leafIndex !== undefined && 
                             n.note.leafIndex === fn.note.leafIndex)) === idx
        )
        
        if (uniqueFullNotes.length !== combination.fullNotes.length) {
          console.warn(`[CustomAmount] Filtered out ${combination.fullNotes.length - uniqueFullNotes.length} duplicate note(s) from batch`)
        }
        
        const fullNoteIndices = uniqueFullNotes.map(fn => fn.index)
        
        // Calculate fee for full notes (total fee minus partial fee)
        const partialFee = combination.partialNote 
          ? calculateFeeForNote(combination.partialNote.unshieldAmount).fee 
          : 0n
        const fullNotesFee = combination.totalFee - partialFee
        
        console.log(`[CustomAmount] Batch unshielding ${combination.fullNotes.length} full notes...`)
        const batchResult = await prepareBatchUnshield(
          recipientAddress,
          fullNoteIndices,
          SHIELDED_POOL_ADDRESS,
          relayerInfo?.address || undefined,
          Number(formatUnits(fullNotesFee, tokenDecimals))
        )
        
        // CRITICAL: Use batchResult.totalFee (adjusted to be divisible by batch size) instead of fullNotesFee
        // prepareBatchUnshield adjusts the fee to be evenly divisible by batch size (contract requirement)
        const adjustedBatchFee = batchResult.totalFee
        
        console.log(`[CustomAmount] Fee adjustment:`, {
          originalFullNotesFee: fullNotesFee.toString(),
          adjustedBatchFee: adjustedBatchFee.toString(),
          batchSize: combination.fullNotes.length,
          difference: (fullNotesFee - adjustedBatchFee).toString(),
        })
        
        // Submit batch
        const batchResponse = await fetch(`${RELAYER_URL}/api/shielded/relay/batch-unshield`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: SHIELDED_POOL_ADDRESS,
            proofs: batchResult.proofs.map(p => p.proof),
            roots: batchResult.roots,
            nullifierHashes: batchResult.nullifierHashes,
            recipient: recipientAddress,
            token: tokenAddress || NATIVE_TOKEN,
            amounts: batchResult.amounts.map(a => a.toString()),
            changeCommitments: batchResult.changeCommitments,
            totalFee: adjustedBatchFee.toString(), // Use adjusted fee from prepareBatchUnshield
            publicInputs: batchResult.proofs.map(p => p.publicInputs), // For debugging
          }),
        })
        
        const batchData = await batchResponse.json()
        if (!batchData.success || !batchData.txHash) {
          // Use backend's error message and suggestion if available
          const errorMsg = batchData.error || batchData.message || 'Batch unshield failed'
          const suggestion = batchData.suggestion || 'Please try again or contact support if the issue persists.'
          const fullError = suggestion ? `${errorMsg}\n\n${suggestion}` : errorMsg
          throw new Error(fullError)
        }
        
        txHashes.push(batchData.txHash) // Track batch transaction hash
        // batchResult.totalAmount is already net (after fees deducted)
        console.log(`[CustomAmount] Batch unshield completed:`, {
          batchTxHash: batchData.txHash,
          batchTotalAmountWei: batchResult.totalAmount.toString(),
          batchTotalAmountHuman: Number(formatUnits(batchResult.totalAmount, tokenDecimals)).toFixed(4),
          totalReceivedBefore: totalReceived.toString(),
        })
        totalReceived += batchResult.totalAmount
        console.log(`[CustomAmount] totalReceived after batch:`, {
          totalReceivedWei: totalReceived.toString(),
          totalReceivedHuman: Number(formatUnits(totalReceived, tokenDecimals)).toFixed(4),
        })
        
        // Remove full notes
        await completeBatchUnshield(fullNoteIndices)
      }
      
      // Step 2: Partial unshield remaining note (if any)
      if (combination.partialNote) {
        console.log(`[CustomAmount] Partially unshielding ${formatUnits(combination.partialNote.unshieldAmount, tokenDecimals)} ${selectedToken}...`)
        
        // CRITICAL: After batch unshield, notes were removed, so indices changed
        // Find the partial note again by commitment/leafIndex (not by stale index)
        const partialNoteCommitment = combination.partialNote.note.commitment
        const partialNoteLeafIndex = combination.partialNote.note.leafIndex
        
        // Refresh notes and find the partial note by its unique identifier
        const currentNotes = getNotes()
        const partialNoteIndex = currentNotes.findIndex(note => 
          note.commitment === partialNoteCommitment && 
          note.leafIndex === partialNoteLeafIndex
        )
        
        if (partialNoteIndex === -1) {
          throw new Error('Partial note not found after batch unshield. It may have been spent.')
        }
        
        const partialFee = calculateFeeForNote(combination.partialNote.unshieldAmount).fee
        
        const proofResult = await prepareUnshield(
          recipientAddress,
          partialNoteIndex, // Use the refreshed index
          combination.partialNote.unshieldAmount,
          SHIELDED_POOL_ADDRESS,
          relayerInfo?.address || undefined,
          0,
          partialFee
        )
        
        // Submit partial unshield
        const partialResponse = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: proofResult.proof.proof,
            root: proofResult.root,
            nullifierHash: proofResult.nullifierHash,
            recipient: recipientAddress,
            amount: proofResult.amount.toString(),
            changeCommitment: proofResult.changeCommitment || '0x0000000000000000000000000000000000000000000000000000000000000000',
            fee: partialFee.toString(),
            token: tokenAddress || NATIVE_TOKEN,
          }),
        })
        
        const partialData = await partialResponse.json()
        if (!partialData.success || !partialData.txHash) {
          throw new Error(partialData.error || 'Partial unshield failed')
        }
        
        txHashes.push(partialData.txHash) // Track partial transaction hash
        // proofResult.amount is the actual amount received (requested - fees)
        console.log(`[CustomAmount] Partial unshield completed:`, {
          partialTxHash: partialData.txHash,
          proofResultAmountWei: proofResult.amount.toString(),
          proofResultAmountHuman: Number(formatUnits(proofResult.amount, tokenDecimals)).toFixed(4),
          requestedUnshieldAmountWei: combination.partialNote.unshieldAmount.toString(),
          requestedUnshieldAmountHuman: Number(formatUnits(combination.partialNote.unshieldAmount, tokenDecimals)).toFixed(4),
          totalReceivedBefore: totalReceived.toString(),
        })
        totalReceived += proofResult.amount
        console.log(`[CustomAmount] totalReceived after partial:`, {
          totalReceivedWei: totalReceived.toString(),
          totalReceivedHuman: Number(formatUnits(totalReceived, tokenDecimals)).toFixed(4),
        })
        
        // Complete partial unshield (removes note, adds change note)
        // Use the refreshed index (or find by note object for robustness)
        await completeUnshield(
          partialNoteIndex, // Use the refreshed index
          proofResult.changeNote || null,
          partialData.changeLeafIndex,
          proofResult.nullifierHash,
          SHIELDED_POOL_ADDRESS
        )
      }
      
      // Phase 2: Completion Acknowledge (300-600ms)
      // This gives the user a sense of closure before showing success
      setStatus("completing")
      
      // Use the last transaction hash for backward compatibility (single txHash state)
      // But also pass txHashes array to SuccessDialog to show all transactions
      const finalTxHash = txHashes[txHashes.length - 1] || ''
      setTxHash(finalTxHash)
      // IMPORTANT: Use actual totalReceived (sum of batchResult.totalAmount + proofResult.amount)
      // NOT requestedAmount, because actual received may differ due to fee adjustments or note filtering
      const actualReceived = Number(formatUnits(totalReceived, tokenDecimals))
      console.log(`[CustomAmount] Setting withdrawnAmount:`, {
        totalReceivedWei: totalReceived.toString(),
        totalReceivedHuman: actualReceived.toFixed(4),
        requestedAmountWei: requestedAmount.toString(),
        requestedAmountHuman: Number(formatUnits(requestedAmount, tokenDecimals)).toFixed(4),
        fullNotesCount: combination.fullNotes.length,
        hasPartialNote: !!combination.partialNote,
        totalFee: Number(formatUnits(combination.totalFee, tokenDecimals)).toFixed(4),
        txHashes: txHashes,
        txHashesCount: txHashes.length,
      })
      setWithdrawnAmount(actualReceived.toFixed(4))
      setFee(Number(formatUnits(combination.totalFee, tokenDecimals)).toFixed(4))
      // Store all transaction hashes for SuccessDialog
      setAllTxHashes(txHashes)
      
      // Phase 3: Show success dialog after brief completion acknowledgment
      // Hold duration: 400ms for completion phase + 500ms pause = 900ms total
      setTimeout(() => {
        // Pause on completion for 500ms before transitioning to success
        setTimeout(() => {
          setStatus("confirmed")
          // Small delay before showing dialog to allow fade-out of progress indicator
          setTimeout(() => {
            setShowSuccessDialog(true)
          }, 150) // Fade-out duration (150ms)
        }, 500) // Pause on completion (500ms)
      }, 400) // Completion phase duration (400ms)
      
      // OPTIMISTIC UPDATE: Shielded balance updates immediately (notes removed from local storage)
      // This provides instant feedback for better UX
      window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
      
      // NOTE: Public balance refresh happens AFTER confirmation (when transaction is mined)
      // We don't refresh here because transaction isn't mined yet
      
      // Add to transaction history
      addTransaction({
        type: 'unshield',
        txHash: finalTxHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: selectedToken,
        amount: Number(formatUnits(totalReceived, tokenDecimals)).toFixed(4),
        amountWei: totalReceived.toString(),
        recipientPublicAddress: recipientAddress,
        relayerFee: Number(formatUnits(combination.totalFee, tokenDecimals)).toFixed(4),
        status: 'confirmed',
      })
      
    } catch (error: any) {
      console.error('[CustomAmount] Unshield failed:', error)
      setErrorMessage(error.message || 'Failed to unshield')
      setStatus("error")
      toast({
        title: "Unshield Failed",
        description: error.message || 'Failed to unshield. Please try again.',
        variant: "destructive",
      })
    }
  }
  
  // Execute unshield (internal - called after confirmation)
  const executeUnshield = async () => {
    setErrorMessage(null)
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    // Validate recipient address (use the same validation function)
    if (!isValidPublicAddress(recipientAddress)) {
      toast({ title: "Invalid Address", description: "Please enter a valid wallet address", variant: "destructive" })
      return
    }
    
    // V3: Try optimal note combination first (supports custom amount from total balance)
    const combination = findOptimalNoteCombination(requestedWei)
    
    if (combination && (combination.fullNotes.length > 0 || combination.partialNote)) {
      // Custom amount unshield using optimal combination (mixed batch)
      await executeCustomAmountUnshield(combination, requestedWei)
      return
    }
    
    // Fallback to single note unshield
    const result = findBestNote(requestedWei)
    if (!result) {
      const totalBalance = totalReceivableAfterFees
      toast({ 
        title: "Insufficient Balance", 
        description: `You have ${formatUnits(totalBalance, tokenDecimals)} ${selectedToken} available. Enter the max amount to unshield everything.`, 
        variant: "destructive" 
      })
      return
    }
    const { note: selectedNote, noteIndex: actualNoteIndex } = result
    
    // Calculate fee based on requested amount (not note amount) for partial unshield
    const { fee: relayerFeeWei } = calculateFeeForNote(requestedWei)
    
    // Check if note can cover requested amount + fee
    if (selectedNote.amount < requestedWei + relayerFeeWei) {
      toast({
        title: "Insufficient Funds",
        description: `Note has ${formatWeiToAmount(selectedNote.amount)} ${selectedToken}, but need ${formatWeiToAmount(requestedWei + relayerFeeWei)} ${selectedToken} (requested + fee)`,
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      // V3: Pass requestedAmount as 3rd parameter for partial unshield support
      const proofResult = await prepareUnshield(recipientAddress, actualNoteIndex, requestedWei, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, 0, relayerFeeWei)
      
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
      
      // 🆕 Simulate transaction before submitting to relayer
      try {
        console.log('[Unshield] Simulating transaction before submission...')
        const simResponse = await fetch(`${RELAYER_URL}/api/shielded/relay/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'unshield',
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: proofResult.proof.proof,
            root: proofResult.root,
            nullifierHash: proofResult.nullifierHash,
            recipient: recipientAddress,
            amount: proofResult.amount.toString(),
            fee: relayerFeeWei.toString(),
            token: tokenAddress || NATIVE_TOKEN,
          }),
        })
        
        const simResult = await simResponse.json()
        
        // If simulation fails, show warning and stop
        if (!simResult.wouldPass) {
          console.warn('[Unshield] Simulation failed:', simResult)
          setSimulationWarning({
            show: true,
            message: simResult.error || 'Transaction validation failed',
            errorCode: simResult.errorCode,
            suggestion: simResult.suggestion,
          })
          setStatus("idle")
          return // Don't submit to relayer
        }
        
        // ✅ If simulation passes, clear any previous warning (silent success)
        setSimulationWarning(null)
        console.log('[Unshield] Simulation passed, proceeding with submission')
      } catch (simError: any) {
        // Don't block on simulation errors, just log and continue
        console.warn('[Unshield] Simulation check failed, continuing anyway:', simError)
      }
      
      setStatus("relaying")
      
      // Prepare request body - V3: Include changeCommitment for partial unshield
      const requestBody = {
        poolAddress: SHIELDED_POOL_ADDRESS,
        proof: proofResult.proof.proof,
        root: proofResult.root,
        nullifierHash: proofResult.nullifierHash,
        recipient: recipientAddress,
        amount: proofResult.amount.toString(),  // Recipient net amount
        changeCommitment: proofResult.changeCommitment || '0x0000000000000000000000000000000000000000000000000000000000000000',  // V3: Change commitment
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
      
      // Validate response data
      if (!data.amountReceived || BigInt(data.amountReceived) <= 0n) {
        console.error('[Unshield] Invalid amountReceived from relayer:', data.amountReceived)
        throw new Error('Invalid response from relayer: amountReceived is zero or missing')
      }
      
      setTxHash(data.txHash)
      
      // Convert from token base units to human-readable using token decimals
      const receivedAmount = formatUnits(BigInt(data.amountReceived), tokenDecimals)
      const feeAmount = formatUnits(BigInt(data.fee || 0), tokenDecimals)
      const withdrawnAmountStr = Number(receivedAmount).toFixed(4)
      setWithdrawnAmount(withdrawnAmountStr)
      setFee(Number(feeAmount).toFixed(4))
      
      // Validate withdrawn amount is greater than 0
      if (Number(withdrawnAmountStr) <= 0) {
        console.error('[Unshield] Withdrawn amount is zero or negative:', withdrawnAmountStr)
        throw new Error('Cannot unshield: amount received would be zero')
      }
      
      // V3: Complete unshield - pass changeNote (without leafIndex for now, will update after confirmation)
      // Note: changeLeafIndex will be extracted from backend response (which reads it from transaction events)
      await completeUnshield(actualNoteIndex, proofResult.changeNote || null, data.changeLeafIndex, proofResult.nullifierHash, SHIELDED_POOL_ADDRESS)
      
      // OPTIMISTIC UPDATE: Shielded balance updates immediately (note removed from local storage)
      // This provides instant feedback for better UX
      window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
      
      // NOTE: Public balance refresh happens AFTER confirmation (in tracker callback)
      // We don't refresh here because transaction isn't mined yet
      
      // Update status to pending (tracker will update to confirmed)
      setStatus("pending")
      
      // Start tracking transaction
      const newTracker = new TransactionTrackerClass(1)
      let isConfirmed = false
      newTracker.onUpdate(async (trackerState) => {
        console.log('[Unshield] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[Unshield] Transaction confirmed! Setting status and showing dialog')
          // Phase 2: Completion Acknowledge (300-600ms)
          setStatus('completing')
          
          // V3: Update change note's leaf index if we have it and change note exists
          if (proofResult.changeNote && data.changeLeafIndex !== undefined) {
            try {
              const { getNotes } = await import('@/lib/shielded/shielded-service');
              const notes = getNotes();
              const changeNote = notes.find(n => 
                n.commitment === proofResult.changeNote!.commitment && 
                n.ownerPubkey === proofResult.changeNote!.ownerPubkey
              );
              if (changeNote && changeNote.leafIndex === undefined) {
                changeNote.leafIndex = data.changeLeafIndex;
                const { saveNotesToStorage } = await import('@/lib/shielded/shielded-service');
                await saveNotesToStorage(notes);
                console.log(`[Unshield] Updated change note leaf index to ${data.changeLeafIndex}`);
              }
            } catch (updateError) {
              console.warn('[Unshield] Failed to update change note leaf index:', updateError);
            }
          }
          // Add to transaction history
          addTransaction({
            type: 'unshield',
            txHash: data.txHash,
            timestamp: Math.floor(Date.now() / 1000),
            token: selectedToken,
            amount: Number(receivedAmount).toFixed(4), // Format to 4 decimals
            amountWei: data.amountReceived,
            recipientPublicAddress: wallet.address,
            relayerFee: feeAmount,
            status: 'confirmed',
          })
          // Phase 3: Show success dialog after brief completion acknowledgment
          // Hold duration: 400ms for completion phase + 500ms pause = 900ms total
          setTimeout(() => {
            // Pause on completion for 500ms before transitioning to success
            setTimeout(() => {
              setStatus('confirmed')
              // Note: Success dialog will be shown by useEffect when status === "confirmed"
              // Small delay before showing dialog to allow fade-out of progress indicator
            }, 500) // Pause on completion (500ms)
          }, 400) // Completion phase duration (400ms)
          
          // AFTER CONFIRMATION: Refresh public balance (transaction is now mined)
          // This is when the public balance actually changes on-chain
          window.dispatchEvent(new Event('refresh-balance'))
          if (wallet?.refreshBalance) {
            wallet.refreshBalance().catch(err => console.warn('[Unshield] Failed to refresh public balance:', err))
          }
          
          // AFTER CONFIRMATION: Sync shielded notes with chain (ensures accuracy)
          // This catches any discrepancies from optimistic updates
          try {
            await syncNotesWithChain(SHIELDED_POOL_ADDRESS)
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          } catch (syncError) {
            console.warn('[Unshield] Failed to sync notes after confirmation:', syncError)
          }
          
          // Additional refresh after short delay as backup
          setTimeout(() => {
            window.dispatchEvent(new Event('refresh-balance'))
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
            if (wallet?.refreshBalance) {
              wallet.refreshBalance().catch(err => console.warn('[Unshield] Failed to refresh public balance (backup):', err))
            }
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
    setAllTxHashes([]) // Reset all transaction hashes
    setWithdrawnAmount(null)
    setFee(null)
    setErrorMessage(null)
    setIsExecuting(false)
    setShowSuccessDialog(false) // Clear success dialog state
    // Ensure balances are refreshed when dialog closes
    window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
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
      // Format to 4 decimal places to exactly match "Max: 6.0030" display format
      const formatted = Number(maxAmount).toFixed(4)
      setAmount(formatted)
    }
  }
  
  // Don't return early if we're showing success/confirmed state, success dialog, or have a pending transaction (even if no notes left)
  if (spendableNotes.length === 0 && status !== "success" && status !== "confirmed" && !showSuccessDialog && !txHash) {
    return null
  }
  
  const selectedInfo = getSelectedNoteInfo()
  
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
          title="Unshield Complete"
          message="Assets have been released from the shielded balance."
          onClose={() => {
            setShowSuccessDialog(false)
            reset()
            onSuccess?.()
          }}
          txHash={allTxHashes.length === 0 ? txHash : null} // Use txHash only if no txHashes array
          txHashes={allTxHashes.length > 0 ? allTxHashes : undefined} // Pass txHashes if multiple transactions
          blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
          actionText="Unshield More"
          onAction={() => {
            setShowSuccessDialog(false)
            reset()
            onSuccess?.()
          }}
          details={
            <div className="space-y-2.5 text-sm">
              <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-semibold">{withdrawnAmount && Number(withdrawnAmount) > 0 ? Number(withdrawnAmount).toFixed(4) : '0.0000'} {selectedToken}</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
                <span className="text-gray-400">Destination</span>
                <span className="text-white font-mono text-xs">{recipientAddress.slice(0, 8)}…{recipientAddress.slice(-6)}</span>
              </div>
            </div>
          }
        />
      )}
      
      <div className="space-y-4">
      {status === "idle" && (
        <div className="space-y-4">
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
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount Unshield</Label>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSetMax}>
                  Max: {getMaxAmountSafe()}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Unshield any amount from your total shielded balance</p>
            </div>
            <Input id="amount" type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={fillConnectedAddress}>Use my wallet</Button>
            </div>
            <div className="relative">
              <style dangerouslySetInnerHTML={{__html: `
                #unshield-recipient {
                  background-color: transparent !important;
                  background: transparent !important;
                }
                #unshield-recipient:-webkit-autofill,
                #unshield-recipient:-webkit-autofill:hover,
                #unshield-recipient:-webkit-autofill:focus,
                #unshield-recipient:-webkit-autofill:active {
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
                  id="unshield-recipient"
                  type="text"
                  placeholder="0x... (any wallet address)"
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
              <p className="text-xs text-muted-foreground mt-1.5">You can send unshield to any public wallet address</p>
              {showAddressError && (
                <p className="text-xs text-red-400 mt-1.5">
                  Invalid address. Must start with '0x' followed by 40 hexadecimal characters.
                </p>
              )}
            </div>
          </div>
          {amount && relayerInfo && selectedInfo && !('error' in selectedInfo) && (
            <EstimatedFees
              amount={BigInt(Math.floor(parseFloat(amount) * (10 ** tokenDecimals)))}
              fee={selectedInfo.isCustomAmount ? (selectedInfo.totalFee || 0n) : (selectedInfo.fee || 0n)}
              received={selectedInfo.youReceive}
              token={selectedToken}
              tokenDecimals={tokenDecimals}
            />
          )}
          
          {amount && relayerInfo && selectedInfo && 'error' in selectedInfo && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="text-sm text-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                {selectedInfo.error}
              </div>
            </div>
          )}
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-zinc-900/70 border border-zinc-700/80 hover:border-[#C2A633]/50 transition-all duration-300 group py-3 sm:py-2 backdrop-blur-sm"
            onClick={() => {
              if (selectedInfo && !('error' in selectedInfo)) {
                setSimulationWarning(null) // Clear any previous warnings
                setPendingUnshield(() => executeUnshield)
                setShowConfirmDialog(true)
              }
            }} 
            disabled={!relayerInfo?.available || !selectedInfo || 'error' in selectedInfo || totalBalance === 0n || !isAddressValid}
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
              <ShieldOff className="h-4 w-4 mr-2 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.05]" strokeWidth={1.75} />
              Unshield to Public Wallet
            </span>
          </Button>
          
          {/* Confirmation Dialog */}
          <ConfirmationDialog
            open={showConfirmDialog}
            onOpenChange={(open) => {
              setShowConfirmDialog(open)
            }}
            title="Confirm Unshield"
            description={`You're about to unshield your ${selectedToken}. Please check the details below before confirming to unshield.`}
            confirmText="Confirm Unshield"
            cancelText="Cancel"
            onConfirm={async () => {
              // BULLETPROOF: Multiple guards to prevent duplicate execution
              if (isExecuting || !pendingUnshield) {
                console.warn('[Consolidate] Confirmation blocked: isExecuting=', isExecuting, 'pendingUnshield=', !!pendingUnshield)
                return
              }
              
              // Set executing IMMEDIATELY to prevent any other calls
              setIsExecuting(true)
              
              // Capture the pending function and clear it immediately to prevent reuse
              const executeFn = pendingUnshield
              setPendingUnshield(null)
              setShowConfirmDialog(false)
              
              try {
                await executeFn()
              } catch (error: any) {
                console.error('[Unshield] Execution error:', error)
              } finally {
                isExecutingRef.current = false
                setIsExecuting(false)
              }
            }}
            isLoading={status === "proving" || status === "relaying"}
            details={
              selectedInfo && !('error' in selectedInfo) ? (
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-400">Recipient Address</span>
                    <span className="text-white text-right break-all font-mono">{recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-400">Amount to Unshield</span>
                    <span className="text-white text-right break-all">{amount ? Number(amount).toFixed(4) : '0.0000'} {selectedToken}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-400">Relayer Fee</span>
                    <span className="text-red-400 text-right break-all">-{Number(formatUnits(selectedInfo.isCustomAmount ? (selectedInfo.totalFee || 0n) : (selectedInfo.fee || 0n), tokenDecimals)).toFixed(4)} {selectedToken}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#C2A633]/10">
                    <span className="text-gray-400">Total Receive</span>
                    <span className="text-green-400 font-semibold text-right break-all">{Number(formatUnits(selectedInfo.youReceive, tokenDecimals)).toFixed(4)} {selectedToken}</span>
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
      )}
      
      {/* Progress Indicator - Show during processing and completion phase */}
      {(status === "proving" || status === "relaying" || status === "pending" || status === "completing") && (
        <div className={cn(
          "transition-opacity duration-150",
          status === "confirmed" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <TransactionProgress
            status={status === "idle" ? "idle" : (status === "error" ? "failed" : status)}
            provingText="Generating unshield proof"
            message={
              status === "proving" ? "This typically takes a few seconds."
              : status === "relaying" ? "Relayer is submitting your transaction..."
              : status === "pending" ? "Waiting for blockchain confirmation..."
              : undefined
            }
            txHash={status === "completing" ? null : txHash} // Hide txHash during completing phase
            blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
          />
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
