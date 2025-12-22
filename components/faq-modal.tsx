"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FAQItem {
  question: string
  answer: string
}

const faqData: FAQItem[] = [
  {
    question: "How does Dogenado work?",
    answer: "Dogenado uses zero-knowledge proofs and Merkle trees to break the on-chain link between deposits and withdrawals. When you deposit, your funds are added to a privacy pool. When you withdraw, you prove you have a valid deposit without revealing which one.",
  },
  {
    question: "What if observers try to guess based on the amount I deposited or withdrew?",
    answer: "To maximize privacy, wait before withdrawing and consider splitting into different amounts. The longer you wait, the larger the anonymity set becomes, making it harder to link your transactions.",
  },
  {
    question: "What are the fees?",
    answer: "Deposits are free (0% fee). Withdrawals have a 0.5% relayer fee plus gas costs if using the relayer service. You can also submit withdrawals directly for maximum privacy, paying only gas fees.",
  },
  {
    question: "Can I directly withdraw to centralized exchanges or apps?",
    answer: "It's highly recommended that you withdraw to a clean, new non-custodial wallet first. Then send from that wallet to centralized services. This adds an extra privacy layer and prevents direct association.",
  },
  {
    question: "What happens if I lose my secret note?",
    answer: "Your secret note is the only way to withdraw your funds. If you lose it, your funds are permanently unrecoverable. Store your note securely offline and never share it with anyone.",
  },
  {
    question: "Is this safe to use?",
    answer: "Dogenado uses audited smart contracts and proven cryptographic methods. However, this is currently deployed on testnet. Always verify you're on the correct network and never deposit more than you can afford to lose.",
  },
]

export function FAQModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-[#C2A633]/20 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl text-white mb-6">
            Frequently Asked Questions
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {faqData.map((item, index) => (
            <div key={index} className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-[#C2A633]">
                {index + 1}. {item.question}
              </h3>
              <p className="font-mono text-sm text-gray-300 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

