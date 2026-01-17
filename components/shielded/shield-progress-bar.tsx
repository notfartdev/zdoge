"use client"

import { cn } from "@/lib/utils"

interface ShieldProgressBarProps {
  progress: number // 0-1 (0 to 100%)
  className?: string
  showGlow?: boolean
  flowingGradient?: boolean // Add flowing gradient animation for transfer
}

/**
 * Reusable progress bar component for shield/unshield/transfer operations.
 * EXACT SAME design as shield/unshield: same thickness, same gradient, same structure.
 * For transfer: adds flowing gradient animation.
 */
export function ShieldProgressBar({ 
  progress, 
  className,
  showGlow = false,
  flowingGradient = false
}: ShieldProgressBarProps) {
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress))
  
  return (
    <div className={cn("relative w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden", className)}>
      {/* Base filled progress with gradient */}
      <div 
        className="absolute top-0 left-0 h-full rounded-full"
        style={{ 
          // Gold gradient with brighter leading edge (EXACT SAME as shield/unshield, more visible gradient)
          background: 'linear-gradient(to right, #C2A633, #C2A633, rgba(194, 166, 51, 0.9), rgba(194, 166, 51, 0.75))',
          width: `${clampedProgress * 100}%`,
          // Only animates when progress changes (350ms ease-out, same as shield/unshield)
          transition: 'width 350ms ease-out, box-shadow 350ms ease-out',
          // Subtle glow pulse only when showGlow is true (on phase change)
          boxShadow: showGlow ? '0 0 8px rgba(194, 166, 51, 0.4)' : 'none'
        }}
      />
      {/* Flowing gradient overlay (for transfer) - animates across the filled portion (more transparent) */}
      {flowingGradient && clampedProgress > 0 && (
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${clampedProgress * 100}%`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(194, 166, 51, 0.25) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  )
}
