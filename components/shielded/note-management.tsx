"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield, Trash2, RefreshCw, Eye, EyeOff } from "lucide-react"
import { ShieldedNote, formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { getNotes, clearNotes, syncNotesWithChain } from "@/lib/shielded/shielded-service"
import { shieldedPool } from "@/lib/dogeos-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmationDialog } from "./confirmation-dialog"
import { useToast } from "@/hooks/use-toast"

interface NoteManagementProps {
  className?: string
  onNotesChange?: () => void
}

export function NoteManagement({ className, onNotesChange }: NoteManagementProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<ShieldedNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [filterToken, setFilterToken] = useState<string>("all")
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({})
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const loadNotes = () => {
    setIsLoading(true)
    try {
      const allNotes = getNotes()
      setNotes(allNotes)
    } catch (error) {
      console.error("[NoteManagement] Failed to load notes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
    
    // Listen for note updates
    const handleUpdate = () => {
      loadNotes()
      onNotesChange?.()
    }
    
    window.addEventListener('shielded-wallet-updated', handleUpdate)
    return () => window.removeEventListener('shielded-wallet-updated', handleUpdate)
  }, [onNotesChange])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncNotesWithChain(shieldedPool.address)
      loadNotes()
      toast({
        title: "Notes Synced",
        description: "Successfully synced notes with blockchain",
      })
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync notes",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleClear = async () => {
    try {
      clearNotes()
      loadNotes()
      onNotesChange?.()
      toast({
        title: "Notes Cleared",
        description: "All notes have been cleared from local storage",
      })
    } catch (error: any) {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear notes",
        variant: "destructive",
      })
    }
    setClearDialogOpen(false)
  }

  const filteredNotes = notes.filter(note => 
    filterToken === "all" || (note.token || 'DOGE') === filterToken
  )

  const tokens = Array.from(new Set(notes.map(n => n.token || 'DOGE')))

  const getTotalBalance = (token: string) => {
    return notes
      .filter(n => (n.token || 'DOGE') === token)
      .reduce((sum, n) => sum + n.amount, 0n)
  }

  return (
    <>
      <Card className={`bg-zinc-900 border-[#C2A633]/20 ${className}`}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-white text-base sm:text-lg">Shielded Notes</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-8 flex-1 sm:flex-none bg-zinc-800 border-zinc-700 text-xs sm:text-sm"
            >
              {isSyncing ? (
                <Loader2 className="h-3 w-3 mr-1 sm:mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1 sm:mr-2" />
              )}
              Sync
            </Button>
            {notes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearDialogOpen(true)}
                className="h-8 flex-1 sm:flex-none bg-zinc-800 border-zinc-700 text-red-400 hover:bg-red-500/10 text-xs sm:text-sm"
              >
                <Trash2 className="h-3 w-3 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Clear All</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2">
          <Select value={filterToken} onValueChange={setFilterToken}>
            <SelectTrigger className="w-full sm:w-32 h-8 bg-zinc-800 border-zinc-700 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tokens</SelectItem>
                {tokens.map(token => (
                  <SelectItem key={token} value={token}>
                    {token}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs sm:text-sm text-gray-400">
              {notes.length} note{notes.length !== 1 ? 's' : ''}
              {filterToken !== "all" && (
                <span className="hidden sm:inline"> • {formatWeiToAmount(getTotalBalance(filterToken), 18).toFixed(4)} {filterToken}</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#C2A633]" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shielded notes found</p>
              <p className="text-sm mt-2">Shield tokens to create notes</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
              {filteredNotes.map((note, index) => {
                const noteId = note.commitment.toString()
                const decimals = note.decimals ?? 18
                const token = note.token || 'DOGE'
                const amountFormatted = formatWeiToAmount(note.amount, decimals)
                const isVisible = showDetails[noteId] || false

                return (
                  <div
                    key={noteId}
                    className="p-2 sm:p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-[#C2A633]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#C2A633]/20 flex items-center justify-center text-[#C2A633]">
                          <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <p className="text-xs sm:text-sm font-medium text-white truncate">
                              {amountFormatted} {token}
                            </p>
                            {note.leafIndex !== undefined ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                Confirmed
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                          {note.leafIndex !== undefined && (
                            <div className="text-xs text-gray-400">
                              Leaf Index: {note.leafIndex}
                            </div>
                          )}
                          {isVisible && (
                            <div className="mt-2 p-2 rounded bg-zinc-900/50 border border-zinc-700/50">
                              <div className="text-xs space-y-1 font-mono">
                                <div className="text-gray-400">
                                  <span className="text-gray-500">Commitment:</span>{" "}
                                  <span className="text-gray-300">{note.commitment.toString().slice(0, 20)}...</span>
                                </div>
                                <div className="text-gray-400">
                                  <span className="text-gray-500">Owner:</span>{" "}
                                  <span className="text-gray-300">{note.ownerPubkey.toString().slice(0, 20)}...</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => setShowDetails({ ...showDetails, [noteId]: !isVisible })}
                      >
                        {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Clear All Notes"
        description="This will remove all notes from local storage. You will need to re-sync or re-shield to see them again. Your on-chain notes are safe."
        confirmText="Clear All"
        cancelText="Cancel"
        onConfirm={handleClear}
        variant="destructive"
      />
    </>
  )
}
