"use client"

import { motion } from "framer-motion"
import { Shuffle, Lock, Unlock } from "lucide-react"

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

// Animated particle that flows along a path
function FlowingParticle({ delay, duration, fromLeft }: { delay: number; duration: number; fromLeft: boolean }) {
  return (
    <motion.div
      className="absolute w-2 h-2 bg-[#C2A633] rounded-full"
      initial={{ 
        x: fromLeft ? -20 : 20, 
        opacity: 0 
      }}
      animate={{ 
        x: fromLeft ? 100 : -100,
        opacity: [0, 1, 1, 0]
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

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
          <h2 className="font-sans text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-4 md:mb-6">
            Privacy Through
            <br />
            <span className="italic">Mixing</span>
          </h2>
          <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-2xl px-4 sm:px-0">
            DogenadoCash uses cryptographic privacy to break the on-chain link between deposit and withdrawal addresses,
            enhancing transaction privacy without compromising decentralization. Your DOGE remains yours, just more
            private.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 md:mb-16">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="border border-white/10 bg-black/20 backdrop-blur-sm p-4 sm:p-6 md:p-8 group hover:border-[#C2A633]/50 transition-colors duration-500"
            >
              <div className="mb-6">
                <step.icon className="w-10 h-10 text-[#C2A633]" />
              </div>
              <div className="font-mono text-xs tracking-widest text-[#C2A633] mb-3">{step.number}</div>
              <h3 className="font-sans text-xl sm:text-2xl md:text-3xl font-light tracking-tight mb-2 md:mb-4">{step.title}</h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Visual Diagram with Animated Lines */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="border border-white/10 bg-black/20 backdrop-blur-sm p-4 sm:p-6 md:p-8 lg:p-12 overflow-x-auto"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 relative min-w-[320px]">
            {/* Input Wallets */}
            <div className="flex flex-col gap-2 md:gap-4 relative z-10 w-full md:w-auto">
              <div className="text-center">
                <p className="font-mono text-[10px] sm:text-xs tracking-widest text-muted-foreground mb-2 md:mb-4">INPUT WALLETS</p>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-full md:w-32 h-8 md:h-10 border border-white/20 bg-black/40 mb-0 md:mb-2 flex items-center justify-center relative"
                    >
                      <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">Wallet {i}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Animated Connection Lines - Left Side */}
            <div className="hidden md:flex flex-col items-center justify-center relative w-24">
              {/* Flowing lines from wallets to mixer */}
              <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="lineGradientLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C2A633" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#C2A633" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#C2A633" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {/* Static lines */}
                {[0, 1, 2, 3].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={40 + i * 48}
                    x2="100%"
                    y2="96"
                    stroke="url(#lineGradientLeft)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}
              </svg>
              
              {/* Animated particles */}
              <div className="relative w-full h-48">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute left-0 w-2 h-2 bg-[#C2A633] rounded-full shadow-[0_0_10px_#C2A633]"
                    style={{ top: 36 + i * 48 }}
                    animate={{
                      x: [0, 96],
                      y: [0, (96 - (36 + i * 48)) * 0.5],
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1, 1, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mixing Pool */}
            <div className="flex flex-col items-center justify-center relative z-10 my-4 md:my-0">
              {/* Mobile: Vertical Arrow */}
              <motion.div
                className="md:hidden mb-2"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg className="w-6 h-6 text-[#C2A633]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
              
              <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 border-2 border-[#C2A633] bg-[#C2A633]/5 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                {/* Rotating particles inside mixer */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0"
                >
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#C2A633] rounded-full shadow-[0_0_8px_#C2A633]"
                      style={{
                        transform: `rotate(${i * 45}deg) translateY(-50px)`,
                      }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.25,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </motion.div>
                
                {/* Inner rotating ring */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-8 border border-[#C2A633]/30 rounded-full"
                />
                
                {/* Center icon */}
                <Shuffle className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-[#C2A633] relative z-10" />
                
                {/* Pulsing glow */}
                <motion.div
                  className="absolute inset-0 border-2 border-[#C2A633]"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
            </div>

            {/* Animated Connection Lines - Right Side */}
            <div className="hidden md:flex flex-col items-center justify-center relative w-24">
              {/* Flowing lines from mixer to wallets */}
              <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="lineGradientRight" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C2A633" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#C2A633" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#C2A633" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {/* Static lines */}
                {[0, 1, 2, 3].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    y1="96"
                    x2="100%"
                    y2={40 + i * 48}
                    stroke="url(#lineGradientRight)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}
              </svg>
              
              {/* Animated particles */}
              <div className="relative w-full h-48">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute right-0 w-2 h-2 bg-[#C2A633] rounded-full shadow-[0_0_10px_#C2A633]"
                    style={{ top: 92 }}
                    animate={{
                      x: [0, 96],
                      y: [0, (36 + i * 48) - 92],
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1, 1, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.5 + 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </div>

              {/* Mobile: Vertical Arrow */}
              <motion.div
                className="md:hidden mt-2"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
              >
                <svg className="w-6 h-6 text-[#C2A633]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
            </div>

            {/* Output Wallets */}
            <div className="flex flex-col gap-2 md:gap-4 relative z-10 w-full md:w-auto">
              <div className="text-center">
                <p className="font-mono text-[10px] sm:text-xs tracking-widest text-muted-foreground mb-2 md:mb-4">OUTPUT WALLETS</p>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-full md:w-32 h-8 md:h-10 border border-[#C2A633]/50 bg-[#C2A633]/10 mb-0 md:mb-2 flex items-center justify-center"
                    animate={{
                      borderColor: ['rgba(194, 166, 51, 0.3)', 'rgba(194, 166, 51, 0.6)', 'rgba(194, 166, 51, 0.3)']
                    }}
                    transition={{
                      duration: 3,
                      delay: i * 0.3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    >
                      <span className="font-mono text-[10px] sm:text-xs text-foreground">Wallet {i}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 md:mt-8 text-center px-4">
            <p className="font-mono text-[10px] sm:text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Crypto mixers blend funds from multiple users so the connection between the original wallet and the
              withdrawal wallet is obfuscated, making tracing difficult.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
