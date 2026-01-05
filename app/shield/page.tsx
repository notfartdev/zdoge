"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { ShieldInterface } from "@/components/shielded/shield-interface"
import { Card } from "@/components/ui/card"
import { ShieldPlus, Loader2 } from "lucide-react"

function ShieldPageContent() {
  const { refresh } = useShieldedState()
  const [key, setKey] = useState(0)
  const searchParams = useSearchParams()
  const [selectedToken, setSelectedToken] = useState<string>(() => {
    // Get token from URL params if present, otherwise default to DOGE
    const tokenParam = searchParams.get('token')
    const validTokens = ['DOGE', 'USDC', 'USDT', 'USD1', 'WETH', 'LBTC']
    return (tokenParam && validTokens.includes(tokenParam.toUpperCase())) ? tokenParam.toUpperCase() : "DOGE"
  })
  
  const handleSuccess = () => {
    refresh()
    // Don't reset key immediately - let the success state display first
    // The component will reset when user clicks "Shield More Tokens"
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-mono">
            Shield Tokens
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-mono">
            Convert public tokens to private shielded notes. Your funds become invisible on-chain.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} selectedToken={selectedToken} onTokenChange={setSelectedToken} />
        
        <Card className="p-6">
          <ShieldInterface 
            key={key} 
            onSuccess={handleSuccess} 
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </Card>
      </main>
    </div>
  )
}

export default function ShieldPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <ShieldPageContent />
    </Suspense>
  )
}
