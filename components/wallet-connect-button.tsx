"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { Wallet, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function WalletConnectButton() {
  const { wallet, isConnecting, connect, disconnect } = useWallet()
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setError(null)
    try {
      await connect()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("not installed")) {
          setError("MyDogeWallet extension not found. Please install it first.")
        } else {
          setError("Failed to connect wallet. Please try again.")
        }
      }
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBalance = (balance: bigint): string => {
    // DOGE has 18 decimals
    const divisor = BigInt(10 ** 18)
    const whole = balance / divisor
    const remainder = balance % divisor
    const decimal = remainder.toString().padStart(18, '0').slice(0, 2)
    return `${whole}.${decimal}`
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Alert variant="destructive" className="bg-red-950 border-red-900 text-red-200">
          <AlertDescription className="font-body text-sm">{error}</AlertDescription>
        </Alert>
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-body font-medium"
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (!wallet?.isConnected) {
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-body font-medium px-6"
      >
        <Wallet className="h-4 w-4 mr-2" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10 font-body bg-transparent px-6"
        >
          <Wallet className="h-4 w-4 mr-2" />
          {formatAddress(wallet.address)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-[#C2A633]/20">
        <div className="px-2 py-2">
          <p className="font-body text-xs text-white/60">Balance</p>
          <p className="font-mono text-lg font-bold tracking-[-0.01em] text-[#C2A633]">{formatBalance(wallet.balance)} <span className="font-body text-sm text-white/70">DOGE</span></p>
        </div>
        <DropdownMenuSeparator className="bg-[#C2A633]/20" />
        <DropdownMenuItem onClick={disconnect} className="font-body text-red-400 cursor-pointer">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
