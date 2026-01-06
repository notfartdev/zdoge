"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { ShieldedHeader, useShieldedState } from "@/components/shielded/shielded-header"
import { ShieldInterface } from "@/components/shielded/shield-interface"
import { TransferInterface } from "@/components/shielded/transfer-interface"
import { SwapInterface } from "@/components/shielded/swap-interface"
import { UnshieldInterface } from "@/components/shielded/unshield-interface"
import { ReceiveInterface } from "@/components/receive-interface"
import { ActivityInterface } from "@/components/activity-interface"
import { Loader2, Shield, Send, ArrowLeftRight, ShieldOff, QrCode, Activity } from "lucide-react"

function AppCardContent() {
  const { notes, refresh } = useShieldedState()
  const searchParams = useSearchParams()
  
  // Get initial tab from URL params (for deep linking)
  const tabParam = searchParams.get('tab')
  const validTabs = ['shield', 'send', 'swap', 'unshield', 'receive', 'activity']
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'shield'
  
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedToken, setSelectedToken] = useState<string>(() => {
    const tokenParam = searchParams.get('token')
    const validTokens = ['DOGE', 'USDC', 'USDT', 'USD1', 'WETH', 'LBTC']
    return (tokenParam && validTokens.includes(tokenParam.toUpperCase())) ? tokenParam.toUpperCase() : "DOGE"
  })
  const [key, setKey] = useState(0)

  const handleSuccess = () => {
    refresh()
    if (activeTab === 'shield' || activeTab === 'swap') {
      setKey(k => k + 1)
    }
  }

  return (
    <Card className="p-6 sm:p-8 bg-white/[0.03] border border-white/10 backdrop-blur-sm rounded-2xl shadow-xl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Top Tabs */}
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 p-0 h-auto bg-transparent border-b border-white/10 rounded-none mb-6 overflow-x-auto">
          <TabsTrigger
            value="shield"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Shield"
          >
            <Shield className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
          <TabsTrigger
            value="send"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Send"
          >
            <Send className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
          <TabsTrigger
            value="swap"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Swap"
          >
            <ArrowLeftRight className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
          <TabsTrigger
            value="unshield"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Unshield"
          >
            <ShieldOff className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
          <TabsTrigger
            value="receive"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Receive"
          >
            <QrCode className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="flex-1 flex items-center justify-center py-3 sm:py-4 data-[state=active]:bg-transparent data-[state=active]:text-[#C2A633] data-[state=active]:border-b-2 data-[state=active]:border-[#C2A633] rounded-none transition-all duration-300 hover:text-white/80"
            title="Activity"
          >
            <Activity className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </TabsTrigger>
        </TabsList>

        {/* Shield Tab */}
        <TabsContent value="shield" className="mt-0 space-y-6">
          <ShieldedHeader 
            onStateChange={refresh} 
            selectedToken={selectedToken} 
            onTokenChange={setSelectedToken}
            connectDescription="Connect your wallet to shield tokens"
          />
          <ShieldInterface 
            key={key}
            onSuccess={handleSuccess} 
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="mt-0 space-y-6">
          <ShieldedHeader 
            onStateChange={refresh} 
            selectedToken={selectedToken} 
            onTokenChange={setSelectedToken}
            compact
            connectDescription="Connect your wallet to send shielded tokens"
          />
          <TransferInterface 
            notes={notes} 
            onSuccess={handleSuccess}
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </TabsContent>

        {/* Swap Tab */}
        <TabsContent value="swap" className="mt-0 space-y-6">
          <ShieldedHeader 
            onStateChange={refresh} 
            selectedToken={selectedToken} 
            onTokenChange={setSelectedToken}
            compact
            connectDescription="Connect your wallet to swap shielded tokens"
          />
          <SwapInterface 
            key={key}
            notes={notes} 
            onSuccess={handleSuccess}
            onInputTokenChange={(token) => {
              setSelectedToken(token)
            }}
          />
        </TabsContent>

        {/* Unshield Tab */}
        <TabsContent value="unshield" className="mt-0 space-y-6">
          <ShieldedHeader 
            onStateChange={refresh} 
            selectedToken={selectedToken} 
            onTokenChange={setSelectedToken}
            compact
            connectDescription="Connect your wallet to unshield tokens"
          />
          <UnshieldInterface 
            notes={notes} 
            onSuccess={handleSuccess}
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </TabsContent>

        {/* Receive Tab */}
        <TabsContent value="receive" className="mt-0">
          <ReceiveInterface />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-0">
          <ActivityInterface />
        </TabsContent>
      </Tabs>
    </Card>
  )
}

export function AppCard() {
  return (
    <Suspense
      fallback={
        <Card className="p-6 sm:p-8 bg-white/[0.03] border border-white/10 backdrop-blur-sm rounded-2xl shadow-xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-[#C2A633] animate-spin" />
          </div>
        </Card>
      }
    >
      <AppCardContent />
    </Suspense>
  )
}

