"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Loader2, ArrowDownUp, AlertCircle, Check, RefreshCw } from "lucide-react"
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

interface SwapInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
}

export function SwapInterface({ notes, onSuccess }: SwapInterfaceProps) {
  const { toast } = useToast()
  
  const [inputToken, setInputToken] = useState<SwapToken>("DOGE")
  const [outputToken, setOutputToken] = useState<SwapToken>("USDC")
  const [inputAmount, setInputAmount] = useState("")
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [status, setStatus] = useState<"idle" | "quoting" | "confirming" | "success" | "error">("idle")
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
    setInputToken(outputToken)
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
      setStatus("confirming")
      
      // Prepare swap (in production, this would generate real proof)
      const result = await prepareShieldedSwap(
        noteToSpend,
        identity,
        quote,
        "0x0000000000000000000000000000000000000000" // TODO: Pool address
      )
      
      // In production: Send transaction to contract
      // For now: Simulate success
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setTxHash("0x" + "1234".repeat(16)) // Mock
      setStatus("success")
      
      toast({
        title: "Swap Successful!",
        description: `Swapped ${inputAmount} ${inputToken} for ${formatWeiToAmount({ amount: quote.outputAmount } as any).toFixed(4)} ${outputToken}`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Swap error:", error)
      setStatus("error")
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      })
    }
  }
  
  const reset = () => {
    setInputAmount("")
    setQuote(null)
    setStatus("idle")
    setTxHash(null)
  }
  
  if (Object.keys(balances).length === 0 || Object.values(balances).every(b => b === 0n)) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No shielded tokens to swap</p>
        <p className="text-sm text-muted-foreground mt-2">
          Shield some tokens first to enable swapping
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Swap Tokens</h3>
        <p className="text-sm text-muted-foreground">
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
              <Select value={inputToken} onValueChange={(v) => setInputToken(v as SwapToken)}>
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
            className="w-full" 
            onClick={handleSwap}
            disabled={!quote || parseFloat(inputAmount) <= 0}
          >
            <ArrowDownUp className="h-4 w-4 mr-2" />
            Swap Privately
          </Button>
        </div>
      )}
      
      {status === "confirming" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Executing private swap...</p>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4">
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Swap successful! Your shielded balance has been updated.
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
            Make Another Swap
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Swap failed. Your shielded tokens are safe.
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


