"use client"

import { motion } from "framer-motion"
import { ArrowRight, Shuffle, Lock, Unlock } from "lucide-react"

const steps = [
  {
    icon: Lock,
    number: "01",
    title: "Deposit",
    description: "Choose an amount and generate a secret note. Doge coins enter the mixing pool.",
  },
  {
    icon: Shuffle,
    number: "02",
    title: "Mix",
    description: "Your coins are blended with others in the pool, breaking the traceable link.",
  },
  {
    icon: Unlock,
    number: "03",
    title: "Withdraw",
    description: "Use your secret note to withdraw to a fresh address. The connection is obfuscated.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 px-6 md:px-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-[#C2A633] mb-4">HOW IT WORKS</p>
          <h2 className="font-sans text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6">
            Privacy Through
            <br />
            <span className="italic">Mixing</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-2xl">
            DogenadoCash uses cryptographic privacy to break the on-chain link between deposit and withdrawal addresses,
            enhancing transaction privacy without compromising decentralization. Your DOGE remains yours, just more
            private.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="border border-white/10 bg-black/20 backdrop-blur-sm p-8 group hover:border-[#C2A633]/50 transition-colors duration-500"
            >
              <div className="mb-6">
                <step.icon className="w-10 h-10 text-[#C2A633]" />
              </div>
              <div className="font-mono text-xs tracking-widest text-[#C2A633] mb-3">{step.number}</div>
              <h3 className="font-sans text-2xl md:text-3xl font-light tracking-tight mb-4">{step.title}</h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Visual Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="border border-white/10 bg-black/20 backdrop-blur-sm p-8 md:p-12"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Input Wallets */}
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="font-mono text-xs tracking-widest text-muted-foreground mb-4">INPUT WALLETS</p>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-32 h-10 border border-white/20 bg-black/40 mb-2 flex items-center justify-center"
                  >
                    <span className="font-mono text-xs text-muted-foreground">Wallet {i}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mixing Pool */}
            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="w-6 h-6 text-[#C2A633] mb-4 rotate-0 md:rotate-0" />
              <div className="w-48 h-48 border-2 border-[#C2A633] bg-[#C2A633]/5 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="absolute inset-0"
                >
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#C2A633] rounded-full"
                      style={{
                        transform: `rotate(${i * 45}deg) translateY(-60px)`,
                      }}
                    />
                  ))}
                </motion.div>
                <Shuffle className="w-12 h-12 text-[#C2A633] relative z-10" />
              </div>
              <ArrowRight className="w-6 h-6 text-[#C2A633] mt-4 rotate-0 md:rotate-0" />
            </div>

            {/* Output Wallets */}
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="font-mono text-xs tracking-widest text-muted-foreground mb-4">OUTPUT WALLETS</p>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-32 h-10 border border-[#C2A633]/50 bg-[#C2A633]/10 mb-2 flex items-center justify-center"
                  >
                    <span className="font-mono text-xs text-foreground">Wallet {i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="font-mono text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Crypto mixers blend funds from multiple users so the connection between the original wallet and the
              withdrawal wallet is obfuscated, making tracing difficult.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
