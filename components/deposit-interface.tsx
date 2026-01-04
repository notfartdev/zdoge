"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useWallet } from "@/lib/wallet-context"
import { Copy, Check, Loader2, AlertCircle, Download, ExternalLink, DollarSign, ChevronDown, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateNote, serializeNote, getCommitmentBytes, type Note } from "@/lib/note-service"
import { tokens, links, dogeosTestnet, tokenPools, SUPPORTED_TOKENS, type SupportedToken } from "@/lib/dogeos-config"
import { toBytes32 } from "@/lib/mimc"
import { contractService } from "@/lib/contract-service"
import { useToken, formatRealUSD } from "@/lib/token-context"

export function DepositInterface() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const { selectedToken, setSelectedToken, prices } = useToken()
  
  // Amount selection - initialize with first amount of default token
  const [selectedAmount, setSelectedAmount] = useState<string>(() => tokenPools["USDC"].amounts[0].toString())
  
  const [txStatus, setTxStatus] = useState<"idle" | "generating" | "approving" | "depositing" | "success" | "error">("idle")
  const [secretNote, setSecretNote] = useState<string>("")
  const [noteData, setNoteData] = useState<Note | null>(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [txHash, setTxHash] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n)
  const [leafIndex, setLeafIndex] = useState<number>(0)
  const [isNoteRevealed, setIsNoteRevealed] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const [hasBeenRevealed, setHasBeenRevealed] = useState(false)

  // Get current token config
  const tokenConfig = tokenPools[selectedToken]
  const currentToken = tokenConfig.token
  const availableAmounts = tokenConfig.amounts
  
  // Use first available amount if selectedAmount is not set
  const effectiveAmount = selectedAmount || availableAmounts[0].toString()
  const poolAddress = tokenConfig.pools[effectiveAmount]
  const amountNum = parseFloat(effectiveAmount) || 0
  const denomination = amountNum > 0 
    ? BigInt(Math.floor(amountNum * (10 ** currentToken.decimals)))
    : 0n

  // Reset amount when token changes
  useEffect(() => {
    const amounts = tokenPools[selectedToken].amounts
    setSelectedAmount(amounts[0].toString())
  }, [selectedToken])

  // Check if this token uses native deposits (native DOGE)
  const isNative = tokenConfig.isNative === true

  // Fetch token balance when wallet or token changes
  useEffect(() => {
    async function fetchBalance() {
      if (wallet?.isConnected && wallet.address && currentToken) {
        try {
          let balance: bigint
          if (isNative) {
            // For native DOGE, get the native balance
            balance = await contractService.getNativeBalance(wallet.address)
          } else {
            balance = await contractService.getTokenBalance(
              currentToken.address,
              wallet.address
            )
          }
          setTokenBalance(balance)
        } catch (err) {
          console.error("Failed to fetch token balance:", err)
        }
      }
    }
    fetchBalance()
  }, [wallet?.isConnected, wallet?.address, selectedToken, isNative])

  const handleDeposit = async () => {
    if (!wallet?.isConnected || !wallet.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    if (!poolAddress) {
      toast({
        title: "Pool Not Available",
        description: "This pool is not yet deployed.",
        variant: "destructive",
      })
      return
    }

    // Check balance
    if (tokenBalance < denomination) {
      toast({
        title: "Insufficient Balance",
        description: `You need at least ${selectedAmount} ${currentToken.symbol}. Get tokens from the faucet.`,
        variant: "destructive",
      })
      return
    }

    setTxStatus("generating")

    try {
      // Step 1: Generate secret note
      const poolId = `${selectedToken.toLowerCase()}${selectedAmount}`
      console.log("[Deposit] Generating note for pool:", poolId)
      const note = await generateNote(poolId)
      const noteString = serializeNote(note)
      setNoteData(note)
      setSecretNote(noteString)
      const commitment = getCommitmentBytes(note)
      console.log("[Deposit] Commitment:", commitment)

      let result: { txHash: string; leafIndex: number }

      if (isNative) {
        // Native DOGE deposit - send native DOGE directly to pool
        // No approval needed - just send native DOGE with the deposit call
        setTxStatus("depositing")
        toast({
          title: "Confirm Deposit",
          description: `Please confirm the ${selectedAmount} DOGE deposit in your wallet.`,
        })
        
        console.log("[Deposit] Native DOGE deposit...")
        result = await contractService.depositNative(
          poolAddress,
          commitment,
          denomination
        )
      } else {
        // ERC-20 token deposit (existing flow)
        // Step 2: Check and approve token spending
        setTxStatus("approving")
        const currentAllowance = await contractService.getAllowance(
          currentToken.address,
          wallet.address,
          poolAddress
        )
        
        if (currentAllowance < denomination) {
          console.log("[Deposit] Approving tokens...")
          toast({
            title: "Approve Token",
            description: "Please approve the token spending in your wallet.",
          })
          await contractService.approveToken(
            currentToken.address,
            poolAddress,
            denomination
          )
          console.log("[Deposit] Tokens approved!")
        } else {
          console.log("[Deposit] Already approved")
        }

        // Step 3: Submit deposit transaction
        setTxStatus("depositing")
        toast({
          title: "Confirm Deposit",
          description: "Please confirm the deposit transaction in your wallet.",
        })
        
        result = await contractService.deposit(
          poolAddress,
          commitment
        )
      }
      
      setTxHash(result.txHash)
      setLeafIndex(result.leafIndex)
      console.log("[Deposit] Success! TX:", result.txHash, "Leaf Index:", result.leafIndex)

      setTxStatus("success")
      toast({
        title: "Deposit Successful!",
        description: `${selectedAmount} ${currentToken.symbol} deposited to the privacy pool.`,
      })
    } catch (err: any) {
      console.error("Deposit failed:", err)
      setTxStatus("error")
      toast({
        title: "Deposit Failed",
        description: err.message || "An error occurred during deposit.",
        variant: "destructive",
      })
    }
  }

  const copyNote = () => {
    navigator.clipboard.writeText(secretNote)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: "Note Copied",
      description: "Secret note copied to clipboard. Store it securely!",
    })
  }

  const downloadNote = () => {
    const content = `DOGENADO SECRET NOTE
====================
⚠️ WARNING: This note is required to withdraw your funds.
   Store it securely OFFLINE. If you lose it, your funds are LOST FOREVER.

Note: ${secretNote}

Token: ${currentToken.symbol}
Amount: ${selectedAmount} ${currentToken.symbol}
Pool Address: ${poolAddress}
Leaf Index: ${leafIndex}
Commitment: ${noteData ? toBytes32(noteData.commitment) : ''}
Generated: ${new Date().toISOString()}

Network: DogeOS Chikyū Testnet
Chain ID: ${dogeosTestnet.id}
Transaction: ${txHash}

Explorer: ${links.explorer}/tx/${txHash}
`
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `zdoge-note-${selectedToken}-${selectedAmount}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setNoteSaved(true)
    toast({
      title: "Note Downloaded",
      description: "Store this file securely offline!",
    })
  }

  const formatBalance = (balance: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals)
    const whole = balance / divisor
    const remainder = balance % divisor
    if (remainder === 0n) return whole.toString()
    const decimal = remainder.toString().padStart(decimals, '0').slice(0, 4)
    return `${whole}.${decimal}`
  }

  const formatAmount = (amount: number): string => {
    if (amount >= 1000) return amount.toLocaleString()
    return amount.toString()
  }

  // Success state - show note backup screen
  if (txStatus === "success" && secretNote) {
    return (
      <Card className="bg-black border-[#C2A633]/20 p-0 rounded-none overflow-hidden">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="font-mono text-xl font-bold text-white">Deposit Complete</h2>
              <p className="font-mono text-xs text-gray-400">Save your note to withdraw later</p>
            </div>
          </div>

          <div className="p-4 bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-mono font-bold text-sm">CRITICAL: Save Your Note NOW</p>
                <p className="text-xs text-gray-400 mt-1 font-mono leading-relaxed">
                  This is the <strong className="text-white">ONLY</strong> way to withdraw your {selectedAmount} {currentToken.symbol}. 
                  Write it down on paper or download it. If you lose this note, your funds are 
                  <strong className="text-red-400"> PERMANENTLY LOST</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-mono text-xs text-[#C2A633] uppercase tracking-wider">Your Secret Note</Label>
            <div className="relative">
              <div className={`p-4 bg-zinc-950 border border-[#C2A633]/30 font-mono text-xs break-all text-zinc-300 leading-relaxed min-h-[100px] flex items-center justify-center ${hasBeenRevealed ? 'pr-20 sm:pr-24' : ''}`}>
                {isNoteRevealed ? (
                  <span className="select-all">{secretNote}</span>
                ) : (
                  <span className="text-zinc-600 select-none tracking-wider">
                    {secretNote.split('').map(() => '•').join('')}
                  </span>
                )}
              </div>
              
              {!hasBeenRevealed ? (
                // Initial "Hold to Reveal" button - centered
                <Button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsHolding(true)
                    setIsNoteRevealed(true)
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault()
                    setIsHolding(false)
                    setHasBeenRevealed(true)
                    setIsNoteRevealed(true)
                  }}
                  onMouseLeave={(e) => {
                    e.preventDefault()
                    if (isHolding) {
                      setIsHolding(false)
                      setHasBeenRevealed(true)
                      setIsNoteRevealed(true)
                    }
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    setIsHolding(true)
                    setIsNoteRevealed(true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    setIsHolding(false)
                    setHasBeenRevealed(true)
                    setIsNoteRevealed(true)
                  }}
                  variant="outline"
                  className={`
                    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-[#C2A633]/50 text-[#C2A633] hover:bg-[#C2A633]/10 font-mono
                    active:bg-[#C2A633]/20 active:border-[#C2A633] transition-all min-h-[44px] min-w-[140px]
                    touch-manipulation
                    ${isHolding ? 'bg-[#C2A633]/20 border-[#C2A633] scale-95' : ''}
                  `}
                  size="sm"
                >
                  {isHolding ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Revealing...
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hold to Reveal
                    </>
                  )}
                </Button>
              ) : (
                // Toggle button after initial reveal - top right
                <Button
                  onClick={() => setIsNoteRevealed(!isNoteRevealed)}
                  variant="outline"
                  className="absolute top-2 right-2 sm:top-3 sm:right-3 border-[#C2A633]/50 text-[#C2A633] hover:bg-[#C2A633]/10 font-mono transition-all min-h-[44px] touch-manipulation"
                  size="sm"
                >
                  {isNoteRevealed ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-mono text-center">
              {!hasBeenRevealed 
                ? "Hold the button above to reveal your secret note"
                : isNoteRevealed
                ? "Note is visible. Click the button to hide."
                : "Note is hidden. Click the button to show."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={copyNote} 
              variant="outline"
              className="border-[#C2A633]/50 text-[#C2A633] hover:bg-[#C2A633]/10 font-mono"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy
            </Button>
            <Button 
              onClick={downloadNote} 
              variant="outline"
              className="border-[#C2A633]/50 text-[#C2A633] hover:bg-[#C2A633]/10 font-mono"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {txHash && (
            <a
              href={`${links.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-[#C2A633] transition-colors font-mono"
            >
              <ExternalLink className="h-4 w-4" />
              View on Explorer
            </a>
          )}

          {noteSaved && (
            <Button
              onClick={() => {
                setTxStatus("idle")
                setSecretNote("")
                setNoteData(null)
                setNoteSaved(false)
                setTxHash("")
                setIsNoteRevealed(false)
                setIsHolding(false)
                setHasBeenRevealed(false)
              }}
              className="w-full h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold"
            >
              Make Another Deposit
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-black border-[#C2A633]/20 p-0 rounded-none overflow-hidden">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Step 1: Token Selection - Dropdown */}
        <div className="space-y-3">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Select Token</Label>
          <div className="relative">
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as SupportedToken)}
              disabled={txStatus !== "idle"}
              className="w-full h-12 px-4 pr-10 bg-black border border-[#C2A633]/30 text-white font-mono text-sm appearance-none cursor-pointer hover:border-[#C2A633] focus:border-[#C2A633] focus:outline-none transition-colors"
            >
              {SUPPORTED_TOKENS.map((token) => (
                <option key={token} value={token} className="bg-black text-white">
                  {token}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C2A633] pointer-events-none" />
          </div>
          
        </div>

        {/* Step 2: Amount Selection */}
        <div className="space-y-3">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Select Amount</Label>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {availableAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount.toString())}
                disabled={txStatus !== "idle"}
                className={`
                  relative p-4 border transition-all duration-200 text-left cursor-pointer
                  ${selectedAmount === amount.toString()
                    ? 'border-[#C2A633] bg-[#C2A633]/10' 
                    : 'border-zinc-800 hover:border-[#C2A633]/50 bg-zinc-950/50'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-lg font-bold text-white">{formatAmount(amount)}</span>
                  <span className="font-mono text-xs text-[#C2A633]">{currentToken.symbol}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-gray-500" />
                  <span className="font-mono text-xs text-gray-400">{formatRealUSD(amount, selectedToken, prices)}</span>
                </div>
                {selectedAmount === amount.toString() && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-[#C2A633]" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pool Info */}
        <div className="p-4 bg-zinc-950/50 border border-zinc-800 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-500">Token</span>
            <span className="text-white">{currentToken.name} ({currentToken.symbol})</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-500">Amount</span>
            <span className="text-[#C2A633] font-bold">{selectedAmount} {currentToken.symbol}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-500">Network</span>
            <span className="text-white">DogeOS Testnet</span>
          </div>
          {wallet?.isConnected && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Your Balance</span>
              <span className={tokenBalance >= denomination ? "text-green-400" : "text-red-400"}>
                {formatBalance(tokenBalance, currentToken.decimals)} {currentToken.symbol}
              </span>
            </div>
          )}
        </div>

        <Button
          onClick={handleDeposit}
          disabled={txStatus !== "idle" || !wallet?.isConnected}
          className="w-full h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {txStatus === "generating" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Note...
            </>
          ) : txStatus === "approving" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Approving Token...
            </>
          ) : txStatus === "depositing" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Depositing...
            </>
          ) : !wallet?.isConnected ? (
            "Connect Wallet First"
          ) : (
            `Deposit ${selectedAmount} ${currentToken.symbol}`
          )}
        </Button>

        <p className="text-xs text-zinc-500 text-center font-mono">
          Get testnet tokens from the{" "}
          <a href={links.faucet} target="_blank" rel="noopener noreferrer" className="text-[#C2A633] hover:underline">
            DogeOS Faucet
          </a>
        </p>
      </div>
    </Card>
  )
}
