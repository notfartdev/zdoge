"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/lib/wallet-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, ExternalLink, AlertCircle, Shield, Clock, Timer } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { parseNote, isValidNoteFormat, type Note } from "@/lib/note-service"
import { toBytes32 } from "@/lib/mimc"
import { 
  generateProof, 
  prepareWithdrawalInput,
  isNullifierSpent, 
  type ProofInput
} from "@/lib/proof-service"
import { contractService } from "@/lib/contract-service"
import { links, dogeosTestnet, tokenPools, WITHDRAWAL_DELAYS, type SupportedToken } from "@/lib/dogeos-config"
import { useToken, formatRealUSD } from "@/lib/token-context"

// Fee structure - pure percentage, no minimum
const FEE_PERCENTAGE = 0.5 // 0.5% fee

// Withdrawal delay type
type DelayOption = 'instant' | 'delayed' | 'custom';

// Helper to get pool info from pool ID
// IMPORTANT: Must check larger amounts first to avoid partial matches (e.g., "usdc10" matching "usdc1")
function getPoolFromId(poolId: string): { token: SupportedToken; amount: number; address: string } | null {
  const lower = poolId.toLowerCase()
  
  // Try exact match first with amounts sorted descending (largest first)
  for (const [tokenSymbol, config] of Object.entries(tokenPools)) {
    // Sort amounts descending to check larger amounts first
    const sortedAmounts = [...config.amounts].sort((a, b) => b - a)
    
    for (const amount of sortedAmounts) {
      const checkId = `${tokenSymbol.toLowerCase()}${amount}`
      // Use exact match: the pool ID should be exactly the checkId
      if (lower === checkId) {
        return { 
          token: tokenSymbol as SupportedToken, 
          amount: amount, 
          address: config.pools[amount.toString()] as string 
        }
      }
    }
  }
  
  // Fallback: check if pool ID ends with the token+amount pattern
  for (const [tokenSymbol, config] of Object.entries(tokenPools)) {
    // Sort amounts descending to check larger amounts first
    const sortedAmounts = [...config.amounts].sort((a, b) => b - a)
    
    for (const amount of sortedAmounts) {
      const checkId = `${tokenSymbol.toLowerCase()}${amount}`
      // Check if it ends with the pattern (more reliable than includes)
      if (lower.endsWith(checkId) || lower === checkId) {
        return {
          token: tokenSymbol as SupportedToken,
          amount: amount,
          address: config.pools[amount.toString()] as string
        }
      }
    }
  }
  
  return null
}

