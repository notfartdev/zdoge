"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { HelpCircle, X } from "lucide-react"

const faqs = [
  {
    question: "How does zDoge work?",
    answer: "zDoge uses zero-knowledge proofs and Merkle trees to enable private transactions. Shield tokens to create private notes, transfer them privately, or unshield them back to public addresses."
  },
  {
    question: "What are the fees?",
    answer: "Shield: Free (relayer) or gas fees only. Send/Transfer: ~0.5% relayer fee. Swap: ~0.3% swap fee + 0.5% relayer fee if applicable. Unshield: ~0.5% relayer fee. Direct transactions only require gas fees."
  },
  {
    question: "How do I receive private transfers?",
    answer: "Your wallet automatically discovers incoming transfers via encrypted memos. No manual action needed - just ensure your wallet is connected and the sender has your shielded address."
  },
  {
    question: "Is my spending key secure?",
    answer: "Your spending key is stored locally in your browser. Never share it. Back it up securely offline. If lost, your shielded funds cannot be recovered."
  }
]

export function HelpModal() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-black border-white/10 rounded-lg p-0 overflow-hidden" showCloseButton={false}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-normal font-serif">FAQ</h2>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-medium font-mono text-sm text-white">
                  {index + 1}. {faq.question}
                </h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

