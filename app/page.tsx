"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SmoothScroll } from "@/components/smooth-scroll"
import { AppCard } from "@/components/app-card"

// SVG Illustrations for the steps
function ShieldIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Shield shape */}
        <path d="M100 15 L140 30 L140 65 Q140 95 100 110 Q60 95 60 65 L60 30 Z" strokeWidth="2">
          <animate attributeName="stroke-dasharray" values="0 400;200 200;400 0" dur="3s" repeatCount="indefinite" />
        </path>
        {/* Lock inside shield */}
        <rect x="85" y="50" width="30" height="25" rx="3" />
        <path d="M90 50 L90 42 Q90 35 100 35 Q110 35 110 42 L110 50" />
        <circle cx="100" cy="62" r="4" fill="#C2A633" />
        {/* Coins entering */}
        <circle cx="35" cy="60" r="8" strokeDasharray="3 2">
          <animate attributeName="cx" values="20;55;55" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="35" y="64" fontSize="8" fill="#C2A633" textAnchor="middle">Ð</text>
        {/* Arrow */}
        <path d="M45 60 L55 60" strokeWidth="2">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  )
}

function SendIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Two shielded addresses */}
        <rect x="20" y="40" width="50" height="40" rx="4" strokeDasharray="3 2" />
        <text x="45" y="55" fontSize="8" fill="#C2A633" textAnchor="middle" fontFamily="monospace">zdoge:</text>
        <text x="45" y="70" fontSize="7" fill="#C2A633" textAnchor="middle" opacity="0.6">sender</text>
        
        <rect x="130" y="40" width="50" height="40" rx="4" strokeDasharray="3 2" />
        <text x="155" y="55" fontSize="8" fill="#C2A633" textAnchor="middle" fontFamily="monospace">zdoge:</text>
        <text x="155" y="70" fontSize="7" fill="#C2A633" textAnchor="middle" opacity="0.6">recipient</text>
        
        {/* Animated transfer arrow */}
        <path d="M75 60 L120 60" strokeWidth="2" strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
        </path>
        <path d="M115 55 L125 60 L115 65" fill="#C2A633" stroke="none">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
        </path>
        
        {/* ZK proof indicator */}
        <circle cx="100" cy="90" r="12" opacity="0.3">
          <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="100" y="94" fontSize="8" fill="#C2A633" textAnchor="middle">ZK</text>
      </g>
    </svg>
  )
}

function UnshieldIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Shield opening */}
        <path d="M60 20 L90 32 L90 55 Q90 78 60 90 Q30 78 30 55 L30 32 Z" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Coin coming out */}
        <circle cx="60" cy="55" r="12" strokeWidth="2">
          <animate attributeName="cx" values="60;130;130" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0.8" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <text x="60" y="59" fontSize="10" fill="#C2A633" textAnchor="middle">Ð
          <animate attributeName="x" values="60;130;130" dur="2.5s" repeatCount="indefinite" />
        </text>
        {/* Arrow */}
        <path d="M95 55 L120 55" strokeWidth="2">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
        </path>
        {/* Wallet receiving */}
        <rect x="140" y="35" width="45" height="40" rx="4" fill="none" strokeWidth="2" />
        <path d="M150 50 L175 50 M150 60 L170 60" strokeWidth="1" opacity="0.5" />
        <text x="162" y="85" fontSize="8" fill="#C2A633" textAnchor="middle" opacity="0.6">0x...</text>
      </g>
    </svg>
  )
}

const steps = [
  {
    illustration: ShieldIllustration,
    title: "Shield",
    description: "Convert public DOGE to private shielded notes. Your funds generate a cryptographic commitment stored in a Merkle tree, making them invisible on the blockchain.",
  },
  {
    illustration: SendIllustration,
    title: "Transfer",
    description: "Send privately between shielded addresses. Zero-knowledge proofs verify the transaction without revealing sender, recipient, or amount. Fully anonymous.",
  },
  {
    illustration: UnshieldIllustration,
    title: "Unshield",
    description: "Convert shielded notes back to public DOGE. Generate a ZK proof demonstrating ownership without revealing which note you're spending. Gas-free via relayer.",
  },
]

