"use client"

import { useState, useEffect } from "react"

export function Footer() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, "0")
      const minutes = now.getMinutes().toString().padStart(2, "0")
      const seconds = now.getSeconds().toString().padStart(2, "0")
      const milliseconds = now.getMilliseconds().toString().padStart(3, "0")
      setTime(`${hours}:${minutes}:${seconds}.${milliseconds}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 10)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="relative border-t border-white/10">
      {/* Footer Info */}
      <div className="px-8 md:px-12 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#C2A633] flex items-center justify-center text-black font-bold text-sm">
              Ð
            </div>
            <span className="font-mono text-xs tracking-widest text-foreground">DOGEMIXER</span>
          </div>

          {/* Links */}
          <div className="flex gap-8">
            {["Docs", "GitHub", "Community"].map((link) => (
              <a
                key={link}
                href="#"
                data-cursor-hover
                className="font-mono text-xs tracking-widest text-muted-foreground hover:text-white transition-colors duration-300"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <p className="font-mono text-xs tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} • OPEN SOURCE
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="font-mono text-xs text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
            DogeMixer is experimental software. Use at your own risk. Always comply with local regulations. This is a
            demonstration interface inspired by privacy-preserving technologies.
          </p>
        </div>
      </div>
    </footer>
  )
}
