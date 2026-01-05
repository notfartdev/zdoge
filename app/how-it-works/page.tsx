"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import { Shield, Send, ArrowLeftRight, ShieldOff, Info, DollarSign } from "lucide-react"

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center gap-3">
            <Info className="h-8 w-8 text-primary" />
            How It Works
          </h1>
          <p className="text-muted-foreground">
            Learn how zDoge enables private transactions and understand the fee structure.
          </p>
        </div>

        {/* Features Section */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          
          {/* Shield */}
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-[#C2A633]/10 rounded-lg">
                <Shield className="h-6 w-6 text-[#C2A633]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Shield</h3>
                <p className="text-muted-foreground mb-3">
                  Convert your public tokens into private shielded notes. Your tokens are locked in the smart contract and a cryptographic commitment is added to the Merkle tree. Only you can access these notes using your spending key.
                </p>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Select token and amount to shield</li>
                    <li>Approve token spending (for ERC20 tokens)</li>
                    <li>Transaction creates a shielded note stored locally</li>
                    <li>Commitment is added to on-chain Merkle tree</li>
                    <li>Your shielded balance updates automatically</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>

          {/* Transfer */}
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-[#C2A633]/10 rounded-lg">
                <Send className="h-6 w-6 text-[#C2A633]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Send / Transfer</h3>
                <p className="text-muted-foreground mb-3">
                  Send tokens privately between shielded addresses. The transaction is completely private - no one can see the sender, recipient, or amount. Recipients automatically discover incoming transfers via encrypted memos.
                </p>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Select note(s) to spend and enter recipient's shielded address</li>
                    <li>Generate zero-knowledge proof (30-60 seconds)</li>
                    <li>Create encrypted memo for recipient</li>
                    <li>Submit transaction (directly or via relayer)</li>
                    <li>Recipient automatically discovers and receives the transfer</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>

          {/* Swap */}
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-[#C2A633]/10 rounded-lg">
                <ArrowLeftRight className="h-6 w-6 text-[#C2A633]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Swap</h3>
                <p className="text-muted-foreground mb-3">
                  Exchange one token for another privately within the shielded layer. All swaps are completely private - no one can see what tokens you're swapping or the amounts.
                </p>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Select input and output tokens</li>
                    <li>Enter amount to swap</li>
                    <li>Generate zero-knowledge proof</li>
                    <li>Submit transaction</li>
                    <li>Receive new token note in your wallet</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>

          {/* Unshield */}
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-[#C2A633]/10 rounded-lg">
                <ShieldOff className="h-6 w-6 text-[#C2A633]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Unshield</h3>
                <p className="text-muted-foreground mb-3">
                  Convert your shielded notes back to public tokens. Tokens are sent to any public wallet address. Note that unshielding reveals the recipient address and amount on-chain.
                </p>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Select note(s) to unshield</li>
                    <li>Enter recipient public address (0x...)</li>
                    <li>Generate zero-knowledge proof</li>
                    <li>Submit transaction (directly or via relayer)</li>
                    <li>Tokens are sent to recipient address</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Fees Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-[#C2A633]" />
            Fee Structure
          </h2>

          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Transaction Fees</h3>
            
            <div className="space-y-4">
              {/* Shield */}
              <div className="border-b border-border pb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#C2A633]" />
                  Shield
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 ml-6">
                  <p>• <strong>Direct transaction:</strong> Gas fees only (paid in DOGE)</p>
                  <p>• <strong>Relayer:</strong> No fees (gasless transaction)</p>
                  <p>• <strong>ERC20 tokens:</strong> One-time approval fee required</p>
                </div>
              </div>

              {/* Transfer */}
              <div className="border-b border-border pb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#C2A633]" />
                  Send / Transfer
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 ml-6">
                  <p>• <strong>Relayer fee:</strong> ~0.5% of transaction amount (minimum fee applies)</p>
                  <p>• <strong>Direct transaction:</strong> Gas fees only (paid in DOGE)</p>
                  <p>• <strong>Example:</strong> Transfer 100 DOGE = ~0.5 DOGE relayer fee</p>
                </div>
              </div>

              {/* Swap */}
              <div className="border-b border-border pb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-[#C2A633]" />
                  Swap
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 ml-6">
                  <p>• <strong>Swap fee:</strong> ~0.3% of transaction amount</p>
                  <p>• <strong>Relayer fee:</strong> Additional ~0.5% if using relayer</p>
                  <p>• <strong>Direct transaction:</strong> Gas fees only</p>
                  <p>• <strong>Example:</strong> Swap 100 DOGE = ~0.3 DOGE swap fee + relayer fee if applicable</p>
                </div>
              </div>

              {/* Unshield */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ShieldOff className="h-4 w-4 text-[#C2A633]" />
                  Unshield
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 ml-6">
                  <p>• <strong>Relayer fee:</strong> ~0.5% of transaction amount (minimum fee applies)</p>
                  <p>• <strong>Direct transaction:</strong> Gas fees only (paid in DOGE)</p>
                  <p>• <strong>Example:</strong> Unshield 100 DOGE = ~0.5 DOGE relayer fee</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold mb-2">Understanding Fees</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Relayer Service:</strong> The relayer pays gas fees on your behalf, enabling gasless transactions. 
                In exchange, a small percentage fee is charged. This is ideal if you don't have DOGE for gas.
              </p>
              <p>
                <strong>Direct Transactions:</strong> You pay gas fees directly using DOGE. No relayer fees apply, 
                but you need sufficient DOGE balance for gas.
              </p>
              <p>
                <strong>Minimum Fees:</strong> Relayer fees have a minimum threshold to ensure profitability. 
                Very small transactions may pay the minimum fee rather than the percentage.
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

