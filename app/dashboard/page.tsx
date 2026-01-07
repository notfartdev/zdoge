import { DashboardNav } from "@/components/dashboard-nav"
import { ShieldedWallet } from "@/components/shielded/shielded-wallet"
import { Suspense } from "react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black">
      <DashboardNav />
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-8">
        <div className="max-w-6xl mx-auto">
          <Suspense fallback={<div className="w-full h-96 bg-black/20 animate-pulse" />}>
            <ShieldedWallet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
