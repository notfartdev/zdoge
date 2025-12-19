"use client"

// MyDogeWallet integration
export class DogeWalletService {
  private static instance: DogeWalletService

  static getInstance(): DogeWalletService {
    if (!DogeWalletService.instance) {
      DogeWalletService.instance = new DogeWalletService()
    }
    return DogeWalletService.instance
  }

  async connectWallet(): Promise<{ address: string; balance: number } | null> {
    try {
      // @ts-ignore - MyDogeWallet injected by extension
      if (typeof window.mydoge === "undefined") {
        throw new Error("MyDogeWallet not installed")
      }

      // @ts-ignore
      const accounts = await window.mydoge.request({
        method: "doge_requestAccounts",
      })

      if (accounts && accounts.length > 0) {
        const address = accounts[0]
        // @ts-ignore
        const balance = await window.mydoge.request({
          method: "doge_getBalance",
          params: [address],
        })

        return {
          address,
          balance: Number.parseFloat(balance) || 0,
        }
      }

      return null
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      throw error
    }
  }

  async disconnectWallet(): Promise<void> {
    // MyDogeWallet doesn't require explicit disconnect
    console.log("[v0] Wallet disconnected")
  }

  async getBalance(address: string): Promise<number> {
    try {
      // @ts-ignore
      const balance = await window.mydoge.request({
        method: "doge_getBalance",
        params: [address],
      })
      return Number.parseFloat(balance) || 0
    } catch (error) {
      console.error("Failed to get balance:", error)
      return 0
    }
  }

  async sendTransaction(to: string, amount: number): Promise<string> {
    try {
      // @ts-ignore
      const txHash = await window.mydoge.request({
        method: "doge_sendTransaction",
        params: [{ to, value: amount.toString() }],
      })
      return txHash
    } catch (error) {
      console.error("Transaction failed:", error)
      throw error
    }
  }

  isWalletInstalled(): boolean {
    // @ts-ignore
    return typeof window !== "undefined" && typeof window.mydoge !== "undefined"
  }
}
