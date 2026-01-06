"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { SwapInterface } from "@/components/shielded/swap-interface"
import { Card } from "@/components/ui/card"
import { ArrowLeftRight } from "lucide-react"

export default function SwapPage() {
  const { notes, refresh } = useShieldedState()
  const [key, setKey] = useState(0)
  const [selectedToken, setSelectedToken] = useState<string>("DOGE")
  
  const handleSuccess = () => {
    refresh()
    setKey(k => k + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-2 flex items-center gap-2 sm:gap-3">
            <img 
              src="https://z.cash/wp-content/uploads/2023/04/fast-and-low-fees.gif" 
              alt="Swap" 
              className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12"
            />
            Swap Tokens
          </h1>
          <p className="mt-2 font-body text-sm sm:text-base text-white/70 leading-relaxed tracking-[-0.01em]">
            Exchange shielded tokens privately. Swap without revealing your identity.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} selectedToken={selectedToken} onTokenChange={setSelectedToken} compact />
        
        <Card className="p-6">
          <SwapInterface 
            key={key} 
            notes={notes} 
            onSuccess={handleSuccess}
            onInputTokenChange={setSelectedToken}
          />
        </Card>
      </main>
    </div>
  )
}

