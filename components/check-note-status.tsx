"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, AlertCircle, Search, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { parseNote, isValidNoteFormat } from "@/lib/note-service"
import { toBytes32 } from "@/lib/mimc"
import { isNullifierSpent } from "@/lib/proof-service"
import { tokenPools, links, type SupportedToken } from "@/lib/dogeos-config"

type CheckStatus = 'idle' | 'checking' | 'available' | 'withdrawn' | 'error'

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

export function CheckNoteStatus() {
  const { toast } = useToast()
  const [noteInput, setNoteInput] = useState("")
  const [status, setStatus] = useState<CheckStatus>('idle')
  const [error, setError] = useState("")
  const [noteInfo, setNoteInfo] = useState<{
    token: string
    amount: number
    poolAddress: string
    nullifierHash: string
  } | null>(null)

  const handleCheck = async () => {
    if (!noteInput.trim()) {
      setError("Please enter your deposit note")
      return
    }

    if (!isValidNoteFormat(noteInput)) {
      setError("Invalid note format. Expected: zdoge-1-<pool>-<secret>-<nullifier>")
      return
    }

    setError("")
    setStatus('checking')
    setNoteInfo(null)

    try {
      // Parse the note
      const note = await parseNote(noteInput)
      
      // Get pool info
      const poolInfo = getPoolFromId(note.pool)
      if (!poolInfo) {
        setError("Unknown pool. Could not determine token and amount.")
        setStatus('error')
        return
      }

      // Get nullifier hash
      const nullifierHashHex = toBytes32(note.nullifierHash)
      
      setNoteInfo({
        token: poolInfo.token,
        amount: poolInfo.amount,
        poolAddress: poolInfo.address,
        nullifierHash: nullifierHashHex,
      })

      // Check if nullifier is spent
      const isSpent = await isNullifierSpent(poolInfo.address, nullifierHashHex)
      
      if (isSpent) {
        setStatus('withdrawn')
        toast({
          title: "Note Already Used",
          description: "This deposit has already been withdrawn.",
          variant: "destructive",
        })
      } else {
        setStatus('available')
        toast({
          title: "Note Available",
          description: "This deposit has not been withdrawn yet.",
        })
      }
    } catch (err: any) {
      setError(err.message || "Failed to check note status")
      setStatus('error')
    }
  }

  const resetForm = () => {
    setNoteInput("")
    setStatus('idle')
    setError("")
    setNoteInfo(null)
  }

  return (
    <Card className="bg-zinc-900 border-[#C2A633]/20 p-6 rounded-none">
      <div className="space-y-6">
        {/* Input Section */}
        <div className="space-y-3">
          <Label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Your Deposit Note
          </Label>
          <Textarea
            value={noteInput}
            onChange={(e) => {
              setNoteInput(e.target.value)
              setError("")
              setStatus('idle')
              setNoteInfo(null)
            }}
            placeholder="zdoge-1-usdc100-abc123...def456..."
            disabled={status === 'checking'}
            className="font-mono text-xs bg-black border-[#C2A633]/20 text-white min-h-[100px] resize-none"
          />
          <p className="text-[10px] font-mono text-gray-600">
            Paste your secret note to check if it has been withdrawn
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert className="bg-red-500/10 border-red-500 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Status Results */}
        {status === 'available' && noteInfo && (
          <div className="p-6 bg-green-500/10 border border-green-500/30 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="font-mono text-xl font-bold text-green-400">Available</h3>
              <p className="font-mono text-sm text-gray-400 mt-1">
                This note has NOT been withdrawn yet
              </p>
            </div>
            <div className="p-3 bg-black/50 text-left space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-gray-500">Amount:</span>
                <span className="text-white">{noteInfo.amount} {noteInfo.token}</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-gray-500">Pool:</span>
                <span className="text-gray-400">{noteInfo.poolAddress.slice(0, 10)}...{noteInfo.poolAddress.slice(-8)}</span>
              </div>
            </div>
            <p className="font-mono text-[10px] text-gray-500">
              You can still withdraw these funds using your note
            </p>
          </div>
        )}

        {status === 'withdrawn' && noteInfo && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="font-mono text-xl font-bold text-red-400">Already Withdrawn</h3>
              <p className="font-mono text-sm text-gray-400 mt-1">
                This deposit has already been claimed
              </p>
            </div>
            <div className="p-3 bg-black/50 text-left space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-gray-500">Amount:</span>
                <span className="text-white">{noteInfo.amount} {noteInfo.token}</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-gray-500">Pool:</span>
                <span className="text-gray-400">{noteInfo.poolAddress.slice(0, 10)}...{noteInfo.poolAddress.slice(-8)}</span>
              </div>
            </div>
            <p className="font-mono text-[10px] text-gray-500">
              This note cannot be used again
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {status === 'available' || status === 'withdrawn' ? (
            <Button
              onClick={resetForm}
              className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold"
            >
              Check Another Note
            </Button>
          ) : (
            <Button
              onClick={handleCheck}
              disabled={status === 'checking' || !noteInput.trim()}
              className="flex-1 h-12 bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold disabled:opacity-50"
            >
              {status === 'checking' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Check Status
                </>
              )}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="p-3 bg-zinc-950 border border-zinc-800 text-center">
          <p className="font-mono text-[10px] text-gray-500">
            Your note is never sent to any server. The check is performed locally using blockchain data.
          </p>
        </div>
      </div>
    </Card>
  )
}

