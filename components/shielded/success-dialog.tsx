"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  txHash?: string | null
  txHashes?: string[] // For sequential transfers (multiple transactions)
  blockExplorerUrl?: string
  onClose?: () => void
  actionText?: string
  onAction?: () => void
  details?: React.ReactNode
}

export function SuccessDialog({
  open,
  onOpenChange,
  title,
  message,
  txHash,
  txHashes,
  blockExplorerUrl,
  onClose,
  actionText,
  onAction,
  details,
}: SuccessDialogProps) {
  // Use txHashes if provided (sequential transfers), otherwise use single txHash
  const transactions = txHashes && txHashes.length > 0 ? txHashes : (txHash ? [txHash] : [])
  const handleClose = () => {
    onClose?.()
    onOpenChange(false)
  }

  const handleAction = () => {
    onAction?.()
    onOpenChange(false)
  }

  // Prevent closing on outside click or ESC - only close via buttons
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Only allow closing if it's from our button handlers (handleClose/handleAction)
      // This prevents closing on outside click or ESC key
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent 
        className={cn(
          "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-[#C2A633]/30 shadow-2xl shadow-[#C2A633]/10 rounded-2xl p-4 sm:p-6 max-w-[95vw] sm:max-w-md",
          // Enter animations
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:duration-300",
          // Exit animations - smooth fade out
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-[250ms] data-[state=closed]:ease-in-out"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader className="space-y-3">
          {/* Minimalist success icon - simple checkmark */}
          <div className="flex items-center justify-center mx-auto mb-2">
            <div className="w-10 h-10 rounded-full bg-[#C2A633]/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-[#C2A633]" strokeWidth={2.5} />
            </div>
          </div>
          <AlertDialogTitle className="text-white text-lg sm:text-xl font-semibold text-center flex items-center justify-center gap-2">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300 text-center text-xs sm:text-sm leading-relaxed">
            {message && message.trim() !== '' 
              ? message 
              : transactions.length > 1 
                ? 'Sequential transfers finalized on-chain.' 
                : 'Transaction completed successfully.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {details && (
          <div className="my-3 sm:my-4 p-3 sm:p-4 rounded-xl bg-zinc-800/60 backdrop-blur-sm border border-[#C2A633]/20 shadow-inner">
            {details}
          </div>
        )}

        {transactions.length > 0 && blockExplorerUrl && (
          <div className="my-3 sm:my-4 space-y-2.5">
            {transactions.length === 1 ? (
              // Single transaction
              <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20 hover:border-[#C2A633]/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <span className="text-[10px] sm:text-xs text-gray-400">Transaction Link</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-[10px] sm:text-xs bg-zinc-800/60 hover:bg-zinc-700/60 text-gray-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/50 rounded-lg transition-all self-start sm:self-auto min-w-[120px] sm:min-w-0"
                    onClick={() => window.open(`${blockExplorerUrl}/tx/${transactions[0]}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    View on Explorer
                  </Button>
                </div>
              </div>
            ) : (
              // Multiple transactions (sequential transfer)
              <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/40 backdrop-blur-sm border border-[#C2A633]/20">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-3">
                  Executed as {transactions.length} split transaction{transactions.length > 1 ? 's' : ''}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.map((hash, index) => (
                    <div key={hash} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/30">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">#{index + 1}</span>
                        <span className="text-[10px] sm:text-xs text-gray-400 font-mono flex-1 break-all sm:break-normal sm:truncate">
                          {hash.slice(0, 8)}...{hash.slice(-6)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] bg-zinc-800/60 hover:bg-zinc-700/60 text-gray-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/50 rounded-lg transition-all"
                        onClick={() => window.open(`${blockExplorerUrl}/tx/${hash}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2 mt-6">
          {actionText && onAction ? (
            <>
              <AlertDialogAction
                onClick={handleClose}
                className="bg-zinc-800/60 hover:bg-zinc-700/70 text-gray-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/60 rounded-xl px-4 py-2.5 transition-all w-full sm:w-auto"
              >
                Done
              </AlertDialogAction>
              <AlertDialogAction
                onClick={handleAction}
                className="bg-[#C2A633]/10 hover:bg-[#C2A633]/15 text-[#C2A633] border border-[#C2A633]/30 hover:border-[#C2A633]/40 rounded-xl px-4 py-2.5 font-medium transition-all w-full sm:w-auto"
              >
                {actionText}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              onClick={handleClose}
              className="bg-[#C2A633]/10 hover:bg-[#C2A633]/15 text-[#C2A633] border border-[#C2A633]/30 hover:border-[#C2A633]/40 rounded-xl px-6 py-2.5 font-medium transition-all w-full"
            >
              Done
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
