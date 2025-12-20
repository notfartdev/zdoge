"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, Copy } from "lucide-react"

export function MixerInterface() {
  const [amount, setAmount] = useState([10])
  const [activeTab, setActiveTab] = useState("deposit")
  // Demo state - shows example output without real functionality
  const [showDemo, setShowDemo] = useState(false)

  // Demo data - not real functionality
  const demoNote = "dogenado://note/srjo2mcnfwlvxw31p0ehg"
  const demoAddress = "D4TRKW2AB4GC"

  const handleDemoClick = () => {
    setShowDemo(true)
  }

  return (
    <section
      id="mix"
      className="relative min-h-screen w-full flex items-center justify-center bg-background pt-32 pb-20 px-6"
    >
      <div className="w-full max-w-7xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/dogenadologo.png" alt="DogenadoCash" className="w-20 h-20 rounded-full" />
          </div>
          <h1 className="font-sans text-6xl md:text-8xl lg:text-9xl font-light tracking-tight mb-8">
            DOGENADO<span className="italic">CASH</span>
          </h1>
          <p className="font-mono text-base md:text-lg tracking-wider text-gray-400 max-w-2xl mx-auto">
            A decentralized privacy protocol enabling private transactions on Doge.
          </p>
        </motion.div>

        {/* Main Interface - Demo Only */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="grid lg:grid-cols-[500px_1fr] gap-8 items-start"
        >
          {/* Left: Mixer Interface (Demo) */}
          <div className="border border-white/10 bg-black/20 backdrop-blur-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-transparent border-b border-white/10 rounded-none h-auto p-0">
                <TabsTrigger
                  value="deposit"
                  className="rounded-none border-r border-white/10 data-[state=active]:bg-[#C2A633] data-[state=active]:text-black font-mono text-xs tracking-widest py-4"
                >
                  DEPOSIT
                </TabsTrigger>
                <TabsTrigger
                  value="withdraw"
                  className="rounded-none data-[state=active]:bg-[#C2A633] data-[state=active]:text-black font-mono text-xs tracking-widest py-4"
                >
                  WITHDRAW
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="p-8">
                <div className="space-y-6">
                  {/* Amount Selection */}
                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-4 block">
                      AMOUNT <span className="text-[#C2A633]">Ð</span>
                    </label>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="font-mono text-2xl text-foreground tabular-nums">{amount[0]} DOGE</span>
                    </div>
                    <Slider value={amount} onValueChange={setAmount} min={0.1} max={100} step={0.1} className="mb-4" />
                    <div className="flex justify-between font-mono text-xs text-muted-foreground">
                      <span>0.1 DOGE</span>
                      <span>10 DOGE</span>
                      <span>100 DOGE</span>
                    </div>
                  </div>

                  {/* Demo Button */}
                  {!showDemo && (
                    <Button
                      onClick={handleDemoClick}
                      className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono text-xs tracking-widest py-6"
                    >
                      GENERATE DEPOSIT
                    </Button>
                  )}

                  {/* Demo Output Display */}
                  {showDemo && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="border border-[#C2A633] bg-[#C2A633]/5 p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <AlertCircle className="w-5 h-5 text-[#C2A633] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-mono text-xs text-[#C2A633] mb-1">SAVE THIS NOTE SECURELY</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              You will need this to withdraw. Write it down offline.
                            </p>
                          </div>
                        </div>
                        <div className="bg-black/40 p-3 rounded border border-white/10 flex items-center gap-2">
                          <code className="font-mono text-xs text-foreground break-all flex-1">{demoNote}</code>
                          <button className="text-muted-foreground hover:text-foreground transition-colors cursor-default">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="border border-white/10 bg-black/20 p-4">
                        <p className="font-mono text-xs tracking-widest text-muted-foreground mb-2">DEPOSIT ADDRESS</p>
                        <div className="bg-black/40 p-3 rounded border border-white/10 flex items-center gap-2">
                          <code className="font-mono text-sm text-foreground break-all flex-1">{demoAddress}</code>
                          <button className="text-muted-foreground hover:text-foreground transition-colors cursor-default">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground mt-3">
                          Send exactly {amount[0]} DOGE to this address
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="withdraw" className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-3 block">
                      SECRET NOTE
                    </label>
                    <Input
                      placeholder="dogenado://note/..."
                      className="bg-black/40 border-white/10 font-mono text-xs"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs tracking-widest text-muted-foreground mb-3 block">
                      RECIPIENT ADDRESS
                    </label>
                    <Input placeholder="D..." className="bg-black/40 border-white/10 font-mono text-xs" readOnly />
                  </div>

                  <Button className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono text-xs tracking-widest py-6 cursor-default">
                    WITHDRAW
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Statistics */}
          <div className="grid gap-6">
            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Anonymity Set</span>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-4xl text-foreground tabular-nums">43,825</div>
                <p className="font-mono text-xs text-muted-foreground">equal user deposits</p>
              </div>
            </div>

            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Pool Amounts</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xl text-[#C2A633] tabular-nums">1 Ð</span>
                  <span className="font-mono text-xl text-[#C2A633] tabular-nums">10 Ð</span>
                  <span className="font-mono text-xl text-[#C2A633] tabular-nums">100 Ð</span>
                  <span className="font-mono text-xl text-[#C2A633] tabular-nums">1000 Ð</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">available mixing pools</p>
              </div>
            </div>

            <div className="border border-white/10 bg-black/20 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#C2A633] flex-shrink-0" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Latest Deposit
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-4xl text-foreground tabular-nums">7</span>
                  <span className="font-mono text-base text-muted-foreground">hours ago</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">last activity</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
