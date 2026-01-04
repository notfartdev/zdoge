"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Loader2, 
  AlertCircle, 
  Check, 
  ShieldPlus,
  Coins
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
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
  selectedToken?: string
  onTokenChange?: (token: string) => void
}

export function ShieldInterface({ onSuccess, selectedToken: externalToken, onTokenChange }: ShieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  // Initialize transaction history
  useEffect(() => {
    if (wallet?.address) {
      initTransactionHistory(wallet.address)
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
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false)
  
  // Get selected token info
  const selectedTokenInfo = SHIELDED_TOKENS.find(t => t.symbol === selectedToken)!
  
  // Current selected token balance
  const tokenBalance = allTokenBalances[selectedToken] || "0"
  
  // Fetch ALL token balances when wallet changes
  useEffect(() => {
    async function fetchAllBalances() {
      if (!wallet?.address) {
        setAllTokenBalances({})
        return
      }
      
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
        description: "Please enter a valid amount",
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
      
      toast({
        title: "Shield Successful!",
        description: `${amountNum} ${selectedToken} is now shielded`,
      })
      
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Shield error:", error)
      setStatus("error")
      toast({
        title: "Shield Failed",
        description: error.message || "Transaction failed",
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
    isSubmittingRef.current = false
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Shield Tokens
        </h3>
        <p className="text-sm text-muted-foreground">
          Deposit public tokens into your shielded balance
        </p>
      </div>
      
      {status === "idle" && (
        <div className="space-y-4">
          {/* Token Selector with Balances */}
          <div className="space-y-2">
            <Label>Select Token</Label>
            <Select value={selectedToken} onValueChange={(v) => handleTokenChange(v as ShieldedToken)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIELDED_TOKENS.map((token) => {
                  const bal = allTokenBalances[token.symbol] || "0"
                  const hasBalance = parseFloat(bal) > 0
                  return (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-2">
                          <img 
                            src={TOKEN_LOGOS[token.symbol]} 
                            alt={token.symbol} 
                            className="w-5 h-5 rounded-full"
                          />
                          <span>{token.symbol}</span>
                        </div>
                        <span className={`text-xs ${hasBalance ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {bal}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          
          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount ({selectedToken})</Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={handleShieldAll}
              >
                Max: {tokenBalance} {selectedToken}
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          
          {/* Info Box */}
          {parseFloat(tokenBalance) > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
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
          )}
          
          <Button 
            className="w-full" 
            onClick={handleShield}
            disabled={!wallet?.isConnected || status !== "idle"}
          >
            <ShieldPlus className="h-4 w-4 mr-2" />
            Shield {selectedToken}
          </Button>
        </div>
      )}
      
      {status === "approving" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Step 1/2: Approving {selectedToken}...</p>
            <p className="text-xs text-muted-foreground">
              Confirm the approval transaction in MetaMask
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              ℹ️ <strong>Two-step process:</strong> ERC20 tokens require an approval first, then the shield transaction.
            </p>
          </div>
        </div>
      )}
      
      {status === "preparing" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">
            {selectedTokenInfo.isNative ? "Preparing shield..." : "Step 2/2: Preparing shield..."}
          </p>
        </div>
      )}
      
      {status === "confirming" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">
              {selectedTokenInfo.isNative ? "Waiting for confirmation..." : "Step 2/2: Shielding tokens..."}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={reset}
          >
            Cancel and try again
          </Button>
        </div>
      )}
      
      {status === "success" && noteBackup && (
        <div className="space-y-4" ref={(el) => {
          if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }
        }}>
          <Alert className="border-green-500/50 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription className="flex flex-col gap-2">
              <div>
                <strong>Shield Successful!</strong> {amount} {selectedToken} is now shielded. Your funds are now private.
              </div>
              {txHash && (
                <a 
                  href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm font-mono flex items-center gap-1 mt-1"
                >
                  View transaction on Blockscout →
                </a>
              )}
            </AlertDescription>
          </Alert>
          
          <Button className="w-full" onClick={reset}>
            Shield More Tokens
          </Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Shield transaction failed. Your funds are safe.
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
