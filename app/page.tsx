"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Shield, 
  Send, 
  LogOut, 
  ArrowLeftRight, 
  Lock, 
  Eye, 
  EyeOff, 
  Zap,
  Check,
  ArrowRight,
  Wallet,
  Key,
  ShieldCheck,
  Fingerprint,
  Network
} from "lucide-react"
import { DashboardNav } from "@/components/dashboard-nav"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <DashboardNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C2A633]/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C2A633]/5 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C2A633]/10 border border-[#C2A633]/20 mb-6">
              <Shield className="h-4 w-4 text-[#C2A633]" />
              <span className="text-sm text-[#C2A633] font-mono">Powered by Zero-Knowledge Proofs</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Private Transactions for{" "}
              <span className="text-[#C2A633]">DOGE</span>
            </h1>
            
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Shield your DOGE. Send privately. Unshield anywhere. 
              Like Zcash shielded pools, but for the DogeOS ecosystem.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/shield">
                <Button size="lg" className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-bold text-lg px-8">
                  <Shield className="h-5 w-5 mr-2" />
                  Start Shielding
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="border-[#C2A633]/30 hover:bg-[#C2A633]/10 text-lg px-8">
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Grid */}
      <section className="py-20 border-t border-[#C2A633]/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Four Ways to Transact Privately</h2>
            <p className="text-gray-400">Complete privacy toolkit for your DOGE</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Link href="/shield" className="group">
              <Card className="p-6 bg-zinc-950 border-[#C2A633]/20 hover:border-[#C2A633]/50 transition-all h-full">
                <div className="p-3 rounded-lg bg-[#C2A633]/10 w-fit mb-4 group-hover:bg-[#C2A633]/20 transition-colors">
                  <Shield className="h-6 w-6 text-[#C2A633]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Shield</h3>
                <p className="text-gray-400 text-sm">
                  Convert public DOGE to private shielded notes. Your funds disappear from public view.
                </p>
                <div className="mt-4 text-[#C2A633] text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Get started <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>
            
            <Link href="/send" className="group">
              <Card className="p-6 bg-zinc-950 border-[#C2A633]/20 hover:border-[#C2A633]/50 transition-all h-full">
                <div className="p-3 rounded-lg bg-[#C2A633]/10 w-fit mb-4 group-hover:bg-[#C2A633]/20 transition-colors">
                  <Send className="h-6 w-6 text-[#C2A633]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Send</h3>
                <p className="text-gray-400 text-sm">
                  Transfer privately between shielded addresses. No one can see who sent what to whom.
                </p>
                <div className="mt-4 text-[#C2A633] text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Send privately <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>
            
            <Link href="/unshield" className="group">
              <Card className="p-6 bg-zinc-950 border-[#C2A633]/20 hover:border-[#C2A633]/50 transition-all h-full">
                <div className="p-3 rounded-lg bg-[#C2A633]/10 w-fit mb-4 group-hover:bg-[#C2A633]/20 transition-colors">
                  <LogOut className="h-6 w-6 text-[#C2A633]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Unshield</h3>
                <p className="text-gray-400 text-sm">
                  Convert shielded notes back to public DOGE. Withdraw to any wallet, gas-free.
                </p>
                <div className="mt-4 text-[#C2A633] text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Withdraw funds <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>
            
            <Link href="/swap" className="group">
              <Card className="p-6 bg-zinc-950 border-[#C2A633]/20 hover:border-[#C2A633]/50 transition-all h-full">
                <div className="p-3 rounded-lg bg-[#C2A633]/10 w-fit mb-4 group-hover:bg-[#C2A633]/20 transition-colors">
                  <ArrowLeftRight className="h-6 w-6 text-[#C2A633]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Swap</h3>
                <p className="text-gray-400 text-sm">
                  Exchange shielded tokens privately. Trade without revealing your identity.
                </p>
                <div className="mt-4 text-[#C2A633] text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Swap tokens <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-zinc-950/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How Shielded Transactions Work</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Using zero-knowledge proofs inspired by Zcash, DogenadoCash enables truly private 
              transactions while maintaining full verifiability on-chain.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#C2A633]/10 border border-[#C2A633]/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-[#C2A633]">1</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Shield</h3>
                <p className="text-gray-400 text-sm">
                  Deposit DOGE to create a private "note" — a cryptographic commitment that represents 
                  your funds without revealing the amount or owner.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#C2A633]/10 border border-[#C2A633]/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-[#C2A633]">2</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Transact</h3>
                <p className="text-gray-400 text-sm">
                  Send shielded notes to anyone using their private address. The transaction is 
                  verified on-chain but reveals nothing about sender, recipient, or amount.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#C2A633]/10 border border-[#C2A633]/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-[#C2A633]">3</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Unshield</h3>
                <p className="text-gray-400 text-sm">
                  Convert notes back to public DOGE anytime. Prove ownership with a zero-knowledge 
                  proof without revealing which note you're spending.
                </p>
              </div>
            </div>
          </div>
          
          {/* Technical Details */}
          <div className="mt-16 max-w-4xl mx-auto">
            <Card className="p-8 bg-zinc-900/50 border-[#C2A633]/20">
              <h3 className="text-xl font-bold mb-6 text-center">The Privacy Stack</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-[#C2A633]/10 h-fit">
                    <ShieldCheck className="h-5 w-5 text-[#C2A633]" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">ZK-SNARKs</h4>
                    <p className="text-gray-400 text-sm">
                      Groth16 proofs verify transactions without revealing any private data.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-[#C2A633]/10 h-fit">
                    <Fingerprint className="h-5 w-5 text-[#C2A633]" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Nullifiers</h4>
                    <p className="text-gray-400 text-sm">
                      Prevent double-spending while maintaining complete sender anonymity.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-[#C2A633]/10 h-fit">
                    <Network className="h-5 w-5 text-[#C2A633]" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Merkle Trees</h4>
                    <p className="text-gray-400 text-sm">
                      Efficient on-chain storage of all commitments with logarithmic proofs.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-[#C2A633]/10 h-fit">
                    <Key className="h-5 w-5 text-[#C2A633]" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Encrypted Memos</h4>
                    <p className="text-gray-400 text-sm">
                      Recipients auto-discover incoming transfers using viewing keys.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Privacy Benefits */}
      <section className="py-20 border-t border-[#C2A633]/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">What Makes It Private</h2>
              <p className="text-gray-400">
                Unlike transparent blockchains, shielded transactions reveal nothing
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <EyeOff className="h-5 w-5 text-[#C2A633]" />
                  Hidden On-Chain
                </h3>
                <ul className="space-y-3">
                  {[
                    "Sender's wallet address",
                    "Recipient's wallet address", 
                    "Transaction amount",
                    "Link between sender and recipient"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-500" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#C2A633]" />
                  Additional Benefits
                </h3>
                <ul className="space-y-3">
                  {[
                    "Gas-free transactions via relayer",
                    "No wallet signature required",
                    "Auto-discovery of incoming funds",
                    "Non-custodial & decentralized"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400">
                      <div className="w-5 h-5 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-[#C2A633]" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-20 bg-gradient-to-t from-[#C2A633]/10 to-transparent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready for Private DOGE?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Start shielding your DOGE today. No KYC, no sign-up, fully decentralized.
          </p>
          <Link href="/shield">
            <Button size="lg" className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-bold text-lg px-8">
              <Shield className="h-5 w-5 mr-2" />
              Launch App
            </Button>
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 border-t border-[#C2A633]/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/dogenadologo.png" alt="DogenadoCash" className="w-8 h-8 rounded-full" />
              <span className="font-mono font-bold">DogenadoCash</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>DECENTRALIZED</span>
              <span>•</span>
              <span>NON-CUSTODIAL</span>
              <span>•</span>
              <span>PRIVATE</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://docs.dogenado.cash" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </a>
              <a 
                href="https://github.com/notfartdev/dogenadocash" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