export function WithdrawInterface() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const { prices } = useToken()
  
  const [noteInput, setNoteInput] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [txStatus, setTxStatus] = useState<"idle" | "verified" | "validating" | "fetching" | "proving" | "submitting" | "scheduled" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState("")
  const [error, setError] = useState("")
  const [parsedNote, setParsedNote] = useState<Note | null>(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [poolInfo, setPoolInfo] = useState<{ token: SupportedToken; amount: number; address: string } | null>(null)
  
  // Delay options
  const [delayOption, setDelayOption] = useState<DelayOption>('instant')
  const [selectedSuggestedDelay, setSelectedSuggestedDelay] = useState(WITHDRAWAL_DELAYS.suggested[2].value) // 24 hours default
  const [customDelayHours, setCustomDelayHours] = useState("")
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
  
  // Two-step flow: isVerified tracks if note has been verified
  const [isVerified, setIsVerified] = useState(false)

  // Calculate fees - pure 0.5% of deposit amount
  const calculateFee = () => {
    if (!poolInfo) return { fee: 0, feeUsd: 0, receive: 0, receiveUsd: 0, depositAmount: 0, depositUsd: 0 }
    
    const tokenPrice = prices[poolInfo.token] || 1
    const depositAmount = poolInfo.amount
    const depositUsd = depositAmount * tokenPrice
    
    // Calculate fee: 0.5% of deposit amount
    const fee = depositAmount * (FEE_PERCENTAGE / 100)
    const feeUsd = fee * tokenPrice
    
    const receive = depositAmount - fee
    const receiveUsd = receive * tokenPrice
    
    return { fee, feeUsd, receive, receiveUsd, depositAmount, depositUsd }
  }

  const feeInfo = calculateFee()

  // Update pool info when note changes
  useEffect(() => {
    if (parsedNote) {
      const info = getPoolFromId(parsedNote.pool)
      setPoolInfo(info)
    } else {
      setPoolInfo(null)
    }
  }, [parsedNote])

  const validateNote = async (): Promise<Note | null> => {
    if (!isValidNoteFormat(noteInput)) {
      setError("Invalid note format. Expected: zdoge-1-<pool>-<secret>-<nullifier>")
      return null
    }

    try {
      const note = await parseNote(noteInput)
      setParsedNote(note)
      return note
    } catch (err: any) {
      setError(err.message || "Failed to parse note")
      return null
    }
  }

  // Step 1: Verify the note and show breakdown
  const handleVerifyNote = async () => {
    if (!noteInput.trim()) {
      setError("Please enter your deposit note")
      return
    }

    if (!recipientAddress.trim() || !recipientAddress.startsWith("0x")) {
      setError("Please enter a valid recipient address")
      return
    }

    setError("")
    setTxStatus("validating")
    setStatusMessage("Validating note...")

    const note = await validateNote()
    if (!note) {
      setTxStatus("idle")
      return
    }

    const info = getPoolFromId(note.pool)
    if (!info) {
      setError("Unknown pool. Could not determine token and amount.")
      setTxStatus("idle")
      return
    }
    
    setPoolInfo(info)

    const nullifierHashHex = toBytes32(note.nullifierHash)

    // Check if already spent
    setStatusMessage("Checking if note is already used...")
    const isSpent = await isNullifierSpent(info.address, nullifierHashHex)
    if (isSpent) {
      setError("This note has already been used to withdraw funds.")
      setTxStatus("idle")
      return
    }

    // Note is verified! Show the breakdown
    setIsVerified(true)
    setTxStatus("verified")
    setStatusMessage("")
    toast({
      title: "Note Verified",
      description: "Review the withdrawal details below and click Withdraw to proceed.",
    })
  }

  // Step 2: Process the actual withdrawal
  const handleWithdraw = async () => {
    if (!parsedNote || !poolInfo) {
      setError("Please verify your note first")
      return
    }

    const poolAddress = poolInfo.address
    const nullifierHashHex = toBytes32(parsedNote.nullifierHash)

    // Calculate fee in token units - pure 0.5%
    const feeTokens = poolInfo.amount * (FEE_PERCENTAGE / 100)
    const tokenConfig = tokenPools[poolInfo.token]
    const feeWei = BigInt(Math.floor(feeTokens * (10 ** tokenConfig.token.decimals)))

    // Prepare proof input
    setTxStatus("fetching")
    setStatusMessage("Fetching Merkle data...")
    
    let proofInput: ProofInput
    try {
      const relayerInfo = await contractService.getRelayerInfo()
      const relayerAddress = relayerInfo?.relayerAddress || "0x0000000000000000000000000000000000000000"
      
      proofInput = await prepareWithdrawalInput(
        parsedNote,
        poolAddress,
        recipientAddress,
        relayerAddress,
        feeWei
      )
    } catch (err: any) {
      setError(err.message || "Failed to fetch Merkle data")
      setTxStatus("error")
      return
    }

    // Generate ZK proof
    setTxStatus("proving")
    setStatusMessage("Generating zero-knowledge proof... This may take 30-60 seconds.")
    toast({
      title: "Generating Proof",
      description: "Creating zero-knowledge proof. This may take a minute...",
    })

    let proof
    try {
      proof = await generateProof(proofInput)
    } catch (err: any) {
      setError(`Proof generation failed: ${err.message}`)
      setTxStatus("error")
      return
    }

    // Submit withdrawal
    setTxStatus("submitting")
    
    const getDelaySeconds = () => {
      if (delayOption === 'instant') return 0
      if (delayOption === 'delayed') return selectedSuggestedDelay
      if (delayOption === 'custom' && customDelayHours) {
        return parseInt(customDelayHours) * 3600
      }
      return 0
    }
    const delaySeconds = getDelaySeconds()

    if (delaySeconds > 0) {
      // Scheduled withdrawal
      setStatusMessage(`Scheduling withdrawal with ${Math.round(delaySeconds / 3600)}h delay...`)
      toast({
        title: "Scheduling Withdrawal",
        description: `Your withdrawal will be executed after the delay period.`,
      })
      
      try {
        const result = await contractService.scheduleWithdrawal(
          poolAddress,
          proof.proof,
          toBytes32(proofInput.root),
          nullifierHashHex,
          recipientAddress,
          proofInput.fee,
          delaySeconds
        )
        setTxHash(result.txHash)
        setScheduledTime(result.unlockTime)
        setTxStatus("scheduled")
        toast({
          title: "Withdrawal Scheduled!",
          description: `Your funds will be available at ${result.unlockTime.toLocaleString()}`,
        })
        return
      } catch (err: any) {
        setError(err.message || "Failed to schedule withdrawal")
        setTxStatus("error")
        return
      }
    }
    
    // Instant withdrawal
    setStatusMessage("Submitting withdrawal...")
    toast({
      title: "Submitting Withdrawal",
      description: "Your transaction is being submitted for maximum privacy.",
    })
    
    try {
      const result = await contractService.withdrawViaRelayer(
        poolAddress,
        proof.proof,
        toBytes32(proofInput.root),
        nullifierHashHex,
        recipientAddress,
        proofInput.fee
      )
      setTxHash(result.txHash)
      setTxStatus("success")
      toast({
        title: "Withdrawal Successful!",
        description: "Your funds have been withdrawn to the recipient address.",
      })
    } catch (err: any) {
      setError(err.message || "Withdrawal submission failed")
      setTxStatus("error")
    }
  }

  const resetForm = () => {
    setNoteInput("")
    setRecipientAddress("")
    setTxStatus("idle")
    setTxHash("")
    setError("")
    setParsedNote(null)
    setPoolInfo(null)
    setStatusMessage("")
    setScheduledTime(null)
    setDelayOption('instant')
    setIsVerified(false)
  }

  // Scheduled state
  if (txStatus === "scheduled" && scheduledTime) {
    return (
      <Card className="bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
        <div className="text-center py-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#C2A633]/20 flex items-center justify-center mx-auto">
            <Clock className="h-10 w-10 text-[#C2A633]" />
          </div>
          <div className="space-y-2">
            <h3 className="font-mono text-2xl font-bold text-white">Withdrawal Scheduled!</h3>
            <p className="font-mono text-sm text-gray-400">
              Your withdrawal will be executed at:
            </p>
            <p className="font-mono text-lg text-[#C2A633]">
              {scheduledTime.toLocaleString()}
            </p>
          </div>
          
          <div className="p-4 bg-[#C2A633]/10 border border-[#C2A633]/30 text-left space-y-2">
            <p className="text-[#C2A633] font-mono text-sm font-bold">
              Check your Inbox to execute when ready
            </p>
            <p className="text-gray-400 font-mono text-xs">
              Visit the Inbox page after the delay period to execute your withdrawal.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 items-center">
            {txHash && (
              <a
                href={`${links.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#C2A633] transition-colors font-mono"
              >
                <ExternalLink className="h-4 w-4" />
                View Schedule TX on Explorer
              </a>
            )}

            <Button 
              onClick={resetForm} 
              className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold px-6"
            >
              Make Another Withdrawal
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Success state
  if (txStatus === "success") {
    return (
      <Card className="bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
        <div className="text-center py-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <div className="space-y-2">
            <h3 className="font-mono text-2xl font-bold text-white">Withdrawal Complete!</h3>
            <p className="font-mono text-sm text-gray-400">
              {poolInfo ? `${feeInfo.receive.toFixed(4)} ${poolInfo.token}` : 'Funds'} sent to recipient
            </p>
            {poolInfo && (
              <p className="font-mono text-xs text-gray-500">
                (After {FEE_PERCENTAGE}% service fee)
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-3 items-center">
            {txHash && (
              <a
                href={`${links.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#C2A633] transition-colors font-mono"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </a>
            )}

            <Button 
              onClick={resetForm} 
              className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold px-6"
            >
              Make Another Withdrawal
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-[#C2A633]/20 p-6 rounded-none">
      <div className="space-y-5">
        <Alert className="bg-[#C2A633]/10 border-[#C2A633] text-white">
          <Shield className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">
            Paste your deposit note to withdraw anonymously to any wallet address.
          </AlertDescription>
        </Alert>

        {/* Deposit Note Input */}
        <div className="space-y-2">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Deposit Note</Label>
          <Textarea
            value={noteInput}
            onChange={(e) => {
              setNoteInput(e.target.value)
              setError("")
              setParsedNote(null)
            }}
            placeholder="zdoge-1-usdc100-abc123...def456..."
            disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
            className="font-mono text-xs bg-black border-[#C2A633]/20 text-white min-h-[80px] resize-none"
          />
          {parsedNote && poolInfo && (
            <div className="text-xs font-mono text-green-500">
              ✓ Valid note: {poolInfo.amount} {poolInfo.token}
            </div>
          )}
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Recipient Address</Label>
          <Input
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
            className="font-mono text-sm bg-black border-[#C2A633]/20 text-white h-11"
          />
          <p className="text-[10px] font-mono text-gray-600">
            Use a fresh address that has never been linked to your deposit address.
          </p>
        </div>

        {/* Withdrawal Timing */}
        <div className="space-y-3">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Withdrawal Timing</Label>
          
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setDelayOption('instant')}
              disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
              className={`p-3 border transition-all text-center ${
                delayOption === 'instant' 
                  ? 'border-[#C2A633] bg-[#C2A633]/10' 
                  : 'border-zinc-800 hover:border-[#C2A633]/50'
              }`}
            >
              <span className="font-mono text-xs text-white block">Instant</span>
            </button>
            <button
              onClick={() => setDelayOption('delayed')}
              disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
              className={`p-3 border transition-all text-center ${
                delayOption === 'delayed' 
                  ? 'border-[#C2A633] bg-[#C2A633]/10' 
                  : 'border-zinc-800 hover:border-[#C2A633]/50'
              }`}
            >
              <span className="font-mono text-xs text-white block">Delayed</span>
            </button>
            <button
              onClick={() => setDelayOption('custom')}
              disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
              className={`p-3 border transition-all text-center ${
                delayOption === 'custom' 
                  ? 'border-[#C2A633] bg-[#C2A633]/10' 
                  : 'border-zinc-800 hover:border-[#C2A633]/50'
              }`}
            >
              <span className="font-mono text-xs text-white block">Custom</span>
            </button>
          </div>

          <p className="text-[10px] font-mono text-gray-600">
            {delayOption === 'instant' && "Withdraw immediately. Quick but may reduce privacy."}
            {delayOption === 'delayed' && "Delayed withdrawal increases privacy by waiting."}
            {delayOption === 'custom' && "Set your own delay period in hours."}
          </p>

          {delayOption === 'delayed' && (
            <div className="flex flex-wrap gap-2">
              {WITHDRAWAL_DELAYS.suggested.map((delay) => (
                <button
                  key={delay.value}
                  onClick={() => setSelectedSuggestedDelay(delay.value)}
                  disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
                  className={`px-3 py-1.5 text-xs font-mono transition-all ${
                    selectedSuggestedDelay === delay.value
                      ? 'bg-[#C2A633] text-black'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  {delay.label}
                </button>
              ))}
            </div>
          )}

          {delayOption === 'custom' && (
            <Input
              type="number"
              value={customDelayHours}
              onChange={(e) => setCustomDelayHours(e.target.value)}
              placeholder="Enter hours (1-168)"
              min="1"
              max="168"
              disabled={isVerified || (txStatus !== "idle" && txStatus !== "verified")}
              className="font-mono text-sm bg-black border-[#C2A633]/20 text-white h-10"
            />
          )}
        </div>

        {/* Fee Breakdown - Only show when note is parsed */}
        {poolInfo && (
          <div className="p-4 bg-black border border-[#C2A633]/30 space-y-3">
            <Label className="font-mono text-xs text-[#C2A633] uppercase tracking-wider">Withdrawal Summary</Label>
            
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Deposit Amount</span>
                <span className="text-white">
                  {feeInfo.depositAmount} {poolInfo.token}
                  <span className="text-gray-500 ml-2">
                    ({formatRealUSD(feeInfo.depositAmount || 0, poolInfo.token, prices)})
                  </span>
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Service Fee ({FEE_PERCENTAGE}%)</span>
                <span className="text-red-400">
                  -{feeInfo.fee.toFixed(4)} {poolInfo.token}
                  <span className="text-gray-500 ml-2">
                    (-{formatRealUSD(feeInfo.fee, poolInfo.token, prices)})
                  </span>
                </span>
              </div>
              
              <div className="border-t border-[#C2A633]/20 pt-2 flex justify-between">
                <span className="text-[#C2A633] font-bold">You Receive</span>
                <span className="text-[#C2A633] font-bold">
                  {feeInfo.receive.toFixed(4)} {poolInfo.token}
                  <span className="text-white ml-2">
                    ({formatRealUSD(feeInfo.receive, poolInfo.token, prices)})
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert className="bg-red-500/10 border-red-500 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Status Message */}
        {statusMessage && txStatus !== "idle" && txStatus !== "error" && (
          <div className="text-center py-2">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin text-[#C2A633]" />
            <p className="font-mono text-xs text-gray-400">{statusMessage}</p>
          </div>
        )}

        {/* Two-Step Buttons */}
        {!isVerified ? (
          // Step 1: Verify Note Button
          <Button
            onClick={handleVerifyNote}
            disabled={txStatus === "validating" || !noteInput || !recipientAddress}
            className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold text-sm tracking-wider disabled:opacity-50 border border-[#C2A633]/30"
          >
            {txStatus === "validating" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying Note...
              </>
            ) : (
              "Verify Note"
            )}
          </Button>
        ) : (
          // Step 2: Withdraw Button (after verification)
          <div className="space-y-3">
            <Button
              onClick={handleWithdraw}
              disabled={txStatus !== "verified" && txStatus !== "idle"}
              className="w-full h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold text-sm tracking-wider disabled:opacity-50"
            >
              {txStatus === "verified" || txStatus === "idle" ? (
                `Withdraw ${feeInfo.receive.toFixed(4)} ${poolInfo?.token || ''}`
              ) : (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              )}
            </Button>
            <button
              onClick={() => {
                setIsVerified(false)
                setTxStatus("idle")
                setParsedNote(null)
                setPoolInfo(null)
              }}
              className="w-full text-center text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Go back and edit
            </button>
          </div>
        )}

        <p className="text-center font-mono text-[10px] text-gray-600">
          Network: {dogeosTestnet.name} (Chain ID: {dogeosTestnet.id})
        </p>
      </div>
    </Card>
  )
}
