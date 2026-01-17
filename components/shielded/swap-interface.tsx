"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Loader2, ArrowDownUp, AlertCircle, Check, RefreshCw, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount, parseAmountToWei } from "@/lib/shielded/shielded-note"
import { 
  getSwapQuote, 
  prepareShieldedSwap,
  prepareSequentialSwaps,
  getShieldedBalances,
  getNotesForToken, filterValidNotes,
  formatSwapDetails,
  checkSwapLiquidity,
  SWAP_TOKENS,
  addSwapToken,
  removeSwapToken,
  loadSwapTokensFromStorage,
  type SwapToken,
  type SwapQuote,
} from "@/lib/shielded/shielded-swap-service"
import { getIdentity, getNotes, completeUnshield, completeSwap } from "@/lib/shielded/shielded-service"
import { addTransaction } from "@/lib/shielded/transaction-history"
import { shieldedPool, dogeosTestnet } from "@/lib/dogeos-config"
import { useWallet } from "@/lib/wallet-context"
import { TransactionProgress, type TransactionStatus } from "@/components/shielded/transaction-progress"
import { TransactionTrackerClass } from "@/lib/shielded/transaction-tracker"
import { EstimatedFees } from "@/components/shielded/estimated-fees"
import { ConfirmationDialog } from "@/components/shielded/confirmation-dialog"
import { SuccessDialog } from "@/components/shielded/success-dialog"
import { formatErrorWithSuggestion } from "@/lib/shielded/error-suggestions"
import { syncNotesWithChain } from "@/lib/shielded/shielded-service"
import { ShieldProgressBar } from "@/components/shielded/shield-progress-bar"
import { cn } from "@/lib/utils"

// Use local backend for development, production URL for deployed
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://dogenadocash.onrender.com')

