"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, AlertTriangle, CheckCircle, Copy, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VerificationData {
  buildId: string
  generated: string
  rootHash: string
  circuitHashes: Record<string, string>
}

interface CircuitVerification {
  name: string
  expectedHash: string
  actualHash: string | null
  status: "pending" | "verifying" | "valid" | "invalid" | "error"
}

export default function VerifyPage() {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [circuitVerifications, setCircuitVerifications] = useState<CircuitVerification[]>([])
  const [overallStatus, setOverallStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Load verification data
    fetch("/build-hash.json")
      .then(res => res.json())
      .then(data => {
        setVerificationData(data)
        if (data.circuitHashes) {
          setCircuitVerifications(
            Object.entries(data.circuitHashes).map(([name, hash]) => ({
              name,
              expectedHash: hash as string,
              actualHash: null,
              status: "pending"
            }))
          )
        }
      })
      .catch(() => {
        // Build hash not generated yet
        setVerificationData(null)
      })
  }, [])

  const verifyCircuits = async () => {
    if (!verificationData?.circuitHashes) return

    setOverallStatus("verifying")
    const results: CircuitVerification[] = []

    for (const [name, expectedHash] of Object.entries(verificationData.circuitHashes)) {
      // Update status to verifying
      setCircuitVerifications(prev => 
        prev.map(c => c.name === name ? { ...c, status: "verifying" } : c)
      )

      try {
        // Fetch the circuit file
        const response = await fetch(`/circuits/shielded/${name}`)
        const buffer = await response.arrayBuffer()
        
        // Calculate SHA-384 hash
        const hashBuffer = await crypto.subtle.digest("SHA-384", buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashBase64 = btoa(String.fromCharCode(...hashArray))
        const actualHash = `sha384-${hashBase64}`

        const isValid = actualHash === expectedHash
        
        results.push({
          name,
          expectedHash,
          actualHash,
          status: isValid ? "valid" : "invalid"
        })

        setCircuitVerifications(prev => 
          prev.map(c => c.name === name ? { ...c, actualHash, status: isValid ? "valid" : "invalid" } : c)
        )
      } catch {
        results.push({
          name,
          expectedHash,
          actualHash: null,
          status: "error"
        })
        
        setCircuitVerifications(prev => 
          prev.map(c => c.name === name ? { ...c, status: "error" } : c)
        )
      }
    }

    // Set overall status
    const allValid = results.every(r => r.status === "valid")
    setOverallStatus(allValid ? "valid" : "invalid")
  }

  const copyHash = () => {
    if (verificationData?.rootHash) {
      navigator.clipboard.writeText(verificationData.rootHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            Frontend Verification
          </h1>
        </div>

        {/* Explanation */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Why Verify?</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            zDoge is a client-side privacy application. Your spending keys never leave your browser.
            This means if the frontend code is compromised, an attacker could steal your funds.
            <br /><br />
            <strong className="text-white">Verification ensures:</strong>
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>The JavaScript code hasn&apos;t been tampered with</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>ZK circuit files are authentic and unmodified</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>You&apos;re running the same code as everyone else</span>
            </li>
          </ul>
        </div>

        {/* Build Info */}
        {verificationData ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Build Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Build ID</label>
                <p className="font-mono text-sm mt-1">{verificationData.buildId || "N/A"}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Generated</label>
                <p className="font-mono text-sm mt-1">
                  {new Date(verificationData.generated).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Root Hash (SHA-384)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-xs bg-zinc-800 px-3 py-2 rounded flex-1 break-all">
                    {verificationData.rootHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyHash}
                    className="flex-shrink-0"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <p>Build hashes not yet generated. Run <code className="bg-zinc-800 px-2 py-0.5 rounded text-xs">npm run build:verify</code></p>
            </div>
          </div>
        )}

        {/* Circuit Verification */}
        {circuitVerifications.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">ZK Circuit Verification</h2>
              <Button
                onClick={verifyCircuits}
                disabled={overallStatus === "verifying"}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {overallStatus === "verifying" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Circuits"
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {circuitVerifications.map((circuit) => (
                <div
                  key={circuit.name}
                  className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg"
                >
                  <span className="font-mono text-sm">{circuit.name}</span>
                  <span>
                    {circuit.status === "pending" && (
                      <span className="text-gray-500 text-sm">Not verified</span>
                    )}
                    {circuit.status === "verifying" && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    )}
                    {circuit.status === "valid" && (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                    {circuit.status === "invalid" && (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    {circuit.status === "error" && (
                      <span className="text-yellow-400 text-sm">Error</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Overall Status */}
            {overallStatus === "valid" && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">All circuits verified successfully!</span>
                </div>
              </div>
            )}
            
            {overallStatus === "invalid" && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">WARNING: Some circuits failed verification!</span>
                </div>
                <p className="text-sm text-red-300 mt-2">
                  Do not use this frontend. The circuit files may have been tampered with.
                </p>
              </div>
            )}
          </div>
        )}

        {/* External Verification */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">External Verification</h2>
          
          <p className="text-gray-400 text-sm mb-4">
            For maximum security, verify using external tools:
          </p>

          <div className="space-y-3">
            <a
              href="https://github.com/DogeProtocol/dogenado"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm">Compare with GitHub source</span>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>
            
            <a
              href="https://docs.zdoge.cash/resources/contract-addresses"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm">Published hashes on docs</span>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>
          </div>

          <div className="mt-6 p-4 bg-zinc-800/30 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Command-line verification:</h3>
            <code className="text-xs bg-zinc-900 px-3 py-2 rounded block overflow-x-auto">
              npx zdoge-verify https://zdoge.cash
            </code>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          zDoge Privacy Protocol - Verify before you trust
        </p>
      </div>
    </main>
  )
}
