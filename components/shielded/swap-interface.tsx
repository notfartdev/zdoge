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
  getNotesForToken,
  formatSwapDetails,
  SWAP_TOKENS,
  type SwapToken,
  type SwapQuote,
} from "@/lib/shielded/shielded-swap-service"
import { getIdentity, getNotes, completeUnshield } from "@/lib/shielded/shielded-service"
import { addTransaction } from "@/lib/shielded/transaction-history"

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
  
  // Get balances
  const balances = getShieldedBalances(notes)
  const inputBalance = balances[inputToken] || 0n
  
  // Fetch quote when input changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!inputAmount || parseFloat(inputAmount) <= 0) {
        setQuote(null)
        return
      }
      
      try {
        setIsLoadingQuote(true)
        const amountWei = parseAmountToWei(parseFloat(inputAmount))
        const newQuote = await getSwapQuote(inputToken, outputToken, amountWei)
        setQuote(newQuote)
      } catch (error) {
        console.error("Quote error:", error)
        setQuote(null)
      } finally {
        setIsLoadingQuote(false)
      }
    }
    
    const debounce = setTimeout(fetchQuote, 500)
    return () => clearTimeout(debounce)
  }, [inputAmount, inputToken, outputToken])
  
  // Swap tokens
  const handleSwapTokens = () => {
    const temp = inputToken
    handleInputTokenChange(outputToken)
    setOutputToken(temp)
    setInputAmount("")
    setQuote(null)
  }
  
  // Set max amount
  const handleSetMax = () => {
    if (inputBalance > 0n) {
      const maxAmount = formatWeiToAmount({ amount: inputBalance } as any)
      setInputAmount(maxAmount.toString())
    }
  }
  
  // Execute swap
  const handleSwap = async () => {
    // Swap functionality requires DEX integration
    // The circuit and contract are ready, but we need liquidity
    toast({
      title: "Coming Soon",
      description: "Private swaps require DEX liquidity integration. Available in next release.",
    })
    return
    
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
    
    // Find note to spend
    const availableNotes = getNotesForToken(notes, inputToken)
    const noteToSpend = availableNotes.find(n => n.amount >= quote.inputAmount)
    
    if (!noteToSpend) {
      toast({
        title: "Insufficient Balance",
        description: `Not enough ${inputToken} in a single note`,
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      
      // Prepare swap (in production, this would generate real proof)
      const result = await prepareShieldedSwap(
        noteToSpend,
        identity,
        quote,
        "0x0000000000000000000000000000000000000000" // TODO: Pool address
      )
      
      setStatus("relaying")
      
      // In production: Send transaction to contract
      // For now: Simulate success
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockTxHash = "0x" + "1234".repeat(16) // Mock
      setTxHash(mockTxHash)
      setStatus("success")
      
      // Add to transaction history
      const inputAmountWei = parseAmountToWei(inputAmount, inputToken)
      const outputAmountWei = quote.outputAmount
      addTransaction({
        type: 'swap',
        txHash: mockTxHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: inputToken,
        amount: inputAmount,
        amountWei: inputAmountWei.toString(),
        inputToken,
        outputToken,
        outputAmount: formatWeiToAmount({ amount: outputAmountWei } as any).toFixed(6),
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
                Max: {formatWeiToAmount({ amount: inputBalance } as any).toFixed(4)}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="text-xl"
              />
              <Select value={inputToken} onValueChange={(v) => handleInputTokenChange(v as SwapToken)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS).map((token) => (
                    <SelectItem key={token} value={token}>
                      {token}
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
                value={quote ? formatWeiToAmount({ amount: quote.outputAmount } as any).toFixed(6) : ""}
                readOnly
                className="text-xl bg-muted"
              />
              <Select value={outputToken} onValueChange={(v) => setOutputToken(v as SwapToken)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWAP_TOKENS)
                    .filter(t => t !== inputToken)
                    .map((token) => (
                      <SelectItem key={token} value={token}>
                        {token}
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
                <span>{formatWeiToAmount({ amount: quote.fee } as any).toFixed(6)} {outputToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={quote.priceImpact > 1 ? "text-destructive" : ""}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
            </div>
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
            disabled={!quote || parseFloat(inputAmount) <= 0}
          >
            <ArrowDownUp className="h-4 w-4 mr-2 opacity-85" strokeWidth={1.75} />
            Swap Privately
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


