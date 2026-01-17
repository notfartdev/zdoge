"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { Wallet, LogOut, AlertCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface WalletConnectButtonProps {
  variant?: 'default' | 'quiet' // 'quiet' for navbar, 'default' for in-card hero
}

export function WalletConnectButton({ variant = 'quiet' }: WalletConnectButtonProps) {
  const { wallet, isConnecting, connect, disconnect, requestAccountSelection } = useWallet()
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
        <Alert className="bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="font-body text-sm text-red-100">{error}</AlertDescription>
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
    if (variant === 'quiet') {
      // Header version - ghost pill style (like "How it Works?")
      return (
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="font-body text-sm font-medium px-4 py-1.5 rounded-full border-0 transition-all duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(6px)',
            color: 'rgba(255, 255, 255, 0.9)',
          }}
          onMouseEnter={(e) => {
            if (!isConnecting) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 1)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 255, 255, 0.08)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <Wallet className="h-3.5 w-3.5 mr-1.5" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      )
    }
    
    // In-card version - ghost pill style (like "How it Works?")
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="font-body font-medium px-6 py-3 rounded-full border-0 transition-all duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(6px)',
          color: 'rgba(255, 255, 255, 0.9)',
        }}
        onMouseEnter={(e) => {
          if (!isConnecting) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 255, 255, 0.08)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <Wallet className="h-4 w-4 mr-2" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  const handleChangeWallet = async () => {
    try {
      // Disconnect current wallet first
      disconnect()
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Request account selection - this will show the account picker
      // if multiple accounts are available in MetaMask
      await requestAccountSelection()
    } catch (err: any) {
      // User cancelled or error - that's okay
      if (err?.code !== 4001) { // 4001 is user rejection, don't log that
        console.log('[Wallet] Change wallet error:', err)
      }
    }
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
        <DropdownMenuItem 
          onClick={handleChangeWallet} 
          className="font-body text-white hover:bg-white/10 cursor-pointer"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Change Wallet
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#C2A633]/20" />
        <DropdownMenuItem onClick={disconnect} className="font-body text-red-400 hover:bg-red-500/10 cursor-pointer">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
