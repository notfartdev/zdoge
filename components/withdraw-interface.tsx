"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/lib/wallet-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function WithdrawInterface() {
  const { wallet } = useWallet()
  const { toast } = useToast()
  const [note, setNote] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)

  const parseNote = (noteString: string) => {
    // Parse format: dogemixer-{amount}-DOGE-{secret}-{nullifier}
    const parts = noteString.split("-")
    if (parts.length !== 5 || parts[0] !== "dogemixer") {
      return null
    }
    return {
      amount: Number.parseInt(parts[1]),
      secret: parts[3],
      nullifier: parts[4],
    }
  }

  const handleWithdraw = async () => {
    if (!note || !recipientAddress) return

    const parsedNote = parseNote(note)
    if (!parsedNote) {
      toast({
        title: "Invalid Note",
        description: "The deposit note format is incorrect.",
        variant: "destructive",
      })
      return
    }

    setIsWithdrawing(true)
    try {
      const response = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedNote.amount,
          secret: parsedNote.secret,
          nullifier: parsedNote.nullifier,
          recipientAddress,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setWithdrawSuccess(true)
        toast({
          title: "Withdrawal Complete",
          description: `Successfully withdrew ${parsedNote.amount} DOGE to your address.`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("[v0] Withdrawal failed:", error)
      toast({
        title: "Withdrawal Failed",
        description: "Failed to process withdrawal. Please check your note and try again.",
        variant: "destructive",
      })
    } finally {
      setIsWithdrawing(false)
    }
  }

  const resetForm = () => {
    setNote("")
    setRecipientAddress("")
    setWithdrawSuccess(false)
  }

  if (withdrawSuccess) {
    return (
      <Card className="bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
        <div className="text-center py-8 space-y-6">
          <CheckCircle2 className="h-16 w-16 text-[#C2A633] mx-auto" />
          <div className="space-y-2">
            <h3 className="font-mono text-2xl font-bold text-white">Withdrawal Successful!</h3>
            <p className="font-mono text-sm text-gray-400">Your DOGE has been sent to the recipient address.</p>
          </div>
          <Button onClick={resetForm} className="bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold">
            Make Another Withdrawal
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-[#C2A633]/20 p-8 rounded-none">
      <div className="space-y-6">
        <Alert className="bg-[#C2A633]/10 border-[#C2A633] text-white">
          <AlertDescription className="font-mono text-sm">
            Paste your deposit note to withdraw your DOGE anonymously to any address.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Label className="font-mono text-sm text-gray-400">Deposit Note</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="dogemixer-100-DOGE-..."
            className="font-mono text-sm bg-black border-[#C2A633]/20 text-white min-h-[100px] resize-none"
          />
        </div>

        <div className="space-y-3">
          <Label className="font-mono text-sm text-gray-400">Recipient DOGE Address</Label>
          <Input
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="D..."
            className="font-mono text-sm bg-black border-[#C2A633]/20 text-white"
          />
        </div>

        <Button
          onClick={handleWithdraw}
          disabled={isWithdrawing || !note || !recipientAddress}
          className="w-full bg-[#C2A633] hover:bg-[#C2A633]/90 text-black font-mono font-bold text-lg py-6"
        >
          {isWithdrawing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Withdrawing...
            </>
          ) : (
            "Withdraw DOGE"
          )}
        </Button>
      </div>
    </Card>
  )
}
