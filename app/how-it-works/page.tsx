"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-mono">
            How It Works
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-mono">
            Quick guide to using zDoge features.
          </p>
        </div>

        <div className="space-y-4">
          {/* Shield */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Shield</h2>
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              Convert public tokens to private shielded notes.
            </p>
            <ol className="text-sm space-y-2 font-mono text-muted-foreground list-decimal list-inside ml-2">
              <li>Select token and amount</li>
              <li>Approve (ERC20 tokens only)</li>
              <li>Confirm transaction</li>
              <li>Note stored automatically</li>
            </ol>
          </Card>

          {/* Send */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Send</h2>
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              Send tokens privately between shielded addresses.
            </p>
            <ol className="text-sm space-y-2 font-mono text-muted-foreground list-decimal list-inside ml-2">
              <li>Enter recipient shielded address</li>
              <li>Enter amount</li>
              <li>Generate proof (30-60s)</li>
              <li>Submit transaction</li>
              <li>Recipient auto-discovers transfer</li>
            </ol>
          </Card>

          {/* Swap */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Swap</h2>
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              Exchange tokens privately within shielded layer.
            </p>
            <ol className="text-sm space-y-2 font-mono text-muted-foreground list-decimal list-inside ml-2">
              <li>Select input and output tokens</li>
              <li>Enter amount</li>
              <li>Generate proof</li>
              <li>Submit transaction</li>
              <li>Receive new token note</li>
            </ol>
          </Card>

          {/* Unshield */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3 font-mono">Unshield</h2>
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              Convert shielded notes back to public tokens.
            </p>
            <ol className="text-sm space-y-2 font-mono text-muted-foreground list-decimal list-inside ml-2">
              <li>Select note(s) to unshield</li>
              <li>Enter recipient public address</li>
              <li>Generate proof</li>
              <li>Submit transaction</li>
              <li>Tokens sent to recipient</li>
            </ol>
          </Card>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <Link 
            href="/fees" 
            className="text-sm text-[#C2A633] hover:underline font-mono"
          >
            View fee structure →
          </Link>
        </div>
      </main>
    </div>
  )
}
