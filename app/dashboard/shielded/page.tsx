"use client"

import { ShieldedWallet } from "@/components/shielded"
import { DashboardNav } from "@/components/dashboard-nav"

export default function ShieldedPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Shielded Transactions</h1>
          <p className="text-muted-foreground">
            Private value layer for DogeOS. Shield, transfer, and unshield DOGE
            without revealing your activity on-chain.
          </p>
        </div>
        
        <ShieldedWallet />
      </main>
    </div>
  )
}


