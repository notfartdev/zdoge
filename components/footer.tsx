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
      <div className="px-8 md:px-12 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/dogenadologo.png" alt="DogenadoCash" className="w-8 h-8" />
            <span className="font-mono text-xs tracking-widest text-foreground">DOGENADOCASH</span>
          </div>

          {/* Icon Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://docs.dogenado.cash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300"
              title="Documentation"
            >
              <FileText className="w-4 h-4" />
              <span className="font-mono text-xs tracking-widest">Docs</span>
            </a>
            <a
              href="https://x.com/DogenadoCash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300"
              title="X (Twitter)"
            >
              <XIcon className="w-4 h-4" />
              <span className="font-mono text-xs tracking-widest">X</span>
            </a>
            <a
              href="https://dogeos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-[#C2A633] transition-colors duration-300"
              title="DogeOS Website"
            >
              <Globe className="w-4 h-4" />
              <span className="font-mono text-xs tracking-widest">DogeOS</span>
            </a>
          </div>

          {/* Copyright */}
          <p className="font-mono text-xs tracking-widest text-muted-foreground/50">
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
