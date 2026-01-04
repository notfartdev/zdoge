"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Shield, Send, ArrowLeftRight, ShieldOff, QrCode, Activity } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"
import { AccountModal } from "./account-modal"

export function DashboardNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: "/shield", label: "Shield", icon: Shield },
    { href: "/send", label: "Send", icon: Send },
    { href: "/swap", label: "Swap", icon: ArrowLeftRight },
    { href: "/unshield", label: "Unshield", icon: ShieldOff },
    { href: "/receive", label: "Receive", icon: QrCode },
    { href: "/activity", label: "Activity", icon: Activity },
  ]

  return (
    <nav className="border-b border-[#C2A633]/20 bg-black sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 sm:h-16">
          
          {/* Left: Logo only */}
          <div className="flex-shrink-0">
            <Link href="/">
              <img 
                src="/zdoge-logo.png" 
                alt="zDoge.cash" 
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-transform duration-300 hover:scale-105" 
              />
            </Link>
          </div>

          {/* Center: Main Nav Links */}
          <div className="hidden lg:flex items-center justify-center flex-1">
            <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`font-mono text-[11px] tracking-wider px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-1.5 ${
                      isActive 
                        ? "bg-[#C2A633] text-black font-bold" 
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {link.label.toUpperCase()}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right: Wallet & Account */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <WalletConnectButton />
            <AccountModal />
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden ml-auto">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#C2A633]/20 bg-black/95 backdrop-blur-sm">
          <div className="px-4 py-4 space-y-2">
            {/* Mobile Navigation Links */}
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`font-mono text-sm tracking-wider transition-all duration-300 flex items-center gap-3 py-3 px-4 rounded ${
                    isActive 
                      ? "bg-[#C2A633] text-black font-bold" 
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-5 h-5 opacity-85" strokeWidth={1.75} />
                  {link.label.toUpperCase()}
                </Link>
              )
            })}
            
            {/* Mobile Actions */}
            <div className="pt-4 border-t border-[#C2A633]/20 space-y-3">
              <WalletConnectButton />
              <div onClick={() => setMobileMenuOpen(false)}>
                <AccountModal />
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
