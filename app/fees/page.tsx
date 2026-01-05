"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default function FeesPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-mono">
            Fees
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-mono">
            Transaction fee breakdown.
          </p>
        </div>

        <div className="space-y-4">
          {/* Shield */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Shield</h2>
            <div className="text-sm space-y-2 font-mono text-muted-foreground">
              <p>• Direct: Gas fees only</p>
              <p>• Relayer: No fees (gasless)</p>
              <p>• ERC20: One-time approval fee</p>
            </div>
          </Card>

          {/* Send */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Send / Transfer</h2>
            <div className="text-sm space-y-2 font-mono text-muted-foreground">
              <p>• Relayer fee: ~0.5% (minimum applies)</p>
              <p>• Direct: Gas fees only</p>
              <p>• Example: 100 DOGE = ~0.5 DOGE fee</p>
            </div>
          </Card>

          {/* Swap */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Swap</h2>
            <div className="text-sm space-y-2 font-mono text-muted-foreground">
              <p>• Swap fee: ~0.3%</p>
              <p>• Relayer fee: +0.5% if using relayer</p>
              <p>• Direct: Gas fees only</p>
            </div>
          </Card>

          {/* Unshield */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Unshield</h2>
            <div className="text-sm space-y-2 font-mono text-muted-foreground">
              <p>• Relayer fee: ~0.5% (minimum applies)</p>
              <p>• Direct: Gas fees only</p>
              <p>• Example: 100 DOGE = ~0.5 DOGE fee</p>
            </div>
          </Card>
        </div>

        <Card className="p-6 mt-6 bg-muted/30">
          <h3 className="font-semibold mb-3 font-mono">About Fees</h3>
          <div className="text-sm space-y-2 font-mono text-muted-foreground">
            <p>
              <strong>Relayer:</strong> Pays gas on your behalf. Charges ~0.5% fee. Ideal if you don't have DOGE for gas.
            </p>
            <p>
              <strong>Direct:</strong> You pay gas directly. No relayer fees. Requires DOGE balance.
            </p>
            <p>
              <strong>Minimum:</strong> Small transactions may pay minimum fee instead of percentage.
            </p>
          </div>
        </Card>

        <div className="mt-8 pt-6 border-t border-border">
          <Link 
            href="/how-it-works" 
            className="text-sm text-[#C2A633] hover:underline font-mono"
          >
            ← How it works
          </Link>
        </div>
      </main>
    </div>
  )
}

