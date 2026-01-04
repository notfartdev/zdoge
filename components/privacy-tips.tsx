"use client"

import { motion } from "framer-motion"
import { Shield, Eye, Clock, Zap } from "lucide-react"

const tips = [
  {
    icon: Shield,
    title: "Save Notes Offline",
    description: "Write down your secret note on paper. Never store it digitally or in cloud services.",
  },
  {
    icon: Eye,
    title: "Use Fresh Wallets",
    description: "Always withdraw to a new, unused address that has no connection to your deposit address.",
  },
  {
    icon: Clock,
    title: "Wait Before Withdrawing",
    description: "Add time delay between deposit and withdrawal to increase anonymity set size.",
  },
  {
    icon: Zap,
    title: "Match Pool Amounts",
    description: "Use standard amounts (0.1, 1, 10, 100 DOGE) to blend with the largest anonymity sets.",
  },
]

export function PrivacyTips() {
  return (
    <section id="privacy" className="relative py-24 px-6 md:px-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-[#C2A633] mb-4">BEST PRACTICES</p>
          <h2 className="font-sans text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6">
            Privacy
            <br />
            <span className="italic">Tips</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-2xl">
            Follow these guidelines to maximize your privacy when using zDoge.cash.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {tips.map((tip, index) => (
            <motion.div
              key={tip.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="border border-white/10 bg-black/20 backdrop-blur-sm p-8 hover:border-[#C2A633]/50 transition-colors duration-500"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-[#C2A633] bg-[#C2A633]/10 flex items-center justify-center flex-shrink-0">
                  <tip.icon className="w-6 h-6 text-[#C2A633]" />
                </div>
                <div>
                  <h3 className="font-sans text-xl md:text-2xl font-light tracking-tight mb-3">{tip.title}</h3>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-12 border-2 border-[#C2A633] bg-[#C2A633]/5 p-8"
        >
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-[#C2A633] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-sans text-2xl font-light tracking-tight mb-3">Security Reminder</h3>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">
                zDoge.cash is a decentralized, non-custodial protocol. We never have access to your funds or private
                keys. You are solely responsible for keeping your secret notes secure. Loss of your secret note means
                permanent loss of access to your deposited funds.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="px-3 py-1 border border-[#C2A633]/30 bg-black/20">
                  <span className="font-mono text-xs tracking-wider text-[#C2A633]">DECENTRALIZED</span>
                </div>
                <div className="px-3 py-1 border border-[#C2A633]/30 bg-black/20">
                  <span className="font-mono text-xs tracking-wider text-[#C2A633]">NON-CUSTODIAL</span>
                </div>
                <div className="px-3 py-1 border border-[#C2A633]/30 bg-black/20">
                  <span className="font-mono text-xs tracking-wider text-[#C2A633]">TRANSPARENT</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
