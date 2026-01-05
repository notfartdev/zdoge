"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Shield, Send, ArrowLeftRight, ShieldOff, Info } from "lucide-react"

export default function FeesPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-normal mb-2 font-serif tracking-tight">
            Fees
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-mono tracking-wide">
            Transaction fee breakdown.
          </p>
        </div>

        <div className="space-y-4">
          {/* Shield */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-[#C2A633]" />
              <h2 className="text-lg font-normal font-serif">Shield</h2>
            </div>
            <div className="text-sm space-y-2 font-mono text-muted-foreground ml-8">
              <p>Direct: Gas fees only</p>
              <p>Relayer: No fees (gasless)</p>
              <p>ERC20: One-time approval fee</p>
            </div>
          </Card>

          {/* Send */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Send className="h-5 w-5 text-[#C2A633]" />
              <h2 className="text-lg font-normal font-serif">Send / Transfer</h2>
            </div>
            <div className="text-sm space-y-2 font-mono text-muted-foreground ml-8">
              <p>Relayer fee: ~0.5% (minimum applies)</p>
              <p>Direct: Gas fees only</p>
              <p>Example: 100 DOGE = ~0.5 DOGE fee</p>
            </div>
          </Card>

          {/* Swap */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ArrowLeftRight className="h-5 w-5 text-[#C2A633]" />
              <h2 className="text-lg font-normal font-serif">Swap</h2>
            </div>
            <div className="text-sm space-y-2 font-mono text-muted-foreground ml-8">
              <p>Swap fee: ~0.3%</p>
              <p>Relayer fee: +0.5% if using relayer</p>
              <p>Direct: Gas fees only</p>
            </div>
          </Card>

          {/* Unshield */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldOff className="h-5 w-5 text-[#C2A633]" />
              <h2 className="text-lg font-normal font-serif">Unshield</h2>
            </div>
            <div className="text-sm space-y-2 font-mono text-muted-foreground ml-8">
              <p>Relayer fee: ~0.5% (minimum applies)</p>
              <p>Direct: Gas fees only</p>
              <p>Example: 100 DOGE = ~0.5 DOGE fee</p>
            </div>
          </Card>
        </div>

        <Card className="p-6 mt-6 bg-muted/30 border border-border/50">
          <div className="flex items-start gap-3 mb-3">
            <Info className="h-5 w-5 text-[#C2A633] mt-0.5 flex-shrink-0" />
            <h3 className="font-normal font-serif text-base">About Fees</h3>
          </div>
          <div className="text-sm space-y-2 font-mono text-muted-foreground ml-8">
            <p>
              <span className="font-medium">Relayer:</span> Pays gas on your behalf. Charges ~0.5% fee. Ideal if you don't have DOGE for gas.
            </p>
            <p>
              <span className="font-medium">Direct:</span> You pay gas directly. No relayer fees. Requires DOGE balance.
            </p>
            <p>
              <span className="font-medium">Minimum:</span> Small transactions may pay minimum fee instead of percentage.
            </p>
          </div>
        </Card>

        <div className="mt-8 pt-6 border-t border-border">
          <Link 
            href="/how-it-works" 
            className="text-sm text-[#C2A633] hover:underline font-mono tracking-wide"
          >
            ← How it works
          </Link>
        </div>
      </main>
    </div>
  )
}
