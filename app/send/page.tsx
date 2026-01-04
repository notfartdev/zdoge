"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { TransferInterface } from "@/components/shielded/transfer-interface"
import { Card } from "@/components/ui/card"
import { Send } from "lucide-react"

export default function SendPage() {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Send className="h-8 w-8 text-primary" />
            Private Transfer
          </h1>
          <p className="text-muted-foreground">
            Send shielded DOGE to another private address. Fully anonymous, gas-free.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} />
        
        <Card className="p-6">
          <TransferInterface key={key} notes={notes} onSuccess={handleSuccess} />
        </Card>
      </main>
    </div>
  )
}

