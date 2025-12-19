"use client"

import type { ReactNode } from "react"

export function SmoothScroll({ children }: { children: ReactNode }) {
  return <div className="scroll-smooth">{children}</div>
}
