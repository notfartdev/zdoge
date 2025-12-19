"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { DogeWalletService } from "./doge-wallet"
import type { DogeWalletConnection } from "./types"

interface WalletContextType {
  wallet: DogeWalletConnection | null
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<DogeWalletConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const walletService = DogeWalletService.getInstance()

  const connect = async () => {
    setIsConnecting(true)
    try {
      const connection = await walletService.connectWallet()
      if (connection) {
        setWallet({
          address: connection.address,
          balance: connection.balance,
          isConnected: true,
        })
        localStorage.setItem("wallet_connected", "true")
      }
    } catch (error) {
      console.error("[v0] Wallet connection failed:", error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    walletService.disconnectWallet()
    setWallet(null)
    localStorage.removeItem("wallet_connected")
  }

  const refreshBalance = async () => {
    if (wallet?.address) {
      const balance = await walletService.getBalance(wallet.address)
      setWallet({ ...wallet, balance })
    }
  }

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem("wallet_connected")
    if (wasConnected === "true" && walletService.isWalletInstalled()) {
      connect().catch(console.error)
    }
  }, [])

  return (
    <WalletContext.Provider value={{ wallet, isConnecting, connect, disconnect, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
