"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Copy, 
  Check, 
  Shield,
  Download,
  Wallet
} from "lucide-react"
import { WalletIcon } from "@/components/wallet-icon"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import {
  initializeShieldedWallet,
  getWalletState,
  getIdentity,
} from "@/lib/shielded/shielded-service"
import { shieldedPool } from "@/lib/dogeos-config"
import QRCode from "qrcode"

export function ReceiveInterface() {
  const { toast } = useToast()
  const { wallet, signMessage } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [publicQrCode, setPublicQrCode] = useState<string>("")
  const [shieldedQrCode, setShieldedQrCode] = useState<string>("")
  const [copiedPublic, setCopiedPublic] = useState(false)
  const [copiedShielded, setCopiedShielded] = useState(false)
  const [shieldedAddress, setShieldedAddress] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize shielded wallet and get address
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setShieldedAddress(null)
      setIsInitializing(false)
      return
    }

    async function init() {
      setIsInitializing(true)
      try {
        // Check if already initialized
        const existingState = getWalletState()
        if (existingState?.shieldedAddress) {
          setShieldedAddress(existingState.shieldedAddress)
          setIsInitializing(false)
          return
        }

        // Initialize if not already done
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
        toast({
          title: "Initialization Error",
          description: "Failed to initialize shielded wallet. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsInitializing(false)
      }
    }

    init()
  }, [mounted, wallet?.isConnected, wallet?.address, signMessage, toast])

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
      <Card className="p-6 mb-6 bg-muted/30 border border-muted">
        <div className="text-center py-8">
          <WalletIcon className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-display font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm font-body text-muted-foreground mb-6">
            Connect your wallet to view your receive addresses
          </p>
          <WalletConnectButton />
        </div>
      </Card>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Public Address */}
      <Card className="p-6 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-6 h-[72px]">
          <div className="p-2 rounded-full bg-muted flex-shrink-0">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-display font-semibold mb-1">Public Address</h2>
            <p className="text-sm font-body text-white/70">Receive public DOGE & tokens</p>
          </div>
        </div>

        <div className="space-y-4 flex-1 flex flex-col">
          {/* QR Code - Fixed size */}
          <div className="flex justify-center">
            {publicQrCode ? (
              <div className="p-4 bg-white rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                <img src={publicQrCode} alt="Public Address QR" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="p-4 bg-white rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                <div className="w-full h-full bg-gray-100 rounded" />
              </div>
            )}
          </div>

          {/* Address - Fixed height */}
          <div className="p-3 rounded-lg bg-muted/30 border min-h-[60px] flex items-center">
            <code className="text-xs sm:text-sm font-mono break-all block text-left w-full">
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
        <div className="flex items-start gap-3 mb-6 h-[72px]">
          <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-display font-semibold mb-1">
              Shielded Address
            </h2>
            <p className="text-sm font-body text-white/70">
              Receive private shielded tokens • This address never changes
            </p>
          </div>
        </div>

        <div className="space-y-4 flex-1 flex flex-col">
          {/* QR Code - Fixed size, matches public */}
          <div className="flex justify-center">
            {shieldedQrCode ? (
              <div className="p-4 bg-white rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                <img src={shieldedQrCode} alt="Shielded Address QR" className="w-full h-full object-contain" />
              </div>
            ) : isInitializing ? (
              <div className="p-4 bg-white rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                <p className="text-sm font-body text-gray-500">Initializing...</p>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                <div className="w-full h-full bg-gray-100 rounded" />
              </div>
            )}
          </div>

          {/* Address - Fixed height, matches public */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 min-h-[60px] flex items-center">
            {isInitializing ? (
              <p className="text-sm font-body text-white/70 w-full text-center">
                Initializing shielded wallet...
              </p>
            ) : !shieldedAddress ? (
              <div className="w-full text-center space-y-2">
                <p className="text-sm font-body text-white/70">
                  Failed to initialize
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShieldedAddress(null)
                    setIsInitializing(true)
                    // Retry initialization
                    if (wallet?.address && signMessage) {
                      initializeShieldedWallet(
                        wallet.address,
                        async (msg: string) => signMessage(msg),
                        shieldedPool.address
                      ).then(identity => {
                        if (identity) {
                          setShieldedAddress(identity.addressString)
                        }
                        setIsInitializing(false)
                      }).catch(err => {
                        console.error("Retry failed:", err)
                        setIsInitializing(false)
                      })
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <code className="text-xs sm:text-sm font-mono break-all block text-left w-full">
                {shieldedAddress}
              </code>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={copyShieldedAddress}
              disabled={!shieldedAddress}
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
      </Card>
    </div>
  )
}

