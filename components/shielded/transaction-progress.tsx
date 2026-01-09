"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type TransactionStatus = "idle" | "proving" | "relaying" | "pending" | "confirmed" | "failed"

interface TransactionProgressProps {
  status: TransactionStatus
  progress?: number // 0-100
  message?: string
  txHash?: string | null
  blockExplorerUrl?: string
  className?: string
}

export function TransactionProgress({
  status,
  progress,
  message,
  txHash,
  blockExplorerUrl,
  className
}: TransactionProgressProps) {
  const [displayProgress, setDisplayProgress] = useState(0)
  
  // Simulate progress if not provided
  useEffect(() => {
    if (progress !== undefined) {
      setDisplayProgress(progress)
    } else {
      // Auto-progress based on status
      switch (status) {
        case "proving":
          // Simulate proof generation progress (2-5 seconds)
          let provingProgress = 0
          const provingInterval = setInterval(() => {
            provingProgress += 2
            if (provingProgress >= 80) {
              clearInterval(provingInterval)
            }
            setDisplayProgress(provingProgress)
          }, 100)
          return () => clearInterval(provingInterval)
        
        case "relaying":
          setDisplayProgress(85)
          break
        
        case "pending":
          setDisplayProgress(90)
          break
        
        case "confirmed":
          setDisplayProgress(100)
          break
        
        case "failed":
          setDisplayProgress(0)
          break
        
        default:
          setDisplayProgress(0)
      }
    }
  }, [status, progress])

  const getStatusIcon = () => {
    switch (status) {
      case "proving":
      case "relaying":
      case "pending":
        return <Loader2 className="h-5 w-5 animate-spin text-[#C2A633]" />
      case "confirmed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "proving":
        return "Generating zero-knowledge proof..."
      case "relaying":
        return "Submitting transaction..."
      case "pending":
        return "Waiting for confirmation..."
      case "confirmed":
        return "Transaction confirmed!"
      case "failed":
        return "Transaction failed"
      default:
        return ""
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "proving":
      case "relaying":
      case "pending":
        return "bg-[#C2A633]"
      case "confirmed":
        return "bg-green-500"
      case "failed":
        return "bg-red-500"
      default:
        return "bg-gray-400"
    }
  }

  if (status === "idle") {
    return null
  }

  return (
    <Card className={cn("p-4 bg-zinc-900/50 border-[#C2A633]/20", className)}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{getStatusText()}</p>
            {message && (
              <p className="text-xs text-gray-400 mt-1">{message}</p>
            )}
          </div>
        </div>

        {(status === "proving" || status === "relaying" || status === "pending") && (
          <div className="space-y-2">
            <Progress 
              value={displayProgress} 
              className="h-2 bg-zinc-800"
            />
            <p className="text-xs text-gray-400 text-right">{Math.round(displayProgress)}%</p>
          </div>
        )}

        {txHash && status !== "idle" && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#C2A633]/10">
            <span className="text-xs text-gray-400 font-mono">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
            {blockExplorerUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => window.open(`${blockExplorerUrl}/tx/${txHash}`, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
