"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Loader2, 
  AlertCircle, 
  Check, 
  Shield,
  Coins,
  Info,
  ExternalLink,
  Wallet
} from "lucide-react"
import { SuccessDialog } from "@/components/shielded/success-dialog"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { formatErrorWithSuggestion } from "@/lib/shielded/error-suggestions"
import { prepareShield, completeShield } from "@/lib/shielded/shielded-service"
import { noteToShareableString, ShieldedNote } from "@/lib/shielded/shielded-note"
import { shieldedPool, ERC20ABI, tokens, ShieldedPoolABI } from "@/lib/dogeos-config"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import { createPublicClient, http, parseAbiItem, type Address, encodeFunctionData, toHex, keccak256, toBytes } from "viem"
import { dogeosTestnet } from "@/lib/dogeos-config"

// Use the deployed contract address
const SHIELDED_POOL_ADDRESS = shieldedPool.address

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
})

// Token logo URLs - using Trust Wallet token list and CoinGecko
const TOKEN_LOGOS: Record<string, string> = {
  DOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  USD1: "https://assets.coingecko.com/coins/images/54977/standard/USD1_1000x1000_transparent.png",
  WETH: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
  LBTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
}

// All supported tokens for shielded pool
const SHIELDED_TOKENS = [
  { symbol: 'DOGE', name: 'Dogecoin', address: '0x0000000000000000000000000000000000000000' as `0x${string}`, isNative: true },
  { symbol: 'USDC', name: 'USD Coin', address: tokens.USDC.address, isNative: false },
  { symbol: 'USDT', name: 'Tether USD', address: tokens.USDT.address, isNative: false },
  { symbol: 'USD1', name: 'USD1', address: tokens.USD1.address, isNative: false },
  { symbol: 'WETH', name: 'Wrapped ETH', address: tokens.WETH.address, isNative: false },
  { symbol: 'LBTC', name: 'Liquid BTC', address: tokens.LBTC.address, isNative: false },
] as const

type ShieldedToken = typeof SHIELDED_TOKENS[number]['symbol']

const DepositEventABI = parseAbiItem('event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp)')
const ShieldEventABI = parseAbiItem('event Shield(bytes32 indexed commitment, uint256 indexed leafIndex, address indexed token, uint256 amount, uint256 timestamp)')

interface ShieldInterfaceProps {
  onSuccess?: () => void
  onReset?: () => void
  selectedToken?: string
  onTokenChange?: (token: string) => void
}

