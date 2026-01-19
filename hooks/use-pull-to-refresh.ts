"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { haptic } from '@/lib/haptic'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number // Pull distance to trigger refresh (default: 80px)
  maxPull?: number // Maximum pull distance (default: 120px)
  disabled?: boolean
}

interface UsePullToRefreshReturn {
  pullDistance: number
  isRefreshing: boolean
  isPulling: boolean
  progress: number // 0-1 progress towards threshold
  containerRef: React.RefObject<HTMLDivElement>
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)
  const triggeredHaptic = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return
    
    const container = containerRef.current
    if (!container) return
    
    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop > 0) return
    
    startY.current = e.touches[0].clientY
    currentY.current = startY.current
    triggeredHaptic.current = false
    setIsPulling(true)
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || !isPulling) return
    
    const container = containerRef.current
    if (!container) return
    
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    
    // Only pull down, not up
    if (diff < 0) {
      setPullDistance(0)
      return
    }
    
    // Apply resistance (pull gets harder as you go further)
    const resistance = 0.5
    const pull = Math.min(diff * resistance, maxPull)
    setPullDistance(pull)
    
    // Trigger haptic when crossing threshold
    if (pull >= threshold && !triggeredHaptic.current) {
      haptic('medium')
      triggeredHaptic.current = true
    } else if (pull < threshold && triggeredHaptic.current) {
      triggeredHaptic.current = false
    }
    
    // Prevent default scroll when pulling
    if (pull > 0) {
      e.preventDefault()
    }
  }, [disabled, isRefreshing, isPulling, threshold, maxPull])

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return
    
    setIsPulling(false)
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true)
      haptic('success')
      
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const progress = Math.min(pullDistance / threshold, 1)

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    progress,
    containerRef,
  }
}