// Native token address constant - must match contract's NATIVE_TOKEN constant
// V4 Contract uses address(0) (zero address) for native DOGE
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`

// Token logos for swap interface
const TOKEN_LOGOS: Record<string, string> = {
  DOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  WETH: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
}

interface SwapInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
  onReset?: () => void
  onInputTokenChange?: (token: string) => void
}

export function SwapInterface({ notes, onSuccess, onReset, onInputTokenChange }: SwapInterfaceProps) {
  const { toast } = useToast()
  const { wallet } = useWallet()
  const router = useRouter()
  
  // Load swap tokens from storage on mount
  useEffect(() => {
    loadSwapTokensFromStorage()
    
    // Listen for swap tokens updates
    const handleSwapTokensUpdate = () => {
      // Force re-render by updating state
      setInputToken(prev => prev)
      setOutputToken(prev => prev)
    }
    
    window.addEventListener('swap-tokens-updated', handleSwapTokensUpdate)
    return () => {
      window.removeEventListener('swap-tokens-updated', handleSwapTokensUpdate)
    }
  }, [])
  
  const [inputToken, setInputToken] = useState<SwapToken>("DOGE")
  
  // Notify parent when input token changes
  const handleInputTokenChange = (token: SwapToken) => {
    setInputToken(token)
    onInputTokenChange?.(token)
  }
  const [outputToken, setOutputToken] = useState<SwapToken>("USDC")
  const [inputAmount, setInputAmount] = useState("")
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isCheckingLiquidity, setIsCheckingLiquidity] = useState(false)
  const [status, setStatus] = useState<TransactionStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [tracker, setTracker] = useState<TransactionTrackerClass | null>(null)
  const [trackerStatus, setTrackerStatus] = useState<TransactionStatus>("idle")
  const [liquidityCheck, setLiquidityCheck] = useState<{
    hasLiquidity: boolean;
    availableBalance: bigint;
    requiredAmount: bigint;
  } | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [pendingSwap, setPendingSwap] = useState<() => Promise<void> | null>(null)
  const [simulationWarning, setSimulationWarning] = useState<{
    show: boolean
    message: string
    errorCode?: string
    suggestion?: string
  } | null>(null)
  const [isSyncingNotes, setIsSyncingNotes] = useState(false)
  const [swapResult, setSwapResult] = useState<{
    inputAmount: string
    inputToken: SwapToken
    outputAmount: string
    outputToken: SwapToken
  } | null>(null)
  const [sequentialSwapProgress, setSequentialSwapProgress] = useState<{
    current: number
    total: number
    amount: number
    stage: 'preparing' | 'generating' | 'submitting' | 'confirming' | 'complete' | 'finalized'
    txHash?: string
  } | null>(null)
  const [sequentialSwapTxHashes, setSequentialSwapTxHashes] = useState<string[]>([])
  const [showProgressGlow, setShowProgressGlow] = useState(false)
  const [iconPulseKey, setIconPulseKey] = useState(0)
  
  // Get balances
  const balances = getShieldedBalances(notes)
  const inputBalance = balances[inputToken] || 0n
  
  // Calculate largest single note (for Max button display and capping)
  const [largestNoteAmount, setLargestNoteAmount] = useState<bigint>(0n)
  
  useEffect(() => {
    const updateLargestNote = async () => {
      try {
        const identity = getIdentity()
        const validNotes = await filterValidNotes(notes, shieldedPool.address, identity || undefined)
        const availableNotes = getNotesForToken(validNotes, inputToken)
        if (availableNotes.length > 0) {
          const largest = availableNotes.reduce((max, note) => 
            note.amount > max.amount ? note : max
          )
          setLargestNoteAmount(largest.amount)
        } else {
          setLargestNoteAmount(0n)
        }
      } catch (error) {
        console.error('[Swap] Error calculating largest note:', error)
        setLargestNoteAmount(0n)
      }
    }
    updateLargestNote()
  }, [notes, inputToken])
  
  // Fetch quote when input changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!inputAmount || parseFloat(inputAmount) <= 0) {
        setQuote(null)
        return
      }
      
      try {
        setIsLoadingQuote(true)
        const inputTokenConfig = SWAP_TOKENS[inputToken]
        if (!inputTokenConfig) {
          toast({
            title: "Invalid Token",
            description: `Token ${inputToken} is not available for swapping`,
            variant: "destructive",
          })
          setIsLoadingQuote(false)
          return
        }
        const decimals = inputTokenConfig.decimals
        const amountWei = parseAmountToWei(parseFloat(inputAmount), decimals)
        
        // Get identity for filtering spent notes (optional - if not available, will skip spent check)
        const identity = getIdentity()
        
        // Filter notes to only those that exist in the current contract and are not spent
        const validNotes = await filterValidNotes(notes, shieldedPool.address, identity || undefined)
        
        // Get available notes for the token (from valid notes only)
        const availableNotes = getNotesForToken(validNotes, inputToken)
        if (availableNotes.length === 0) {
          setQuote(null)
          return
        }
        
        // Cap amount to total balance (sequential swaps will handle splitting across notes)
        const maxAvailableWei = inputBalance
        const cappedAmountWei = amountWei > maxAvailableWei ? maxAvailableWei : amountWei
        
        // Only generate quote if we have a valid amount
        if (cappedAmountWei <= 0n) {
          setQuote(null)
          return
        }
        
        // Update input field if it was capped (but avoid infinite loop)
        const cappedAmount = formatWeiToAmount(cappedAmountWei, decimals)
        const inputAmountNum = parseFloat(inputAmount)
        // Check if amount was capped (allowing small floating point differences)
        if (cappedAmountWei < amountWei) {
          // Amount was capped - update input field
          const difference = Math.abs(cappedAmount - inputAmountNum)
          if (difference > 0.00001) {
            // Update to capped value - this will trigger useEffect again with corrected value
            setInputAmount(cappedAmount.toFixed(4))
            return // Will trigger useEffect again with corrected value
          }
        }
        
        // Generate quote with capped amount
        const newQuote = await getSwapQuote(inputToken, outputToken, cappedAmountWei)
        
        // Check if quote has an error (amount too small)
        if (newQuote.error) {
          // Set quote to show error message in UI
          setQuote(newQuote)
          setLiquidityCheck(null)
        } else {
          setQuote(newQuote)
          
          // Check liquidity for output token
          if (newQuote && newQuote.outputAmount > 0n) {
            setIsCheckingLiquidity(true)
            try {
              const liquidity = await checkSwapLiquidity(
                outputToken,
                newQuote.outputAmount,
                shieldedPool.address
              )
              setLiquidityCheck(liquidity)
            } catch (error) {
              console.error('[Swap] Liquidity check failed:', error)
              setLiquidityCheck(null)
            } finally {
              setIsCheckingLiquidity(false)
            }
          } else {
            setLiquidityCheck(null)
          }
        }
      } catch (error) {
        console.error("Quote error:", error)
        // If it's a quote with an error flag, set it to show the error message
        // Otherwise, clear the quote
        setQuote(null)
        setLiquidityCheck(null)
      } finally {
        setIsLoadingQuote(false)
      }
    }
    
    const debounce = setTimeout(fetchQuote, 500)
    return () => clearTimeout(debounce)
  }, [inputAmount, inputToken, outputToken, inputBalance, notes])
  
  // Swap tokens (reverse input/output)
  const handleSwapTokens = () => {
    const temp = inputToken
    handleInputTokenChange(outputToken)
    setOutputToken(temp)
    setInputAmount("")
    setQuote(null)
  }
  
    // Show confirmation dialog before swap
  const handleSwap = () => {
    if (!quote) {
      toast({
        title: "No Quote",
        description: "Please enter an amount to swap",
        variant: "destructive",
      })
      return
    }
    
    // Prevent swap if quote has an error
    if (quote.error) {
      toast({
        title: "Swap Not Possible",
        description: quote.error,
        variant: "destructive",
      })
      return
    }
    
    setSimulationWarning(null) // Clear any previous warnings
    setPendingSwap(() => executeSwap)
    setShowConfirmDialog(true)
  }
  
  // Set max amount (based on total balance, sequential swaps will handle splitting)
  const handleSetMax = () => {
    if (inputBalance > 0n) {
      const inputTokenConfig = SWAP_TOKENS[inputToken]
      if (!inputTokenConfig) return
      const decimals = inputTokenConfig.decimals
      const maxAmount = formatWeiToAmount(inputBalance, decimals)
      setInputAmount(maxAmount.toString())
    }
  }
  
  // Execute swap (internal - called after confirmation)
  const executeSwap = async () => {
    if (!quote) {
      toast({
        title: "No Quote",
        description: "Please enter an amount to swap",
        variant: "destructive",
      })
      return
    }
    
    const identity = getIdentity()
    if (!identity) {
      toast({
        title: "Not Initialized",
        description: "Please initialize your shielded wallet first",
        variant: "destructive",
      })
      return
    }
    
    // Find note to spend - use largest available note
    // Filter notes to only those that exist in the current contract and are not spent
    const validNotes = await filterValidNotes(notes, shieldedPool.address, identity)
    
    // Get available notes for the token (from valid notes only)
    const availableNotes = getNotesForToken(validNotes, inputToken)
    
    if (availableNotes.length === 0) {
      toast({
        title: "Insufficient Balance",
        description: `No ${inputToken} notes available in the current contract`,
        variant: "destructive",
      })
      return
    }
    
    // Check if we need sequential swaps (amount exceeds largest single note)
    const sortedNotes = [...availableNotes].sort((a, b) => {
      if (a.amount > b.amount) return -1
      if (a.amount < b.amount) return 1
      return 0
    })
    
    const largestNote = sortedNotes[0]
    const useSequentialSwaps = largestNote && quote.inputAmount > largestNote.amount
    
    if (useSequentialSwaps) {
      // Use sequential swaps (auto-splitting large amount across multiple notes)
      console.log('[Swap] Using SEQUENTIAL swaps (auto-splitting large amount)...')
      console.log('[Swap] Amount:', formatWeiToAmount(quote.inputAmount, SWAP_TOKENS[inputToken].decimals), inputToken)
      
      // Start with "Preparing swap" stage
      setSequentialSwapProgress({
        current: 0,
        total: 0, // Will be updated when we know the count
        amount: Number(quote.inputAmount) / 10 ** SWAP_TOKENS[inputToken].decimals,
        stage: 'preparing'
      })
      
      // Small delay to show "Preparing swap" phase
      await new Promise(resolve => setTimeout(resolve, 400))
      
      // Store original notes array BEFORE generating proofs (indices will shift after swaps)
      const originalNotes = getNotes()
      
      // Prepare sequential swaps - note that the actual amount swapped may be slightly less
      // if some small notes are too small to swap after fees
      let sequentialResults
      try {
        sequentialResults = await prepareSequentialSwaps(
          inputToken,
          outputToken,
          quote.inputAmount,
          shieldedPool.address,
          identity,
          availableNotes,
          (swapIndex, totalSwaps, amount) => {
            setShowProgressGlow(true)
            setIconPulseKey(prev => prev + 1)
            setTimeout(() => setShowProgressGlow(false), 400)
            setSequentialSwapProgress({ 
              current: swapIndex, 
              total: totalSwaps, 
              amount,
              stage: 'generating' // Proof generation stage
            })
            console.log(`[SequentialSwap] Progress: ${swapIndex}/${totalSwaps} (${amount} ${inputToken})`)
          }
        )
      } catch (error: any) {
        // Check if it's a remainder tolerance error - if so, we should show a helpful message
        if (error.message && error.message.includes('remaining after selecting viable swaps')) {
          // Show a more user-friendly error message
          toast({
            title: "Cannot Swap Full Amount",
            description: error.message + " Try swapping a slightly smaller amount, or the remaining small notes may be too small to swap after fees.",
            variant: "destructive",
          })
          setStatus("idle")
          return
        }
        throw error
      }
      
      // Check if we got any swaps - if not, show error
      if (!sequentialResults || sequentialResults.length === 0) {
        toast({
          title: "No Viable Swaps",
          description: "All notes are too small to swap after fees. The platform fee (0.4 USDC) requires a minimum swap amount.",
          variant: "destructive",
        })
        setStatus("idle")
        return
      }
      
      // Calculate actual amount that will be swapped (may be less than requested)
      const actualSwapAmount = sequentialResults.reduce((sum, r) => sum + r.inputAmount, 0n)
      const requestedAmount = quote.inputAmount
      
      if (actualSwapAmount < requestedAmount) {
        const difference = requestedAmount - actualSwapAmount
        const differenceDoge = formatWeiToAmount(difference, SWAP_TOKENS[inputToken].decimals)
        const actualSwapAmountDoge = formatWeiToAmount(actualSwapAmount, SWAP_TOKENS[inputToken].decimals)
        
        // Show warning if difference is significant
        if (differenceDoge > 0.01) {
          console.warn(
            `[SequentialSwap] Warning: Requested ${formatWeiToAmount(requestedAmount, SWAP_TOKENS[inputToken].decimals).toFixed(4)} ${inputToken}, ` +
            `but only ${actualSwapAmountDoge.toFixed(4)} ${inputToken} can be swapped. ` +
            `${differenceDoge.toFixed(4)} ${inputToken} remains in notes that are too small after fees.`
          )
          
          // Update quote to reflect actual swapable amount
          const updatedQuote = await getSwapQuote(inputToken, outputToken, actualSwapAmount)
          if (updatedQuote.error) {
            toast({
              title: "Cannot Complete Swap",
              description: `Cannot swap the full amount. ${differenceDoge.toFixed(4)} ${inputToken} cannot be swapped because it's in notes that are too small after fees.`,
              variant: "destructive",
            })
            setStatus("idle")
            return
          }
          
          // Continue with updated quote (actual swapable amount)
          // The sequential results already use the correct amounts, so we can proceed
        }
      }
      
      // Update total count now that we know it
      if (sequentialResults.length > 0) {
        setSequentialSwapProgress(prev => prev ? {
          ...prev,
          total: sequentialResults.length,
          current: 1 // Start with first swap (stage will be set in loop)
        } : null)
      }

      // Small delay after proof generation completes
      await new Promise(resolve => setTimeout(resolve, 400))
      
      console.log(`[SequentialSwap] Generated ${sequentialResults.length} swap proofs`)
      
      // Send each swap sequentially
      setStatus("relaying")
      const txHashes: string[] = []
      let totalOutputAmount = 0n
      
      // Get token addresses
      const inputTokenAddress = inputToken === 'DOGE' 
        ? NATIVE_TOKEN
        : SWAP_TOKENS[inputToken].address
      const outputTokenAddress = outputToken === 'DOGE'
        ? NATIVE_TOKEN
        : SWAP_TOKENS[outputToken].address
      
      for (let i = 0; i < sequentialResults.length; i++) {
        const result = sequentialResults[i]
        
        // Update progress: Submitting (for this specific swap)
        setShowProgressGlow(true)
        setIconPulseKey(prev => prev + 1)
        setTimeout(() => setShowProgressGlow(false), 400)
        setSequentialSwapProgress({
          current: i + 1,
          total: sequentialResults.length,
          amount: Number(result.inputAmount) / 10 ** SWAP_TOKENS[inputToken].decimals,
          stage: 'submitting'
        })
        
        // Small delay to show "Submitting" phase
        await new Promise(resolve => setTimeout(resolve, 300))
        
        console.log(`[SequentialSwap] Sending swap ${i + 1}/${sequentialResults.length}...`)
        
        const publicInputs = result.proof.publicInputs
        const outputCommitment2FromProof = publicInputs[3] || '0'
        const swapAmountFromProof = publicInputs[6] || result.inputAmount.toString()
        const outputAmountFromProof = publicInputs[7] || result.outputAmount.toString()
        
        const changeCommitmentValue = result.changeNote 
          ? `0x${BigInt(result.changeNote.commitment).toString(16).padStart(64, '0')}`
          : '0x0000000000000000000000000000000000000000000000000000000000000000'
        
        // Get platform fee from quote for this swap
        const swapQuote = await getSwapQuote(inputToken, outputToken, result.inputAmount)
        const platformFeeWei = swapQuote.platformFee || 0n
        
        const swapRequestBody = {
          poolAddress: shieldedPool.address,
          proof: result.proof.proof,
          root: result.root,
          inputNullifierHash: result.inputNullifierHash,
          outputCommitment1: result.outputCommitment1,
          outputCommitment2: changeCommitmentValue,
          tokenIn: inputTokenAddress,
          tokenOut: outputTokenAddress,
          swapAmount: swapAmountFromProof,
          outputAmount: outputAmountFromProof,
          platformFee: platformFeeWei.toString(),
          minAmountOut: outputAmountFromProof,
          encryptedMemo: '',
        }
        
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/swap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(swapRequestBody),
        })
        
        if (!response.ok) {
          let errorMessage = `Swap ${i + 1} failed: ${response.statusText}`
          try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
            console.error(`[SequentialSwap] Swap ${i + 1} error:`, errorData)
          } catch (e) {
            const errorText = await response.text().catch(() => '')
            console.error(`[SequentialSwap] Swap ${i + 1} error (non-JSON):`, errorText)
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }
        
        const data = await response.json()
        txHashes.push(data.txHash)
        totalOutputAmount += result.outputAmount
        
        // Realistic delay: after submission, before confirming
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Update progress: Confirming
        setShowProgressGlow(true)
        setIconPulseKey(prev => prev + 1)
        setTimeout(() => setShowProgressGlow(false), 400)
        setSequentialSwapProgress(prev => prev ? { 
          ...prev, 
          stage: 'confirming',
          txHash: data.txHash
        } : null)
        
        // Realistic delay: confirming phase
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log(`[SequentialSwap] Swap ${i + 1} sent: ${data.txHash}`)
        
        // Complete this swap (remove spent note, add output note, add change note)
        const currentNotes = getNotes()
        const spentNote = currentNotes.find(n => n.commitment === result.note.commitment)
        
        if (!spentNote) {
          console.error(`[SequentialSwap] Swap ${i + 1} note not found in current notes!`)
          throw new Error(`Note for swap ${i + 1} not found in current wallet. It may have already been spent.`)
        }
        
        const spentNoteIndex = currentNotes.findIndex(n => n.commitment === result.note.commitment)
        
        await completeSwap(
          spentNoteIndex,
          result.outputNote,
          data.leafIndex1 || undefined,
          result.changeNote,
          data.leafIndex2 || undefined
        )
        
        // Dispatch event to refresh UI after each swap
        window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
        
        // Wait a bit between swaps to avoid rate limiting
        if (i < sequentialResults.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      // After all swaps are submitted, mark as complete
      setSequentialSwapProgress(prev => prev ? { ...prev, stage: 'complete' } : null)
      setSequentialSwapTxHashes(txHashes)
      setTxHash(txHashes[txHashes.length - 1] || null)
      
      // Calculate total swap details for success dialog
      const totalInputAmountFormatted = formatWeiToAmount(quote.inputAmount, SWAP_TOKENS[inputToken].decimals)
      const totalOutputAmountFormatted = formatWeiToAmount(totalOutputAmount, SWAP_TOKENS[outputToken].decimals)
      
      setSwapResult({
        inputAmount: totalInputAmountFormatted.toFixed(4),
        inputToken,
        outputAmount: totalOutputAmountFormatted.toFixed(4),
        outputToken,
      })
      
      // Start tracking the last transaction
      const newTracker = new TransactionTrackerClass(1)
      let isConfirmed = false
      
      newTracker.onUpdate(async (trackerState) => {
        console.log('[SequentialSwap] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[SequentialSwap] All swaps confirmed!')
          setStatus('confirmed')
          
          // Show finalized micro-state (300-500ms) before success dialog
          setTimeout(() => {
            if (sequentialSwapProgress) {
              setSequentialSwapProgress(prev => prev ? { ...prev, stage: 'finalized' } : null)
            }

            // After finalized micro-state (500ms), fade out container (200ms), then delay before success dialog
            setTimeout(() => {
              setTimeout(() => {
                setShowSuccessDialog(true)
              }, 500)
            }, 500)
          }, 100)
          
          // Refresh notes
          await getNotes()
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
        } else if (trackerState.status === 'failed') {
          setStatus('failed')
        } else if (trackerState.status === 'pending') {
          setStatus('pending')
          if (sequentialSwapProgress && sequentialSwapProgress.stage === 'submitting') {
            setSequentialSwapProgress(prev => prev ? { ...prev, stage: 'confirming' } : null)
          }
        }
      })
      
      setTracker(newTracker)
      newTracker.track(txHashes[txHashes.length - 1])
      
      // Add to transaction history
      for (const hash of txHashes) {
        const result = sequentialResults.find(r => txHashes.indexOf(hash) === sequentialResults.indexOf(r))
        const inputAmountNum = result ? Number(result.inputAmount) / 10 ** SWAP_TOKENS[inputToken].decimals : 0
        const outputAmountNum = result ? Number(result.outputAmount) / 10 ** SWAP_TOKENS[outputToken].decimals : 0
        await addTransaction({
          txHash: hash,
          type: 'swap',
          amount: inputAmountNum.toFixed(4),
          amountWei: result ? result.inputAmount.toString() : BigInt(0).toString(),
          token: inputToken,
          outputToken: outputToken,
          outputAmount: outputAmountNum.toFixed(4),
          timestamp: Math.floor(Date.now() / 1000),
          status: 'confirmed',
        })
      }
      
      return // Exit early for sequential swap
    }
    
    // Single note swap (original logic)
    const noteToSpend = sortedNotes.find(n => n.amount >= quote.inputAmount)
    
    if (!noteToSpend) {
      const largestNoteAmount = formatWeiToAmount(sortedNotes[0].amount, SWAP_TOKENS[inputToken].decimals)
      toast({
        title: "Insufficient Balance",
        description: `Not enough ${inputToken} in a single note. Largest note: ${largestNoteAmount.toFixed(4)} ${inputToken}`,
        variant: "destructive",
      })
      return
    }
    
    // Use the quote as-is - prepareShieldedSwap will handle partial swaps with change notes
    const finalQuote = quote
    
    // Verify the note can cover the swap amount
    if (noteToSpend.amount < quote.inputAmount) {
      toast({
        title: "Insufficient Balance",
        description: `Selected note (${formatWeiToAmount(noteToSpend.amount, SWAP_TOKENS[inputToken].decimals).toFixed(4)} ${inputToken}) is smaller than requested swap amount (${formatWeiToAmount(quote.inputAmount, SWAP_TOKENS[inputToken].decimals).toFixed(4)} ${inputToken})`,
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      
      // Prepare swap - this will create a change note if note.amount > quote.inputAmount
      const result = await prepareShieldedSwap(
        noteToSpend,
        identity,
        finalQuote, // quote.inputAmount is the swapAmount (can be less than note.amount)
        shieldedPool.address
      )
      
      setStatus("relaying")
      
      // Get token addresses
      // Use NATIVE_TOKEN constant for DOGE (matches deployed contract)
      const inputTokenAddress = inputToken === 'DOGE' 
        ? NATIVE_TOKEN
        : SWAP_TOKENS[inputToken].address
      const outputTokenAddress = outputToken === 'DOGE'
        ? NATIVE_TOKEN
        : SWAP_TOKENS[outputToken].address
      
      // Extract public inputs from proof (they contain the data needed for contract)
      // Public inputs order: [root, inputNullifierHash, outputCommitment1, outputCommitment2, tokenInAddress, tokenOutAddress, swapAmount, outputAmount]
      const publicInputs = result.proof.publicInputs
      if (!publicInputs || publicInputs.length < 8) {
        throw new Error(`Invalid proof public inputs: expected 8, got ${publicInputs?.length || 0}`);
      }
      
      // outputCommitment2 is at index 3, swapAmount is at index 6, outputAmount is at index 7
      const outputCommitment2FromProof = publicInputs[3] || '0'  // Change commitment (0 if no change)
      const swapAmountFromProof = publicInputs[6] || finalQuote.inputAmount.toString()  // Amount being swapped (from proof)
      const outputAmountFromProof = publicInputs[7] || finalQuote.outputAmount.toString()  // Output amount from proof (raw value)
      
      // Use changeCommitment from result if available, otherwise use the one from public inputs
      // result.changeCommitment should be properly formatted as hex string
      const changeCommitmentValue = result.changeCommitment || 
        (outputCommitment2FromProof === '0' || outputCommitment2FromProof === '0x0' 
          ? '0x0000000000000000000000000000000000000000000000000000000000000000'
          : `0x${BigInt(outputCommitment2FromProof).toString(16).padStart(64, '0')}`)
      
      console.log('[Swap] Commitments:', {
        outputCommitment1: result.outputCommitment?.slice(0, 18) + '...',
        changeCommitment: result.changeCommitment?.slice(0, 18) + '...',
        changeCommitmentFromProof: outputCommitment2FromProof?.slice(0, 20),
        finalChangeCommitment: changeCommitmentValue?.slice(0, 18) + '...',
        hasChangeNote: !!result.changeNote,
      });
      
      // Validate all required parameters before sending
      if (!result.outputCommitment || !result.inputNullifierHash || !result.merkleRoot || !result.proof?.proof) {
        console.error('[Swap] Missing proof data:', {
          hasOutputCommitment: !!result.outputCommitment,
          hasInputNullifierHash: !!result.inputNullifierHash,
          hasMerkleRoot: !!result.merkleRoot,
          hasProof: !!result.proof?.proof,
        });
        throw new Error('Missing proof data - please try again');
      }
      
      if (!inputTokenAddress || !outputTokenAddress) {
        throw new Error('Missing token addresses');
      }
      
      if (!finalQuote.inputAmount || !outputAmountFromProof) {
        throw new Error('Missing swap amounts');
      }
      
      // Get platform fee from quote (5 DOGE equivalent in output token)
      const platformFeeWei = finalQuote.platformFee || 0n;
      
      // Send to relayer
      const swapRequestBody = {
        poolAddress: shieldedPool.address,
        proof: result.proof.proof,
        root: result.merkleRoot,
        inputNullifierHash: result.inputNullifierHash,
        outputCommitment1: result.outputCommitment,  // Swapped token note
        outputCommitment2: changeCommitmentValue,  // Change note (0x0...0 if no change)
        tokenIn: inputTokenAddress,
        tokenOut: outputTokenAddress,
        swapAmount: swapAmountFromProof, // Amount being swapped (from proof's public signals - index 6)
        outputAmount: outputAmountFromProof, // outputAmount from proof's public signals (net amount after fees - index 7)
        platformFee: platformFeeWei.toString(), // Platform fee (5 DOGE equivalent in output token)
        minAmountOut: finalQuote.outputAmount.toString(), // Use finalQuote's outputAmount as minAmountOut for slippage protection
        encryptedMemo: '', // TODO: Add memo encryption if needed
      };
      
      console.log('[Swap] Request body validation:', {
        swapAmountFromProof,
        outputAmountFromProof,
        finalQuoteInputAmount: finalQuote.inputAmount.toString(),
        finalQuoteOutputAmount: finalQuote.outputAmount.toString(),
      });
      
      // Debug: Log public inputs that will be sent to contract
      console.log('[Swap] Public inputs from proof:', {
        root: publicInputs[0],
        inputNullifierHash: publicInputs[1],
        outputCommitment1: publicInputs[2],
        outputCommitment2: publicInputs[3],
        tokenInAddress: publicInputs[4],
        tokenOutAddress: publicInputs[5],
        swapAmount: publicInputs[6],
        outputAmount: publicInputs[7],
      });
      
      // Debug: Log what contract will receive
      console.log('[Swap] Contract will receive:', {
        root: result.merkleRoot,
        inputNullifier: result.inputNullifierHash,
        outputCommitment1: result.outputCommitment,
        outputCommitment2: changeCommitmentValue,
        tokenIn: inputTokenAddress,
        tokenOut: outputTokenAddress,
        swapAmount: swapAmountFromProof,
        outputAmount: outputAmountFromProof,
      });
      
      // 🔍 DETAILED DIAGNOSTICS: Compare proof public inputs vs contract expectations
      console.log('[Swap] 🔍 DETAILED DIAGNOSTICS:');
      console.log('[Swap] Proof public inputs (from circuit):', {
        '[0] root': publicInputs[0],
        '[1] inputNullifierHash': publicInputs[1],
        '[2] outputCommitment1': publicInputs[2],
        '[3] outputCommitment2': publicInputs[3],
        '[4] tokenInAddress': publicInputs[4] + ' (circuit expects 0 for native)',
        '[5] tokenOutAddress': publicInputs[5],
        '[6] swapAmount': publicInputs[6],
        '[7] outputAmount': publicInputs[7],
      });
      
      // Calculate what contract will construct for publicInputs array
      const contractTokenInUint = inputTokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' || inputTokenAddress === '0x0000000000000000000000000000000000000000' 
        ? '0' 
        : BigInt(inputTokenAddress).toString();
      const contractTokenOutUint = outputTokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' || outputTokenAddress === '0x0000000000000000000000000000000000000000'
        ? '0'
        : BigInt(outputTokenAddress).toString();
      
      const contractPublicInputs = [
        BigInt(result.merkleRoot).toString(),
        BigInt(result.inputNullifierHash).toString(),
        BigInt(result.outputCommitment).toString(),
        BigInt(changeCommitmentValue || '0x0').toString(),
        contractTokenInUint,
        contractTokenOutUint,
        swapAmountFromProof.toString(),
        outputAmountFromProof.toString(),
      ];
      
      console.log('[Swap] Contract publicInputs array (what verifier will receive):', {
        '[0] root': contractPublicInputs[0],
        '[1] inputNullifier': contractPublicInputs[1],
        '[2] outputCommitment1': contractPublicInputs[2],
        '[3] outputCommitment2': contractPublicInputs[3],
        '[4] tokenInUint': contractPublicInputs[4] + ' (contract converts NATIVE_TOKEN to 0)',
        '[5] tokenOutUint': contractPublicInputs[5],
        '[6] swapAmount': contractPublicInputs[6],
        '[7] outputAmount': contractPublicInputs[7],
      });
      
      // Compare proof vs contract public inputs
      const mismatches: string[] = [];
      for (let i = 0; i < 8; i++) {
        if (publicInputs[i] !== contractPublicInputs[i]) {
          mismatches.push(`Index ${i}: proof="${publicInputs[i]}" vs contract="${contractPublicInputs[i]}"`);
        }
      }
      
      if (mismatches.length > 0) {
        console.error('[Swap] ❌ PUBLIC INPUT MISMATCH DETECTED:', mismatches);
      } else {
        console.log('[Swap] ✓ Public inputs match between proof and contract');
      }
      
      // Log Merkle root freshness
      console.log('[Swap] Merkle root info:', {
        root: result.merkleRoot,
        rootHex: '0x' + BigInt(result.merkleRoot).toString(16),
        fetchedAt: new Date().toISOString(),
      });
      
      // Validate request body before sending
      const requiredFields = [
        'poolAddress', 'proof', 'root', 'inputNullifierHash', 
        'outputCommitment1', 'tokenIn', 'tokenOut', 'swapAmount', 
        'outputAmount', 'minAmountOut'
      ];
      const missingFields = requiredFields.filter(field => !swapRequestBody[field as keyof typeof swapRequestBody]);
      
      if (missingFields.length > 0) {
        console.error('[Swap] Missing required fields:', missingFields);
        console.error('[Swap] Request body:', swapRequestBody);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      console.log('[Swap] Simulating transaction before submission...')
      
      // 🆕 Simulate transaction before submitting to relayer
      try {
        const simResponse = await fetch(`${RELAYER_URL}/api/shielded/relay/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'swap',
            poolAddress: swapRequestBody.poolAddress,
            proof: swapRequestBody.proof,
            root: swapRequestBody.root,
            nullifierHash: swapRequestBody.inputNullifierHash,
            outputCommitment1: swapRequestBody.outputCommitment1,
            outputCommitment2: swapRequestBody.outputCommitment2,
            tokenIn: swapRequestBody.tokenIn,
            tokenOut: swapRequestBody.tokenOut,
            swapAmount: swapRequestBody.swapAmount,
            outputAmount: swapRequestBody.outputAmount,
            platformFee: swapRequestBody.platformFee,
            minAmountOut: swapRequestBody.minAmountOut,
            encryptedMemo: swapRequestBody.encryptedMemo || '',
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
            console.warn('[Swap] Simulation returned false but all checks passed - proceeding anyway:', simResult)
            setSimulationWarning(null)
          } else {
            // Basic checks failed - block transaction
            console.warn('[Swap] Simulation failed:', simResult)
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
        console.log('[Swap] Simulation passed, proceeding with submission')
      } catch (simError: any) {
        // Don't block on simulation errors, just log and continue
        console.warn('[Swap] Simulation check failed, continuing anyway:', simError)
      }
      
      console.log('[Swap] Sending to relayer:', {
        poolAddress: swapRequestBody.poolAddress,
        hasProof: !!swapRequestBody.proof && swapRequestBody.proof.length === 8,
        root: swapRequestBody.root?.slice(0, 18) + '...',
        inputNullifierHash: swapRequestBody.inputNullifierHash?.slice(0, 18) + '...',
        outputCommitment1: swapRequestBody.outputCommitment1?.slice(0, 18) + '...',
        outputCommitment2: swapRequestBody.outputCommitment2?.slice(0, 18) + '...',
        tokenIn: swapRequestBody.tokenIn,
        tokenOut: swapRequestBody.tokenOut,
        swapAmount: swapRequestBody.swapAmount,
        outputAmount: swapRequestBody.outputAmount,
        minAmountOut: swapRequestBody.minAmountOut,
        allFields: Object.keys(swapRequestBody),
      });
      
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapRequestBody),
      })
      
      let data;
      try {
        data = await response.json()
      } catch (e) {
        const text = await response.text()
        console.error('[Swap] Failed to parse response as JSON:', text)
        throw new Error(`Relayer returned non-JSON response: ${text.substring(0, 200)}`)
      }
      
      if (!response.ok) {
        console.error('[Swap] Backend error response:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          message: data.message,
          missing: data.missing,
          required: data.required,
        })
        
        // Provide more helpful error messages
        let errorMsg = data.missing 
          ? `Missing parameters: ${Array.isArray(data.missing) ? data.missing.join(', ') : data.missing}`
          : (data.message || data.error || 'Relayer transaction failed')
        
        // Add specific guidance for InvalidProof errors
        if (data.error === 'InvalidProof' || (data.message && data.message.includes('ZK proof verification failed'))) {
          errorMsg = `ZK proof verification failed. This could mean:
1. The Merkle root is stale - try refreshing the page or waiting a few seconds
2. The circuit WASM/zkey files are out of sync with the contract verifier
3. The proof generation had an error

Please try:
- Refreshing the page to get the latest Merkle root
- Ensuring you have the latest circuit files
- If the issue persists, clear your browser cache and try again`
        }
        
        throw new Error(errorMsg)
      }
      
      setTxHash(data.txHash)
      
      // Calculate swap details for success dialog (before tracking)
      const swapAmountWei = finalQuote.inputAmount  // This is the swapAmount (can be less than note.amount)
      const outputAmountWei = finalQuote.outputAmount
      const decimals = SWAP_TOKENS[inputToken].decimals
      const swappedAmount = formatWeiToAmount(swapAmountWei, decimals)
      const outputAmount = formatWeiToAmount(outputAmountWei, SWAP_TOKENS[outputToken].decimals)
      
      // Store swap result details for success dialog
      setSwapResult({
        inputAmount: swappedAmount.toFixed(4),
        inputToken,
        outputAmount: outputAmount.toFixed(4),
        outputToken,
      })
      
      // Update wallet state: remove spent input note and add output note
      const allNotes = getNotes()
      const spentNoteIndex = allNotes.findIndex(n => 
        n.commitment === noteToSpend.commitment && 
        n.leafIndex === noteToSpend.leafIndex
      )
      
      if (spentNoteIndex !== -1) {
        // completeSwap will remove the spent note and add both output notes (swapped + change)
        // It also dispatches 'shielded-wallet-updated' event to immediately update UI
        completeSwap(
          spentNoteIndex,
          result.outputNote,
          data.outputLeafIndex1 || data.outputLeafIndex || undefined,
          result.changeNote,  // Add change note if present
          data.outputLeafIndex2 || undefined  // Change note leaf index
        )
        console.log('[Swap] Updated wallet state:', {
          removedNoteIndex: spentNoteIndex,
          addedLeafIndex1: data.outputLeafIndex1 || data.outputLeafIndex,
          addedLeafIndex2: data.outputLeafIndex2,
          outputNoteAmount: result.outputNote.amount.toString(),
          outputToken: finalQuote.outputToken,
          changeNoteAmount: result.changeNote?.amount.toString() || '0',
        })
        
        // Balance update is handled by completeSwap() via 'shielded-wallet-updated' event
        // This ensures the shielded balance card updates immediately
      } else {
        console.warn('[Swap] Could not find spent note in wallet state')
      }
      
      // Update status to pending (tracker will update to confirmed)
      setStatus("pending")
      
      // Start tracking transaction
      const newTracker = new TransactionTrackerClass(1)
      let isConfirmed = false
      newTracker.onUpdate(async (trackerState) => {
        console.log('[Swap] Tracker update:', trackerState.status, 'txHash:', trackerState.txHash)
        if (trackerState.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true
          console.log('[Swap] Transaction confirmed! Setting status and showing dialog')
          setTrackerStatus(trackerState.status)
          setStatus('confirmed')
          
          // Add to transaction history
          addTransaction({
            type: 'swap',
            txHash: data.txHash,
            timestamp: Math.floor(Date.now() / 1000),
            token: inputToken,
            amount: swappedAmount.toFixed(4),  // Use the actual swapped amount, not the input field value
            amountWei: swapAmountWei.toString(),
            inputToken,
            outputToken,
            outputAmount: outputAmount.toFixed(4),
            status: 'confirmed',
          })
          
          // AFTER CONFIRMATION: Shielded balance already updated optimistically (immediately after submission)
          // Dispatch event to ensure UI updates immediately
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          
          // NOTE: Swap doesn't change public balance, so no refresh needed
          // But we sync notes to catch any discrepancies from optimistic updates
          try {
            const { syncNotesWithChain } = await import('@/lib/shielded/shielded-service')
            const { shieldedPool } = await import('@/lib/dogeos-config')
            await syncNotesWithChain(shieldedPool.address)
            // Dispatch again after sync to ensure balance is accurate
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          } catch (syncError) {
            console.warn('[Swap] Failed to sync notes after confirmation:', syncError)
            // Still dispatch event even if sync fails - optimistic update is better than no update
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
          }
          
          // Note: Success dialog will be shown by useEffect when status === "confirmed"
        } else if (trackerState.status === 'failed') {
          setTrackerStatus(trackerState.status)
          setStatus('failed')
        } else if (trackerState.status === 'pending') {
          setTrackerStatus(trackerState.status)
          setStatus('pending')
        }
      })
      setTracker(newTracker)
      await newTracker.track(data.txHash)
      
      // Don't show toast - the green success UI box will show instead
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Swap error:", error)
      setStatus("error")
      
      // Smart error suggestions
      const errorInfo = formatErrorWithSuggestion(error, {
        operation: 'swap',
        token: inputToken,
        hasShieldedBalance: inputBalance > 0n,
      })
      
      toast({
        title: errorInfo.title,
        description: errorInfo.suggestion ? `${errorInfo.description} ${errorInfo.suggestion}` : errorInfo.description,
        variant: "destructive",
      })
    }
  }
  
  const reset = () => {
    setInputAmount("")
    setQuote(null)
    setStatus("idle")
    setTxHash(null)
    setSwapResult(null)
    setLiquidityCheck(null)
    setShowConfirmDialog(false)
    setShowSuccessDialog(false)
    setPendingSwap(null)
    setSimulationWarning(null)
    setSequentialSwapProgress(null)
    setSequentialSwapTxHashes([])
    if (tracker) {
      tracker.stop()
      tracker.reset()
      setTracker(null)
    }
    setTrackerStatus("idle")
    // Trigger component reset in AppCard
    onReset?.()
    
    // CRITICAL: Subtle refresh to ensure all balances and data are up-to-date
    // This happens after the success dialog closes, so it's unnoticeable to the user
    // router.refresh() does a soft refresh without full page reload - no flicker or visible reload
    // The delay ensures the dialog close animation completes first
    setTimeout(() => {
      router.refresh() // Soft refresh - re-fetches data without full page reload
    }, 300) // Delay to let dialog close animation complete (250ms animation + 50ms buffer)
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
      console.log('[Swap] useEffect: Status is confirmed, showing success dialog')
      // Use a small delay to ensure all state updates are processed
      const timer = setTimeout(() => {
        setShowSuccessDialog(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [status, txHash, showSuccessDialog]) // Include showSuccessDialog to prevent duplicate
  
  if (Object.keys(balances).length === 0 || Object.values(balances).every(b => b === 0n)) {
    return null
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display font-medium">Swap Tokens</h3>
        <p className="text-sm font-body text-muted-foreground">
          Swap tokens privately within the shielded layer
        </p>
      </div>
      
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
                        await syncNotesWithChain(shieldedPool.address)
                        // Trigger balance refresh
                        window.dispatchEvent(new Event('refresh-balance'))
                        window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
                        
                        // Refresh public balance
                        if (wallet?.refreshBalance) {
                          wallet.refreshBalance().catch(err => console.warn('[Swap] Failed to refresh public balance:', err))
                        }
                        
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
          
          {/* Input Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>You Pay</Label>
              <button 
                className="text-xs text-primary hover:underline h-auto p-0"
                onClick={handleSetMax}
              >
                Max: {inputBalance > 0n ? formatWeiToAmount(inputBalance, SWAP_TOKENS[inputToken].decimals).toFixed(4) : '0.0000'}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '') {
                    setInputAmount('')
                    return
                  }
                  const numValue = parseFloat(value)
                  if (!isNaN(numValue)) {
                    const maxAmount = formatWeiToAmount(inputBalance, SWAP_TOKENS[inputToken].decimals)
                    // Cap to max balance
                    if (numValue > maxAmount) {
                      setInputAmount(maxAmount.toFixed(4))
                    } else {
                      setInputAmount(value)
                    }
                  }
                }}
                className="text-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0"
                step="0.0001"
              />
              <Select value={inputToken} onValueChange={(v) => handleInputTokenChange(v as SwapToken)}>
                <SelectTrigger className="min-w-[140px] [&_[data-slot=select-value]]:!-webkit-line-clamp-[unset] [&_[data-slot=select-value]]:overflow-visible">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <img 
                        src={TOKEN_LOGOS[inputToken] || TOKEN_LOGOS.DOGE} 
                        alt={inputToken} 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                      />
                      <span className="whitespace-nowrap">{inputToken}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS).map((token) => {
                    const tokenConfig = SWAP_TOKENS[token]
                    return (
                      <SelectItem key={token} value={token}>
                        <div className="flex items-center gap-2">
                          <img 
                            src={TOKEN_LOGOS[token] || TOKEN_LOGOS.DOGE} 
                            alt={token} 
                            className="w-4 h-4 rounded-full"
                          />
                          <span>{tokenConfig?.symbol || token}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Swap Button with Divider */}
          <div className="relative flex items-center justify-center my-4 gap-3">
            {/* Left divider segment - Fade to solid gradient */}
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-zinc-700/50"></div>
            {/* Swap Button */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-9 w-9 border-zinc-700/50 hover:border-[#C2A633]/50 bg-transparent hover:bg-zinc-900/30 transition-all flex-shrink-0"
              onClick={handleSwapTokens}
            >
              <ArrowDownUp className="h-[18px] w-[18px]" />
            </Button>
            {/* Right divider segment - Fade to solid gradient */}
            <div className="flex-1 h-px bg-gradient-to-r from-zinc-700/50 via-zinc-700/50 to-transparent"></div>
          </div>
          
          {/* Output Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>You Receive</Label>
              {isLoadingQuote && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing quote...</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={isLoadingQuote ? "Computing..." : "0.0"}
                  value={quote ? formatWeiToAmount(quote.outputAmount, SWAP_TOKENS[outputToken].decimals).toFixed(4) : ""}
                  readOnly
                  className="text-xl"
                  disabled={isLoadingQuote}
                />
                {isLoadingQuote && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin text-[#C2A633]" />
                  </div>
                )}
              </div>
              <Select value={outputToken} onValueChange={(v) => setOutputToken(v as SwapToken)}>
                <SelectTrigger className="min-w-[140px] [&_[data-slot=select-value]]:!-webkit-line-clamp-[unset] [&_[data-slot=select-value]]:overflow-visible">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <img 
                        src={TOKEN_LOGOS[outputToken] || TOKEN_LOGOS.USDC} 
                        alt={outputToken} 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                      />
                      <span className="whitespace-nowrap">{outputToken}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS)
                    .filter(t => t !== inputToken)
                    .map((token) => {
                      const tokenConfig = SWAP_TOKENS[token]
                      return (
                        <SelectItem key={token} value={token}>
                          <div className="flex items-center gap-2">
                            <img 
                              src={TOKEN_LOGOS[token] || TOKEN_LOGOS.USDC} 
                              alt={token} 
                              className="w-4 h-4 rounded-full"
                            />
                            <span>{tokenConfig?.symbol || token}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Loading State - Quote Computing */}
          {(isLoadingQuote || isCheckingLiquidity) && inputAmount && parseFloat(inputAmount) > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 border border-[#C2A633]/20 text-sm">
              <div className="flex items-center gap-2 text-[#C2A633]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isLoadingQuote ? "Computing swap quote..." : "Checking liquidity..."}
                </span>
              </div>
            </div>
          )}
          
          {/* Estimated Fees */}
          {quote && !quote.error && !isLoadingQuote && !isCheckingLiquidity && (
            <EstimatedFees
              amount={quote.inputAmount}
              fee={quote.fee}
              received={quote.outputAmount}
              token={outputToken}
              tokenDecimals={SWAP_TOKENS[outputToken].decimals}
            />
          )}
          
          {/* Quote Details */}
          {quote && !quote.error && !isLoadingQuote && !isCheckingLiquidity && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {inputToken} = {quote.exchangeRate.toFixed(6)} {outputToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={quote.priceImpact > 1 ? "text-destructive" : ""}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
              {quote.platformFee !== undefined && quote.swapFee !== undefined && (
                <>
                  <div className="flex justify-between pt-1 border-t border-white/10">
                    <span className="text-muted-foreground">Swap Fee (0.3%)</span>
                    <span className="text-yellow-400">
                      -{formatWeiToAmount(quote.swapFee, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span className="text-yellow-400">
                      -{formatWeiToAmount(quote.platformFee, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Quote Error - Amount Too Small */}
          {quote?.error && (
            <Alert className="bg-orange-500/10 border-orange-500/30">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              <AlertDescription className="text-orange-50">
                <strong className="text-orange-100 font-semibold">Swap Amount Too Small</strong>
                <p className="mt-1 text-sm text-orange-100">
                  {quote.error}
                </p>
                {quote.minimumRequired && (
                  <p className="mt-2 text-xs text-orange-200/80">
                    The platform fee ({formatWeiToAmount(quote.platformFee || 0n, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}) exceeds the swap output. 
                    Please shield more {inputToken} first to make a viable swap.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Liquidity Warning */}
          {liquidityCheck && !liquidityCheck.hasLiquidity && quote && !quote.error && (
            <Alert className="bg-orange-500/10 border-orange-500/30">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              <AlertDescription className="text-orange-50">
                <strong className="text-orange-100 font-semibold">Insufficient Liquidity:</strong> The contract has{" "}
                {formatWeiToAmount(liquidityCheck.availableBalance, SWAP_TOKENS[outputToken].decimals).toFixed(4)}{" "}
                {outputToken} available, but {formatWeiToAmount(liquidityCheck.requiredAmount, SWAP_TOKENS[outputToken].decimals).toFixed(4)}{" "}
                {outputToken} is required. Someone must shield {outputToken} first to provide liquidity.
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-zinc-900/70 border border-zinc-700/80 hover:border-[#C2A633]/50 transition-all duration-300 group py-3 sm:py-2 backdrop-blur-sm"
            onClick={handleSwap}
            disabled={!quote || quote.error || inputBalance === 0n || parseFloat(inputAmount) <= 0 || isLoadingQuote || isCheckingLiquidity || (liquidityCheck && !liquidityCheck.hasLiquidity)}
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
              {isLoadingQuote || isCheckingLiquidity ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  Computing...
                </>
              ) : (
                <>
                  <ArrowDownUp className="h-4 w-4 mr-2 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.05]" strokeWidth={1.75} />
                  {quote?.error ? "Amount Too Small" : liquidityCheck && !liquidityCheck.hasLiquidity ? "Insufficient Liquidity" : "Swap Privately"}
                </>
              )}
            </span>
          </Button>
        </div>
      )}
      
      {/* Sequential Swap Progress - Matches sequential transfer design */}
      {sequentialSwapProgress && (status !== "confirmed" || sequentialSwapProgress.stage === "finalized") && !showSuccessDialog && (
        <div 
          className={cn(
            "transition-opacity duration-200",
            status === "confirmed" && sequentialSwapProgress.stage !== "finalized" ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="p-3 sm:p-4 bg-zinc-900/50 border border-[#C2A633]/20 rounded-lg">
            <div className="space-y-2 sm:space-y-3">
              {/* Icon on left, text on right - matches TransactionProgress layout */}
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Icon - Spinner (EXACT SAME as shield interface) */}
                <div className="flex-shrink-0">
                  {sequentialSwapProgress.stage === 'finalized' ? (
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
                        preparing: `Preparing swap`,
                        generating: `Generating privacy proof`,
                        submitting: `Submitting to network`,
                        confirming: `Confirming on-chain`,
                        complete: `Finalizing swap`,
                        finalized: `✓ Swap finalized`
                      }
                      return stageMessages[sequentialSwapProgress.stage] || `Processing swap...`
                    })()}
                  </p>
                  {(() => {
                    const secondaryMessages: Record<string, string> = {
                      preparing: `Initializing swap sequence`,
                      generating: `This typically takes a few seconds.`,
                      submitting: `Relayer is submitting your transaction...`,
                      confirming: `Transaction is being confirmed on-chain`,
                      complete: `Finalizing shielded assets…`
                    }
                    const message = secondaryMessages[sequentialSwapProgress.stage]
                    return message ? (
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">
                        {message}
                      </p>
                    ) : null
                  })()}
                </div>
              </div>
              
              {/* Progress Bar - Reuse EXACT SAME component as sequential/shield/unshield */}
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
                
                // Calculate progress based on current swap and stage
                let progressValue = 0
                
                if (sequentialSwapProgress.total > 0) {
                  // Calculate base progress from swap number (0 to total-1)
                  const baseProgress = (sequentialSwapProgress.current - 1) / sequentialSwapProgress.total
                  // Add stage progress for current swap (0 to 1/total)
                  const stageProgress = progressByPhase[sequentialSwapProgress.stage] || 0
                  const stageContribution = stageProgress / sequentialSwapProgress.total
                  progressValue = Math.min(baseProgress + stageContribution, 1.0)
                } else {
                  // Before we know total swaps, just use stage progress directly
                  progressValue = progressByPhase[sequentialSwapProgress.stage] || 0
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
      
      {/* Progress Indicator - Only show during processing, hide when confirmed (single swap only) */}
      {!sequentialSwapProgress && status !== "confirmed" && status !== "idle" && (
        <TransactionProgress
          status={status === "idle" ? "idle" : (status === "error" ? "failed" : status)}
          message={
            status === "proving" ? "This may take 10-30 seconds..."
            : status === "relaying" ? "Relayer is submitting your transaction..."
            : status === "pending" ? "Waiting for blockchain confirmation..."
            : undefined
          }
          txHash={txHash}
          blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        />
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Swap"
        description={`You are about to swap ${quote ? formatWeiToAmount(quote.inputAmount, SWAP_TOKENS[inputToken].decimals).toFixed(4) : '0'} ${inputToken} for approximately ${quote ? formatWeiToAmount(quote.outputAmount, SWAP_TOKENS[outputToken].decimals).toFixed(4) : '0'} ${outputToken}.`}
        confirmText="Confirm Swap"
        cancelText="Cancel"
        onConfirm={async () => {
          if (pendingSwap) {
            await pendingSwap()
          }
          setPendingSwap(null)
        }}
        isLoading={status === "proving" || status === "relaying"}
        details={
          quote ? (
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-400">Rate</span>
                <span className="text-white text-right break-all">1 {inputToken} = {quote.exchangeRate.toFixed(6)} {outputToken}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-400">Price Impact</span>
                <span className={quote.priceImpact > 1 ? "text-red-400" : "text-white"}>{quote.priceImpact.toFixed(2)}%</span>
              </div>
              {quote.swapFee !== undefined && (
                <div className="flex justify-between items-center gap-2 pt-1 border-t border-[#C2A633]/10">
                  <span className="text-gray-400">Swap Fee (0.3%)</span>
                  <span className="text-red-400 text-right break-all">-{formatWeiToAmount(quote.swapFee, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}</span>
                </div>
              )}
              {quote.platformFee !== undefined && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-yellow-400 text-right break-all">-{formatWeiToAmount(quote.platformFee, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-[#C2A633]/10">
                <span className="text-gray-400">You Receive</span>
                <span className="text-green-400 font-semibold text-right break-all">{formatWeiToAmount(quote.outputAmount, SWAP_TOKENS[outputToken].decimals).toFixed(4)} {outputToken}</span>
              </div>
            </div>
          ) : undefined
        }
      />
      
      {/* Success Dialog */}
      <SuccessDialog
        open={showSuccessDialog && status === "confirmed"}
        onOpenChange={(open) => {
          // Only allow closing via buttons, not by clicking outside or scrolling
          if (!open && status === "confirmed") {
            reset() // reset() includes subtle refresh
          } else if (status === "confirmed") {
            setShowSuccessDialog(true)
          }
        }}
        onClose={reset} // reset() includes subtle refresh
        title="Swap Successful!"
        message={swapResult 
          ? `Successfully swapped ${swapResult.inputAmount} ${swapResult.inputToken} = ${swapResult.outputAmount} ${swapResult.outputToken}.`
          : "Your shielded balance has been updated. The swap completed successfully."
        }
        txHash={txHash}
        txHashes={sequentialSwapTxHashes.length > 0 ? sequentialSwapTxHashes : undefined}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Make Another Swap"
        onAction={reset} // reset() includes subtle refresh
      />
      
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-300 mb-1">
                  Swap Failed
                </p>
                <p className="text-sm text-orange-400/90">
                  Swap failed. Your shielded tokens are safe.
                </p>
              </div>
            </div>
          </div>
          
          <Button className="w-full" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}


