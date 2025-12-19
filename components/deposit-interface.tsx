"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useWallet } from "@/lib/wallet-context"
import { Copy, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const DEPOSIT_AMOUNTS = [0.1, 1, 10, 100]

export function DepositInterface() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [selectedAmount, setSelectedAmount] = useState(10)
  const [isDepositing, setIsDepositing] = useState(false)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [signaturePayload, setSignaturePayload] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleDeposit = async () => {
    if (!wallet?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    setIsDepositing(true)
    try {
      const response = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedAmount,
          address: wallet.address,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const paymentId = data.depositId
        const link = `${window.location.origin}/payment-request?id=${paymentId}`
        const payload = `dogemix:pay:${paymentId}`

        setPaymentLink(link)
        setSignaturePayload(payload)

        toast({
          title: "Payment Link Generated",
          description: `Your ${selectedAmount} DOGE payment request is ready.`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("[v0] Deposit failed:", error)
      toast({
        title: "Deposit Failed",
        description: "Failed to create payment request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDepositing(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: `${label} Copied`,
      description: `${label} has been copied to clipboard.`,
    })
  }

  if (paymentLink) {
    return (
      <Card className="glass-card glass-card-hover p-8 rounded-none border-[#C2A633]/15">
        <div className="space-y-6">
          <h2 className="font-mono text-2xl font-bold text-white">Payment Link Ready</h2>
          <p className="font-mono text-sm text-gray-400 leading-relaxed">
            Share this link with the payer. They will be asked to sign and unlock the payment details.
          </p>

          <div className="space-y-3">
            <Label className="font-mono text-sm text-gray-400">Shareable URL</Label>
            <div className="flex gap-3">
              <input
                value={paymentLink}
                readOnly
                className="flex-1 p-4 font-mono text-sm bg-black/50 border border-[#C2A633]/20 text-white backdrop-blur-sm transition-all duration-200 hover:border-[#C2A633]/40 focus:border-[#C2A633]/60 focus:outline-none"
              />
              <Button
                onClick={() => copyToClipboard(paymentLink, "Link")}
                className="bg-transparent border border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10 font-mono transition-all duration-300 px-6"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy Link
              </Button>
            </div>
          </div>

          <div className="p-5 bg-[#1a3a3a]/30 backdrop-blur-sm border border-[#C2A633]/30 space-y-3 transition-all duration-300 hover:border-[#C2A633]/50">
            <p className="font-mono text-sm text-gray-300 leading-relaxed">
              When the payer opens the link they will be asked to sign the following message with their wallet:
            </p>
            <div className="p-4 bg-black/40 backdrop-blur-sm border border-[#C2A633]/20 font-mono text-sm text-[#C2A633] break-all">
              {signaturePayload}
            </div>
            <p className="font-mono text-xs text-gray-400 leading-relaxed">
              After signing, DogeMixer will provide them the stealth address, QR code, and a secure token to view this
              link.
            </p>
          </div>

          <Button
            onClick={() => {
              setPaymentLink(null)
              setSignaturePayload(null)
            }}
            className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold py-6 transition-all duration-300 hover:scale-[1.02]"
          >
            Generate Another Link
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-black border-[#C2A633]/20 p-0 rounded-none overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Token</Label>
          <Select value="DOGE" disabled>
            <SelectTrigger className="h-12 bg-zinc-950 border-[#C2A633]/20 text-white font-mono text-sm hover:border-[#C2A633]/40 transition-colors">
              <SelectValue placeholder="DOGE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DOGE">DOGE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Amount</Label>
            <div className="w-4 h-4 rounded-full bg-[#C2A633] flex items-center justify-center">
              <span className="text-black text-[10px] font-bold">D</span>
            </div>
          </div>

          <div className="py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-bold text-white leading-none">{selectedAmount}</span>
              <span className="font-mono text-xl text-gray-500">DOGE</span>
            </div>
          </div>

          <div className="pt-2 pb-4">
            <input
              type="range"
              min={0}
              max={3}
              value={DEPOSIT_AMOUNTS.indexOf(selectedAmount)}
              onChange={(e) => setSelectedAmount(DEPOSIT_AMOUNTS[Number.parseInt(e.target.value)])}
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer 
                [&::-webkit-slider-thumb]:appearance-none 
                [&::-webkit-slider-thumb]:w-4 
                [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:rounded-full 
                [&::-webkit-slider-thumb]:bg-[#C2A633] 
                [&::-webkit-slider-thumb]:cursor-pointer 
                [&::-webkit-slider-thumb]:transition-transform 
                [&::-webkit-slider-thumb]:duration-200 
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:w-4 
                [&::-moz-range-thumb]:h-4 
                [&::-moz-range-thumb]:rounded-full 
                [&::-moz-range-thumb]:bg-[#C2A633] 
                [&::-moz-range-thumb]:border-0 
                [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between mt-3">
              {DEPOSIT_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSelectedAmount(amount)}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${selectedAmount === amount ? "bg-[#C2A633] scale-125" : "bg-gray-700 group-hover:bg-gray-600"}`}
                  />
                  <span
                    className={`font-mono text-[10px] transition-colors duration-200 ${selectedAmount === amount ? "text-[#C2A633] font-bold" : "text-gray-600 group-hover:text-gray-500"}`}
                  >
                    {amount} DOGE
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={handleDeposit}
          disabled={isDepositing || !wallet?.isConnected}
          className="w-full h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDepositing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : !wallet?.isConnected ? (
            "Connect Wallet First"
          ) : (
            "Deposit"
          )}
        </Button>
      </div>
    </Card>
  )
}
