"use client"

import { Loader2 } from "lucide-react"

interface AppLoadingOverlayProps {
  progress: number // 0-100
  isLoading: boolean
  hasCompletedInitialLoad: boolean
}

export function AppLoadingOverlay({ progress, isLoading, hasCompletedInitialLoad }: AppLoadingOverlayProps) {
  // Only show loading overlay if we haven't completed initial load yet
  // Once completed, never show it again (unless wallet disconnects and reconnects)
  if (hasCompletedInitialLoad) {
    return null
  }
  
  // Also hide if progress is 100 and not loading (safety check)
  if (progress >= 100 && !isLoading) {
    return null
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-2xl pointer-events-none">
      <Loader2 className="w-8 h-8 animate-spin text-[#C2A633]/60" strokeWidth={2} />
    </div>
  )
}
