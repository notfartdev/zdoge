"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { evmWalletService, type EVMWalletConnection } from "./evm-wallet"
import { dogeosTestnet } from "./dogeos-config"

interface WalletContextType {
  wallet: EVMWalletConnection | null
  isConnecting: boolean
  isWrongNetwork: boolean
  connect: () => Promise<void>
  requestAccountSelection: () => Promise<void>
  disconnect: () => void
  refreshBalance: () => Promise<void>
  switchNetwork: () => Promise<void>
  signMessage: ((message: string) => Promise<string>) | null
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<EVMWalletConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isWrongNetwork, setIsWrongNetwork] = useState(false)
  const pathname = usePathname()

  const connect = async () => {
    setIsConnecting(true)
    try {
      const connection = await evmWalletService.connect()
      if (connection) {
        setWallet(connection)
        setIsWrongNetwork(connection.chainId !== dogeosTestnet.id)
        localStorage.setItem("wallet_connected", "true")
      }
    } catch (error) {
      console.error("[Wallet] Connection failed:", error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const requestAccountSelection = async () => {
    setIsConnecting(true)
    try {
      const connection = await evmWalletService.requestAccountSelection()
      if (connection) {
        setWallet(connection)
        setIsWrongNetwork(connection.chainId !== dogeosTestnet.id)
        localStorage.setItem("wallet_connected", "true")
      }
    } catch (error) {
      console.error("[Wallet] Account selection failed:", error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    evmWalletService.disconnect()
    setWallet(null)
    setIsWrongNetwork(false)
    localStorage.removeItem("wallet_connected")
  }

  const refreshBalance = async () => {
    if (wallet?.address) {
      const balance = await evmWalletService.getBalance(wallet.address)
      setWallet({ ...wallet, balance })
    }
  }

  const switchNetwork = async () => {
    try {
      await evmWalletService.switchToDogeOS()
      setIsWrongNetwork(false)
      // Refresh connection after switch
      const connection = evmWalletService.getConnection()
      if (connection) {
        setWallet(connection)
      }
    } catch (error) {
      console.error("[Wallet] Network switch failed:", error)
      throw error
    }
  }

  // Subscribe to wallet changes
  useEffect(() => {
    const unsubscribe = evmWalletService.subscribe((connection) => {
      setWallet(connection)
      if (connection) {
        setIsWrongNetwork(connection.chainId !== dogeosTestnet.id)
      }
    })

    return unsubscribe
  }, [])

  // Auto-connect only on dashboard pages if previously connected
  useEffect(() => {
    // Only auto-connect on /dashboard pages, not on landing page
    const isDashboardPage = pathname?.startsWith('/dashboard')
    const wasConnected = localStorage.getItem("wallet_connected")
    
    if (isDashboardPage && wasConnected === "true" && evmWalletService.isWalletInstalled()) {
      connect().catch(console.error)
    }
  }, [pathname])

  // Create signMessage function that uses evmWalletService
  const signMessage = useCallback(
    wallet?.isConnected 
      ? async (message: string) => {
          try {
            return await evmWalletService.signMessage(message)
          } catch (error) {
            console.error("[Wallet] Sign message failed:", error)
            throw error
          }
        }
      : null,
    [wallet?.isConnected]
  )

  return (
    <WalletContext.Provider value={{ 
      wallet, 
      isConnecting, 
      isWrongNetwork,
      connect,
      requestAccountSelection, 
      disconnect, 
      refreshBalance,
      switchNetwork,
      signMessage
    }}>
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
