"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, LogOut, AlertCircle, Check, Shield, ShieldOff, Info, Coins, Layers, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { prepareUnshield, completeUnshield, getNotes } from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import { useWallet } from "@/lib/wallet-context"
import { shieldedPool } from "@/lib/dogeos-config"
import { getUSDValue, formatUSD } from "@/lib/price-service"
import Link from "next/link"
import { ShieldPlus } from "lucide-react"

const SHIELDED_POOL_ADDRESS = shieldedPool.address
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

interface RelayerInfo {
  available: boolean
  address: string | null
  feePercent: number
  minFee: string
}

interface UnshieldInterfaceProps {
  notes: ShieldedNote[]
  onSuccess?: () => void
  selectedToken?: string
  onTokenChange?: (token: string) => void
}

export function UnshieldInterface({ notes, onSuccess, selectedToken = "DOGE", onTokenChange }: UnshieldInterfaceProps) {
  const { wallet } = useWallet()
  const { toast } = useToast()
  
  // Initialize transaction history
  useEffect(() => {
    if (wallet?.address) {
      initTransactionHistory(wallet.address).catch(err => {
        console.warn('[Unshield] Failed to init transaction history:', err)
      })
    }
  }, [wallet?.address])
  
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [status, setStatus] = useState<"idle" | "proving" | "relaying" | "success" | "error" | "consolidating">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null)
  const [fee, setFee] = useState<string | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [consolidateProgress, setConsolidateProgress] = useState<{ current: number; total: number; totalReceived: number } | null>(null)
  const [consolidateTxHashes, setConsolidateTxHashes] = useState<string[]>([])
  const [usdValue, setUsdValue] = useState<string | null>(null)
  
  const spendableNotes = useMemo(() => 
    notes.filter(n => n.leafIndex !== undefined && n.amount > 0n && (n.token || 'DOGE') === selectedToken)
      .sort((a, b) => Number(b.amount - a.amount)),
    [notes, selectedToken]
  )
  
  const totalBalance = useMemo(() => 
    spendableNotes.reduce((sum, n) => sum + n.amount, 0n),
    [spendableNotes]
  )
  
  const largestNote = useMemo(() => 
    spendableNotes.length > 0 ? spendableNotes[0] : null,
    [spendableNotes]
  )
  
  const calculateFeeForNote = (amountWei: bigint): { fee: bigint; received: bigint } => {
    if (!relayerInfo) return { fee: 0n, received: amountWei }
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let feeAmt = (amountWei * feePercent) / 10000n
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (feeAmt < minFee) feeAmt = minFee
    if (amountWei <= feeAmt) return { fee: amountWei, received: 0n }
    return { fee: feeAmt, received: amountWei - feeAmt }
  }
  
  const totalReceivableAfterFees = useMemo(() => {
    if (!relayerInfo) return totalBalance
    let total = 0n
    for (const note of spendableNotes) {
      const { received } = calculateFeeForNote(note.amount)
      total += received
    }
    return total
  }, [spendableNotes, relayerInfo])
  
  // Calculate USD value
  useEffect(() => {
    async function calculateUSD() {
      const dogeAmount = formatWeiToAmount(totalReceivableAfterFees)
      try {
        const usd = await getUSDValue(dogeAmount, "DOGE")
        setUsdValue(formatUSD(usd))
      } catch (error) {
        console.error('Failed to calculate USD value:', error)
        setUsdValue(null)
      }
    }
    if (totalReceivableAfterFees > 0n) {
      calculateUSD()
    } else {
      setUsdValue(null)
    }
  }, [totalReceivableAfterFees])
  
  useEffect(() => {
    async function fetchRelayerInfo() {
      try {
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/info`)
        if (response.ok) setRelayerInfo(await response.json())
      } catch (error) {
        console.warn('Could not fetch relayer info:', error)
      }
    }
    fetchRelayerInfo()
  }, [])
  
  const fillConnectedAddress = () => {
    if (wallet?.address) setRecipientAddress(wallet.address)
  }
  
  const calculateMaxUnshieldable = (): bigint => {
    if (!largestNote || !relayerInfo) return 0n
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    if (largestNote.amount <= minFee) return 0n
    const { received } = calculateFeeForNote(largestNote.amount)
    return received
  }
  
  const findBestNote = (requestedAmount: bigint): { note: ShieldedNote; noteIndex: number } | null => {
    if (!relayerInfo) return null
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    let requiredFee = (requestedAmount * feePercent) / 10000n
    if (requiredFee < minFee) requiredFee = minFee
    const requiredNoteAmount = requestedAmount + requiredFee
    const freshNotes = getNotes().filter(n => n.leafIndex !== undefined && n.amount > 0n)
    const sortedAsc = [...freshNotes].sort((a, b) => Number(a.amount - b.amount))
    for (const note of sortedAsc) {
      if (note.amount >= requiredNoteAmount) {
        const actualIndex = freshNotes.findIndex(n => n.commitment === note.commitment)
        return { note, noteIndex: actualIndex }
      }
    }
    return null
  }
  
  const parseInputAmount = (): bigint => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0n
    return BigInt(Math.floor(amountNum * 1e18))
  }
  
  const getSelectedNoteInfo = () => {
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) return null
    const result = findBestNote(requestedWei)
    if (!result) return { error: "No single note large enough. Use 'Consolidate All' to unshield everything." }
    const { fee } = calculateFeeForNote(result.note.amount)
    return {
      note: result.note,
      noteAmount: result.note.amount,
      fee,
      youReceive: requestedWei,
      change: result.note.amount - fee - requestedWei,
    }
  }
  
  const handleConsolidateAll = async () => {
    if (!wallet?.address) {
      toast({ title: "Wallet Required", description: "Please connect your wallet first", variant: "destructive" })
      return
    }
    if (!relayerInfo?.available) {
      toast({ title: "Relayer Offline", description: "Cannot consolidate while relayer is offline", variant: "destructive" })
      return
    }
    const freshNotes = getNotes().filter(n => n.leafIndex !== undefined && n.amount > 0n)
    const minFee = BigInt(Math.floor(parseFloat(relayerInfo.minFee) * 1e18))
    const worthyNotes = freshNotes.filter(n => n.amount > minFee)
    if (worthyNotes.length === 0) {
      toast({ title: "No Notes to Consolidate", description: "All notes are too small (dust)", variant: "destructive" })
      return
    }
    setStatus("consolidating")
    setConsolidateProgress({ current: 0, total: worthyNotes.length, totalReceived: 0 })
    setConsolidateTxHashes([])
    setErrorMessage(null)
    let totalReceived = 0
    const txHashes: string[] = []
    for (let i = 0; i < worthyNotes.length; i++) {
      const note = worthyNotes[i]
      try {
        const currentNotes = getNotes().filter(n => n.leafIndex !== undefined && n.amount > 0n)
        const noteIndex = currentNotes.findIndex(n => n.commitment === note.commitment)
        if (noteIndex === -1) continue
        const { fee: relayerFeeWei } = calculateFeeForNote(note.amount)
        const relayerFeeDoge = Number(relayerFeeWei) / 1e18
        const proofResult = await prepareUnshield(wallet.address, noteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, relayerFeeDoge)
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: proofResult.proof.proof,
            root: proofResult.root,
            nullifierHash: proofResult.nullifierHash,
            recipient: wallet.address,
            amount: proofResult.amount.toString(),
            fee: relayerFeeWei.toString(),
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || data.error || 'Relayer failed')
        txHashes.push(data.txHash)
        totalReceived += Number(data.amountReceived) / 1e18
        completeUnshield(noteIndex)
        
        // Add to transaction history
        addTransaction({
          type: 'unshield',
          txHash: data.txHash,
          timestamp: Math.floor(Date.now() / 1000),
          token: 'DOGE',
          amount: (Number(data.amountReceived) / 1e18).toFixed(4),
          amountWei: data.amountReceived,
          recipientPublicAddress: wallet.address,
          relayerFee: (Number(relayerFeeWei) / 1e18).toFixed(4),
          status: 'confirmed',
        })
        
        setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
        setConsolidateTxHashes([...txHashes])
      } catch (error: any) {
        console.error(`[Consolidate] Error on note ${i + 1}:`, error)
        setErrorMessage(`Failed on note ${i + 1}: ${error.message}`)
      }
    }
    setWithdrawnAmount(totalReceived.toFixed(4))
    setStatus("success")
    toast({ title: "🎉 Consolidation Complete!", description: `Received ${totalReceived.toFixed(4)} ${selectedToken}. Now re-shield to create one big note!` })
    onSuccess?.()
  }
  
  const handleUnshield = async () => {
    setErrorMessage(null)
    const requestedWei = parseInputAmount()
    if (requestedWei <= 0n) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    if (!recipientAddress || !recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      toast({ title: "Invalid Address", description: "Please enter a valid wallet address", variant: "destructive" })
      return
    }
    const result = findBestNote(requestedWei)
    if (!result) {
      toast({ title: "Insufficient Balance", description: "No single note large enough. Use 'Consolidate All'.", variant: "destructive" })
      return
    }
    const { note: selectedNote, noteIndex: actualNoteIndex } = result
    try {
      setStatus("proving")
      const { fee: relayerFeeWei } = calculateFeeForNote(selectedNote.amount)
      const relayerFeeDoge = Number(relayerFeeWei) / 1e18
      const proofResult = await prepareUnshield(recipientAddress, actualNoteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, relayerFeeDoge)
      setStatus("relaying")
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolAddress: SHIELDED_POOL_ADDRESS,
          proof: proofResult.proof.proof,
          root: proofResult.root,
          nullifierHash: proofResult.nullifierHash,
          recipient: recipientAddress,
          amount: proofResult.amount.toString(),
          fee: relayerFeeWei.toString(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'Relayer failed')
      setTxHash(data.txHash)
      const receivedAmount = (Number(data.amountReceived) / 1e18).toFixed(4)
      const feeAmount = (Number(data.fee) / 1e18).toFixed(4)
      setWithdrawnAmount(receivedAmount)
      setFee(feeAmount)
      completeUnshield(actualNoteIndex)
      
      // Add to transaction history
      addTransaction({
        type: 'unshield',
        txHash: data.txHash,
        timestamp: Math.floor(Date.now() / 1000),
        token: selectedToken,
        amount: receivedAmount,
        amountWei: data.amountReceived,
        recipientPublicAddress: wallet.address,
        relayerFee: feeAmount,
        status: 'confirmed',
      })
      
      setStatus("success")
      toast({ title: "Unshield Successful!", description: `Received ${receivedAmount} ${selectedToken}` })
      onSuccess?.()
    } catch (error: any) {
      setStatus("error")
      setErrorMessage(error.message || "Transaction failed")
      toast({ title: "Unshield Failed", description: error.message, variant: "destructive" })
    }
  }
  
  const reset = () => {
    setAmount("")
    setRecipientAddress("")
    setStatus("idle")
    setTxHash(null)
    setWithdrawnAmount(null)
    setFee(null)
    setErrorMessage(null)
    setConsolidateProgress(null)
    setConsolidateTxHashes([])
  }
  
  const handleSetMax = () => {
    const maxReceivable = calculateMaxUnshieldable()
    if (maxReceivable > 0n) {
      const maxDoge = Math.floor(formatWeiToAmount(maxReceivable) * 10000) / 10000
      setAmount(maxDoge.toFixed(4))
    }
  }
  
  if (spendableNotes.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div>
          <p className="text-muted-foreground">No shielded notes to unshield</p>
          <p className="text-sm text-muted-foreground mt-2">Shield some {selectedToken} first</p>
        </div>
        <Link href={`/shield?token=${selectedToken}`}>
          <Button className="mt-4">
            <ShieldPlus className="h-4 w-4 mr-2" />
            Shield {selectedToken}
          </Button>
        </Link>
      </div>
    )
  }
  
  const selectedInfo = getSelectedNoteInfo()
  const needsConsolidation = spendableNotes.length > 1
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Send to Public Address</h3>
        <p className="text-sm text-muted-foreground">Unshield your shielded DOGE to any public wallet address</p>
      </div>
      
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-medium">Available to Unshield</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{formatWeiToAmount(totalBalance).toFixed(4)} DOGE</div>
          </div>
        </div>
        {largestNote && (
          <div className="mt-2 pt-2 border-t border-muted text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Max single unshield: {formatWeiToAmount(largestNote.amount).toFixed(4)} DOGE
          </div>
        )}
      </div>
      
      {needsConsolidation && status === "idle" && (
        <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium flex items-center gap-2">
                Consolidate All Notes
                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Recommended</span>
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Unshield all available notes directly to your connected wallet
              </p>
              <div className="mt-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">You'll receive:</span>
                  <span className="font-medium text-green-500">~{formatWeiToAmount(totalReceivableAfterFees).toFixed(4)} {selectedToken}</span>
                </div>
                {usdValue && (
                  <div className="text-muted-foreground mt-1">
                    {usdValue}
                  </div>
                )}
              </div>
              <Button className="mt-3 w-full" variant="outline" onClick={handleConsolidateAll} disabled={!relayerInfo?.available || !wallet?.address}>
                <Layers className="h-4 w-4 mr-2" />
                Consolidate All to {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'Wallet'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      
      {status === "idle" && (
        <div className="space-y-4">
          {needsConsolidation && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or unshield specific amount</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount to Unshield</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSetMax}>
                Max: {formatWeiToAmount(calculateMaxUnshieldable()).toFixed(4)}
              </Button>
            </div>
            <Input id="amount" type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={fillConnectedAddress}>Use my wallet</Button>
            </div>
            <Input id="recipient" placeholder="0x... (any wallet address)" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
            <p className="text-xs text-muted-foreground">You can send unshield to any public wallet address</p>
          </div>
          {amount && relayerInfo && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              {selectedInfo && 'error' in selectedInfo ? (
                <div className="text-sm text-red-500 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{selectedInfo.error}</div>
              ) : selectedInfo ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Using note:</span><span>#{selectedInfo.note.leafIndex} ({formatWeiToAmount(selectedInfo.noteAmount).toFixed(4)} DOGE)</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Relayer fee:</span><span className="text-orange-500">-{formatWeiToAmount(selectedInfo.fee).toFixed(4)} DOGE</span></div>
                  <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1"><span>You receive:</span><span className="text-green-500">{amount} DOGE</span></div>
                  {selectedInfo.change > 0n && <div className="flex justify-between text-xs text-muted-foreground"><span>Remaining:</span><span>{formatWeiToAmount(selectedInfo.change).toFixed(4)} DOGE</span></div>}
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Gas you pay:</span><span className="text-primary">0 ✓</span></div>
                </>
              ) : null}
            </div>
          )}
          <Button 
            className="w-full border-[#C2A633] text-[#C2A633] hover:bg-[#C2A633]/10" 
            variant="outline"
            onClick={handleUnshield} 
            disabled={!relayerInfo?.available || !selectedInfo || 'error' in selectedInfo}
          >
            <ShieldOff className="h-4 w-4 mr-2 opacity-85" strokeWidth={1.75} />
            Unshield to Public Wallet
          </Button>
        </div>
      )}
      
      {status === "consolidating" && consolidateProgress && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Consolidating note {consolidateProgress.current}/{consolidateProgress.total}...</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(consolidateProgress.current / consolidateProgress.total) * 100}%` }} />
          </div>
          <p className="text-sm text-green-500">Received so far: {consolidateProgress.totalReceived.toFixed(4)} {selectedToken}</p>
        </div>
      )}
      
      {status === "proving" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="w-full max-w-xs space-y-2">
            <Progress value={33} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">Generating zero-knowledge proof...</p>
            <p className="text-xs text-muted-foreground text-center">This may take 10-30 seconds</p>
          </div>
        </div>
      )}
      
      {status === "relaying" && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="w-full max-w-xs space-y-2">
            <Progress value={66} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">Submitting transaction...</p>
            <p className="text-xs text-muted-foreground text-center">Your wallet never signs - complete privacy!</p>
          </div>
        </div>
      )}
      
      {status === "success" && (
        <div className="space-y-4" ref={(el) => {
          if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }
        }}>
          <div className="p-5 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-base font-semibold text-green-300 mb-1.5">
                    Unshield Successful!
                  </h4>
                  <p className="text-sm text-green-400/90 leading-relaxed">
                    Received {withdrawnAmount} {selectedToken}
                    {fee && <span className="text-green-400/70"> (Fee: {fee} {selectedToken})</span>}
                  </p>
                </div>
                {txHash && (
                  <a 
                    href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-green-300 hover:text-green-200 transition-colors group"
                  >
                    <span className="font-medium">View transaction on Blockscout</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
                {consolidateTxHashes.length > 0 && (
                  <div className="pt-3 border-t border-green-500/20 space-y-2">
                    <p className="text-xs font-medium text-green-400/70">
                      Consolidation Transactions ({consolidateTxHashes.length}):
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {consolidateTxHashes.map((hash, i) => (
                        <a 
                          key={hash} 
                          href={`https://blockscout.testnet.dogeos.com/tx/${hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 text-xs text-green-300 hover:text-green-200 transition-colors group"
                        >
                          <span className="font-mono">{i + 1}. {hash.slice(0, 10)}...{hash.slice(-8)}</span>
                          <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-medium text-green-400">🎉 Zero Gas Paid</p>
          </div>
          {consolidateTxHashes.length > 0 && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-primary/90">
                    <strong>Next step:</strong> Go to <strong>Shield</strong> tab and re-shield {withdrawnAmount} {selectedToken}!
                  </p>
                </div>
              </div>
            </div>
          )}
          <Button className="w-full" onClick={reset}>{consolidateTxHashes.length > 0 ? 'Done' : 'Unshield More'}</Button>
        </div>
      )}
      
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-300 mb-1">
                  Unshield Failed
                </p>
                <p className="text-sm text-orange-400/90">
                  {errorMessage || "Unshield failed. Your funds are safe."}
                </p>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={reset}>Try Again</Button>
        </div>
      )}
    </div>
  )
}
