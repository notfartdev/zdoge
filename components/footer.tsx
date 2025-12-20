"use client"

import { FileText, Globe } from "lucide-react"

// X/Twitter icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="relative border-t border-[#C2A633]/20">
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/dogenadologo.png" alt="DogenadoCash" className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="font-mono text-[10px] sm:text-xs tracking-widest text-foreground">DOGENADOCASH</span>
          </div>

          {/* Icon Links */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <a
              href="https://docs.dogenado.cash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300 min-h-[44px] min-w-[44px] justify-center"
              title="Documentation"
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono text-[10px] sm:text-xs tracking-widest">Docs</span>
            </a>
            <a
              href="https://x.com/DogenadoCash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300 min-h-[44px] min-w-[44px] justify-center"
              title="X (Twitter)"
            >
              <XIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono text-[10px] sm:text-xs tracking-widest">X</span>
            </a>
            <a
              href="https://dogeos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300 min-h-[44px] min-w-[44px] justify-center"
              title="DogeOS Website"
            >
              <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono text-[10px] sm:text-xs tracking-widest">DogeOS</span>
            </a>
          </div>

          {/* Copyright */}
          <p className="font-mono text-[10px] sm:text-xs tracking-widest text-muted-foreground/50 text-center sm:text-left">
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
