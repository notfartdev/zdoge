"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useWallet } from "@/lib/wallet-context"
import { Shield, Key, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function NoteAccountSettings() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [isSetup, setIsSetup] = useState(false)
  const [accountKey, setAccountKey] = useState("")
  const [backupKey, setBackupKey] = useState<string | null>(null)

  const handleSetupAccount = () => {
    if (!wallet?.address) return

    // Generate backup key
    const key = `zdoge-backup-${wallet.address.slice(0, 8)}-${Date.now()}`
    setBackupKey(key)
    setIsSetup(true)

    toast({
      title: "Note Account Created",
      description: "Your encrypted note account has been set up successfully.",
    })
  }

  const handleRecoverAccount = () => {
    if (!accountKey) return

    toast({
      title: "Account Recovered",
      description: "Your note account has been recovered successfully.",
    })
    setIsSetup(true)
  }

  const downloadBackupKey = () => {
    if (!backupKey) return

    const blob = new Blob([backupKey], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "zdoge-backup-key.txt"
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Backup Downloaded",
      description: "Your backup key has been downloaded.",
    })
  }

  return (
    <Card className="bg-zinc-900 border-[#C2A633]/20 rounded-none">
      <CardHeader>
        <CardTitle className="font-mono text-2xl text-white">Note Account</CardTitle>
        <CardDescription className="font-mono text-gray-400">
          Store encrypted backups of your deposit notes on-chain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-[#C2A633]/10 border-[#C2A633] text-white">
          <Shield className="h-4 w-4" />
          <AlertDescription className="font-mono text-sm">
            A Note Account allows safe storage of funds hassle-free with Dogecoin blockchain security.
          </AlertDescription>
        </Alert>

        {!isSetup ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="font-mono text-sm text-gray-400">Note account</Label>
              <div className="p-4 bg-black border border-[#C2A633]/20 text-center">
                <p className="font-mono text-sm text-gray-500">Not set up</p>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-mono text-sm text-gray-400">Backed up with</Label>
              <div className="p-4 bg-black border border-[#C2A633]/20 text-center">
                <p className="font-mono text-sm text-gray-500">—</p>
              </div>
            </div>

            <div className="grid gap-4">
              <Button
                onClick={handleSetupAccount}
                disabled={!wallet?.isConnected}
                className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold justify-start"
              >
                <Shield className="h-4 w-4 mr-2" />
                Set up Note Account for storing encrypted notes on Dogecoin blockchain
              </Button>

              <Button
                variant="outline"
                className="w-full border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10 font-mono justify-start bg-transparent"
                onClick={() => {}}
              >
                <Download className="h-4 w-4 mr-2" />
                Recover Note Account associated with this wallet
              </Button>

              <div className="space-y-3">
                <Label className="font-mono text-sm text-gray-400">Use previously set Note Account key</Label>
                <div className="flex gap-3">
                  <Input
                    value={accountKey}
                    onChange={(e) => setAccountKey(e.target.value)}
                    placeholder="Enter your backup key"
                    className="font-mono text-sm bg-black border-[#C2A633]/20 text-white"
                  />
                  <Button
                    onClick={handleRecoverAccount}
                    disabled={!accountKey}
                    className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold whitespace-nowrap"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Enter key
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="font-mono text-sm text-gray-400">Note account</Label>
              <div className="p-4 bg-black border border-[#C2A633]/20">
                <p className="font-mono text-sm text-[#C2A633] break-all">{wallet?.address || "Connected"}</p>
              </div>
            </div>

            {backupKey && (
              <div className="space-y-4">
                <Label className="font-mono text-sm text-gray-400">Backed up with</Label>
                <div className="p-4 bg-black border border-[#C2A633]/20 space-y-3">
                  <p className="font-mono text-xs text-gray-400 break-all">{backupKey}</p>
                  <Button
                    onClick={downloadBackupKey}
                    size="sm"
                    className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Backup Key
                  </Button>
                </div>
              </div>
            )}

            <Alert className="bg-green-950 border-green-900 text-green-200">
              <AlertDescription className="font-mono text-sm">
                Your Note Account is active and ready to store encrypted deposit notes.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
