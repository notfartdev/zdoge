import type React from "react"
import type { Metadata, Viewport } from "next"
import { Playfair_Display, Geist_Mono } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet-context"
import { TokenProvider } from "@/lib/token-context"
import { Toaster } from "@/components/ui/toaster"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "zDoge.cash - Private DOGE Transactions",
  description: "A decentralized privacy protocol enabling shielded transactions on DogeOS",
  icons: {
    icon: [
      { url: '/zdoge-logo.png', type: 'image/png' },
    ],
    apple: '/zdoge-logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased overflow-x-hidden">
        <div className="noise-overlay" />
        <WalletProvider>
          <TokenProvider>
            {children}
            <Toaster />
          </TokenProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
