"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { TransferInterface } from "@/components/shielded/transfer-interface"
import { Card } from "@/components/ui/card"
import { Send } from "lucide-react"

export default function SendPage() {
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
          <h1 className="font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-2 flex items-center gap-2 sm:gap-3">
            <img 
              src="https://z.cash/wp-content/uploads/2023/04/fair-open.gif" 
              alt="Send" 
              className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12"
            />
            Send Tokens
          </h1>
          <p className="mt-2 font-sans text-sm sm:text-base text-white/70 leading-relaxed tracking-[-0.01em]">
            Send shielded notes privately without revealing sender or amount.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} selectedToken={selectedToken} onTokenChange={setSelectedToken} compact />
        
        <Card className="p-6">
          <TransferInterface 
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

