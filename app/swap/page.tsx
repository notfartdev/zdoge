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
  
  const handleSuccess = () => {
    refresh()
    setKey(k => k + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <ArrowLeftRight className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Private Swap
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Exchange shielded tokens privately. Swap without revealing your identity.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} />
        
        <Card className="p-6">
          <SwapInterface key={key} notes={notes} onSuccess={handleSuccess} />
        </Card>
      </main>
    </div>
  )
}

