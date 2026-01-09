"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Loader2, ArrowDownUp, AlertCircle, Check, RefreshCw, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount, parseAmountToWei } from "@/lib/shielded/shielded-note"
import { 
  getSwapQuote, 
  prepareShieldedSwap,
  getShieldedBalances,
  getNotesForToken, filterValidNotes,
  formatSwapDetails,
  checkSwapLiquidity,
  SWAP_TOKENS,
  type SwapToken,
  type SwapQuote,
} from "@/lib/shielded/shielded-swap-service"
import { getIdentity, getNotes, completeUnshield, completeSwap } from "@/lib/shielded/shielded-service"
import { addTransaction } from "@/lib/shielded/transaction-history"
import { shieldedPool, dogeosTestnet } from "@/lib/dogeos-config"
import { TransactionProgress, type TransactionStatus } from "@/components/shielded/transaction-progress"
import { TransactionTrackerClass } from "@/lib/shielded/transaction-tracker"
import { EstimatedFees } from "@/components/shielded/estimated-fees"
import { ConfirmationDialog } from "@/components/shielded/confirmation-dialog"
import { SuccessDialog } from "@/components/shielded/success-dialog"
import { formatErrorWithSuggestion } from "@/lib/shielded/error-suggestions"

// Use local backend for development, production URL for deployed
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://dogenadocash.onrender.com')

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
        const decimals = SWAP_TOKENS[inputToken].decimals
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
        
        // Find largest note
        const largestNote = availableNotes.reduce((max, note) => 
          note.amount > max.amount ? note : max
        )
        
        // Cap amount to largest single note (swap can only use one note at a time)
        // Use largestNoteAmount if available, otherwise calculate on the fly
        const maxNoteAmount = largestNoteAmount > 0n && largestNoteAmount <= largestNote.amount 
          ? largestNoteAmount 
          : largestNote.amount
        const maxAvailableWei = inputBalance < maxNoteAmount ? inputBalance : maxNoteAmount
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
        setQuote(newQuote)
        
        // Check liquidity for output token
        if (newQuote) {
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
      } catch (error) {
        console.error("Quote error:", error)
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
    
    setPendingSwap(() => executeSwap)
    setShowConfirmDialog(true)
  }
  
  // Set max amount (based on largest single note, since swaps use one note at a time)
  const handleSetMax = () => {
    if (largestNoteAmount > 0n) {
      const decimals = SWAP_TOKENS[inputToken].decimals
      const maxAmount = formatWeiToAmount(largestNoteAmount, decimals)
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
    
    // Find largest note that can cover the swap amount
    const sortedNotes = [...availableNotes].sort((a, b) => {
      if (a.amount > b.amount) return -1
      if (a.amount < b.amount) return 1
      return 0
    })
    
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
    // If note.amount > quote.inputAmount, a change note will be created automatically
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
      const inputTokenAddress = inputToken === 'DOGE' 
        ? '0x0000000000000000000000000000000000000000'
        : SWAP_TOKENS[inputToken].address
      const outputTokenAddress = outputToken === 'DOGE'
        ? '0x0000000000000000000000000000000000000000'
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
      const outputAmount = publicInputs[7] || finalQuote.outputAmount.toString()
      
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
      
      if (!finalQuote.inputAmount || !outputAmount) {
        throw new Error('Missing swap amounts');
      }
      
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
        outputAmount: outputAmount, // outputAmount from proof's public signals (required for proof verification - index 7)
        minAmountOut: finalQuote.outputAmount.toString(), // Use finalQuote's outputAmount as minAmountOut for slippage protection
        encryptedMemo: '', // TODO: Add memo encryption if needed
      };
      
      console.log('[Swap] Request body validation:', {
        swapAmountFromProof,
        outputAmount,
        finalQuoteInputAmount: finalQuote.inputAmount.toString(),
        finalQuoteOutputAmount: finalQuote.outputAmount.toString(),
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
        const errorMsg = data.missing 
          ? `Missing parameters: ${Array.isArray(data.missing) ? data.missing.join(', ') : data.missing}`
          : (data.message || data.error || 'Relayer transaction failed')
        throw new Error(errorMsg)
      }
      
      setTxHash(data.txHash)
      
      // Start tracking transaction
      const newTracker = new TransactionTrackerClass(1)
      newTracker.onUpdate((trackerState) => {
        setTrackerStatus(trackerState.status)
        if (trackerState.status === 'confirmed') {
          setStatus('confirmed')
        } else if (trackerState.status === 'failed') {
          setStatus('failed')
        }
      })
      setTracker(newTracker)
      await newTracker.track(data.txHash)
      
      // Update status to pending (tracker will update to confirmed)
      setStatus("pending")
      
      // Update wallet state: remove spent input note and add output note
      const allNotes = getNotes()
      const spentNoteIndex = allNotes.findIndex(n => 
        n.commitment === noteToSpend.commitment && 
        n.leafIndex === noteToSpend.leafIndex
      )
      
      if (spentNoteIndex !== -1) {
        // completeSwap will remove the spent note and add both output notes (swapped + change)
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
        
        // Show success dialog
        setShowSuccessDialog(true)
        
        // Trigger UI refresh events
        setTimeout(() => {
          // Refresh public balance (for gas token)
          window.dispatchEvent(new Event('refresh-balance'))
          // Trigger shielded wallet state refresh
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
        }, 500)
      } else {
        console.warn('[Swap] Could not find spent note in wallet state')
      }
      
      // Add to transaction history
      // Use swapAmount from quote (what was actually swapped) and finalQuote for output
      // If there's a change note, only the swapAmount was swapped, not the full note
      const swapAmountWei = finalQuote.inputAmount  // This is the swapAmount (can be less than note.amount)
      const outputAmountWei = finalQuote.outputAmount
      
      // Format the swapped amount for display (not the full note amount)
      const decimals = SWAP_TOKENS[inputToken].decimals
      const swappedAmount = formatWeiToAmount(swapAmountWei, decimals)
      
      addTransaction({
        type: 'swap',
        txHash: data.txHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: inputToken,
        amount: swappedAmount.toFixed(4),  // Use the actual swapped amount, not the input field value
        amountWei: swapAmountWei.toString(),
        inputToken,
        outputToken,
        outputAmount: formatWeiToAmount(outputAmountWei, SWAP_TOKENS[outputToken].decimals).toFixed(4),
        status: 'confirmed',
      })
      
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
    if (tracker) {
      tracker.stop()
      tracker.reset()
      setTracker(null)
    }
    setTrackerStatus("idle")
    // Trigger component reset in AppCard
    onReset?.()
  }
  
  // Cleanup tracker on unmount
  useEffect(() => {
    return () => {
      if (tracker) {
        tracker.stop()
      }
    }
  }, [tracker])
  
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
          {/* Input Token */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
              <Label>You Pay</Label>
              <button 
                className="text-xs text-primary hover:underline"
                onClick={handleSetMax}
              >
                Max: {largestNoteAmount > 0n ? formatWeiToAmount(largestNoteAmount, SWAP_TOKENS[inputToken].decimals).toFixed(4) : '0.0000'}
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
                className="text-xl"
                min="0"
                step="0.0001"
              />
              <Select value={inputToken} onValueChange={(v) => handleInputTokenChange(v as SwapToken)}>
                <SelectTrigger className="w-32">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <img 
                        src={TOKEN_LOGOS[inputToken] || TOKEN_LOGOS.DOGE} 
                        alt={inputToken} 
                        className="w-4 h-4 rounded-full"
                      />
                      <span>{inputToken}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS).map((token) => (
                    <SelectItem key={token} value={token}>
                      <div className="flex items-center gap-2">
                        <img 
                          src={TOKEN_LOGOS[token] || TOKEN_LOGOS.DOGE} 
                          alt={token} 
                          className="w-4 h-4 rounded-full"
                        />
                        <span>{token}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
          
          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleSwapTokens}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Output Token */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
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
                  className="text-xl bg-muted"
                  disabled={isLoadingQuote}
                />
                {isLoadingQuote && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin text-[#C2A633]" />
                  </div>
                )}
              </div>
              <Select value={outputToken} onValueChange={(v) => setOutputToken(v as SwapToken)}>
                <SelectTrigger className="w-32">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <img 
                        src={TOKEN_LOGOS[outputToken] || TOKEN_LOGOS.USDC} 
                        alt={outputToken} 
                        className="w-4 h-4 rounded-full"
                      />
                      <span>{outputToken}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS)
                    .filter(t => t !== inputToken)
                    .map((token) => (
                      <SelectItem key={token} value={token}>
                        <div className="flex items-center gap-2">
                          <img 
                            src={TOKEN_LOGOS[token] || TOKEN_LOGOS.USDC} 
                            alt={token} 
                            className="w-4 h-4 rounded-full"
                          />
                          <span>{token}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
          
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
          {quote && !isLoadingQuote && !isCheckingLiquidity && (
            <EstimatedFees
              amount={quote.inputAmount}
              fee={quote.fee}
              received={quote.outputAmount}
              token={outputToken}
              tokenDecimals={SWAP_TOKENS[outputToken].decimals}
            />
          )}
          
          {/* Quote Details */}
          {quote && !isLoadingQuote && !isCheckingLiquidity && (
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
            </div>
          )}
          
          {/* Liquidity Warning */}
          {liquidityCheck && !liquidityCheck.hasLiquidity && quote && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Insufficient Liquidity:</strong> The contract has{" "}
                {formatWeiToAmount(liquidityCheck.availableBalance, SWAP_TOKENS[outputToken].decimals).toFixed(4)}{" "}
                {outputToken} available, but {formatWeiToAmount(liquidityCheck.requiredAmount, SWAP_TOKENS[outputToken].decimals).toFixed(4)}{" "}
                {outputToken} is required. Someone must shield {outputToken} first to provide liquidity.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Privacy Note */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Private Swap:</strong> On-chain observers will only see that a swap occurred,
              not the tokens, amounts, or your identity.
            </AlertDescription>
          </Alert>
          
          <Button 
            className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-white/10 border border-white/20 hover:border-[#B89A2E]/50 transition-all duration-500 group py-3 sm:py-2"
            onClick={handleSwap}
            disabled={!quote || parseFloat(inputAmount) <= 0 || isLoadingQuote || isCheckingLiquidity || (liquidityCheck && !liquidityCheck.hasLiquidity)}
          >
            {/* Fill animation from left to right - slower and more natural */}
            <span className="absolute inset-0 bg-[#B89A2E] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-[1300ms] ease-in-out" />
            <span className="relative z-10 flex items-center justify-center text-sm sm:text-base text-white group-hover:text-black transition-colors duration-[1300ms] ease-in-out">
              {isLoadingQuote || isCheckingLiquidity ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  Computing...
                </>
              ) : (
                <>
                  <ArrowDownUp className="h-4 w-4 mr-2 flex-shrink-0" strokeWidth={1.75} />
                  {liquidityCheck && !liquidityCheck.hasLiquidity ? "Insufficient Liquidity" : "Swap Privately"}
                </>
              )}
            </span>
          </Button>
        </div>
      )}
      
      {/* Progress Indicator - Only show during processing, hide when confirmed */}
      {status !== "confirmed" && (
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
            </div>
          ) : undefined
        }
      />
      
      {/* Success Dialog */}
      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          // Only allow closing via buttons, not by clicking outside or scrolling
          if (!open && status === "confirmed") {
            reset()
          } else {
            setShowSuccessDialog(true)
          }
        }}
        onClose={reset}
        title="Swap Successful!"
        message="Your shielded balance has been updated. The swap completed successfully."
        txHash={txHash}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Make Another Swap"
        onAction={reset}
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


