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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <Send className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Private Transfer
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Send shielded tokens to another private address. Fully anonymous, gas-free.
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

