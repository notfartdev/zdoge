"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { SwapInterface } from "@/components/shielded/swap-interface"
import { getNotes } from "@/lib/shielded/shielded-service"
import { Card } from "@/components/ui/card"
import { ArrowLeftRight } from "lucide-react"
import Link from "next/link"

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ArrowLeftRight className="h-8 w-8 text-primary" />
            Private Swap
          </h1>
          <p className="text-muted-foreground">
            Exchange shielded tokens privately. Swap without revealing your identity.
          </p>
        </div>
        
        <ShieldedHeader onStateChange={refresh} />
        
        <Card className="p-6">
          <SwapInterface key={key} notes={notes} onSuccess={handleSuccess} />
        </Card>
        
        <div className="mt-6 flex gap-4 text-sm">
          <Link href="/shield" className="text-primary hover:underline">← Shield more</Link>
          <Link href="/send" className="text-primary hover:underline">→ Send privately</Link>
        </div>
      </main>
    </div>
  )
}