export function ShieldInterface({ onSuccess, onReset, selectedToken: externalToken, onTokenChange }: ShieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  // Initialize transaction history
  useEffect(() => {
    if (wallet?.address) {
      initTransactionHistory(wallet.address).catch(err => {
        console.warn('[Shield] Failed to init transaction history:', err)
      })
    }
  }, [wallet?.address])
  
  const [internalToken, setInternalToken] = useState<ShieldedToken>("DOGE")
  
  // Use external token if provided, otherwise use internal state
  const selectedToken = (externalToken as ShieldedToken) || internalToken
  
  const handleTokenChange = (token: ShieldedToken) => {
    setInternalToken(token)
    onTokenChange?.(token)
  }
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "approving" | "preparing" | "confirming" | "success" | "error">("idle")
  const [noteBackup, setNoteBackup] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [leafIndex, setLeafIndex] = useState<number | null>(null)
  const [pendingNote, setPendingNote] = useState<ShieldedNote | null>(null)
  const [allTokenBalances, setAllTokenBalances] = useState<Record<string, string>>({})
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false)
  
  // Get selected token info
  const selectedTokenInfo = SHIELDED_TOKENS.find(t => t.symbol === selectedToken)!
  
  // Current selected token balance
  const tokenBalance = allTokenBalances[selectedToken] || "0"
  const tokenBalanceNum = parseFloat(tokenBalance)
  
  // Validate amount input
  const handleAmountChange = (value: string) => {
    setAmount(value)
    setAmountError(null)
    
    if (!value || value === "") {
      return
    }
    
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) {
      setAmountError("Amount must be greater than 0")
      return
    }
    
    const maxAmount = selectedTokenInfo.isNative 
      ? Math.max(0, tokenBalanceNum - 0.001) // Leave 0.001 for gas
      : tokenBalanceNum
    
    if (numValue > maxAmount) {
      setAmountError(`Amount exceeds available balance (max: ${maxAmount.toFixed(4)} ${selectedToken})`)
      return
    }
    
    if (numValue > tokenBalanceNum) {
      setAmountError(`Amount exceeds balance (${tokenBalance} ${selectedToken})`)
      return
    }
  }
  
  // Fetch ALL token balances when wallet changes
  useEffect(() => {
    async function fetchAllBalances() {
      if (!wallet?.address) {
        setAllTokenBalances({})
        setIsLoadingBalance(false)
        return
      }
      
      setIsLoadingBalance(true)
      const balances: Record<string, string> = {}
      
      for (const token of SHIELDED_TOKENS) {
        try {
          if (token.isNative) {
            // Fetch native DOGE balance directly
            const provider = (window as any).ethereum
            if (provider) {
              const balance = await provider.request({
                method: "eth_getBalance",
                params: [wallet.address, "latest"],
              })
              const balanceWei = BigInt(balance)
              const balanceDoge = Number(balanceWei) / 1e18
              balances[token.symbol] = balanceDoge.toFixed(4)
            } else {
              balances[token.symbol] = "0"
            }
          } else {
            // Fetch ERC20 balance
            const balance = await publicClient.readContract({
              address: token.address,
              abi: ERC20ABI,
              functionName: 'balanceOf',
              args: [wallet.address as Address],
            })
            balances[token.symbol] = (Number(balance) / 1e18).toFixed(4)
          }
        } catch (e) {
          console.error(`Error fetching ${token.symbol} balance:`, e)
          balances[token.symbol] = "0"
        }
      }
      
      setAllTokenBalances(balances)
      setIsLoadingBalance(false)
    }
    fetchAllBalances()
    
    // Refresh balances every 10 seconds
    const interval = setInterval(fetchAllBalances, 10000)
    return () => clearInterval(interval)
  }, [wallet?.address])
  
  // Quick action: Shield all balance
  const handleShieldAll = () => {
    const balance = parseFloat(tokenBalance)
    if (balance <= 0.001) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${selectedToken} to shield`,
        variant: "destructive",
      })
      return
    }
    // Leave a small amount for gas if native
    const shieldAmount = selectedTokenInfo.isNative 
      ? Math.max(0, balance - 0.001) 
      : balance
    setAmount(shieldAmount.toFixed(4))
  }
  
  const handleShield = async () => {
    // Prevent duplicate calls
    if (isSubmittingRef.current || status !== "idle") {
      return
    }
    
    if (!wallet?.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }
    
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      })
      return
    }
    
    // Validate balance
    const maxAmount = selectedTokenInfo.isNative 
      ? Math.max(0, tokenBalanceNum - 0.001) // Leave 0.001 DOGE for gas
      : tokenBalanceNum
    
    if (amountNum > maxAmount) {
      toast({
        title: "Insufficient Balance",
        description: selectedTokenInfo.isNative
          ? `Insufficient ${selectedToken} balance. You need at least 0.001 ${selectedToken} for gas fees.`
          : `Amount exceeds available balance. You have ${tokenBalance} ${selectedToken}.`,
        variant: "destructive",
      })
      return
    }
    
    if (tokenBalanceNum <= 0 || amountNum > tokenBalanceNum) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough ${selectedToken}. Your balance: ${tokenBalance} ${selectedToken}`,
        variant: "destructive",
      })
      return
    }
    
    try {
      isSubmittingRef.current = true
      
      const provider = (window as any).ethereum
      if (!provider) {
        throw new Error("No wallet provider - please install MetaMask")
      }
      
      const amountWei = BigInt(Math.floor(amountNum * 1e18))
      
      // For ERC20 tokens, need to approve first
      if (!selectedTokenInfo.isNative) {
        setStatus("approving")
        console.log(`[Shield] Requesting approval for ${amountNum} ${selectedToken}`)
        
        // Check current allowance
        const allowance = await publicClient.readContract({
          address: selectedTokenInfo.address,
          abi: ERC20ABI,
          functionName: 'allowance',
          args: [wallet.address as Address, SHIELDED_POOL_ADDRESS as Address],
        })
        
        if (BigInt(allowance as bigint) < amountWei) {
          // Need approval
          const approveData = encodeFunctionData({
            abi: ERC20ABI,
            functionName: 'approve',
            args: [SHIELDED_POOL_ADDRESS as Address, amountWei],
          })
          
          const approveTx = await provider.request({
            method: "eth_sendTransaction",
            params: [{
              from: wallet.address,
              to: selectedTokenInfo.address,
              data: approveData,
            }],
          })
          
          console.log("[Shield] Approval tx:", approveTx)
          
          // Wait for approval
          await publicClient.waitForTransactionReceipt({
            hash: approveTx as `0x${string}`,
            confirmations: 1,
          })
          
          console.log("[Shield] Approval confirmed!")
        }
      }
      
      setStatus("preparing")
      
      console.log(`[Shield] Preparing shield for ${amountNum} ${selectedToken}`)
      
      // Prepare the shield (create note with token info)
      const { note, commitment, amountWei: noteAmountWei } = await prepareShield(amountNum, selectedToken)
      
      console.log("[Shield] Note prepared, commitment:", commitment.slice(0, 20) + "...")
      
      // Store note temporarily (NOT shown to user yet)
      setPendingNote(note)
      
      setStatus("confirming")
      
      let txRequest: any
      
      if (selectedTokenInfo.isNative) {
        // Native DOGE - use shieldNative
        txRequest = {
          from: wallet.address,
          to: SHIELDED_POOL_ADDRESS,
          value: `0x${noteAmountWei.toString(16)}`,
          data: `0x${encodeShieldNative(commitment)}`,
        }
      } else {
        // ERC20 - use shieldToken
        txRequest = {
          from: wallet.address,
          to: SHIELDED_POOL_ADDRESS,
          value: '0x0',
          data: encodeShieldTokenCall(selectedTokenInfo.address, noteAmountWei, commitment),
        }
      }
      
      console.log("[Shield] TX Request:", JSON.stringify(txRequest, null, 2))
      
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [txRequest],
      })
      
      console.log("[Shield] Transaction submitted! Hash:", hash)
      
      setTxHash(hash)
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        confirmations: 1,
      })
      
      // Get leafIndex from Shield event
      let actualLeafIndex: number | undefined
      
      // Try parsing logs
      try {
        console.log("Fetching Shield event from block", receipt.blockNumber)
        
        // Look for Shield event in raw logs
        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() === SHIELDED_POOL_ADDRESS.toLowerCase() &&
            log.topics.length >= 3
          ) {
            const logCommitment = log.topics[1]?.toLowerCase()
            const commitmentHex = commitment.toLowerCase()
            
            if (logCommitment === commitmentHex) {
              actualLeafIndex = parseInt(log.topics[2] || '0', 16)
              console.log(`Found via raw parsing at leafIndex: ${actualLeafIndex}`)
              break
            }
          }
        }
      } catch (e) {
        console.warn("Event parsing failed:", e)
      }
      
      // NO FALLBACK - if we can't find the leafIndex, throw an error
      if (actualLeafIndex === undefined) {
        throw new Error(
          "Could not find Shield event in transaction. " +
          "This shouldn't happen - please check the transaction on block explorer."
        )
      }
      
      setLeafIndex(actualLeafIndex)
      
      // Complete the shield (save note with leafIndex)
      completeShield(note, actualLeafIndex)
      
      // Add to transaction history
      addTransaction({
        type: 'shield',
        txHash: hash as string,
        timestamp: Math.floor(Date.now() / 1000),
        token: selectedToken,
        amount: amountNum.toFixed(4),
        amountWei: noteAmountWei.toString(),
        commitment: commitment,
        leafIndex: actualLeafIndex,
        status: 'confirmed',
        blockNumber: Number(receipt.blockNumber),
      })
      
      // NOW show the note backup (after confirmation)
      const backup = noteToShareableString(note)
      setNoteBackup(backup)
      
      setStatus("success")
      setShowSuccessDialog(true)
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Shield error:", error)
      setStatus("error")
      
      // Smart error suggestions
      const errorInfo = formatErrorWithSuggestion(error, {
        operation: 'shield',
        token: selectedToken,
        hasPublicBalance: tokenBalanceNum > 0,
      })
      
      toast({
        title: errorInfo.title,
        description: errorInfo.suggestion ? `${errorInfo.description} ${errorInfo.suggestion}` : errorInfo.description,
        variant: "destructive",
      })
    } finally {
      isSubmittingRef.current = false
    }
  }
  
  const reset = () => {
    setAmount("")
    setStatus("idle")
    setNoteBackup(null)
    setTxHash(null)
    setLeafIndex(null)
    setPendingNote(null)
    setAmountError(null)
    isSubmittingRef.current = false
    // Trigger component reset in AppCard
    onReset?.()
  }
  
  return (
    <div className="space-y-4">
      {status === "idle" && (
        <div className="space-y-4">
          {/* Empty State - No Balance */}
          {tokenBalanceNum <= 0 ? (
            null
          ) : (
            <>
              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount ({selectedToken})</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={handleShieldAll}
                    disabled={tokenBalanceNum <= (selectedTokenInfo.isNative ? 0.001 : 0)}
                  >
                    Max: {tokenBalance} {selectedToken}
                  </Button>
                </div>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className={amountError ? "border-orange-500/60 dark:border-orange-500/70 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/80" : ""}
                />
                {amountError && (
                  <div className="p-2.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs font-body text-orange-400 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                      <span>{amountError}</span>
                    </p>
                  </div>
                )}
                <div className="text-xs font-body text-white/60">
                  {isLoadingBalance ? (
                    <div className="flex items-center gap-2 text-white/50">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Loading balance...</span>
                    </div>
                  ) : (
                    <>
                      Available: {tokenBalance} {selectedToken}
                      {selectedTokenInfo.isNative && tokenBalanceNum > 0.001 && (
                        <span className="ml-1">(0.001 reserved for gas)</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Info Box */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-body text-muted-foreground flex items-center gap-2">
                  <img src={TOKEN_LOGOS[selectedToken]} alt={selectedToken} className="w-4 h-4 rounded-full inline" />
                  <span>
                    <strong>Shielding {selectedToken}:</strong>{' '}
                    {selectedTokenInfo.isNative 
                      ? "Your DOGE will be privately stored in the shielded pool."
                      : `After approval, your ${selectedToken} will be shielded.`
                    }
                  </span>
                </p>
              </div>
              
              <Button 
                className="w-full relative overflow-hidden bg-white/10 border border-white/20 hover:border-[#B89A2E]/50 transition-all duration-500 group"
                onClick={handleShield}
                disabled={!wallet?.isConnected || status !== "idle" || !amount || parseFloat(amount) <= 0 || !!amountError}
              >
                {/* Fill animation from left to right - slower and more natural */}
                <span className="absolute inset-0 bg-[#B89A2E] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-[1300ms] ease-in-out" />
                <span className="relative z-10 flex items-center justify-center text-white group-hover:text-black transition-colors duration-[1300ms] ease-in-out">
                  <Shield className="h-4 w-4 mr-2" />
                  Shield {selectedToken}
                </span>
              </Button>
            </>
          )}
        </div>
      )}
      
      {status === "approving" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="w-full max-w-xs space-y-2">
              <Progress value={25} className="h-2" />
              <p className="text-sm font-body font-medium text-foreground text-center">
                Step 1 of 2: Approving {selectedToken}
              </p>
              <p className="text-xs font-body text-white/60 text-center">
                Please confirm the approval transaction in your wallet
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs font-body text-white/60 flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span><strong>Two-step process:</strong> {selectedToken} requires an approval first, then the shield transaction. This allows the contract to access your tokens.</span>
            </p>
          </div>
        </div>
      )}
      
      {status === "preparing" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="w-full max-w-xs space-y-2">
            <Progress value={selectedTokenInfo.isNative ? 50 : 60} className="h-2" />
            <p className="text-sm font-body font-medium text-foreground text-center">
              {selectedTokenInfo.isNative ? "Preparing shield transaction" : "Step 2 of 2: Preparing shield"}
            </p>
            <p className="text-xs font-body text-white/60 text-center">
              Generating your private note and preparing the transaction...
            </p>
          </div>
        </div>
      )}
      
      {status === "confirming" && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated Wallet Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-white/80 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C2A633] flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-black animate-spin" />
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full max-w-xs space-y-3">
                <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full w-full bg-white rounded-full origin-left"
                    style={{ 
                      animation: `progressFill${selectedTokenInfo.isNative ? '75' : '85'} 2.5s ease-out infinite`
                    }}
                  />
                </div>
                <div className="space-y-2 text-center">
                  <h4 className="text-base font-display font-semibold text-white">
                    {selectedTokenInfo.isNative ? "Waiting for Confirmation" : "Step 2 of 2: Shielding Tokens"}
                  </h4>
                  <p className="text-sm font-body text-white/60 leading-relaxed">
                    Please confirm the transaction in your wallet to complete the shield
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full border-white/20 hover:bg-white/5" 
            onClick={reset}
          >
            Cancel Transaction
          </Button>
        </div>
      )}
      
      {/* Success Dialog */}
      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          // Only allow closing via buttons, not by clicking outside or scrolling
          if (!open && status === "success") {
            reset()
          } else {
            setShowSuccessDialog(true)
          }
        }}
        title="Shield Successful!"
        message={`Successfully shielded ${amount ? Number(amount).toFixed(4) : '0'} ${selectedToken}. Your funds are now private and protected.`}
        txHash={txHash}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Shield More Tokens"
        onAction={reset}
        onClose={reset}
      />
      
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-body font-medium text-orange-300 mb-1">
                  Transaction Failed
                </p>
                <p className="text-sm font-body text-orange-400/90">
                  Shield transaction failed. Your funds are safe.
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

// Helper to encode shieldNative function call
function encodeShieldNative(commitment: `0x${string}`): string {
  // Function selector for shieldNative(bytes32)
  const selector = "b13d48f2"
  const commitmentHex = commitment.slice(2).padStart(64, "0")
  return selector + commitmentHex
}

// Helper to encode shieldToken function call using viem
function encodeShieldTokenCall(tokenAddress: `0x${string}`, amount: bigint, commitment: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: ShieldedPoolABI,
    functionName: 'shieldToken',
    args: [tokenAddress, amount, commitment],
  })
}
