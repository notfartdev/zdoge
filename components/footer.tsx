"use client"

import { useState, useEffect } from "react"
import { ChevronUp } from "lucide-react"

// Social icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

export function Footer() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <footer className="relative border-t border-white/10 bg-[#0a0f0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 sm:py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-8">
          {/* Logo & Copyright */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/zdoge-logo.png" alt="zDoge.cash" className="w-8 h-8 rounded-full" />
              <span className="font-mono text-sm tracking-[0.08em] text-[#C2A633]">zDOGE</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground/60 space-y-1">
              <p>Copyright © {new Date().getFullYear()} zDoge</p>
              <p>All rights reserved.</p>
            </div>
          </div>

          {/* Company Links */}
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-bold text-[#C2A633] italic">Company</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <a
                href="https://docs.zdoge.cash"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Docs
              </a>
              <a
                href="/terms"
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <span className="font-mono text-xs text-muted-foreground/50">
                API <span className="text-[10px]">(Coming Soon)</span>
              </span>
              <a
                href="/privacy"
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Socials */}
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-bold text-[#C2A633] italic">Socials</h3>
            <div className="space-y-3">
              <a
                href="https://x.com/zDogeCash"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <XIcon className="w-4 h-4 group-hover:text-[#C2A633] transition-colors" />
                Twitter
              </a>
              <a
                href="https://discord.gg/gzPNefTMq2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <DiscordIcon className="w-4 h-4 group-hover:text-[#C2A633] transition-colors" />
                Discord
              </a>
              <a
                href="https://t.me/zdogecsh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <TelegramIcon className="w-4 h-4 group-hover:text-[#C2A633] transition-colors" />
                Telegram
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#C2A633] text-black flex items-center justify-center shadow-lg hover:bg-[#C2A633]/90 transition-all duration-300 hover:scale-110 z-50"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </footer>
  )
}
