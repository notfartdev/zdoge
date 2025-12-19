"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"
import { NoteAccountSetup } from "./note-account-setup"

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[#C2A633]/20 bg-black">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
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
              <Link
                href="/#how-it-works"
                className="font-mono text-sm text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WalletConnectButton />
            <Button
              variant="outline"
              size="sm"
              className="border-[#C2A633]/40 text-[#C2A633] hover:bg-[#C2A633]/10 font-mono bg-transparent h-10 px-4"
            >
              DOGE
            </Button>
            <NoteAccountSetup />
            <Link href="/dashboard/account">
              <Button
                variant="outline"
                size="icon"
                className={`border-[#C2A633]/40 hover:bg-[#C2A633]/10 h-10 w-10 transition-colors ${
                  pathname === "/dashboard/account" ? "bg-[#C2A633]/10 text-[#C2A633]" : "text-[#C2A633]"
                }`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
