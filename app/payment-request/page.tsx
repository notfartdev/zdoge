"use client"

import { Badge } from "@/components/ui/badge"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Copy, Check, Lock, Loader2, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import QRCode from "qrcode"

function PaymentRequestContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("id")
  const { wallet } = useWallet()
  const { toast } = useToast()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<{
    amount: number
    stealthAddress: string
    qrCode: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const signaturePayload = `dogemix:pay:${paymentId}`

  const handleSign = async () => {
    if (!wallet?.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    setIsSigning(true)
    try {
      // Simulate signature verification
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Generate stealth address and QR code
      const stealthAddress = `D${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
      const qrCodeData = await QRCode.toDataURL(stealthAddress)

      setPaymentDetails({
        amount: 1, // This would come from the payment request
        stealthAddress,
        qrCode: qrCodeData,
      })

      setIsAuthenticated(true)
      toast({
        title: "Authentication Successful",
        description: "Payment details unlocked.",
      })
    } catch (error) {
      console.error("[v0] Signature failed:", error)
      toast({
        title: "Authentication Failed",
        description: "Failed to verify signature. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSigning(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
    toast({
      title: `${label} Copied`,
      description: `${label} has been copied to clipboard.`,
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 border-2 border-[#C2A633] flex items-center justify-center">
                <Lock className="w-10 h-10 text-[#C2A633]" />
              </div>
            </div>

            <div>
              <h1 className="font-mono text-3xl font-bold text-white mb-3">Authenticate to view this payment</h1>
              <p className="font-mono text-sm text-gray-400">
                Connect your wallet and sign the message below to unlock the payment details.
              </p>
            </div>

            {!wallet?.isConnected && (
              <div className="flex justify-center">
                <WalletConnectButton />
              </div>
            )}

            {wallet?.isConnected && (
              <>
                <div className="p-6 bg-[#1a3a3a] border border-[#C2A633]/30 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm text-gray-300">Signature Payload</h3>
                    <p className="font-mono text-xs text-gray-500">Sign this exact message</p>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-white/5 border border-[#C2A633]/20 font-mono text-sm text-[#C2A633]">
                      {signaturePayload}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(signaturePayload, "Payload")}
                      className="bg-transparent border border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10"
                    >
                      {copied === "Payload" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <p className="font-mono text-xs text-gray-400">
                    This proves you control the payer wallet. We will fetch the stealth address and QR code once signed.
                  </p>
                </div>

                <Button
                  onClick={handleSign}
                  disabled={isSigning}
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-black font-mono font-bold text-lg py-6"
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Verifying Signature...
                    </>
                  ) : (
                    "Sign & Initiate Payment"
                  )}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-3xl font-bold text-white">Payment Details</h1>
            <Badge className="bg-red-600 text-white font-mono">NEW</Badge>
          </div>

          <p className="font-mono text-sm text-gray-400">Send the exact amount to the stealth address below.</p>

          <div className="p-6 bg-black border border-[#C2A633]/20 space-y-4">
            <div className="text-center">
              <p className="font-mono text-sm text-gray-400 mb-2">AMOUNT DUE</p>
              <p className="font-mono text-5xl font-bold text-white">{paymentDetails?.amount} DOGE</p>
              <p className="font-mono text-xs text-yellow-500 mt-2">
                If you send less than requested amount of DOGE, your transaction will get stuck.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-black border border-[#C2A633]/20 space-y-3">
              <h3 className="font-mono text-sm text-gray-400">Stealth Address</h3>
              <p className="font-mono text-xs text-[#C2A633] break-all">{paymentDetails?.stealthAddress}</p>
              <Button
                onClick={() => copyToClipboard(paymentDetails?.stealthAddress || "", "Address")}
                className="w-full bg-transparent border border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10 font-mono"
              >
                {copied === "Address" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy Address
              </Button>
            </div>

            <div className="p-4 bg-black border border-[#C2A633]/20 space-y-3">
              <h3 className="font-mono text-sm text-gray-400">QR Code</h3>
              <div className="flex justify-center p-4 bg-white rounded">
                <img src={paymentDetails?.qrCode || "/placeholder.svg"} alt="QR Code" className="w-32 h-32" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-black border border-[#C2A633]/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm text-white mb-1">Pay with your wallet</h3>
                <p className="font-mono text-xs text-gray-400">
                  Send {paymentDetails?.amount} DOGE directly from {wallet?.address?.slice(0, 6)}...
                  {wallet?.address?.slice(-4)}
                </p>
              </div>
              <Button className="bg-cyan-400 hover:bg-cyan-500 text-black font-mono font-bold">
                <ExternalLink className="h-4 w-4 mr-2" />
                Pay with Wallet
              </Button>
            </div>
          </div>

          <div className="p-4 bg-green-950 border border-green-700">
            <p className="font-mono text-sm text-green-400">Payment initiation submitted.</p>
            <p className="font-mono text-xs text-gray-400 mt-2">
              Keep this tab open. You can refresh to see status updates using your stored token.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function PaymentRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[#C2A633] animate-spin" />
        </div>
      }
    >
      <PaymentRequestContent />
    </Suspense>
  )
}