// Shielded Pool Visualization
function ShieldedPoolVisualization() {
  return (
    <div className="hidden md:block relative w-full max-w-5xl mx-auto">
      <svg viewBox="0 0 900 400" className="w-full h-auto" style={{ minHeight: '400px' }}>
        <defs>
          <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="poolGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Labels */}
        <text x="80" y="30" fill="#C2A633" fontSize="11" fontFamily="monospace" letterSpacing="2">SHIELD</text>
        <text x="780" y="30" fill="#C2A633" fontSize="11" fontFamily="monospace" letterSpacing="2">UNSHIELD</text>

        {/* Left: Public Wallets shielding */}
        {['A', 'B', 'C', 'D'].map((wallet, i) => {
          const y = 70 + i * 80
          return (
            <g key={`shield-${wallet}`}>
              <rect x="20" y={y} width="140" height="50" rx="2" fill="rgba(194,166,51,0.08)" stroke="rgba(194,166,51,0.4)" strokeWidth="1" />
              <rect x="30" y={y + 12} width="26" height="26" rx="4" fill="rgba(194,166,51,0.15)" stroke="#C2A633" strokeWidth="1" />
              <text x="43" y={y + 30} fill="#C2A633" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{wallet}</text>
              <text x="68" y={y + 29} fill="rgba(255,255,255,0.9)" fontSize="11" fontFamily="monospace">0x{wallet.toLowerCase()}...</text>
            </g>
          )
        })}

        {/* Right: Public Wallets receiving */}
        {['W', 'X', 'Y', 'Z'].map((wallet, i) => {
          const y = 70 + i * 80
          return (
            <g key={`unshield-${wallet}`}>
              <rect x="740" y={y} width="140" height="50" rx="2" fill="rgba(194,166,51,0.08)" stroke="rgba(194,166,51,0.4)" strokeWidth="1" />
              <text x="755" y={y + 29} fill="rgba(255,255,255,0.9)" fontSize="11" fontFamily="monospace">0x{wallet.toLowerCase()}...</text>
              <rect x="834" y={y + 12} width="26" height="26" rx="4" fill="rgba(194,166,51,0.25)" stroke="#C2A633" strokeWidth="1.5" />
              <text x="847" y={y + 30} fill="#C2A633" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{wallet}</text>
            </g>
          )
        })}

        {/* Center: Shielded Pool */}
        <g>
          <ellipse cx="450" cy="200" rx="85" ry="40" fill="none" stroke="#C2A633" strokeWidth="1" opacity="0.15" filter="url(#poolGlow)" />
          
          {/* Shield icon layers */}
          {[0, 1, 2, 3, 4].map((level) => {
            const scale = 1 - level * 0.15
            const opacity = 0.8 - level * 0.12
            return (
              <g key={`shield-layer-${level}`} transform={`translate(450, ${180 + level * 10}) scale(${scale})`}>
                <path 
                  d="M0 -30 L25 -20 L25 5 Q25 25 0 35 Q-25 25 -25 5 L-25 -20 Z" 
                  fill="none" 
                  stroke="#C2A633" 
                  strokeWidth={2 - level * 0.3}
                  opacity={opacity}
                >
                  <animateTransform 
                    attributeName="transform" 
                    type="rotate" 
                    from="0" 
                    to={level % 2 === 0 ? "5" : "-5"} 
                    dur={`${2 + level * 0.3}s`} 
                    repeatCount="indefinite"
                    additive="sum"
                  />
                </path>
              </g>
            )
          })}

          {/* Floating particles inside shield - using deterministic values to avoid hydration mismatch */}
          {[
            { cx: "435;450;438", cy: "185;205;192", durX: "2.3s", durY: "2.8s", durO: "1.7s" },
            { cx: "458;445;462", cy: "195;215;188", durX: "2.6s", durY: "3.1s", durO: "2.0s" },
            { cx: "442;455;440", cy: "210;198;205", durX: "2.1s", durY: "2.9s", durO: "1.8s" },
            { cx: "465;448;460", cy: "188;208;195", durX: "2.5s", durY: "2.7s", durO: "2.2s" },
            { cx: "438;460;445", cy: "200;190;212", durX: "2.4s", durY: "3.0s", durO: "1.6s" },
            { cx: "455;440;458", cy: "192;218;198", durX: "2.2s", durY: "2.6s", durO: "1.9s" },
          ].map((particle, i) => (
            <circle key={`particle-${i}`} r="3" fill="#C2A633" opacity="0.7">
              <animate 
                attributeName="cx" 
                values={particle.cx}
                dur={particle.durX}
                repeatCount="indefinite"
              />
              <animate 
                attributeName="cy" 
                values={particle.cy}
                dur={particle.durY}
                repeatCount="indefinite"
              />
              <animate attributeName="opacity" values="0.4;0.9;0.4" dur={particle.durO} repeatCount="indefinite" />
            </circle>
          ))}

          <text x="450" y="280" fill="#C2A633" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="3">SHIELDED POOL</text>
        </g>

        {/* Connection Lines - Shield */}
        {['A', 'B', 'C', 'D'].map((wallet, i) => {
          const walletY = 95 + i * 80
          const poolX = 370
          const poolY = 180 + (i - 1.5) * 10
          const startX = 160
          
          return (
            <g key={`line-shield-${wallet}`}>
              <path
                d={`M ${startX} ${walletY} C ${startX + 80} ${walletY} ${poolX - 60} ${poolY} ${poolX} ${poolY}`}
                fill="none"
                stroke="#C2A633"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.5"
              />
              <circle r="5" fill="#C2A633" filter="url(#particleGlow)">
                <animateMotion
                  dur={`${2.2 + i * 0.15}s`}
                  repeatCount="indefinite"
                  path={`M ${startX} ${walletY} C ${startX + 80} ${walletY} ${poolX - 60} ${poolY} ${poolX} ${poolY}`}
                />
              </circle>
            </g>
          )
        })}

        {/* Connection Lines - Unshield */}
        {['W', 'X', 'Y', 'Z'].map((wallet, i) => {
          const walletY = 95 + i * 80
          const poolX = 530
          const poolY = 200 + (i - 1.5) * 10
          const endX = 740
          
          return (
            <g key={`line-unshield-${wallet}`}>
              <path
                d={`M ${poolX} ${poolY} C ${poolX + 60} ${poolY} ${endX - 80} ${walletY} ${endX} ${walletY}`}
                fill="none"
                stroke="#C2A633"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.5"
              />
              <circle r="5" fill="#C2A633" filter="url(#particleGlow)">
                <animateMotion
                  dur={`${2.2 + i * 0.15}s`}
                  repeatCount="indefinite"
                  begin={`${1.5 + i * 0.2}s`}
                  path={`M ${poolX} ${poolY} C ${poolX + 60} ${poolY} ${endX - 80} ${walletY} ${endX} ${walletY}`}
                />
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function HomePage() {
  return (
    <SmoothScroll>
      <Navbar />
      {/* Global unified background */}
      <main className="min-h-screen bg-[#0a0a0a] relative">
        {/* Micro-dither layer - luxury grade, invisible but effective */}
        <div 
          className="fixed inset-0 opacity-[0.012] pointer-events-none mix-blend-soft-light z-[1]" 
          style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.4\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '300px 300px',
            filter: 'blur(0.5px)'
          }} 
        />
        
        {/* Turbine-style Hero Section - App Embedded */}
        <section className="relative min-h-screen flex items-center px-4 sm:px-6 md:px-12 py-12 md:py-16 overflow-hidden">
          
          {/* Center vignette - calmed, symmetrical, centered */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_450px_350px_at_50%_50%,_rgba(194,166,51,0.03)_0%,_transparent_55%)]" />
          
          {/* Faint oversized Doge silhouette */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img 
              src="/zdoge-logo.png" 
              alt="" 
              className="w-[400px] h-[400px] md:w-[500px] md:h-[500px] opacity-[0.02] blur-sm select-none"
              aria-hidden="true"
            />
          </div>
          
          {/* Turbine-style Grid Layout */}
          <div className="relative z-10 w-full max-w-[1400px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 lg:gap-12 items-start">
              
              {/* Left: Brand Message (Mobile: Second, Desktop: First) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="order-2 lg:order-1 flex flex-col justify-center lg:min-h-[600px] max-w-[600px]"
              >
                {/* Logo/Wordmark */}
                <h1 className="mb-4 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-[-0.015em]">
                  <span className="text-white">z</span><span className="text-white">DOGE</span>
                  <span 
                    className="font-display italic align-baseline inline-block"
                    style={{ fontSize: '0.42em', marginLeft: '0.12em', transform: 'translateY(-0.1em)' }}
                  >
                    <span className="text-[#C2A633]/70">.</span><span className="text-[#C2A633] tracking-[0.02em] ml-[0.03em]">CASH</span>
                  </span>
                </h1>
                
                {/* Subheadline */}
                <p className="font-display text-xl sm:text-2xl md:text-3xl text-white mb-4 font-normal tracking-[-0.005em] uppercase">
                  PRIVATE DOGE TRANSACTIONS
                </p>
                
                {/* Value Prop */}
                <p className="font-body text-base sm:text-lg text-white/50 mb-6 font-normal leading-relaxed tracking-[-0.01em]">
                  A zero-knowledge protocol for non-custodial privacy on Dogecoin.
                </p>
                
                {/* Learn Zdoge Button */}
                <Link href="#how-it-works">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="mb-6 px-6 py-3 rounded-full border-0 font-body text-sm font-medium tracking-[0.02em] transition-all duration-[120ms] ease-out"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      backdropFilter: 'blur(6px)',
                      color: 'rgba(255, 255, 255, 0.9)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 1)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 255, 255, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    Learn zDoge
                  </motion.button>
                </Link>
                
                {/* Micro technical line */}
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
                  BUILT WITH ZK PROOFS · ON-CHAIN VERIFIABLE · NON-CUSTODIAL
                </p>
              </motion.div>
              
              {/* Right: App Card (Mobile: First, Desktop: Second) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="order-1 lg:order-2"
              >
                <AppCard />
              </motion.div>
              
            </div>
          </div>
          
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="relative py-24 px-6 md:px-12">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="mb-16"
            >
              <p className="font-mono text-xs tracking-[0.18em] text-[#C2A633] mb-4 uppercase">HOW IT WORKS</p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-4 md:mb-6">
                Privacy Through
                <br />
                <span className="italic">Shielded Notes</span>
              </h2>
              <p className="font-body text-sm sm:text-base text-muted-foreground max-w-2xl leading-7 sm:leading-8 tracking-[-0.01em]">
                zDoge.cash uses zero-knowledge proofs to create private transactions on DogeOS.
                Like Zcash shielded pools, your DOGE becomes invisible on-chain while remaining 
                fully yours and spendable anytime.
              </p>
            </motion.div>

            {/* Steps Grid - tighter binding to explanation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-16 -mt-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                  className="border border-white/[0.06] p-6 md:p-8 group hover:border-white/10 transition-all duration-500 relative"
                >
                  <step.illustration />
                  <h3 className="font-display text-lg sm:text-xl font-semibold text-[#C2A633] mb-3">{step.title}</h3>
                  <p className="font-body text-sm sm:text-base text-muted-foreground leading-relaxed">{step.description}</p>
                  
                  {index < 2 && (
                    <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                      <div className="w-8 h-[1px] bg-gradient-to-r from-[#C2A633]/30 to-[#C2A633]/10" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="border border-white/[0.06] p-6 sm:p-10 md:p-14"
            >
              <ShieldedPoolVisualization />
              
              {/* Mobile version */}
              <div className="md:hidden flex flex-col items-center gap-6">
                <div className="w-full">
                  <p className="font-mono text-xs tracking-[0.08em] text-[#C2A633] mb-3 text-center uppercase">SHIELD</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['A', 'B', 'C', 'D'].map((wallet) => (
                      <div key={wallet} className="px-3 py-2 border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#C2A633]/15 border border-[#C2A633]/40 flex items-center justify-center">
                            <span className="font-mono text-[10px] font-bold text-[#C2A633]">{wallet}</span>
                          </div>
                          <span className="font-mono text-[10px] text-white/90 tracking-[0.02em]">0x{wallet.toLowerCase()}...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.div
                  animate={{ y: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-[#C2A633] font-mono text-lg"
                >
                  ▼
                </motion.div>

                <div className="p-6 border border-[#C2A633]/30 bg-[#C2A633]/5">
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 40 40" className="w-10 h-10">
                      <path d="M20 5 L35 12 L35 25 Q35 35 20 40 Q5 35 5 25 L5 12 Z" fill="none" stroke="#C2A633" strokeWidth="2" />
                    </svg>
                    <span className="font-mono text-xs text-[#C2A633] font-bold tracking-[0.08em] uppercase">SHIELDED POOL</span>
                  </div>
                </div>

                <motion.div
                  animate={{ y: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  className="text-[#C2A633] font-mono text-lg"
                >
                  ▼
                </motion.div>

                <div className="w-full">
                  <p className="font-mono text-xs tracking-[0.08em] text-[#C2A633] mb-3 text-center uppercase">UNSHIELD</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['W', 'X', 'Y', 'Z'].map((wallet) => (
                      <div key={wallet} className="px-3 py-2 border border-[#C2A633]/40 bg-[#C2A633]/10">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-white/90 tracking-[0.02em]">0x{wallet.toLowerCase()}...</span>
                          <div className="w-6 h-6 rounded bg-[#C2A633]/25 border border-[#C2A633]/60 flex items-center justify-center">
                            <span className="font-mono text-[10px] font-bold text-[#C2A633]">{wallet}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center space-y-2">
                <p className="font-body text-sm sm:text-base text-muted-foreground/85 max-w-3xl mx-auto leading-7 sm:leading-8 tracking-[-0.01em]">
                  Shielded notes are cryptographic commitments stored in a Merkle tree. Zero-knowledge proofs 
                  verify transactions without revealing sender, recipient, or amount — ensuring complete 
                  unlinkability between addresses.
                </p>
                <p className="font-body text-xs sm:text-sm text-muted-foreground/50 max-w-2xl mx-auto leading-relaxed tracking-[-0.01em]">
                  Each spend nullifies a unique hash to prevent double-spending while maintaining full anonymity within the shielded pool.
                </p>
              </div>
            </motion.div>
          </div>
          
        </section>

        {/* Privacy Features Section */}
        <section id="privacy" className="relative py-24 px-6 md:px-12">
          
          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 1 }}
              className="mb-16 text-center md:text-left"
            >
              <p className="font-mono text-xs tracking-[0.18em] text-[#C2A633] mb-4 uppercase">PRIVACY FEATURES</p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-4 md:mb-6">
                What&apos;s
                <br />
                <span className="italic">Hidden</span>
              </h2>
              <p className="font-body text-sm sm:text-base text-muted-foreground max-w-xl mx-auto md:mx-0 leading-7 sm:leading-8 tracking-[-0.01em]">
                Unlike transparent blockchains, shielded transactions reveal nothing about 
                who sent what to whom.
              </p>
            </motion.div>

            {/* Cards with distinct icons per concept */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                { 
                  title: "Sender Address", 
                  desc: "Your wallet never appears in transaction data",
                  // Key icon - represents hidden identity
                  icon: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                },
                { 
                  title: "Recipient Address", 
                  desc: "Recipients receive via encrypted memos",
                  // Encrypted envelope icon
                  icon: <><path d="M22 7L13.03 12.7a1.94 1.94 0 0 1-2.06 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 11v4" /><circle cx="12" cy="17" r="1" /></>
                },
                { 
                  title: "Transaction Amount", 
                  desc: "Amounts are cryptographically hidden",
                  // Stacked layers icon
                  icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>
                },
                { 
                  title: "Transaction Link", 
                  desc: "No connection between sender and recipient",
                  // Broken chain icon
                  icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /><line x1="8" y1="2" x2="8" y2="5" /><line x1="2" y1="8" x2="5" y2="8" /><line x1="16" y1="19" x2="16" y2="22" /><line x1="19" y1="16" x2="22" y2="16" /></>
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="border border-white/[0.06] p-6 flex items-start gap-4"
                >
                  <div className="w-10 h-10 border border-[#C2A633]/30 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#C2A633]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {item.icon}
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="font-body text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Security Reminder - desaturated, warning-tone background */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="border-l-2 border-[#C2A633]/40 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 border border-[#C2A633]/40 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#C2A633]/80" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-[#C2A633]/90 mb-2">Security Reminder</h3>
                  <p className="font-body text-xs sm:text-sm text-muted-foreground leading-relaxed tracking-[-0.01em]">
                    zDoge.cash is a decentralized, non-custodial protocol. We never have access to your 
                    funds or private keys. You are solely responsible for keeping your wallet secure. 
                    Always backup your shielded wallet before transactions.
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
                    {['DECENTRALIZED', 'NON-CUSTODIAL', 'ZK-PRIVATE'].map((tag) => (
                      <span key={tag} className="px-2 sm:px-3 py-1 border border-[#C2A633]/25 text-[#C2A633]/80 font-mono text-[10px] tracking-[0.08em] uppercase">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <Footer />
      </main>
    </SmoothScroll>
  )
}
