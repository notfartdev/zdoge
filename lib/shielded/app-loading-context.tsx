"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface AppLoadingContextType {
  loadingProgress: number
  isLoading: boolean
  hasCompletedInitialLoad: boolean
  setLoadingProgress: (progress: number) => void
  setIsLoading: (loading: boolean) => void
  resetLoading: () => void // Reset when wallet disconnects
}

const AppLoadingContext = createContext<AppLoadingContextType | undefined>(undefined)

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false)

  // When loading reaches 100%, mark as completed immediately
  // This ensures once we hit 100%, we never show loading again
  useEffect(() => {
    if (loadingProgress >= 100 && !hasCompletedInitialLoad) {
      // Set completion flag immediately when we reach 100%
      // Don't wait for isLoading to be false - once progress hits 100%, we're done
      setHasCompletedInitialLoad(true)
      setIsLoading(false)
    }
  }, [loadingProgress, hasCompletedInitialLoad])

  const resetLoading = useCallback(() => {
    setLoadingProgress(0)
    setIsLoading(false)
    setHasCompletedInitialLoad(false)
  }, [])

  return (
    <AppLoadingContext.Provider value={{ 
      loadingProgress, 
      isLoading, 
      hasCompletedInitialLoad,
      setLoadingProgress, 
      setIsLoading,
      resetLoading
    }}>
      {children}
    </AppLoadingContext.Provider>
  )
}

export function useAppLoading() {
  const context = useContext(AppLoadingContext)
  if (context === undefined) {
    throw new Error("useAppLoading must be used within AppLoadingProvider")
  }
  return context
}
