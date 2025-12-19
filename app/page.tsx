import { Navbar } from "@/components/navbar"
import { MixerInterface } from "@/components/mixer-interface"
import { HowItWorks } from "@/components/how-it-works"
import { PrivacyTips } from "@/components/privacy-tips"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { SmoothScroll } from "@/components/smooth-scroll"

export default function Home() {
  return (
    <SmoothScroll>
      <CustomCursor />
      <Navbar />
      <main className="min-h-screen">
        <MixerInterface />
        <HowItWorks />
        <PrivacyTips />
        <Footer />
      </main>
    </SmoothScroll>
  )
}
