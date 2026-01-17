"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
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
import { ConfirmationDialog } from "@/components/shielded/confirmation-dialog"
import { TransactionProgress, type TransactionStatus } from "@/components/shielded/transaction-progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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
  const [status, setStatus] = useState<"idle" | "approving" | "preparing" | "confirming" | "completing" | "confirmed" | "error">("idle")
  const [noteBackup, setNoteBackup] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [leafIndex, setLeafIndex] = useState<number | null>(null)
  const [pendingNote, setPendingNote] = useState<ShieldedNote | null>(null)
  const [allTokenBalances, setAllTokenBalances] = useState<Record<string, string>>({})
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  
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
  
  // Show confirmation dialog before shield
  const handleShield = () => {
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
    
    // Set pending shield function and show confirmation dialog
    // Note: executeShield is defined below, but this is fine since it's only called when confirmed
    setShowConfirmDialog(true)
  }
  
  // Execute shield (internal - called after confirmation)
  const executeShield = async () => {
    // Prevent duplicate calls
    if (isSubmittingRef.current || status !== "idle") {
      return
    }
    
    const amountNum = parseFloat(amount)
    
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
          
          let approveTx: string
          try {
            approveTx = await provider.request({
              method: "eth_sendTransaction",
              params: [{
                from: wallet.address,
                to: selectedTokenInfo.address,
                data: approveData,
              }],
            }) as string
          } catch (approveError: any) {
            // Check if user rejected/canceled the approval
            const errorMessage = approveError?.message?.toLowerCase() || ''
            const errorCode = approveError?.code
            
            if (
              errorCode === 4001 ||
              errorCode === '4001' ||
              errorMessage.includes('user rejected') ||
              errorMessage.includes('user denied') ||
              errorMessage.includes('rejected') ||
              errorMessage.includes('cancelled') ||
              errorMessage.includes('canceled')
            ) {
              // User canceled approval - reset gracefully
              console.log("[Shield] Approval canceled by user")
              setStatus("idle")
              toast({
                title: "Approval Canceled",
                description: "The token approval was canceled. No changes were made.",
                variant: "default",
              })
              return
            }
            // Re-throw other errors
            throw approveError
          }
          
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
      
      let hash: string
      try {
        hash = await provider.request({
          method: "eth_sendTransaction",
          params: [txRequest],
        }) as string
      } catch (txError: any) {
        // Check if user rejected/canceled the transaction
        const errorMessage = txError?.message?.toLowerCase() || ''
        const errorCode = txError?.code
        
        if (
          errorCode === 4001 || // User rejected request
          errorCode === '4001' ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('rejected') ||
          errorMessage.includes('cancelled') ||
          errorMessage.includes('canceled')
        ) {
          // User canceled - reset gracefully
          console.log("[Shield] Transaction canceled by user")
          setStatus("idle")
          toast({
            title: "Transaction Canceled",
            description: "The shield transaction was canceled. No changes were made.",
            variant: "default",
          })
          return
        }
        // Re-throw other errors to be handled by outer catch
        throw txError
      }
      
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
      
      // IMMEDIATELY refresh balances - don't wait for dialog
      window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
      
      // Refresh public balance immediately (shield decreases public balance)
      if (wallet?.refreshBalance) {
        wallet.refreshBalance().catch(err => console.warn('[Shield] Failed to refresh public balance:', err))
      }
      
      onSuccess?.() // Trigger parent component refresh
      
      // Phase 2: Micro-finalizing state (~500ms)
      // Show "Transaction confirmed" with "Finalizing shielded assets…" message
      setStatus("completing")
      
      // Smooth balance increment during finalizing (optimistic update already done)
      // The balance will update smoothly as the shielded balance refreshes
      
      // Phase 3: Show success dialog after finalizing acknowledgment
      // Keep micro-state ~500ms, then fade → animation → open Shield Success Modal
      setTimeout(() => {
        setStatus("confirmed")
        // Fade-out progress indicator (150ms) + small delay (50ms) = 200ms total before showing modal
        setTimeout(() => {
          setShowSuccessDialog(true)
        }, 200) // Fade-in delay after micro-state completes (200ms)
      }, 500) // Micro-finalizing phase duration (~500ms)
      
    } catch (error: any) {
      console.error("Shield error:", error)
      
      // Check if this is a user cancellation (should have been caught earlier, but double-check)
      const errorMessage = error?.message?.toLowerCase() || ''
      const errorCode = error?.code
      
      if (
        errorCode === 4001 ||
        errorCode === '4001' ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('rejected') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('canceled')
      ) {
        // User canceled - already handled, just reset
        setStatus("idle")
        return
      }
      
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
    setShowConfirmDialog(false)
    setShowSuccessDialog(false)
    isSubmittingRef.current = false
    // Ensure balances are refreshed when dialog closes
    window.dispatchEvent(new CustomEvent('shielded-wallet-updated'))
    
    // Refresh public balance when dialog closes
    if (wallet?.refreshBalance) {
      wallet.refreshBalance().catch(err => console.warn('[Shield] Failed to refresh public balance:', err))
    }
    
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
                  className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${amountError ? "border-orange-500/60 dark:border-orange-500/70 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/80" : ""}`}
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
                className="w-full min-h-[44px] sm:min-h-0 relative overflow-hidden bg-zinc-900/70 border border-zinc-700/80 hover:border-[#C2A633]/50 transition-all duration-300 group py-3 sm:py-2 backdrop-blur-sm"
                onClick={handleShield}
                disabled={!wallet?.isConnected || status !== "idle" || !amount || parseFloat(amount) <= 0 || !!amountError}
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
                  <Shield className="h-4 w-4 mr-2 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.05]" />
                  Shield {selectedToken}
                </span>
              </Button>
              
              {/* Confirmation Dialog */}
              <ConfirmationDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                title="Shield Assets"
                description={`${amount} ${selectedToken} will be stored in the shielded balance.`}
                confirmText="Confirm Shield"
                cancelText="Back"
                onConfirm={async () => {
                  setShowConfirmDialog(false)
                  await executeShield()
                }}
                isLoading={status === "approving" || status === "preparing" || status === "confirming"}
                details={
                  amount && parseFloat(amount) > 0 ? (
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-white text-right break-all">{amount} {selectedToken}</span>
                      </div>
                      {selectedTokenInfo.isNative && tokenBalanceNum > 0.001 && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-400">Estimated Gas:</span>
                          <span className="text-yellow-400 text-right break-all">0.001 {selectedToken}</span>
                        </div>
                      )}
                    </div>
                  ) : undefined
                }
              />
            </>
          )}
        </div>
      )}
      
      {status === "approving" && (
        <div className="space-y-3 sm:space-y-4">
          <Card className="p-3 sm:p-4 bg-zinc-900/50 border-[#C2A633]/20">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Loader2 
                  className="h-5 w-5 animate-spin text-[#C2A633]" 
                  style={{
                    filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white">
                    Step 1 of 2: Approving {selectedToken}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">
                    Please confirm the approval transaction in your wallet
                  </p>
                </div>
              </div>

              {/* Indeterminate looping shimmer bar - matching TransactionProgress pending style */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="relative h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden">
                  {/* Subtle pulsing base color - grey → gold → grey */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-zinc-700 via-[#C2A633]/20 to-zinc-700"
                    style={{
                      animation: 'colorPulse 3s ease-in-out infinite',
                      opacity: 0.3
                    }}
                  />
                  {/* Flowing shimmer effect - continuous loop */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C2A633]/40 to-transparent animate-shimmer"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s ease-in-out infinite'
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="p-3 rounded-lg bg-[#C2A633]/10 border border-[#C2A633]/20">
            <p className="text-xs text-gray-400 flex items-start gap-2">
              <Info className="h-4 w-4 text-[#C2A633] mt-0.5 flex-shrink-0" />
              <span><strong className="text-gray-300">Two-step process:</strong> {selectedToken} requires an approval first, then the shield transaction. This allows the contract to access your tokens.</span>
            </p>
          </div>
        </div>
      )}
      
      {/* Progress Indicator - Show during processing and completion phase */}
      {(status === "preparing" || status === "confirming" || status === "completing") && (
        <div className={cn(
          "transition-opacity duration-150",
          status === "confirmed" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <TransactionProgress
            status={
              status === "preparing" ? "proving" :
              status === "confirming" ? "pending" :
              status === "completing" ? "completing" :
              "idle"
            }
            message={
              status === "confirming" ? "Please confirm the transaction in your wallet to complete the shield"
              : undefined // Use default messages for proving (shows "This typically takes a few seconds.")
            }
            txHash={status === "completing" ? null : txHash} // Hide txHash during completing phase
            blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
          />
        </div>
      )}
      
      {status === "confirming" && (
        <Button 
          variant="outline" 
          className="w-full border-white/20 hover:bg-white/5" 
          onClick={reset}
        >
          Cancel Transaction
        </Button>
      )}
      
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
        title="Shield Complete"
        message="Assets have been privately stored in the shielded balance."
        txHash={txHash}
        blockExplorerUrl={dogeosTestnet.blockExplorers.default.url}
        actionText="Shield More Tokens"
        onAction={reset}
        onClose={reset}
        details={
          <div className="space-y-2.5 text-sm">
            <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
              <span className="text-gray-400">Amount</span>
              <span className="text-white font-semibold">{amount ? Number(amount).toFixed(4) : '0'} {selectedToken}</span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 flex justify-between items-center">
              <span className="text-gray-400">Destination</span>
              <span className="text-white font-mono text-xs">Shielded Balance</span>
            </div>
          </div>
        }
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
