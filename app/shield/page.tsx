"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { ShieldInterface } from "@/components/shielded/shield-interface"
import { Card } from "@/components/ui/card"
import { ShieldPlus } from "lucide-react"

export default function ShieldPage() {
  const { refresh } = useShieldedState()
  const [key, setKey] = useState(0)
  const [selectedToken, setSelectedToken] = useState<string>("DOGE")
  
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <ShieldPlus className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Shield Tokens
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Convert public tokens to private shielded notes. Your funds become invisible on-chain.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} selectedToken={selectedToken} />
        
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
