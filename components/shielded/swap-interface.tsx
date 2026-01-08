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
import { shieldedPool } from "@/lib/dogeos-config"

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
  const [status, setStatus] = useState<"idle" | "quoting" | "proving" | "relaying" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [liquidityCheck, setLiquidityCheck] = useState<{
    hasLiquidity: boolean;
    availableBalance: bigint;
    requiredAmount: bigint;
  } | null>(null)
  
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
          const liquidity = await checkSwapLiquidity(
            outputToken,
            newQuote.outputAmount,
            shieldedPool.address
          )
          setLiquidityCheck(liquidity)
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
  
  // Swap tokens
  const handleSwapTokens = () => {
    const temp = inputToken
    handleInputTokenChange(outputToken)
    setOutputToken(temp)
    setInputAmount("")
    setQuote(null)
  }
  
  // Set max amount (based on largest single note, since swaps use one note at a time)
  const handleSetMax = () => {
    if (largestNoteAmount > 0n) {
      const decimals = SWAP_TOKENS[inputToken].decimals
      const maxAmount = formatWeiToAmount(largestNoteAmount, decimals)
      setInputAmount(maxAmount.toString())
    }
  }
  
  // Execute swap
  const handleSwap = async () => {
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
    
    // IMPORTANT: Regenerate quote for the exact note amount to avoid mismatch
    // The quote might have been generated for a capped amount, but we're using a larger note
    let finalQuote = quote
    if (noteToSpend.amount !== quote.inputAmount) {
      // Note is larger than quote amount - regenerate quote for exact note amount
      console.log(`[Swap] Note amount (${noteToSpend.amount.toString()}) differs from quote amount (${quote.inputAmount.toString()}), regenerating quote...`)
      try {
        finalQuote = await getSwapQuote(inputToken, outputToken, noteToSpend.amount)
        // Update the displayed quote amount
        setQuote(finalQuote)
      } catch (error) {
        console.error('[Swap] Failed to regenerate quote:', error)
        toast({
          title: "Quote Error",
          description: "Failed to generate quote for selected note. Please try again.",
          variant: "destructive",
        })
        return
      }
    }
    
    try {
      setStatus("proving")
      
      // Prepare swap (in production, this would generate real proof)
      const result = await prepareShieldedSwap(
        noteToSpend,
        identity,
        finalQuote, // Use the regenerated quote that matches the note amount
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
      setStatus("success")
      
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
      // Use note amount for input (what was actually spent) and finalQuote for output
      const inputAmountWei = noteToSpend.amount
      const outputAmountWei = finalQuote.outputAmount
      addTransaction({
        type: 'swap',
        txHash: data.txHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: inputToken,
        amount: inputAmount,
        amountWei: inputAmountWei.toString(),
        inputToken,
        outputToken,
        outputAmount: formatWeiToAmount(outputAmountWei, SWAP_TOKENS[outputToken].decimals).toFixed(6),
        status: 'confirmed',
      })
      
      // Don't show toast - the green success UI box will show instead
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Swap error:", error)
      setStatus("error")
      
      // Better error messages
      let errorMessage = "Transaction failed"
      if (error?.message) {
        if (error.message.includes("user rejected") || error.message.includes("User denied")) {
          errorMessage = "Transaction was cancelled. Please try again when ready."
        } else if (error.message.includes("insufficient funds") || error.message.includes("insufficient balance")) {
          errorMessage = "Insufficient balance. Please check your shielded balance."
        } else if (error.message.includes("network") || error.message.includes("RPC") || error.message.includes("relayer")) {
          errorMessage = "Network or relayer error. Please check your connection and try again."
        } else if (error.message.includes("quote") || error.message.includes("slippage")) {
          errorMessage = "Swap quote error. Please try again with different amounts."
        } else if (error.message.includes("proof")) {
          errorMessage = "Proof generation failed. Please try again."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }
  
  const reset = () => {
    setInputAmount("")
    setQuote(null)
    setStatus("idle")
    setTxHash(null)
    // Trigger component reset in AppCard
    onReset?.()
  }
  
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
              {isLoadingQuote && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="0.0"
                value={quote ? formatWeiToAmount(quote.outputAmount, SWAP_TOKENS[outputToken].decimals).toFixed(6) : ""}
                readOnly
                className="text-xl bg-muted"
              />
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
          
          {/* Quote Details */}
          {quote && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {inputToken} = {quote.exchangeRate.toFixed(6)} {outputToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (0.3%)</span>
                <span>{formatWeiToAmount(quote.fee, SWAP_TOKENS[outputToken].decimals).toFixed(6)} {outputToken}</span>
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
                {formatWeiToAmount(liquidityCheck.availableBalance, SWAP_TOKENS[outputToken].decimals).toFixed(6)}{" "}
                {outputToken} available, but {formatWeiToAmount(liquidityCheck.requiredAmount, SWAP_TOKENS[outputToken].decimals).toFixed(6)}{" "}
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
            className="w-full bg-[#C2A633]/20 hover:bg-[#C2A633]/30 text-[#C2A633] border border-[#C2A633]/40" 
            onClick={handleSwap}
            disabled={!quote || parseFloat(inputAmount) <= 0 || (liquidityCheck && !liquidityCheck.hasLiquidity)}
          >
            <ArrowDownUp className="h-4 w-4 mr-2 opacity-85" strokeWidth={1.75} />
            {liquidityCheck && !liquidityCheck.hasLiquidity ? "Insufficient Liquidity" : "Swap Privately"}
          </Button>
        </div>
      )}
      
      {status === "proving" && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowDownUp className="h-8 w-8 text-white/80 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C2A633] flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-black animate-spin" />
                </div>
              </div>
              
              {/* Progress Info */}
              <div className="w-full max-w-xs space-y-3">
                <div className="text-center space-y-2">
                  <h4 className="text-base font-display font-semibold text-white">
                    Generating ZK Proof
                  </h4>
                  <p className="text-sm font-body text-white/70">
                    This may take 10-30 seconds...
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full origin-left"
                    style={{ 
                      width: '33%',
                      animation: 'progressFill 2.5s ease-out infinite'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {status === "relaying" && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowDownUp className="h-8 w-8 text-white/80 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C2A633] flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-black animate-spin" />
                </div>
              </div>
              
              {/* Progress Info */}
              <div className="w-full max-w-xs space-y-3">
                <div className="text-center space-y-2">
                  <h4 className="text-base font-display font-semibold text-white">
                    Submitting Transaction
                  </h4>
                  <p className="text-sm font-body text-white/70">
                    Your wallet never signs!
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full origin-left"
                    style={{ 
                      width: '66%',
                      animation: 'progressFill 2.5s ease-out infinite'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {status === "success" && txHash && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-[#C2A633]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-lg font-display font-semibold text-white mb-2">
                    Swap Successful!
                  </h4>
                  <p className="text-sm font-body text-white/70 leading-relaxed">
                    Your shielded balance has been updated. The swap completed successfully.
                  </p>
                </div>
                {txHash && (
                  <a 
                    href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#C2A633] hover:text-[#C2A633]/80 transition-colors group font-medium"
                  >
                    <span className="font-body">View transaction on Blockscout</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-white/5 hover:bg-white/10 text-[#C2A633] border border-[#C2A633]/50 hover:border-[#C2A633] font-body font-medium transition-all" 
            onClick={reset}
          >
            Make Another Swap
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


