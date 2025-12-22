import { DashboardNav } from "@/components/dashboard-nav"
import { MixerTabs } from "@/components/mixer-tabs"
import { Statistics } from "@/components/statistics"
import { Suspense } from "react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black">
      <DashboardNav />
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          <Suspense fallback={<div className="w-full h-96 bg-black/20 animate-pulse" />}>
            <MixerTabs />
          </Suspense>
          <Statistics />
        </div>
      </main>
    </div>
  )
}
