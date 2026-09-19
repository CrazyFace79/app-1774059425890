"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useHistoryStore } from "@/store/history-store"
import { useMetaStore } from "@/store/meta-store"
import { useLyricsStore } from "@/store/lyrics-store"
import type { HistoryEntry } from "@/lib/database"
import { Search, Pin, Copy, RotateCcw, Trash2, Download, Eye, Filter } from "lucide-react"

export function HistoryTab() {
  const { toast } = useToast()
  const {
    entries,
    isLoading,
    searchQuery,
    filterPinned,
    loadHistory,
    removeEntry,
    togglePin,
    clearHistory,
    setSearchQuery,
    setFilterPinned,
    getFilteredEntries,
    exportHistoryCSV,
    exportHistoryJSON,
  } = useHistoryStore()

  const { setPresetId, setBpm, setKey, setStyle } = useMetaStore()
  const { setSections, setStyleLine } = useLyricsStore()

  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handlePreview = (entry: HistoryEntry) => {
    setSelectedEntry(entry)
    setIsPreviewOpen(true)
  }

  const handleCopy = async (entry: HistoryEntry, type: "style" | "lyrics" | "combined") => {
    let text = ""
    switch (type) {
      case "style":
        text = entry.style
        break
      case "lyrics":
        text = entry.lyrics
        break
      case "combined":
        text = `STYLE: ${entry.style}\n\nLYRICS:\n${entry.lyrics}`
        break
    }

    await navigator.clipboard.writeText(text)
    toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard` })
  }

  const handleRestore = (entry: HistoryEntry) => {
    setPresetId(entry.presetId)
    setBpm(entry.bpm)
    setKey(entry.key)

    setStyle(entry.style)
    setStyleLine(entry.style)

    // Parse lyrics back to sections
    const sections = entry.lyrics.split("\n\n").map((section) => {
      const lines = section.split("\n")
      const title = lines[0].replace(/[[\]]/g, "")
      const content = lines.slice(1).join("\n")
      return { title, content }
    })
    setSections(sections)

    toast({ title: "Project restored from history" })
  }

  const handleDelete = async (id: string) => {
    await removeEntry(id)
    toast({ title: "Entry deleted from history" })
  }

  const handleTogglePin = async (id: string) => {
    await togglePin(id)
    toast({ title: "Entry pin status updated" })
  }

  const handleExportCSV = () => {
    const csvData = exportHistoryCSV()
    const blob = new Blob([csvData], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vdamm_history_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "History exported as CSV" })
  }

  const handleExportJSON = () => {
    const jsonData = exportHistoryJSON()
    const blob = new Blob([jsonData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vdamm_history_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "History exported as JSON" })
  }

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      await clearHistory()
      toast({ title: "History cleared" })
    }
  }

  const filteredEntries = getFilteredEntries()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Project History
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportJSON} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <Button onClick={handleClearHistory} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="filter-pinned" checked={filterPinned} onCheckedChange={setFilterPinned} />
              <Label htmlFor="filter-pinned" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Pinned only
              </Label>
            </div>
            <Badge variant="secondary">
              {filteredEntries.length} entr{filteredEntries.length !== 1 ? "ies" : "y"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading history...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No history entries found</div>
        ) : (
          filteredEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{new Date(entry.timestamp).toLocaleString()}</Badge>
                      <Badge variant="secondary">{entry.bpm} BPM</Badge>
                      <Badge variant="secondary">{entry.key}</Badge>
                      <Badge variant="outline">{entry.presetId}</Badge>
                      {entry.pinned && <Pin className="w-4 h-4 text-yellow-500" />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">STYLE:</p>
                        <p className="text-sm bg-muted p-2 rounded truncate">{entry.style}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">LYRICS:</p>
                        <p className="text-sm bg-muted p-2 rounded truncate">{entry.lyrics.split("\n")[0]}...</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(entry)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(entry, "style")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRestore(entry)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleTogglePin(entry.id)}>
                      <Pin className={`w-4 h-4 ${entry.pinned ? "text-yellow-500" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>History Entry Preview</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{new Date(selectedEntry.timestamp).toLocaleString()}</Badge>
                <Badge variant="secondary">{selectedEntry.bpm} BPM</Badge>
                <Badge variant="secondary">{selectedEntry.key}</Badge>
                <Badge variant="outline">{selectedEntry.presetId}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">STYLE</h3>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(selectedEntry, "style")}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-muted p-4 rounded text-sm">{selectedEntry.style}</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">LYRICS</h3>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(selectedEntry, "lyrics")}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-muted p-4 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {selectedEntry.lyrics}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleCopy(selectedEntry, "combined")}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Combined
                </Button>
                <Button onClick={() => handleRestore(selectedEntry)}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Project
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
