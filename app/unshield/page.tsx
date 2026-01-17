"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { UnshieldInterface } from "@/components/shielded/unshield-interface"
import { Card } from "@/components/ui/card"
import { LogOut } from "lucide-react"

export default function UnshieldPage() {
  const { notes, refresh } = useShieldedState()
  const [selectedToken, setSelectedToken] = useState<string>("DOGE")
  
  const handleSuccess = () => {
    refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-2 flex items-center gap-2 sm:gap-3">
            <img 
              src="https://z.cash/wp-content/uploads/2023/04/privacy.gif" 
              alt="Unshield" 
              className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12"
            />
            Unshield Tokens
          </h1>
          <p className="mt-2 font-body text-sm sm:text-base text-white/70 leading-relaxed tracking-[-0.01em]">
            Convert shielded tokens back to your public wallet. Gas-free via relayer.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} selectedToken={selectedToken} onTokenChange={setSelectedToken} />
        
        <Card className="p-6">
          <UnshieldInterface 
            notes={notes} 
            onSuccess={handleSuccess}
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </Card>
      </main>
    </div>
  )
}

