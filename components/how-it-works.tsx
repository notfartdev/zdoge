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

// Tornado particle that spirals inward
function TornadoParticle({ 
  delay, 
  duration, 
  radius, 
  angle, 
  fromLeft 
}: { 
  delay: number
  duration: number
  radius: number
  angle: number
  fromLeft: boolean 
}) {
  return (
    <motion.div
      className="absolute w-2 h-2 bg-[#C2A633] rounded-full shadow-[0_0_8px_#C2A633]"
      style={{
        left: fromLeft ? '0%' : '100%',
        top: '50%',
      }}
      animate={{
        x: fromLeft 
          ? [`0%`, `${50 - radius * Math.cos(angle)}%`, '50%']
          : ['100%', `${50 + radius * Math.cos(angle)}%`, '50%'],
        y: [
          '0%',
          `${-radius * Math.sin(angle)}%`,
          '0%'
        ],
        scale: [0.5, 1.2, 0.8, 0.3],
        opacity: [0, 1, 1, 0.5, 0],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "easeInOut"
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

        {/* Transaction Flow Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="border border-white/10 bg-black/20 backdrop-blur-sm p-8 sm:p-12 md:p-16"
        >
          <div className="relative w-full max-w-6xl mx-auto">
            {/* Transaction Flow Diagram */}
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-12 md:gap-20 min-h-[600px]">
              
              {/* Left: Deposit Wallets */}
              <div className="flex flex-col gap-6 w-full md:w-auto relative z-20">
                <p className="font-mono text-xs tracking-widest text-[#C2A633] mb-6 text-center md:text-left">DEPOSIT</p>
                <div className="flex flex-col gap-6">
                  {['A', 'B', 'C', 'D'].map((wallet, index) => (
                    <motion.div
                      key={wallet}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="relative"
                      id={`deposit-wallet-${wallet}`}
                    >
                      <div className="px-5 py-4 border border-white/20 bg-black/40 backdrop-blur-sm hover:border-[#C2A633]/50 transition-all duration-300 min-w-[160px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#C2A633]/20 border-2 border-[#C2A633]/50 flex items-center justify-center">
                            <span className="font-mono text-sm font-bold text-[#C2A633]">{wallet}</span>
                          </div>
                          <span className="font-mono text-sm text-white font-medium">Wallet {wallet}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Center: Mixing Pool */}
              <div className="flex flex-col items-center justify-center relative z-30 my-12 md:my-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="relative"
                  id="mixing-pool"
                >
                  {/* Pool Container */}
                  <div className="w-56 h-56 md:w-72 md:h-72 border-2 border-[#C2A633] bg-gradient-to-br from-[#C2A633]/10 to-[#C2A633]/5 backdrop-blur-sm rounded-full flex items-center justify-center relative overflow-hidden">
                    
                    {/* Animated mixing particles */}
                    <div className="absolute inset-0">
                      {[...Array(20)].map((_, i) => {
                        const angle = (i * 18) * (Math.PI / 180)
                        const radius = 100
                        return (
                          <motion.div
                            key={i}
                            className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#C2A633] rounded-full shadow-[0_0_10px_#C2A633]"
                            style={{
                              transformOrigin: '0 0',
                            }}
                            animate={{
                              rotate: [i * 18, i * 18 + 360],
                              x: [Math.cos(angle) * radius, Math.cos(angle) * radius * 0.4, Math.cos(angle) * radius * 0.1],
                              y: [Math.sin(angle) * radius, Math.sin(angle) * radius * 0.4, Math.sin(angle) * radius * 0.1],
                              scale: [0.8, 1.3, 1.6, 1.2],
                              opacity: [0.5, 0.9, 1, 0.9, 0.5]
                            }}
                            transition={{
                              duration: 3.5,
                              delay: i * 0.1,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )
                      })}
                    </div>

                    {/* Rotating rings */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-6 border border-[#C2A633]/40 rounded-full"
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-12 border border-[#C2A633]/30 rounded-full"
                    />

                    {/* Center icon */}
                    <Shuffle className="w-14 h-14 md:w-18 md:h-18 text-[#C2A633] relative z-10" />

                    {/* Pulsing glow */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{
                        boxShadow: [
                          '0 0 40px rgba(194, 166, 51, 0.4)',
                          '0 0 80px rgba(194, 166, 51, 0.7)',
                          '0 0 40px rgba(194, 166, 51, 0.4)'
                        ]
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </div>

                  {/* Pool Label */}
                  <div className="mt-6 text-center">
                    <p className="font-mono text-xs tracking-widest text-[#C2A633] font-bold">MIXING POOL</p>
                  </div>
                </motion.div>
              </div>

              {/* Right: Withdrawal Wallets */}
              <div className="flex flex-col gap-6 w-full md:w-auto relative z-20">
                <p className="font-mono text-xs tracking-widest text-[#C2A633] mb-6 text-center md:text-right">WITHDRAW</p>
                <div className="flex flex-col gap-6">
                  {['W', 'X', 'Y', 'Z'].map((wallet, index) => (
                    <motion.div
                      key={wallet}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="relative"
                      id={`withdraw-wallet-${wallet}`}
                    >
                      <div className="px-5 py-4 border-2 border-[#C2A633]/60 bg-[#C2A633]/15 backdrop-blur-sm hover:border-[#C2A633] hover:bg-[#C2A633]/25 transition-all duration-300 min-w-[160px]">
                        <div className="flex items-center gap-3 justify-end md:justify-start">
                          <span className="font-mono text-sm text-white font-medium">Wallet {wallet}</span>
                          <div className="w-10 h-10 rounded-full bg-[#C2A633]/40 border-2 border-[#C2A633] flex items-center justify-center">
                            <span className="font-mono text-sm font-bold text-[#C2A633]">{wallet}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Connection Lines with Animated Signals */}
            <div className="hidden md:block absolute inset-0 pointer-events-none" style={{ height: '100%', width: '100%' }}>
              <svg viewBox="0 0 1000 600" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
                <defs>
                  <filter id="signalGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#C2A633" opacity="0.9" />
                  </marker>
                </defs>
                
                {/* Deposit Lines: A, B, C, D → Pool */}
                {['A', 'B', 'C', 'D'].map((wallet, i) => {
                  const walletY = 120 + i * 120
                  const poolY = 300
                  const startX = 200
                  const endX = 450
                  const midX = (startX + endX) / 2
                  const midY = (walletY + poolY) / 2
                  
                  return (
                    <g key={`deposit-line-${wallet}`}>
                      {/* Visible connection line */}
                      <path
                        d={`M ${startX} ${walletY} Q ${midX} ${midY} ${endX} ${poolY}`}
                        stroke="#C2A633"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="6 6"
                        opacity="0.7"
                        markerEnd="url(#arrowhead)"
                      />
                      
                      {/* Animated signal particles */}
                      {[0, 1, 2].map((particle) => {
                        const delay = particle * 1 + i * 0.6
                        return (
                          <motion.circle
                            key={`deposit-signal-${wallet}-${particle}`}
                            r="7"
                            fill="#C2A633"
                            filter="url(#signalGlow)"
                            initial={{ 
                              cx: startX,
                              cy: walletY
                            }}
                            animate={{
                              cx: [startX, midX, endX],
                              cy: [walletY, midY, poolY],
                            }}
                            transition={{
                              duration: 3.5,
                              delay: delay,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )
                      })}
                    </g>
                  )
                })}

                {/* Withdrawal Lines: Pool → W, X, Y, Z */}
                {['W', 'X', 'Y', 'Z'].map((wallet, i) => {
                  const walletY = 120 + i * 120
                  const poolY = 300
                  const startX = 550
                  const endX = 800
                  const midX = (startX + endX) / 2
                  const midY = (poolY + walletY) / 2
                  
                  return (
                    <g key={`withdraw-line-${wallet}`}>
                      {/* Visible connection line */}
                      <path
                        d={`M ${startX} ${poolY} Q ${midX} ${midY} ${endX} ${walletY}`}
                        stroke="#C2A633"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="6 6"
                        opacity="0.7"
                        markerEnd="url(#arrowhead)"
                      />
                      
                      {/* Animated signal particles */}
                      {[0, 1, 2].map((particle) => {
                        const delay = particle * 1 + i * 0.6 + 3.5
                        return (
                          <motion.circle
                            key={`withdraw-signal-${wallet}-${particle}`}
                            r="7"
                            fill="#C2A633"
                            filter="url(#signalGlow)"
                            initial={{ 
                              cx: startX,
                              cy: poolY
                            }}
                            animate={{
                              cx: [startX, midX, endX],
                              cy: [poolY, midY, walletY],
                            }}
                            transition={{
                              duration: 3.5,
                              delay: delay,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Explanation Text */}
            <div className="mt-12 md:mt-16 text-center">
              <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Transactions flow from deposit wallets into the mixing pool where they are cryptographically blended.
                Withdrawals to fresh addresses break the on-chain link, ensuring privacy.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
