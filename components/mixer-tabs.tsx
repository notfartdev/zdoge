"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DepositInterface } from "./deposit-interface"
import { WithdrawInterface } from "./withdraw-interface"

export function MixerTabs() {
  return (
    <Tabs defaultValue="deposit" className="w-full">
      <TabsList className="w-full glass-card p-0 h-auto rounded-none transition-all duration-300">
        <TabsTrigger
          value="deposit"
          className="flex-1 font-mono text-base py-5 px-6 data-[state=active]:bg-[#C2A633] data-[state=active]:text-black rounded-none transition-all duration-300 hover:bg-[#C2A633]/10"
        >
          DEPOSIT
        </TabsTrigger>
        <TabsTrigger
          value="withdraw"
          className="flex-1 font-mono text-base py-5 px-6 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-l data-[state=active]:border-[#C2A633]/30 rounded-none transition-all duration-300 hover:bg-white/5"
        >
          WITHDRAW
        </TabsTrigger>
      </TabsList>
      <TabsContent value="deposit" className="mt-0">
        <DepositInterface />
      </TabsContent>
      <TabsContent value="withdraw" className="mt-0">
        <WithdrawInterface />
      </TabsContent>
    </Tabs>
  )
}
