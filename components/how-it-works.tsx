"use client"

import { motion } from "framer-motion"

// SVG Illustration Components
function DepositIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      {/* Hand holding note */}
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Hand outline */}
        <path d="M40 90 Q30 85 25 70 Q22 55 30 45 L45 35 Q55 30 65 35 L80 45" />
        <path d="M80 45 L95 40 Q105 38 110 45 L115 55" />
        {/* Fingers */}
        <path d="M45 35 Q40 25 50 20 Q60 18 65 28" />
        <path d="M65 28 Q62 18 72 15 Q82 14 85 25" />
        <path d="M85 25 Q85 15 95 14 Q105 15 105 28" />
        {/* Note/key being inserted */}
        <rect x="100" y="25" width="45" height="30" rx="3" strokeDasharray="3 2" />
        <circle cx="115" cy="40" r="6" />
        <path d="M121 40 L135 40 M130 37 L130 43" />
        {/* Arrow flowing right */}
        <path d="M150 45 Q165 45 175 55" strokeWidth="2">
          <animate attributeName="stroke-dasharray" values="0 100;50 50;100 0" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M170 50 L178 58 L172 60" fill="#C2A633" stroke="none" />
        {/* Flow line */}
        <path d="M175 60 Q185 75 195 85" strokeWidth="1.5" opacity="0.6" />
      </g>
    </svg>
  )
}

function WaitIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Flow line from left */}
        <path d="M5 60 Q25 55 40 60" strokeWidth="1.5" opacity="0.6" />
        {/* Timer/Clock box */}
        <rect x="55" y="25" width="90" height="70" rx="8" />
        <rect x="60" y="30" width="80" height="10" rx="3" fill="none" />
        {/* Clock display segments - digital style */}
        <g transform="translate(70, 50)">
          {/* Hour digits */}
          <path d="M0 0 L0 15 M0 17 L0 32" strokeWidth="3" />
          <path d="M8 0 L15 0 M8 15 L15 15 M8 32 L15 32 M15 0 L15 32" strokeWidth="2" />
          {/* Colon */}
          <circle cx="25" cy="10" r="2" fill="#C2A633" />
          <circle cx="25" cy="22" r="2" fill="#C2A633" />
          {/* Minute digits */}
          <path d="M35 0 L35 15 L45 15 L45 0 M35 15 L35 32 L45 32 L45 15" strokeWidth="2" />
          <path d="M52 0 L52 15 L60 15 M52 15 L52 32 L60 32 L60 15 L52 15" strokeWidth="2" />
        </g>
        {/* Small indicator dots */}
        <circle cx="65" cy="34" r="2" fill="#C2A633" opacity="0.5">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="75" cy="34" r="2" fill="#C2A633" opacity="0.5">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        {/* Flow line to right */}
        <path d="M160 60 Q175 65 195 60" strokeWidth="1.5" opacity="0.6" />
      </g>
    </svg>
  )
}

function WithdrawIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28 mb-4">
      <g stroke="#C2A633" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Flow line from left */}
        <path d="M5 50 Q15 60 30 55" strokeWidth="1.5" opacity="0.6" />
        {/* Receiving indicator */}
        <circle cx="45" cy="50" r="12" strokeDasharray="3 2">
          <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <path d="M45 42 L45 58 M37 50 L53 50" strokeWidth="2" />
        {/* Arrow flowing right */}
        <path d="M60 50 Q75 45 90 50" strokeWidth="1.5" />
        {/* Hand receiving */}
        <path d="M160 90 Q150 85 145 70 Q142 55 150 45 L165 35 Q175 30 185 35 L200 45" transform="scale(-1, 1) translate(-200, 0)" />
        <path d="M160 90 Q170 85 175 70 Q178 55 170 45 L155 35 Q145 30 135 35 L120 45" />
        {/* Fingers */}
        <path d="M155 35 Q160 25 150 20 Q140 18 135 28" />
        <path d="M135 28 Q138 18 128 15 Q118 14 115 25" />
        {/* Token/coin being received */}
        <circle cx="100" cy="40" r="15" strokeWidth="2" />
        <text x="100" y="45" fontSize="12" fill="#C2A633" textAnchor="middle" fontFamily="monospace">Ð</text>
        {/* Glow effect */}
        <circle cx="100" cy="40" r="20" opacity="0.3" strokeWidth="1">
          <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}

