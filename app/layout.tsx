import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet-context"
import { TokenProvider } from "@/lib/token-context"
import { AppLoadingProvider } from "@/lib/shielded/app-loading-context"
import { Toaster } from "@/components/ui/toaster"

// Helvetica Neue - Display font for headings, nav, card titles, key moments
const helveticaNeue = localFont({
  src: [
    // Ultra Light
    { path: "./fonts/helvetica-neue/HelveticaNeueUltraLight.otf", weight: "100", style: "normal" },
    // Thin
    { path: "./fonts/helvetica-neue/HelveticaNeueThin.otf", weight: "200", style: "normal" },
    // Light
    { path: "./fonts/helvetica-neue/HelveticaNeueLight.otf", weight: "300", style: "normal" },
    // Regular (Roman)
    { path: "./fonts/helvetica-neue/HelveticaNeueRoman.otf", weight: "400", style: "normal" },
    // Medium
    { path: "./fonts/helvetica-neue/HelveticaNeueMedium.otf", weight: "500", style: "normal" },
    // Bold
    { path: "./fonts/helvetica-neue/HelveticaNeueBold.otf", weight: "700", style: "normal" },
    // Heavy
    { path: "./fonts/helvetica-neue/HelveticaNeueHeavy.otf", weight: "800", style: "normal" },
    // Black
    { path: "./fonts/helvetica-neue/HelveticaNeueBlack.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-display",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  display: "swap",
})

// Graphik - Body font for paragraphs, UI, forms, buttons
// Using regular Graphik variant (not Compact, Condensed, Wide, etc.)
const graphik = localFont({
  src: [
    // Thin
    { path: "./fonts/graphik/Graphik-Thin-Trial.otf", weight: "100", style: "normal" },
    // Extralight
    { path: "./fonts/graphik/Graphik-Extralight-Trial.otf", weight: "200", style: "normal" },
    // Light
    { path: "./fonts/graphik/Graphik-Light-Trial.otf", weight: "300", style: "normal" },
    // Regular
    { path: "./fonts/graphik/Graphik-Regular-Trial.otf", weight: "400", style: "normal" },
    // Medium
    { path: "./fonts/graphik/Graphik-Medium-Trial.otf", weight: "500", style: "normal" },
    // Semibold
    { path: "./fonts/graphik/Graphik-Semibold-Trial.otf", weight: "600", style: "normal" },
    // Bold
    { path: "./fonts/graphik/Graphik-Bold-Trial.otf", weight: "700", style: "normal" },
    // Super
    { path: "./fonts/graphik/Graphik-Super-Trial.otf", weight: "800", style: "normal" },
    // Black
    { path: "./fonts/graphik/Graphik-Black-Trial.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-body",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Private Doge Transactions",
  description: "A decentralized privacy protocol enabling shielded transactions on DogeOS",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
    ],
    apple: [
      { url: '/favicon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1a1a1a",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${helveticaNeue.variable} ${graphik.variable} ${geistMono.variable}`}>
      <body className="font-body antialiased overflow-x-hidden" suppressHydrationWarning>
        <div className="noise-overlay" />
        <WalletProvider>
          <AppLoadingProvider>
            <TokenProvider>
              {children}
              <Toaster />
            </TokenProvider>
          </AppLoadingProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
