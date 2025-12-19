"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWallet } from "@/lib/wallet-context"
import { WalletConnectButton } from "./wallet-connect-button"
import { Wallet, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function WalletSettings() {
  const { wallet, refreshBalance } = useWallet()
  const { toast } = useToast()
  const [rpcUrl, setRpcUrl] = useState("https://dogechain.info/api/v1")
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateRPC = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch("/api/settings/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rpcUrl }),
      })

      if (response.ok) {
        toast({
          title: "RPC Updated",
          description: "Dogecoin RPC provider has been updated successfully.",
        })
      }
    } catch (error) {
      console.error("[v0] Failed to update RPC:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update RPC provider.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="bg-zinc-900 border-[#C2A633]/20 rounded-none">
      <CardHeader>
        <CardTitle className="font-mono text-2xl text-white">Wallet</CardTitle>
        <CardDescription className="font-mono text-gray-400">
          Manage your connected wallet and network settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="font-mono text-sm text-gray-400">Connected Web3 wallet</Label>
          {wallet?.isConnected ? (
            <div className="p-4 bg-black border border-[#C2A633]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-[#C2A633]" />
                <div>
                  <p className="font-mono text-sm text-white">{wallet.address}</p>
                  <p className="font-mono text-xs text-gray-500">{wallet.balance.toFixed(2)} DOGE</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={refreshBalance}
                className="text-[#C2A633] hover:bg-[#C2A633]/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-black border border-[#C2A633]/20 flex flex-col items-center gap-4">
              <p className="font-mono text-sm text-gray-400">No wallet connected</p>
              <WalletConnectButton />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Label className="font-mono text-sm text-gray-400">Change your Dogecoin RPC Provider</Label>
          <div className="flex gap-3">
            <Input
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://dogechain.info/api/v1"
              className="font-mono text-sm bg-black border-[#C2A633]/20 text-white"
            />
            <Button
              onClick={handleUpdateRPC}
              disabled={isUpdating}
              className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold whitespace-nowrap"
            >
              Change RPC
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
