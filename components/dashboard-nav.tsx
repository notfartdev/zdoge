"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Search, Menu, X, HelpCircle, Shield, Send, LogOut, ArrowLeftRight } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"
import { AccountModal } from "./account-modal"
import { FAQModal } from "./faq-modal"

export function DashboardNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  
  const isShieldedPage = ['/shield', '/send', '/swap', '/unshield'].includes(pathname)

  return (
    <nav className="border-b border-[#C2A633]/20 bg-black">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left Side: Logo / Links */}
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <img src="/dogenadologo.png" alt="DogenadoCash" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full" />
              <span className="font-mono text-base sm:text-xl font-bold text-white">dogenado</span>
            </Link>
            
            {/* Main Nav Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/shield"
                className={`font-mono text-sm transition-colors flex items-center gap-1.5 ${
                  pathname === "/shield" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <Shield className="w-4 h-4" />
                Shield
              </Link>
              <Link
                href="/send"
                className={`font-mono text-sm transition-colors flex items-center gap-1.5 ${
                  pathname === "/send" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <Send className="w-4 h-4" />
                Send
              </Link>
              <Link
                href="/swap"
                className={`font-mono text-sm transition-colors flex items-center gap-1.5 ${
                  pathname === "/swap" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Swap
              </Link>
              <Link
                href="/unshield"
                className={`font-mono text-sm transition-colors flex items-center gap-1.5 ${
                  pathname === "/unshield" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <LogOut className="w-4 h-4" />
                Unshield
              </Link>
              
              <div className="h-4 w-px bg-[#C2A633]/20" />
              
              <a
                href="https://docs.dogenado.cash"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </a>
              <button
                onClick={() => setFaqOpen(true)}
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden lg:inline">How it Works</span>
              </button>
            </div>
          </div>

          {/* Desktop Right Side: Connect Wallet / Account */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-6">
            <WalletConnectButton />
            <AccountModal />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#C2A633]/20 bg-black">
            <div className="px-4 py-4 space-y-3">
              {/* Mobile Navigation Links */}
              <Link
                href="/shield"
                onClick={() => setMobileMenuOpen(false)}
                className={`font-mono text-sm transition-colors flex items-center gap-2 py-2 ${
                  pathname === "/shield" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <Shield className="w-4 h-4" />
                Shield
              </Link>
              <Link
                href="/send"
                onClick={() => setMobileMenuOpen(false)}
                className={`font-mono text-sm transition-colors flex items-center gap-2 py-2 ${
                  pathname === "/send" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <Send className="w-4 h-4" />
                Send
              </Link>
              <Link
                href="/swap"
                onClick={() => setMobileMenuOpen(false)}
                className={`font-mono text-sm transition-colors flex items-center gap-2 py-2 ${
                  pathname === "/swap" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Swap
              </Link>
              <Link
                href="/unshield"
                onClick={() => setMobileMenuOpen(false)}
                className={`font-mono text-sm transition-colors flex items-center gap-2 py-2 ${
                  pathname === "/unshield" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <LogOut className="w-4 h-4" />
                Unshield
              </Link>
              
              <div className="border-t border-[#C2A633]/20 my-3" />
              
              <a
                href="https://docs.dogenado.cash"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 py-2"
              >
                Docs
              </a>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  setFaqOpen(true)
                }}
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 py-2"
              >
                <HelpCircle className="w-4 h-4" />
                How it Works
              </button>
              
              {/* Mobile Actions */}
              <div className="pt-3 border-t border-[#C2A633]/20 space-y-3">
                <WalletConnectButton />
                <div onClick={() => setMobileMenuOpen(false)}>
                  <AccountModal />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <FAQModal open={faqOpen} onOpenChange={setFaqOpen} />
    </nav>
  )
}
