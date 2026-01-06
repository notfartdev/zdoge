"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Copy, 
  Check, 
  QrCode, 
  Shield,
  Download,
  Wallet
} from "lucide-react"
import { WalletIcon } from "@/components/wallet-icon"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import {
  initializeShieldedWallet,
  getWalletState,
  getIdentity,
} from "@/lib/shielded/shielded-service"
import { shieldedPool } from "@/lib/dogeos-config"
import QRCode from "qrcode"

export default function ReceivePage() {
  const { toast } = useToast()
  const { wallet, signMessage } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [publicQrCode, setPublicQrCode] = useState<string>("")
  const [shieldedQrCode, setShieldedQrCode] = useState<string>("")
  const [copiedPublic, setCopiedPublic] = useState(false)
  const [copiedShielded, setCopiedShielded] = useState(false)
  const [shieldedAddress, setShieldedAddress] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize shielded wallet and get address
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setShieldedAddress(null)
      return
    }

    async function init() {
      try {
        const identity = await initializeShieldedWallet(
          wallet.address!,
          signMessage ? async (msg: string) => signMessage(msg) : undefined,
          shieldedPool.address
        )
        
        if (identity) {
          setShieldedAddress(identity.addressString)
        }
      } catch (error) {
        console.error("Failed to initialize shielded wallet:", error)
      }
    }

    init()
  }, [mounted, wallet?.isConnected, wallet?.address])

  // Generate QR codes
  useEffect(() => {
    if (!wallet?.address) {
      setPublicQrCode("")
      return
    }

    QRCode.toDataURL(wallet.address, {
      width: 256,
      margin: 2,
    }).then(setPublicQrCode).catch(console.error)
  }, [wallet?.address])

  useEffect(() => {
    if (!shieldedAddress) {
      setShieldedQrCode("")
      return
    }

    QRCode.toDataURL(shieldedAddress, {
      width: 256,
      margin: 2,
    }).then(setShieldedQrCode).catch(console.error)
  }, [shieldedAddress])

  const copyPublicAddress = async () => {
    if (!wallet?.address) return
    await navigator.clipboard.writeText(wallet.address)
    setCopiedPublic(true)
    setTimeout(() => setCopiedPublic(false), 2000)
    toast({ title: "Public address copied!" })
  }

  const copyShieldedAddress = async () => {
    if (!shieldedAddress) return
    await navigator.clipboard.writeText(shieldedAddress)
    setCopiedShielded(true)
    setTimeout(() => setCopiedShielded(false), 2000)
    toast({ title: "Shielded address copied!" })
  }

  const downloadPublicQR = () => {
    if (!publicQrCode) return
    const link = document.createElement("a")
    link.download = `public-address-qr-${Date.now()}.png`
    link.href = publicQrCode
    link.click()
  }

  const downloadShieldedQR = () => {
    if (!shieldedQrCode) return
    const link = document.createElement("a")
    link.download = `shielded-address-qr-${Date.now()}.png`
    link.href = shieldedQrCode
    link.click()
  }

  if (!mounted) return null

  if (!wallet?.isConnected || !wallet?.address) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
          <Card className="p-12 text-center">
            <WalletIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Connect Your Wallet</h2>
            <p className="font-body text-muted-foreground">
              Connect your wallet to view your receive addresses
            </p>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-2 flex items-center gap-2 sm:gap-3">
            <img 
              src="https://z.cash/wp-content/uploads/2023/04/secret.gif" 
              alt="Receive" 
              className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12"
            />
            Receive Addresses
          </h1>
          <p className="mt-2 font-body text-sm sm:text-base text-white/70 leading-relaxed tracking-[-0.01em]">
            Share your addresses to receive payments. Use the shielded address for private transactions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Public Address */}
          <Card className="p-6 flex flex-col h-full">
            <div className="flex items-start gap-2 mb-4 min-h-[72px]">
              <div className="p-2 rounded-full bg-muted flex-shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-display font-semibold mb-1">Public Address</h2>
                <p className="text-sm font-body text-white/70">Receive public DOGE & tokens</p>
              </div>
            </div>

            <div className="space-y-4 flex-1 flex flex-col">
              {/* QR Code */}
              {publicQrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={publicQrCode} alt="Public Address QR" className="w-48 h-48" />
                </div>
              )}

              {/* Address */}
              <div className="p-3 rounded-lg bg-muted/30 border">
                <code className="text-sm font-mono break-all block">
                  {wallet.address}
                </code>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={copyPublicAddress}
                >
                  {copiedPublic ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={downloadPublicQR}
                  disabled={!publicQrCode}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

            </div>
          </Card>

          {/* Shielded Address */}
          <Card className="p-6 flex flex-col h-full">
            <div className="flex items-start gap-2 mb-4 min-h-[72px]">
              <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-display font-semibold mb-1">
                  Shielded Address
                </h2>
                <p className="text-sm font-body text-white/70">
                  Receive private shielded tokens • This address never changes
                </p>
              </div>
            </div>

            {!shieldedAddress ? (
              <div className="text-center py-8">
                <p className="text-sm font-body text-white/70">
                  Initializing shielded wallet...
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* QR Code */}
                {shieldedQrCode && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <img src={shieldedQrCode} alt="Shielded Address QR" className="w-48 h-48" />
                  </div>
                )}

                {/* Address */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <code className="text-sm font-mono break-all block">
                    {shieldedAddress}
                  </code>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={copyShieldedAddress}
                  >
                    {copiedShielded ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={downloadShieldedQR}
                    disabled={!shieldedQrCode}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

              </div>
            )}
          </Card>
        </div>

      </main>
    </div>
  )
}