const steps = [
  {
    illustration: DepositIllustration,
    title: "Deposit",
    description: "Generate a cryptographic commitment (note) containing a random secret. Submit the hash to the smart contract along with your tokens. The commitment is added to a Merkle tree for later verification.",
  },
  {
    illustration: WaitIllustration,
    title: "Wait",
    description: "Allow time for the anonymity set to grow. As more deposits enter the pool, the statistical linkability between your deposit and potential withdrawals decreases exponentially.",
  },
  {
    illustration: WithdrawIllustration,
    title: "Withdraw",
    description: "Generate a zero-knowledge proof demonstrating ownership of a valid commitment without revealing which one. The contract verifies the proof and transfers tokens to your specified recipient address.",
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

        {/* Steps Grid - Tornado Cash Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-8 md:mb-16">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="border border-white/10 bg-black/30 p-6 md:p-8 group hover:bg-black/50 transition-all duration-500 relative"
            >
              {/* Illustration */}
              <step.illustration />
              
              {/* Title */}
              <h3 className="font-mono text-lg sm:text-xl font-bold text-[#C2A633] tracking-wide mb-3 italic">{step.title}</h3>
              
              {/* Description */}
              <p className="font-mono text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              
              {/* Step connector for desktop */}
              {index < 2 && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                  <div className="w-8 h-[2px] bg-gradient-to-r from-[#C2A633]/50 to-[#C2A633]/20" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Transaction Flow Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="border border-white/10 bg-black/40 backdrop-blur-sm p-6 sm:p-10 md:p-14"
        >
          {/* Clean Grid-Based Layout */}
          <div className="hidden md:block relative w-full max-w-5xl mx-auto">
            {/* SVG Canvas for everything */}
            <svg viewBox="0 0 900 400" className="w-full h-auto" style={{ minHeight: '400px' }}>
              <defs>
                {/* Gradient for lines */}
                <linearGradient id="lineGradientLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#C2A633" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#C2A633" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="lineGradientRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#C2A633" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#C2A633" stopOpacity="0.3" />
                </linearGradient>
                {/* Glow filter for particles */}
                <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Pool glow */}
                <filter id="poolGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Labels */}
              <text x="80" y="30" fill="#C2A633" fontSize="11" fontFamily="monospace" letterSpacing="2">DEPOSIT</text>
              <text x="780" y="30" fill="#C2A633" fontSize="11" fontFamily="monospace" letterSpacing="2">WITHDRAW</text>

              {/* Left Wallet Boxes (A, B, C, D) - Clean minimal design */}
              {['A', 'B', 'C', 'D'].map((wallet, i) => {
                const y = 70 + i * 80
                return (
                  <g key={`deposit-${wallet}`}>
                    {/* Wallet box */}
                    <rect x="20" y={y} width="140" height="50" rx="2" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    {/* Simple badge */}
                    <rect x="30" y={y + 12} width="26" height="26" rx="4" fill="rgba(194,166,51,0.15)" stroke="#C2A633" strokeWidth="1" />
                    <text x="43" y={y + 30} fill="#C2A633" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{wallet}</text>
                    {/* Wallet text */}
                    <text x="68" y={y + 29} fill="rgba(255,255,255,0.9)" fontSize="11" fontFamily="monospace">Wallet {wallet}</text>
                  </g>
                )
              })}

              {/* Right Wallet Boxes (W, X, Y, Z) - Clean minimal design */}
              {['W', 'X', 'Y', 'Z'].map((wallet, i) => {
                const y = 70 + i * 80
                return (
                  <g key={`withdraw-${wallet}`}>
                    {/* Wallet box with golden tint */}
                    <rect x="740" y={y} width="140" height="50" rx="2" fill="rgba(194,166,51,0.08)" stroke="rgba(194,166,51,0.4)" strokeWidth="1" />
                    {/* Wallet text */}
                    <text x="755" y={y + 29} fill="rgba(255,255,255,0.9)" fontSize="11" fontFamily="monospace">Wallet {wallet}</text>
                    {/* Simple badge */}
                    <rect x="834" y={y + 12} width="26" height="26" rx="4" fill="rgba(194,166,51,0.25)" stroke="#C2A633" strokeWidth="1.5" />
                    <text x="847" y={y + 30} fill="#C2A633" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{wallet}</text>
                  </g>
                )
              })}

              {/* Center Tornado Vortex */}
              <g>
                {/* Outer glow effect */}
                <ellipse cx="450" cy="200" rx="85" ry="40" fill="none" stroke="#C2A633" strokeWidth="1" opacity="0.15" filter="url(#poolGlow)" />
                
                {/* Tornado funnel - stacked ellipses creating depth */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map((level) => {
                  const yOffset = level * 12 - 42
                  const rx = 70 - level * 7
                  const ry = 25 - level * 2.5
                  const opacity = 0.8 - level * 0.08
                  const strokeWidth = 2 - level * 0.15
                  return (
                    <ellipse 
                      key={`vortex-${level}`}
                      cx="450" 
                      cy={200 + yOffset} 
                      rx={Math.max(rx, 10)} 
                      ry={Math.max(ry, 4)}
                      fill="none" 
                      stroke="#C2A633" 
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                    >
                      <animateTransform 
                        attributeName="transform" 
                        type="rotate" 
                        from={`0 450 ${200 + yOffset}`} 
                        to={`${level % 2 === 0 ? 360 : -360} 450 ${200 + yOffset}`} 
                        dur={`${3 + level * 0.5}s`} 
                        repeatCount="indefinite" 
                      />
                    </ellipse>
                  )
                })}

                {/* Spiral particles being sucked in */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
                  const startAngle = i * 30
                  const duration = 2 + (i % 3) * 0.5
                  return (
                    <circle key={`spiral-${i}`} r="3" fill="#C2A633" opacity="0.9">
                      <animate 
                        attributeName="cx" 
                        values={`${450 + 65 * Math.cos(startAngle * Math.PI / 180)};${450 + 40 * Math.cos((startAngle + 180) * Math.PI / 180)};${450 + 15 * Math.cos((startAngle + 360) * Math.PI / 180)};450`}
                        dur={`${duration}s`}
                        repeatCount="indefinite"
                      />
                      <animate 
                        attributeName="cy" 
                        values={`${200 - 30 + 25 * Math.sin(startAngle * Math.PI / 180)};${200 + 15 * Math.sin((startAngle + 180) * Math.PI / 180)};${200 + 30 + 5 * Math.sin((startAngle + 360) * Math.PI / 180)};${200 + 45}`}
                        dur={`${duration}s`}
                        repeatCount="indefinite"
                      />
                      <animate 
                        attributeName="r" 
                        values="4;3;2;1"
                        dur={`${duration}s`}
                        repeatCount="indefinite"
                      />
                      <animate 
                        attributeName="opacity" 
                        values="0.9;0.8;0.6;0"
                        dur={`${duration}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )
                })}

                {/* Center vortex eye */}
                <ellipse cx="450" cy="248" rx="8" ry="3" fill="#C2A633" opacity="0.6">
                  <animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite" />
                </ellipse>

                {/* Pool Label */}
                <text x="450" y="300" fill="#C2A633" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="3">MIXING POOL</text>
              </g>

              {/* Connection Lines - Deposit (Left → Vortex) */}
              {['A', 'B', 'C', 'D'].map((wallet, i) => {
                const walletY = 95 + i * 80
                const vortexX = 370
                const vortexY = 180 + (i - 1.5) * 8 // Spread entry points vertically
                const startX = 160
                const ctrlX1 = startX + 80
                const ctrlX2 = vortexX - 60
                
                return (
                  <g key={`line-deposit-${wallet}`}>
                    {/* Connection line with better visibility */}
                    <path
                      d={`M ${startX} ${walletY} C ${ctrlX1} ${walletY} ${ctrlX2} ${vortexY} ${vortexX} ${vortexY}`}
                      fill="none"
                      stroke="#C2A633"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      opacity="0.6"
                    />
                    
                    {/* Animated particle */}
                    <circle r="5" fill="#C2A633" filter="url(#particleGlow)">
                      <animateMotion
                        dur={`${2.2 + i * 0.15}s`}
                        repeatCount="indefinite"
                        path={`M ${startX} ${walletY} C ${ctrlX1} ${walletY} ${ctrlX2} ${vortexY} ${vortexX} ${vortexY}`}
                      />
                    </circle>
                  </g>
                )
              })}

              {/* Connection Lines - Withdraw (Vortex → Right) */}
              {['W', 'X', 'Y', 'Z'].map((wallet, i) => {
                const walletY = 95 + i * 80
                const vortexX = 530
                const vortexY = 220 + (i - 1.5) * 8 // Spread exit points vertically
                const endX = 740
                const ctrlX1 = vortexX + 60
                const ctrlX2 = endX - 80
                
                return (
                  <g key={`line-withdraw-${wallet}`}>
                    {/* Connection line with better visibility */}
                    <path
                      d={`M ${vortexX} ${vortexY} C ${ctrlX1} ${vortexY} ${ctrlX2} ${walletY} ${endX} ${walletY}`}
                      fill="none"
                      stroke="#C2A633"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      opacity="0.6"
                    />
                    
                    {/* Animated particle */}
                    <circle r="5" fill="#C2A633" filter="url(#particleGlow)">
                      <animateMotion
                        dur={`${2.2 + i * 0.15}s`}
                        repeatCount="indefinite"
                        begin={`${1.5 + i * 0.2}s`}
                        path={`M ${vortexX} ${vortexY} C ${ctrlX1} ${vortexY} ${ctrlX2} ${walletY} ${endX} ${walletY}`}
                      />
                    </circle>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden flex flex-col items-center gap-6">
            {/* Deposit Wallets */}
            <div className="w-full">
              <p className="font-mono text-xs tracking-widest text-[#C2A633] mb-3 text-center">DEPOSIT</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['A', 'B', 'C', 'D'].map((wallet) => (
                  <div key={wallet} className="px-3 py-2 border border-white/15 bg-black/50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-[#C2A633]/15 border border-[#C2A633]/40 flex items-center justify-center">
                        <span className="font-mono text-[10px] font-bold text-[#C2A633]">{wallet}</span>
                      </div>
                      <span className="font-mono text-[10px] text-white/90">Wallet {wallet}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow indicator */}
            <motion.div
              animate={{ y: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[#C2A633] font-mono text-lg"
            >
              ▼
            </motion.div>

            {/* Mixing Vortex - Mobile version */}
            <div className="relative">
              <svg width="160" height="120" viewBox="0 0 160 120">
                {/* Vortex ellipses */}
                {[0, 1, 2, 3, 4].map((level) => {
                  const yOffset = level * 15 - 30
                  const rx = 60 - level * 10
                  const ry = 20 - level * 3
                  return (
                    <ellipse 
                      key={level}
                      cx="80" 
                      cy={60 + yOffset} 
                      rx={Math.max(rx, 10)} 
                      ry={Math.max(ry, 4)}
                      fill="none" 
                      stroke="#C2A633" 
                      strokeWidth={1.5 - level * 0.2}
                      opacity={0.8 - level * 0.12}
                    >
                      <animateTransform 
                        attributeName="transform" 
                        type="rotate" 
                        from={`0 80 ${60 + yOffset}`} 
                        to={`${level % 2 === 0 ? 360 : -360} 80 ${60 + yOffset}`} 
                        dur={`${3 + level * 0.5}s`} 
                        repeatCount="indefinite" 
                      />
                    </ellipse>
                  )
                })}
                {/* Center glow */}
                <ellipse cx="80" cy="90" rx="6" ry="3" fill="#C2A633" opacity="0.6">
                  <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
                </ellipse>
              </svg>
              <p className="font-mono text-[10px] tracking-widest text-[#C2A633] font-bold text-center mt-2">MIXING POOL</p>
            </div>

            {/* Flow indicator */}
            <motion.div
              animate={{ y: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              className="text-[#C2A633] font-mono text-lg"
            >
              ▼
            </motion.div>

            {/* Withdrawal Wallets */}
            <div className="w-full">
              <p className="font-mono text-xs tracking-widest text-[#C2A633] mb-3 text-center">WITHDRAW</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['W', 'X', 'Y', 'Z'].map((wallet) => (
                  <div key={wallet} className="px-3 py-2 border border-[#C2A633]/40 bg-[#C2A633]/10">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-white/90">Wallet {wallet}</span>
                      <div className="w-6 h-6 rounded bg-[#C2A633]/25 border border-[#C2A633]/60 flex items-center justify-center">
                        <span className="font-mono text-[10px] font-bold text-[#C2A633]">{wallet}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Explanation Text - More Technical */}
          <div className="mt-10 text-center space-y-3">
            <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Deposits generate Pedersen commitments stored in a Merkle tree. The zero-knowledge circuit validates 
              withdrawal proofs against the tree root without revealing the specific leaf, ensuring cryptographic 
              unlinkability between input and output addresses.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/60 max-w-2xl mx-auto">
              Each withdrawal nullifies a unique hash to prevent double-spending while maintaining sender anonymity within the pool&apos;s anonymity set.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
