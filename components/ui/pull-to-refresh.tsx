"use client"

import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  progress: number
  threshold?: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null

  const isReady = pullDistance >= threshold

  return (
    <div
      className={cn(
        "flex items-center justify-center transition-all duration-200 overflow-hidden",
        isRefreshing ? "h-12" : "h-0"
      )}
      style={{
        height: isRefreshing ? 48 : Math.min(pullDistance, threshold),
        opacity: isRefreshing ? 1 : Math.min(progress, 1),
      }}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          isReady && "text-[#C2A633]"
        )}
      >
        <RefreshCw
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isRefreshing && "animate-spin",
            isReady && !isRefreshing && "text-[#C2A633]"
          )}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${Math.min(progress * 360, 360)}deg)`,
          }}
        />
        <span className="text-xs font-medium">
          {isRefreshing
            ? "Refreshing..."
            : isReady
            ? "Release to refresh"
            : "Pull to refresh"}
        </span>
      </div>
    </div>
  )
}
