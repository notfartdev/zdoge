"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { TransferInterface } from "@/components/shielded/transfer-interface"
import { getNotes } from "@/lib/shielded/shielded-service"
import { Card } from "@/components/ui/card"
import { Send } from "lucide-react"
import Link from "next/link"

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
        
        <div className="mt-6 flex gap-4 text-sm">
          <Link href="/shield" className="text-primary hover:underline">← Shield more</Link>
          <Link href="/unshield" className="text-primary hover:underline">→ Unshield to public</Link>
        </div>
      </main>
    </div>
  )
}

