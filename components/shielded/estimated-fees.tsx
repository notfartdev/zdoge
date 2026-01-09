"use client"

import { Card } from "@/components/ui/card"
import { Info, Loader2 } from "lucide-react"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { cn } from "@/lib/utils"

interface EstimatedFeesProps {
  amount: bigint
  fee: bigint
  received: bigint
  token: string
  tokenDecimals: number
  isLoading?: boolean
  className?: string
}

export function EstimatedFees({
  amount,
  fee,
  received,
  token,
  tokenDecimals,
  isLoading = false,
  className,
}: EstimatedFeesProps) {
  // Format amounts with reasonable decimals (max 4-6, remove trailing zeros)
  const formatDisplayAmount = (value: bigint, decimals: number): string => {
    const formatted = formatWeiToAmount(value, decimals)
    const num = parseFloat(formatted)
    if (isNaN(num)) return formatted
    // Limit to 6 decimals max, remove trailing zeros
    return num.toFixed(6).replace(/\.?0+$/, '')
  }

  const amountFormatted = formatDisplayAmount(amount, tokenDecimals)
  const feeFormatted = formatDisplayAmount(fee, tokenDecimals)
  const receivedFormatted = formatDisplayAmount(received, tokenDecimals)
  const feePercent = amount > 0n ? (Number(fee) / Number(amount)) * 100 : 0

  if (isLoading) {
    return (
      <Card className={cn("p-4 bg-zinc-900/50 border-[#C2A633]/20", className)}>
        <div className="flex items-center gap-2 text-[#C2A633]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Calculating fees...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("p-4 bg-zinc-900/50 border-[#C2A633]/20", className)}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#C2A633]" />
          <span className="text-sm font-medium text-white">Estimated Fees</span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Amount</span>
            <span className="text-white font-mono">{amountFormatted} {token}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Relayer Fee</span>
            <span className="text-red-400 font-mono">-{feeFormatted} {token}</span>
          </div>
          <div className="pt-2 border-t border-[#C2A633]/10 flex justify-between">
            <span className="text-gray-400">You Receive</span>
            <span className="text-green-400 font-mono font-semibold">{receivedFormatted} {token}</span>
          </div>
          <div className="text-xs text-gray-500 pt-1">
            Fee: {feePercent.toFixed(2)}%
          </div>
        </div>
      </div>
    </Card>
  )
}
