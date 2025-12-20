"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Search } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"
import { AccountModal } from "./account-modal"

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[#C2A633]/20 bg-black">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Left Side: Logo / Mixer / Docs */}
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C2A633] flex items-center justify-center">
                <span className="font-mono text-black font-bold text-xl">Ð</span>
              </div>
              <span className="font-mono text-xl font-bold text-white">dogemixer</span>
            </Link>
            <div className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className={`font-mono text-sm transition-colors ${
                  pathname === "/dashboard" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Mixer
              </Link>
              <a
                href="https://docs.dogenado.cash"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </a>
            </div>
          </div>

          {/* Right Side: Connect Wallet / Check / Inbox / Account */}
          <div className="flex items-center gap-6">
            <WalletConnectButton />
            
            {/* Check Note Status */}
            <Link
              href="/dashboard/check"
              className={`font-mono text-sm transition-colors flex items-center gap-2 ${
                pathname === "/dashboard/check" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <Search className="w-4 h-4" />
              Check
            </Link>
            
            {/* Inbox */}
            <Link
              href="/dashboard/inbox"
              className={`font-mono text-sm transition-colors flex items-center gap-2 ${
                pathname === "/dashboard/inbox" ? "text-[#C2A633] font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <Inbox className="w-4 h-4" />
              Inbox
            </Link>

            {/* Account Modal */}
            <AccountModal />
          </div>
        </div>
      </div>
    </nav>
  )
}
