"use client"

import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface BalanceLoadingStateProps {
  progress: number // 0-100
  isLoading: boolean
  children?: React.ReactNode
}

export function BalanceLoadingState({ progress, isLoading, children }: BalanceLoadingStateProps) {
  // Only show loading state if actually loading and not at 100%
  if (progress >= 100 && !isLoading) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 space-y-3 min-h-[120px]">
      <div className="relative w-12 h-12">
        <Loader2 className="w-12 h-12 animate-spin text-[#C2A633]" strokeWidth={2} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono font-bold text-white/90">{Math.round(progress)}%</span>
        </div>
      </div>
      <div className="w-full max-w-[180px]">
        <Progress value={progress} className="h-1.5 bg-white/10" />
      </div>
      <p className="text-xs font-mono text-white/60 text-center max-w-[200px]">
        {progress < 25 && "Connecting wallet..."}
        {progress >= 25 && progress < 50 && "Fetching balances..."}
        {progress >= 50 && progress < 75 && "Initializing shielded wallet..."}
        {progress >= 75 && progress < 100 && "Syncing notes..."}
        {progress >= 100 && "Ready"}
      </p>
    </div>
  )
}
