"use client"

export function WalletIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className}
      fill="none" 
      stroke="#C2A633" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {/* Wallet body outline */}
      <rect x="3" y="7" width="18" height="12" rx="2" strokeWidth="1.5" stroke="#C2A633">
        <animate attributeName="stroke-dasharray" values="0 60;30 30;60 0" dur="3s" repeatCount="indefinite" />
      </rect>
      
      {/* Wallet flap/closure line */}
      <path d="M3 11 L21 11" strokeWidth="1.5" stroke="#C2A633">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </path>
      
      {/* Connection indicator (pulsing dot on right) */}
      <circle cx="19" cy="9" r="1.5" fill="#C2A633" opacity="0.7">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="r" values="1;2;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
      
      {/* Subtle inner glow (cards/money) */}
      <rect x="5" y="9" width="14" height="8" rx="1" opacity="0.2" fill="#C2A633">
        <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2.5s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}

