"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  variant?: "default" | "destructive"
  isLoading?: boolean
  details?: React.ReactNode
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  isLoading = false,
  details,
}: ConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn(
        "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-2 shadow-2xl rounded-2xl p-6 max-w-md",
        variant === "destructive" 
          ? "border-red-500/30 shadow-red-500/10" 
          : "border-[#C2A633]/30 shadow-[#C2A633]/10"
      )}>
        <AlertDialogHeader className="space-y-3">
          {variant === "destructive" && (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/30 mx-auto mb-2">
              <AlertCircle className="h-8 w-8 text-red-400" strokeWidth={2.5} />
            </div>
          )}
          <AlertDialogTitle className={cn(
            "text-white text-xl font-semibold text-center",
            !variant && "flex items-center justify-center gap-2"
          )}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300 text-center text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {details && (
          <div className={cn(
            "my-4 p-4 rounded-xl bg-zinc-800/60 backdrop-blur-sm border shadow-inner",
            variant === "destructive"
              ? "border-red-500/20"
              : "border-[#C2A633]/20"
          )}>
            {details}
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2 mt-6">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-zinc-800/60 hover:bg-zinc-700/70 text-gray-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/60 rounded-xl px-4 py-2.5 transition-all w-full sm:w-auto"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "rounded-xl px-4 py-2.5 font-medium border transition-all w-full sm:w-auto",
              variant === "destructive"
                ? "bg-red-500/10 hover:bg-red-500/15 text-red-400 border-red-500/30 hover:border-red-500/40"
                : "bg-[#C2A633]/10 hover:bg-[#C2A633]/15 text-[#C2A633] border-[#C2A633]/30 hover:border-[#C2A633]/40"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
