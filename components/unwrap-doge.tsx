"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useWallet } from "@/lib/wallet-context"
import { Loader2, ArrowDown, Check, AlertCircle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { tokens, links } from "@/lib/dogeos-config"
import { contractService } from "@/lib/contract-service"

// wDOGE ABI for wrap/unwrap
const WDOGE_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export function UnwrapDoge() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState<string>("")
  const [wdogeBalance, setWdogeBalance] = useState<bigint>(0n)
  const [dogeBalance, setDogeBalance] = useState<bigint>(0n)
  const [txStatus, setTxStatus] = useState<"idle" | "unwrapping" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string>("")

  // Fetch balances
  useEffect(() => {
    async function fetchBalances() {
      if (wallet?.isConnected && wallet.address) {
        try {
          // Get wDOGE balance
          const wdoge = await contractService.getTokenBalance(
            tokens.WDOGE.address,
            wallet.address
          )
          setWdogeBalance(wdoge)
          
          // Get native DOGE balance
          const doge = await contractService.getNativeBalance(wallet.address)
          setDogeBalance(doge)
        } catch (err) {
          console.error("Failed to fetch balances:", err)
        }
      }
    }
    fetchBalances()
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalances, 10000)
    return () => clearInterval(interval)
  }, [wallet?.isConnected, wallet?.address])

  const formatBalance = (balance: bigint): string => {
    const divisor = BigInt(10 ** 18)
    const whole = balance / divisor
    const remainder = balance % divisor
    if (remainder === 0n) return whole.toString()
    const decimal = remainder.toString().padStart(18, '0').slice(0, 4)
    return `${whole}.${decimal}`
  }

  const handleUnwrap = async () => {
    if (!wallet?.isConnected || !wallet.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    const amountWei = BigInt(Math.floor(amountNum * 10 ** 18))
    
    if (amountWei > wdogeBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${formatBalance(wdogeBalance)} wDOGE.`,
        variant: "destructive",
      })
      return
    }

    setTxStatus("unwrapping")

    try {
      // Encode withdraw function call
      const selector = '0x2e1a7d4d' // keccak256("withdraw(uint256)")[:4]
      const amountHex = amountWei.toString(16).padStart(64, '0')
      const data = selector + amountHex

      toast({
        title: "Confirm Transaction",
        description: "Please confirm the unwrap transaction in your wallet.",
      })

      // Send transaction
      const hash = await window.ethereum!.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: tokens.WDOGE.address,
          data: data,
        }],
      })

      setTxHash(hash)

      // Wait for confirmation
      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation...",
      })

      // Poll for receipt
      let receipt = null
      while (!receipt) {
        await new Promise(r => setTimeout(r, 2000))
        receipt = await window.ethereum!.request({
          method: 'eth_getTransactionReceipt',
          params: [hash],
        })
      }

      if (receipt.status === '0x1') {
        setTxStatus("success")
        toast({
          title: "Unwrap Successful!",
          description: `${amount} wDOGE has been converted to native DOGE.`,
        })
        setAmount("")
        
        // Refresh balances
        const wdoge = await contractService.getTokenBalance(tokens.WDOGE.address, wallet.address)
        const doge = await contractService.getNativeBalance(wallet.address)
        setWdogeBalance(wdoge)
        setDogeBalance(doge)
      } else {
        throw new Error("Transaction failed")
      }

    } catch (err: any) {
      console.error("Unwrap failed:", err)
      setTxStatus("error")
      toast({
        title: "Unwrap Failed",
        description: err.message || "Transaction was rejected or failed.",
        variant: "destructive",
      })
    }

    // Reset status after a delay
    setTimeout(() => setTxStatus("idle"), 3000)
  }

  const handleMax = () => {
    setAmount(formatBalance(wdogeBalance))
  }

  return (
    <Card className="bg-black border-[#C2A633]/20 p-0 rounded-none overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="font-mono text-xl font-bold text-white">Unwrap wDOGE</h2>
          <p className="font-mono text-xs text-gray-400">
            Convert your wrapped DOGE (wDOGE) back to native DOGE
          </p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-950/50 border border-zinc-800">
            <p className="font-mono text-xs text-gray-500 mb-1">wDOGE Balance</p>
            <p className="font-mono text-lg font-bold text-[#C2A633]">
              {formatBalance(wdogeBalance)} wDOGE
            </p>
          </div>
          <div className="p-4 bg-zinc-950/50 border border-zinc-800">
            <p className="font-mono text-xs text-gray-500 mb-1">DOGE Balance</p>
            <p className="font-mono text-lg font-bold text-white">
              {formatBalance(dogeBalance)} DOGE
            </p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-3">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Amount to Unwrap
          </Label>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={txStatus !== "idle"}
              className="h-14 bg-black border-[#C2A633]/30 text-white font-mono text-xl pr-24 focus:border-[#C2A633] rounded-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={handleMax}
                disabled={txStatus !== "idle"}
                className="px-2 py-1 text-xs font-mono text-[#C2A633] hover:text-white border border-[#C2A633]/30 hover:border-[#C2A633] transition-colors"
              >
                MAX
              </button>
              <span className="font-mono text-sm text-gray-500">wDOGE</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-[#C2A633]" />
          </div>
        </div>

        {/* Output Preview */}
        <div className="p-4 bg-zinc-950/50 border border-zinc-800">
          <p className="font-mono text-xs text-gray-500 mb-1">You will receive</p>
          <p className="font-mono text-2xl font-bold text-white">
            {amount || "0"} <span className="text-[#C2A633]">DOGE</span>
          </p>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="font-mono text-xs text-blue-300">
              wDOGE and DOGE are always 1:1. Unwrapping is instant and only costs gas.
            </p>
          </div>
        </div>

        {/* Unwrap Button */}
        <Button
          onClick={handleUnwrap}
          disabled={txStatus !== "idle" || !wallet?.isConnected || !amount || parseFloat(amount) <= 0}
          className="w-full h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {txStatus === "unwrapping" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Unwrapping...
            </>
          ) : txStatus === "success" ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Success!
            </>
          ) : !wallet?.isConnected ? (
            "Connect Wallet First"
          ) : (
            "Unwrap wDOGE → DOGE"
          )}
        </Button>

        {/* Transaction Link */}
        {txHash && (
          <a
            href={`${links.explorer}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 font-mono text-xs text-[#C2A633] hover:text-white transition-colors"
          >
            View Transaction
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </Card>
  )
}

