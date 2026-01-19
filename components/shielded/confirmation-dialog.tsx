"use client"

import { useEffect } from "react"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { hapticConfirmation, hapticSuccess, hapticError } from "@/lib/haptic"

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
  // Haptic feedback when dialog opens
  useEffect(() => {
    if (open) {
      hapticConfirmation()
    }
  }, [open])

  const handleConfirm = async () => {
    hapticSuccess()
    await onConfirm()
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    if (variant === "destructive") {
      hapticError()
    }
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className={cn(
        variant === "destructive" 
          ? "border-red-500/30 shadow-red-500/10" 
          : "border-[#C2A633]/30 shadow-[#C2A633]/10"
      )}>
        <ResponsiveDialogHeader className="space-y-3">
          {variant === "destructive" && (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/30 mx-auto mb-2">
              <AlertCircle className="h-8 w-8 text-red-400" strokeWidth={2.5} />
            </div>
          )}
          <ResponsiveDialogTitle className={cn(
            "text-white text-lg sm:text-xl font-semibold text-center",
            !variant && "flex items-center justify-center gap-2"
          )}>
            {title}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-gray-300 text-center text-xs sm:text-sm leading-relaxed">
            {description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        
        {details && (
          <div className={cn(
            "my-3 sm:my-4 p-3 sm:p-4 rounded-xl bg-zinc-800/60 backdrop-blur-sm border shadow-inner",
            variant === "destructive"
              ? "border-red-500/20"
              : "border-[#C2A633]/20"
          )}>
            {details}
          </div>
        )}

        <ResponsiveDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 mt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-zinc-800/60 hover:bg-zinc-700/70 text-gray-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/60 rounded-xl px-4 py-2.5 h-12 sm:h-10 transition-all w-full sm:w-auto touch-manipulation"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "rounded-xl px-4 py-2.5 h-12 sm:h-10 font-medium border transition-all w-full sm:w-auto touch-manipulation",
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
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
