"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  FileText, 
  Import, 
  Clock, 
  Copy, 
  Check,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShieldedNote, formatWeiToAmount, noteToShareableString } from "@/lib/shielded/shielded-note"
import { importReceivedNote } from "@/lib/shielded/shielded-service"

interface ShieldedNotesListProps {
  notes: ShieldedNote[]
  onRefresh?: () => void
}

export function ShieldedNotesList({ notes, onRefresh }: ShieldedNotesListProps) {
  const { toast } = useToast()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importString, setImportString] = useState("")
  const [importing, setImporting] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  
  const handleImport = async () => {
    if (!importString.trim()) {
      toast({
        title: "No Note Provided",
        description: "Please paste a note to import",
        variant: "destructive",
      })
      return
    }
    
    try {
      setImporting(true)
      
      const note = await importReceivedNote(importString.trim())
      
      toast({
        title: "Note Imported!",
        description: `Added ${formatWeiToAmount(note.amount).toFixed(4)} DOGE to your shielded balance`,
      })
      
      setImportDialogOpen(false)
      setImportString("")
      onRefresh?.()
      
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Invalid note format",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
    }
  }
  
  const copyNoteString = async (note: ShieldedNote, index: number) => {
    const noteString = noteToShareableString(note)
    await navigator.clipboard.writeText(noteString)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Shielded Notes</CardTitle>
            <CardDescription>Your private UTXO-like coins</CardDescription>
          </div>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Import className="h-4 w-4 mr-2" />
                Import Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Received Note</DialogTitle>
                <DialogDescription>
                  Paste a note that was shared with you to add it to your wallet
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Only import notes from trusted sources. The note must be addressed
                    to your shielded address.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label htmlFor="noteString">Note String</Label>
                  <Input
                    id="noteString"
                    placeholder="zdoge-note-v1-..."
                    value={importString}
                    onChange={(e) => setImportString(e.target.value)}
                  />
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? "Importing..." : "Import Note"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No shielded notes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Shield some DOGE or import a received note
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {formatWeiToAmount(note.amount).toFixed(4)} {note.token}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(note.createdAt)}
                      {note.leafIndex !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          #{note.leafIndex}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyNoteString(note, index)}
                >
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


