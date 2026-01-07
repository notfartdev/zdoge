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
import { parseUnits, formatUnits } from "viem"

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'
import Link from "next/link"
import { ShieldPlus } from "lucide-react"

const SHIELDED_POOL_ADDRESS = shieldedPool.address
const RELAYER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com'

// Helper to get token decimals
function getTokenDecimals(tokenSymbol: string): number {
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens]
  return token?.decimals || 18 // Default to 18 if not found
}

// Helper to get token metadata
function getTokenMetadata(tokenSymbol: string): { symbol: string; address: `0x${string}`; decimals: number } {
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  
  if (tokenSymbol === 'DOGE') {
    return {
      symbol: 'DOGE',
      address: NATIVE_TOKEN,
      decimals: 18,
    };
  }
  
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found in shieldedPool.supportedTokens`);
  }
  
  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals,
  };
}

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
  const [isLoadingRelayerInfo, setIsLoadingRelayerInfo] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [consolidateProgress, setConsolidateProgress] = useState<{ current: number; total: number; totalReceived: number } | null>(null)
  const [consolidateTxHashes, setConsolidateTxHashes] = useState<string[]>([])
  const [consolidateTotalReceived, setConsolidateTotalReceived] = useState<number>(0)
  const [usdValue, setUsdValue] = useState<string | null>(null)
  
  const spendableNotes = useMemo(() => {
    // Get token metadata for filtering
    const tokenMeta = getTokenMetadata(selectedToken)
    
    return notes
      .filter(note => {
        // Handle legacy notes (without tokenAddress/decimals)
        if (!note.tokenAddress || note.decimals == null) {
          // Legacy note: match by token symbol
          // For USDC, check if note.token is 'USDC'
          // For DOGE, check if note.token is 'DOGE' or missing
          if (selectedToken === 'DOGE') {
            return !note.token || note.token === 'DOGE'
          }
          return note.token === selectedToken
        }
        // Modern note: match by tokenAddress (more reliable)
        return note.tokenAddress.toLowerCase() === tokenMeta.address.toLowerCase()
      })
      .filter(n => n.leafIndex !== undefined && n.amount > 0n)
      .sort((a, b) => Number(b.amount - a.amount))
  }, [notes, selectedToken])
  
  const totalBalance = useMemo(() => 
    spendableNotes.reduce((sum, n) => sum + n.amount, 0n),
    [spendableNotes]
  )
  
  const largestNote = useMemo(() => 
    spendableNotes.length > 0 ? spendableNotes[0] : null,
    [spendableNotes]
  )
  
  // Get token decimals for fee calculation
  const tokenDecimals = getTokenDecimals(selectedToken)
  
  const calculateFeeForNote = (amountWei: bigint): { fee: bigint; received: bigint; error?: string } => {
    if (!relayerInfo) return { fee: 0n, received: amountWei }
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    let feeAmt = (amountWei * feePercent) / 10000n
    // Convert minFee from human-readable to token base units using token decimals
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    if (feeAmt < minFee) feeAmt = minFee
    
    // Check if note is too small to unshield (fee would exceed or equal note amount)
    if (amountWei <= feeAmt) {
      const noteAmountHuman = formatUnits(amountWei, tokenDecimals)
      const feeAmountHuman = formatUnits(feeAmt, tokenDecimals)
      return { 
        fee: amountWei, 
        received: 0n,
        error: `Note too small to unshield. Note: ${noteAmountHuman} ${selectedToken}, Minimum fee: ${feeAmountHuman} ${selectedToken}`
      }
    }
    return { fee: feeAmt, received: amountWei - feeAmt }
  }
  
  const totalReceivableAfterFees = useMemo(() => {
    if (!relayerInfo) return totalBalance
    let total = 0n
    // Filter out notes that are too small to unshield
    for (const note of spendableNotes) {
      const feeResult = calculateFeeForNote(note.amount)
      if (!feeResult.error) {
        total += feeResult.received
      }
    }
    return total
  }, [spendableNotes, relayerInfo])
  
  // Calculate USD value
  useEffect(() => {
    async function calculateUSD() {
      const dogeAmount = Number(formatUnits(totalReceivableAfterFees, tokenDecimals))
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
      setIsLoadingRelayerInfo(true)
      try {
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/info`)
        if (response.ok) {
          setRelayerInfo(await response.json())
        }
      } catch (error) {
        console.warn('Could not fetch relayer info:', error)
      } finally {
        setIsLoadingRelayerInfo(false)
      }
    }
    fetchRelayerInfo()
  }, [])
  
  const fillConnectedAddress = () => {
    if (wallet?.address) setRecipientAddress(wallet.address)
  }
  
  const calculateMaxUnshieldable = (): bigint => {
    if (!largestNote || !relayerInfo) return 0n
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    if (largestNote.amount <= minFee) return 0n
    const feeResult = calculateFeeForNote(largestNote.amount)
    if (feeResult.error) return 0n
    return feeResult.received
  }
  
  const findBestNote = (requestedAmount: bigint): { note: ShieldedNote; noteIndex: number } | null => {
    if (!relayerInfo) return null
    
    // Get token metadata for filtering
    const tokenMeta = getTokenMetadata(selectedToken)
    
    const feePercent = BigInt(Math.floor(relayerInfo.feePercent * 100))
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    let requiredFee = (requestedAmount * feePercent) / 10000n
    if (requiredFee < minFee) requiredFee = minFee
    const requiredNoteAmount = requestedAmount + requiredFee
    
    // Get all notes and filter by token address (not just symbol)
    const allNotes = getNotes()
    const candidateNotes = allNotes
      .map((note, originalIndex) => ({ note, originalIndex }))
      .filter(({ note }) => {
        // Filter by token address - handle missing tokenAddress (legacy notes)
        if (!note.tokenAddress) {
          // Legacy note: check if it's DOGE and selectedToken is DOGE
          if (selectedToken === 'DOGE' && (!note.token || note.token === 'DOGE')) {
            return true
          }
          return false
        }
        // Modern note: match by tokenAddress
        return note.tokenAddress.toLowerCase() === tokenMeta.address.toLowerCase()
      })
      .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n)
    
    if (candidateNotes.length === 0) {
      return null
    }
    
    // Sort by amount ascending (smallest first that covers the amount)
    const sortedCandidates = [...candidateNotes].sort((a, b) => Number(a.note.amount - b.note.amount))
    
    for (const { note, originalIndex } of sortedCandidates) {
      if (note.amount >= requiredNoteAmount) {
        // Return the original index in allNotes array (not filtered array index)
        return { note, noteIndex: originalIndex }
      }
    }
    return null
  }
  
  const parseInputAmount = (): bigint => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0n
    // Use token decimals for parsing
    return parseUnits(amountNum.toString(), tokenDecimals)
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
  
  // Helper function to check if a nullifier is already spent
  const checkNullifierSpent = async (nullifierHash: string): Promise<boolean> => {
    try {
      const response = await fetch(`${RELAYER_URL}/api/shielded/pool/${SHIELDED_POOL_ADDRESS}/nullifier/${nullifierHash}`)
      if (!response.ok) return false // If check fails, assume not spent (safer to try)
      const data = await response.json()
      return data.isSpent === true
    } catch (error) {
      console.warn('[Consolidate] Failed to check nullifier status:', error)
      return false // If check fails, assume not spent (safer to try)
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
    // Only consolidate notes for the selected token
    const freshNotes = getNotes().filter(n => 
      n.leafIndex !== undefined && 
      n.amount > 0n && 
      (n.token || 'DOGE') === selectedToken
    )
    // Use token decimals for minFee
    const minFee = parseUnits(relayerInfo.minFee, tokenDecimals)
    const worthyNotes = freshNotes.filter(n => n.amount > minFee)
    if (worthyNotes.length === 0) {
      toast({ title: "No Notes to Consolidate", description: "All notes are too small (dust)", variant: "destructive" })
      return
    }
    setStatus("consolidating")
    // Start at 0 - shows "Processing note 0 of X" (0 notes completed)
    setConsolidateProgress({ current: 0, total: worthyNotes.length, totalReceived: 0 })
    setConsolidateTxHashes([])
    setErrorMessage(null)
    let totalReceived = 0
    const txHashes: string[] = []
    const skippedNotes: number[] = [] // Track notes that were already spent
    
    for (let i = 0; i < worthyNotes.length; i++) {
      const note = worthyNotes[i]
      
      try {
        // Only look for notes of the selected token
        const currentNotes = getNotes().filter(n => 
          n.leafIndex !== undefined && 
          n.amount > 0n && 
          (n.token || 'DOGE') === selectedToken
        )
        const noteIndex = currentNotes.findIndex(n => n.commitment === note.commitment)
        if (noteIndex === -1) continue
        
        // Get token address for consolidation
        const tokenAddress = selectedToken === 'DOGE' 
          ? NATIVE_TOKEN
          : shieldedPool.supportedTokens[selectedToken]?.address
        
        if (!tokenAddress && selectedToken !== 'DOGE') {
          throw new Error(`Token ${selectedToken} not configured`)
        }
        
        // Check if note is already spent BEFORE generating proof
        const { fee: relayerFeeWei } = calculateFeeForNote(note.amount)
        // Pass fee directly in wei to avoid precision loss during conversion
        const proofResult = await prepareUnshield(wallet.address, noteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, 0, relayerFeeWei)
        
        // Check if nullifier is already spent
        const isSpent = await checkNullifierSpent(proofResult.nullifierHash)
        if (isSpent) {
          console.warn(`[Consolidate] Note ${i + 1} already spent, removing from local state`)
          skippedNotes.push(i + 1)
          // Remove the spent note from local state
          completeUnshield(noteIndex)
          // Update progress (note was processed, just skipped)
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        
        const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: SHIELDED_POOL_ADDRESS,
            proof: proofResult.proof.proof,
            root: proofResult.root,
            nullifierHash: proofResult.nullifierHash,
            recipient: wallet.address,
            amount: proofResult.amount.toString(),  // Recipient net amount
            fee: relayerFeeWei.toString(),  // Relayer fee
            token: tokenAddress,  // Token address (native = 0x0...0)
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          // Check if error is due to already spent
          if (data.error?.includes('already') || data.error?.includes('spent') || data.message?.includes('already') || data.message?.includes('spent')) {
            console.warn(`[Consolidate] Note ${i + 1} already spent (from relayer), removing from local state`)
            skippedNotes.push(i + 1)
            completeUnshield(noteIndex)
            setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
            continue
          }
          throw new Error(data.message || data.error || 'Relayer failed')
        }
        txHashes.push(data.txHash)
        // Convert amountReceived from token base units to human-readable using token decimals
        totalReceived += Number(formatUnits(BigInt(data.amountReceived), tokenDecimals))
        completeUnshield(noteIndex)
        
        // Add to transaction history
        addTransaction({
          type: 'unshield',
          txHash: data.txHash,
          timestamp: Math.floor(Date.now() / 1000),
          token: selectedToken,
          amount: formatUnits(BigInt(data.amountReceived), tokenDecimals),
          amountWei: data.amountReceived,
          recipientPublicAddress: wallet.address,
          relayerFee: formatUnits(relayerFeeWei, tokenDecimals),
          status: 'confirmed',
        })
        
        // Update progress AFTER successful processing - shows how many notes completed
        // i + 1 because we just completed note at index i (0-indexed), so we've completed i+1 notes
        setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
        setConsolidateTxHashes([...txHashes])
      } catch (error: any) {
        console.error(`[Consolidate] Error on note ${i + 1}:`, error)
        // Check if error is due to already spent
        if (error.message?.includes('already') || error.message?.includes('spent') || error.message?.includes('NullifierAlreadySpent')) {
          console.warn(`[Consolidate] Note ${i + 1} already spent, removing from local state`)
          skippedNotes.push(i + 1)
          // Try to remove the note if we can find it
          try {
            const currentNotes = getNotes().filter(n => 
              n.leafIndex !== undefined && 
              n.amount > 0n && 
              (n.token || 'DOGE') === selectedToken
            )
            const noteIndex = currentNotes.findIndex(n => n.commitment === note.commitment)
            if (noteIndex !== -1) {
              completeUnshield(noteIndex)
            }
          } catch (e) {
            console.warn('[Consolidate] Could not remove spent note:', e)
          }
          setConsolidateProgress({ current: i + 1, total: worthyNotes.length, totalReceived })
          continue
        }
        setErrorMessage(`Failed on note ${i + 1}: ${error.message}`)
      }
    }
    
    // Show info about skipped notes if any
    if (skippedNotes.length > 0) {
      console.log(`[Consolidate] Skipped ${skippedNotes.length} already-spent note(s): ${skippedNotes.join(', ')}`)
      toast({
        title: "Note Cleanup",
        description: `Removed ${skippedNotes.length} already-spent note(s) from your wallet. Your balance has been updated.`,
        variant: "default",
      })
    }
    setConsolidateTotalReceived(totalReceived)
    setWithdrawnAmount(totalReceived.toFixed(4))
    setStatus("success")
    // Don't show toast - the green success UI box will show instead
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
    
    // Check if note is too small to unshield
    const feeCheck = calculateFeeForNote(selectedNote.amount)
    if (feeCheck.error) {
      toast({
        title: "Note Too Small",
        description: feeCheck.error,
        variant: "destructive",
      })
      return
    }
    
    try {
      setStatus("proving")
      const { fee: relayerFeeWei } = feeCheck
      // Pass fee directly in wei to avoid precision loss during conversion
      // All tokens on DogeOS testnet use 18 decimals, so this works for all tokens
      const proofResult = await prepareUnshield(recipientAddress, actualNoteIndex, SHIELDED_POOL_ADDRESS, relayerInfo?.address || undefined, 0, relayerFeeWei)
      
      // Get token address for the request
      const tokenAddress = selectedToken === 'DOGE' 
        ? NATIVE_TOKEN
        : shieldedPool.supportedTokens[selectedToken]?.address
      
      // Log for debugging
      console.log(`[Unshield] Token selection:`, {
        selectedToken,
        tokenAddress,
        isNative: selectedToken === 'DOGE',
        supportedTokens: Object.keys(shieldedPool.supportedTokens),
        tokenConfig: shieldedPool.supportedTokens[selectedToken],
      })
      
      if (!tokenAddress && selectedToken !== 'DOGE') {
        console.error(`[Unshield] Token ${selectedToken} not found in config:`, shieldedPool.supportedTokens)
        throw new Error(`Token ${selectedToken} not configured`)
      }
      
      // Validate token address format
      if (tokenAddress && !tokenAddress.startsWith('0x')) {
        console.error(`[Unshield] Invalid token address format:`, tokenAddress)
        throw new Error(`Invalid token address format for ${selectedToken}`)
      }
      
      setStatus("relaying")
      
      // Prepare request body - ALWAYS include token parameter
      // This is critical: backend uses token parameter to determine which function to call
      const requestBody = {
        poolAddress: SHIELDED_POOL_ADDRESS,
        proof: proofResult.proof.proof,
        root: proofResult.root,
        nullifierHash: proofResult.nullifierHash,
        recipient: recipientAddress,
        amount: proofResult.amount.toString(),  // Recipient net amount
        fee: relayerFeeWei.toString(),  // Relayer fee
        token: tokenAddress || NATIVE_TOKEN,  // Token address - ALWAYS include (native = 0x0...0)
      }
      
      // Validate token address is set
      if (!requestBody.token) {
        console.error(`[Unshield] CRITICAL: token address is missing!`, {
          selectedToken,
          tokenAddress,
          supportedTokens: Object.keys(shieldedPool.supportedTokens),
        })
        throw new Error(`Token address is missing for ${selectedToken}`)
      }
      
      // Log the exact request being sent - EXPANDED to show full token info
      console.log(`[Unshield] Sending request to relayer:`, {
        poolAddress: requestBody.poolAddress,
        proof: `[${requestBody.proof.length} elements]`, // Don't log full proof
        root: requestBody.root,
        nullifierHash: requestBody.nullifierHash,
        recipient: requestBody.recipient,
        amount: requestBody.amount,
        fee: requestBody.fee,
        token: requestBody.token,  // CRITICAL: This must be the USDC address for USDC unshield
        tokenType: requestBody.token === NATIVE_TOKEN ? 'NATIVE' : 'ERC20',
        selectedToken,
        expectedToken: selectedToken === 'DOGE' ? NATIVE_TOKEN : shieldedPool.supportedTokens[selectedToken]?.address,
      })
      
      // Also log the FULL request body as JSON to verify token is included
      console.log(`[Unshield] FULL REQUEST BODY (JSON):`, JSON.stringify({
        ...requestBody,
        proof: `[${requestBody.proof.length} elements]`, // Don't log full proof array
      }, null, 2))
      
      const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'Relayer failed')
      setTxHash(data.txHash)
      // Convert from token base units to human-readable using token decimals
      const receivedAmount = formatUnits(BigInt(data.amountReceived), tokenDecimals)
      const feeAmount = formatUnits(BigInt(data.fee), tokenDecimals)
      setWithdrawnAmount(Number(receivedAmount).toFixed(4))
      setFee(Number(feeAmount).toFixed(4))
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
      // Don't show toast - the green success UI box will show instead
      onSuccess?.()
      
      // Trigger balance refresh after a delay to allow transaction confirmation
      setTimeout(() => {
        // Dispatch custom event to trigger balance refresh
        window.dispatchEvent(new Event('refresh-balance'))
      }, 3000)
    } catch (error: any) {
      setStatus("error")
      
      // Better error messages
      let errorMessage = "Transaction failed"
      if (error?.message) {
        if (error.message.includes("user rejected") || error.message.includes("User denied")) {
          errorMessage = "Transaction was cancelled. Please try again when ready."
        } else if (error.message.includes("insufficient funds") || error.message.includes("insufficient balance")) {
          errorMessage = "Insufficient balance. Please check your shielded balance."
        } else if (error.message.includes("network") || error.message.includes("RPC") || error.message.includes("relayer")) {
          errorMessage = "Network or relayer error. Please check your connection and try again."
        } else if (error.message.includes("proof") || error.message.includes("nullifier")) {
          errorMessage = "Proof generation failed. Please try again."
        } else if (error.message.includes("consolidation")) {
          errorMessage = "Consolidation failed. Please try again."
        } else {
          errorMessage = error.message
        }
      }
      
      setErrorMessage(errorMessage)
      toast({ 
        title: "Unshield Failed", 
        description: errorMessage, 
        variant: "destructive" 
      })
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
      // Convert from token base units to human-readable using token decimals
      const maxAmount = formatUnits(maxReceivable, tokenDecimals)
      setAmount(Number(maxAmount).toFixed(4))
    }
  }
  
  // Don't return early if we're showing success state (even if no notes left)
  if (spendableNotes.length === 0 && status !== "success") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-display font-medium">Send to Public Address</h3>
          <p className="text-sm font-body text-muted-foreground">Unshield your shielded {selectedToken} to any public wallet address</p>
        </div>
        <div className="p-8 rounded-lg bg-muted/30 border border-muted text-center">
          <ShieldOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm font-body text-muted-foreground">
            No shielded {selectedToken} balance available
          </p>
          <p className="text-xs font-body text-muted-foreground/70 mt-2">
            Shield some {selectedToken} first to enable unshielding
          </p>
        </div>
      </div>
    )
  }
  
  const selectedInfo = getSelectedNoteInfo()
  const needsConsolidation = spendableNotes.length > 1
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display font-medium">Send to Public Address</h3>
        <p className="text-sm font-body text-muted-foreground">Unshield your shielded {selectedToken} to any public wallet address</p>
      </div>
      
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-medium">Available to Unshield</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold tracking-[-0.01em]">{formatUnits(totalBalance, tokenDecimals)} <span className="font-body text-sm text-white/70">{selectedToken}</span></div>
          </div>
        </div>
        {largestNote && (
          <div className="mt-2 pt-2 border-t border-muted text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Max single unshield: {formatUnits(largestNote.amount, tokenDecimals)} {selectedToken}
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
                {isLoadingRelayerInfo ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Computing notes...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">You'll receive:</span>
                      <span className="font-medium text-green-500">~{formatUnits(totalReceivableAfterFees, tokenDecimals)} {selectedToken}</span>
                    </div>
                    {usdValue && (
                      <div className="text-muted-foreground mt-1">
                        {usdValue}
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button 
                className="mt-3 w-full" 
                variant="outline" 
                onClick={handleConsolidateAll} 
                disabled={isLoadingRelayerInfo || !relayerInfo?.available || !wallet?.address}
              >
                {isLoadingRelayerInfo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Computing notes...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Consolidate All to {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'Wallet'}
                  </>
                )}
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
                Max: {formatUnits(calculateMaxUnshieldable(), tokenDecimals)}
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
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Using note:</span><span>#{selectedInfo.note.leafIndex} ({formatUnits(selectedInfo.noteAmount, tokenDecimals)} {selectedToken})</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Relayer fee:</span><span className="text-orange-500">-{formatUnits(selectedInfo.fee, tokenDecimals)} {selectedToken}</span></div>
                  <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1"><span>You receive:</span><span className="text-green-500">{amount} {selectedToken}</span></div>
                  {selectedInfo.change > 0n && <div className="flex justify-between text-xs text-muted-foreground"><span>Remaining:</span><span>{formatUnits(selectedInfo.change, tokenDecimals)} {selectedToken}</span></div>}
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
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Layers className="h-8 w-8 text-white/80 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C2A633] flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-black animate-spin" />
                </div>
              </div>
              
              {/* Progress Info */}
              <div className="w-full max-w-xs space-y-3">
                <div className="text-center space-y-2">
                  <h4 className="text-base font-display font-semibold text-white">
                    Consolidating Notes
                  </h4>
                  <p className="text-sm font-body text-white/70">
                    Processing note {consolidateProgress.current} of {consolidateProgress.total}...
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full origin-left transition-transform duration-300"
                    style={{ 
                      width: `${(consolidateProgress.current / consolidateProgress.total) * 100}%`
                    }}
                  />
                </div>
                
                {/* Received Amount */}
                <div className="text-center">
                  <p className="text-sm font-body text-white/60">Received so far:</p>
                  <p className="text-lg font-display font-semibold text-[#C2A633]">
                    {consolidateProgress.totalReceived.toFixed(4)} {selectedToken}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
            <p className="text-xs text-muted-foreground text-center">Your wallet never signs!</p>
          </div>
        </div>
      )}
      
      {status === "success" && consolidateTxHashes.length > 0 && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-[#C2A633]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-lg font-display font-semibold text-white mb-2">
                    Consolidation Complete!
                  </h4>
                  <p className="text-sm font-body text-white/70 leading-relaxed">
                    Successfully consolidated {consolidateTxHashes.length} note{consolidateTxHashes.length > 1 ? 's' : ''} and received {consolidateTotalReceived.toFixed(4)} {selectedToken}.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <p className="text-xs font-medium text-white/60">
                    Transaction Links ({consolidateTxHashes.length}):
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {consolidateTxHashes.map((hash, i) => (
                      <a 
                        key={hash} 
                        href={`https://blockscout.testnet.dogeos.com/tx/${hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 text-xs text-[#C2A633] hover:text-[#C2A633]/80 transition-colors group font-medium"
                      >
                        <span className="font-mono">Transaction {i + 1}: {hash.slice(0, 10)}...{hash.slice(-8)}</span>
                        <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-white/5 hover:bg-white/10 text-[#C2A633] border border-[#C2A633]/50 hover:border-[#C2A633] font-body font-medium transition-all" 
            onClick={reset}
          >
            Done
          </Button>
        </div>
      )}
      
      {status === "success" && txHash && consolidateTxHashes.length === 0 && (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#C2A633]/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-[#C2A633]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-lg font-display font-semibold text-white mb-2">
                    Unshield Successful!
                  </h4>
                  <p className="text-sm font-body text-white/70 leading-relaxed">
                    Received {withdrawnAmount} {selectedToken}
                    {fee && <span className="text-white/60"> (Fee: {fee} {selectedToken})</span>}
                  </p>
                </div>
                {txHash && (
                  <a 
                    href={`https://blockscout.testnet.dogeos.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#C2A633] hover:text-[#C2A633]/80 transition-colors group font-medium"
                  >
                    <span className="font-body">View transaction on Blockscout</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
                {consolidateTxHashes.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs font-medium text-white/60">
                      Consolidation Transactions ({consolidateTxHashes.length}):
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {consolidateTxHashes.map((hash, i) => (
                        <a 
                          key={hash} 
                          href={`https://blockscout.testnet.dogeos.com/tx/${hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 text-xs text-[#C2A633] hover:text-[#C2A633]/80 transition-colors group font-medium"
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
          <Button 
            className="w-full bg-white/5 hover:bg-white/10 text-[#C2A633] border border-[#C2A633]/50 hover:border-[#C2A633] font-body font-medium transition-all" 
            onClick={reset}
          >
            {consolidateTxHashes.length > 0 ? 'Done' : 'Unshield More'}
          </Button>
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
