"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { X, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"

export function NoteAccountSetup() {
  const [isOpen, setIsOpen] = useState(false)
  const [noteAccountKey, setNoteAccountKey] = useState<string | null>(null)
  const [createBackup, setCreateBackup] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [walletRejected, setWalletRejected] = useState(false)
  const { wallet } = useWallet()
  const { toast } = useToast()

  const generateNoteAccountKey = () => {
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  const handleSetupAccount = async () => {
    if (!wallet?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    setIsSettingUp(true)
    setWalletRejected(false)

    try {
      // Simulate wallet signature request
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // For demo purposes, randomly accept or reject
          if (Math.random() > 0.5) {
            resolve(true)
          } else {
            reject(new Error("User rejected request"))
          }
        }, 1000)
      })

      const key = generateNoteAccountKey()
      setNoteAccountKey(key)

      if (createBackup) {
        // Create backup on-chain (simulated)
        toast({
          title: "Note Account Created",
          description: "Your note account has been created with on-chain backup.",
        })
      } else {
        toast({
          title: "Note Account Created",
          description: "Your note account key has been generated.",
        })
      }
    } catch (error) {
      setWalletRejected(true)
      console.error("[v0] Wallet signature rejected:", error)
    } finally {
      setIsSettingUp(false)
    }
  }

  const copyKey = () => {
    if (noteAccountKey) {
      navigator.clipboard.writeText(noteAccountKey)
      toast({
        title: "Key Copied",
        description: "Note account key has been copied to clipboard.",
      })
    }
  }

  const downloadKey = () => {
    if (noteAccountKey) {
      const blob = new Blob([noteAccountKey], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "dogemixer-note-account-key.txt"
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: "Key Downloaded",
        description: "Note account key has been saved to your downloads.",
      })
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10 font-mono bg-transparent"
      >
        Setup Note Account
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-950 border-[#C2A633]/30 text-white max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="font-mono text-xl">Account setup</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <p className="font-mono text-sm text-gray-300 leading-relaxed">
              This key is used to encrypt and store your DogeMixer private notes on Dogecoin blockchain. Please back it
              up and never share it with anyone.
            </p>

            {noteAccountKey && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-sm text-gray-400">Note Account key</Label>
                    <Button
                      onClick={copyKey}
                      variant="ghost"
                      size="sm"
                      className="text-[#C2A633] hover:text-[#C2A633]/80 hover:bg-[#C2A633]/10 font-mono text-xs h-7"
                    >
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 bg-black/60 border border-[#C2A633]/20 font-mono text-xs text-[#C2A633] break-all leading-relaxed">
                    {noteAccountKey}
                  </div>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-[#C2A633]/20 space-y-2">
                  <p className="font-mono text-xs text-gray-400 leading-relaxed text-center">
                    Please keep in mind, additional on-chain backup of your Note Account is not supported with hardware
                    wallets or mobile wallets
                  </p>
                </div>

                <Button
                  onClick={downloadKey}
                  className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold h-12"
                >
                  Download Key
                </Button>
              </>
            )}

            {!noteAccountKey && (
              <>
                <div className="flex items-start gap-3 p-4 bg-zinc-900/50 border border-[#C2A633]/20">
                  <Checkbox
                    id="backup"
                    checked={createBackup}
                    onCheckedChange={(checked) => setCreateBackup(checked as boolean)}
                    className="mt-1 border-[#C2A633] data-[state=checked]:bg-[#C2A633] data-[state=checked]:text-black"
                  />
                  <label htmlFor="backup" className="font-mono text-xs text-gray-300 leading-relaxed cursor-pointer">
                    Create additional on-chain backup of your Note Account key with your wallet
                  </label>
                </div>

                {walletRejected && (
                  <div className="p-4 bg-red-950/30 border border-red-900/50 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <p className="font-mono text-sm text-red-300">You rejected wallet request</p>
                  </div>
                )}

                <Button
                  onClick={handleSetupAccount}
                  disabled={isSettingUp}
                  className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold h-12"
                >
                  {isSettingUp ? "Setting up..." : "Setup account"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
