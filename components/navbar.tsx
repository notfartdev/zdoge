"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navLinks = [
  { label: "Mix", href: "#mix" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Privacy Tips", href: "#privacy" },
]

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const isHomePage = pathname === "/"

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (href: string) => {
    setIsMenuOpen(false)
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : ""
        }`}
      >
        <nav className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 my-0 md:px-12 md:py-5">
          <Link href="/" className="group flex items-center gap-2 sm:gap-3 min-h-[44px]">
            <img src="/dogenadologo.png" alt="Dogenado" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
            <span className="font-mono text-xs sm:text-sm tracking-widest text-foreground">DOGENADO</span>
          </Link>

          {/* Desktop Navigation - Removed per design */}

          <div className="hidden md:flex items-center gap-3">
            {isHomePage ? (
              <Link href="/dashboard">
                <button className="px-6 py-2 bg-[#C2A633] text-black font-mono text-xs tracking-wider font-bold hover:bg-[#C2A633]/90 transition-colors">
                  LAUNCH MIXER
                </button>
              </Link>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C2A633] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C2A633]" />
                </span>
                <span className="font-mono text-xs tracking-wider text-muted-foreground">SECURE • NON-CUSTODIAL</span>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden relative w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center justify-center gap-1.5 min-h-[44px] min-w-[44px]"
            aria-label="Toggle menu"
          >
            <motion.span
              animate={isMenuOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center"
            />
            <motion.span
              animate={isMenuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
              className="w-6 h-px bg-foreground"
            />
            <motion.span
              animate={isMenuOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center"
            />
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-lg md:hidden"
          >
            <nav className="flex flex-col items-center justify-center h-full gap-8">
              {isHomePage ? (
                <>
                  {navLinks.map((link, index) => (
                    <motion.button
                      key={link.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => scrollToSection(link.href)}
                      className="group text-4xl font-sans tracking-tight text-foreground"
                    >
                      <span className="text-[#C2A633] font-mono text-sm mr-2">0{index + 1}</span>
                      {link.label}
                    </motion.button>
                  ))}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <Link href="/dashboard">
                      <button className="px-6 sm:px-8 py-3 sm:py-4 bg-[#C2A633] text-black font-mono text-xs sm:text-sm tracking-wider font-bold min-h-[44px]">
                        LAUNCH MIXER
                      </button>
                    </Link>
                  </motion.div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Link href="/">
                    <button className="text-4xl font-sans tracking-tight text-foreground">
                      <span className="text-[#C2A633] font-mono text-sm mr-2">01</span>
                      Back to Home
                    </button>
                  </Link>
                </motion.div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
