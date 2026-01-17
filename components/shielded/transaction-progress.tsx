"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type TransactionStatus = "idle" | "proving" | "relaying" | "pending" | "completing" | "confirmed" | "failed"

interface TransactionProgressProps {
  status: TransactionStatus
  progress?: number // 0-100
  message?: string
  provingText?: string // Custom text for "proving" status (default: "Generating zero-knowledge proof")
  txHash?: string | null
  blockExplorerUrl?: string
  className?: string
}

export function TransactionProgress({
  status,
  progress,
  message,
  provingText,
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
        return (
          <Loader2 
            className="h-5 w-5 animate-spin text-[#C2A633]" 
            style={{
              filter: 'drop-shadow(0 0 2px rgba(194, 166, 51, 0.3))'
            }}
          />
        )
      case "completing":
        return (
          <CheckCircle2 
            className="h-5 w-5 text-green-500 animate-in fade-in-0 zoom-in-95 duration-300"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))',
              animation: 'checkmarkPulse 500ms ease-out'
            }}
          />
        )
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
        return provingText || "Generating zero-knowledge proof"
      case "relaying":
        return "Submitting transaction..."
      case "pending":
        return "Waiting for wallet confirmation…"
      case "completing":
        return "Transaction confirmed"
      case "confirmed":
        return "Transaction confirmed!"
      case "failed":
        return "Transaction failed"
      default:
        return ""
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case "proving":
        return "This typically takes a few seconds."
      case "relaying":
        return message || "Relayer is submitting your transaction..."
      case "pending":
        return message || "Please confirm this transaction in your wallet"
      case "completing":
        return "Finalizing shielded assets…"
      default:
        return message
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "proving":
      case "relaying":
      case "pending":
        return "bg-[#C2A633]"
      case "completing":
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
    <Card className={cn("p-3 sm:p-4 bg-zinc-900/50 border-[#C2A633]/20", className)}>
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-white">{getStatusText()}</p>
            {getStatusMessage() && (
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">{getStatusMessage()}</p>
            )}
          </div>
        </div>

        {status === "proving" && (
          <div className="space-y-2">
            {/* Subtle looping shimmer bar */}
            <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C2A633]/30 to-transparent animate-shimmer" 
                   style={{
                     backgroundSize: '200% 100%',
                     animation: 'shimmer 2s ease-in-out infinite'
                   }}
              />
            </div>
          </div>
        )}

        {status === "completing" && (
          <div className="space-y-2">
            {/* Filled progress bar with ease-out animation as balance reaches final value */}
            <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full"
                style={{ 
                  width: '100%',
                  animation: 'progressEaseOut 500ms ease-out forwards'
                }}
              />
            </div>
          </div>
        )}

        {(status === "relaying" || status === "pending") && (
          <div className="space-y-1.5 sm:space-y-2">
            {/* Indeterminate looping shimmer bar - no fill, just continuous animation */}
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
        )}

        {/* Only show transaction hash during confirmed status (in success dialog), not during pending or completing */}
        {txHash && status === "confirmed" && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pt-2 border-t border-[#C2A633]/10">
            <span className="text-[10px] sm:text-xs text-gray-400 font-mono break-all sm:break-normal">
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </span>
            {blockExplorerUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-6 px-2 text-[10px] sm:text-xs self-start sm:self-auto min-h-[32px] sm:min-h-0"
                onClick={() => window.open(`${blockExplorerUrl}/tx/${txHash}`, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                View
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
