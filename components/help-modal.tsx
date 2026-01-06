"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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

interface HelpModalProps {
  variant?: "default" | "icon"
}

export function HelpModal({ variant = "default" }: HelpModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <button
            className="text-muted-foreground hover:text-foreground transition-colors duration-300"
            aria-label="FAQ"
            title="FAQ"
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="max-w-md bg-background/80 backdrop-blur-xl border border-white/10 rounded-lg p-6 shadow-2xl" 
        showCloseButton={false}
      >
        <div className="flex items-center justify-between mb-6">
          <DialogTitle className="text-xl font-display font-semibold text-white">
            FAQ
          </DialogTitle>
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
              <h3 className="font-display font-medium text-sm text-white">
                {index + 1}. {faq.question}
              </h3>
              <p className="font-body text-xs text-white/70 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
