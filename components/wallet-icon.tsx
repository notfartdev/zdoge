"use client"

export function WalletIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img 
      src="https://z.cash/wp-content/uploads/2023/04/fair-open.gif"
      alt="Wallet"
      className={className}
    />
  )
}
