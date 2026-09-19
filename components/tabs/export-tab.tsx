"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, FileText, FileJson, FileSpreadsheet, Music } from "lucide-react"
import { useLyricsStore } from "@/store/lyrics-store"
import { useMetaStore } from "@/store/meta-store"
import { useHistoryStore } from "@/store/history-store"
import { useToast } from "@/hooks/use-toast"
import { formatLyricsForExport, downloadFile, formatTimestamp } from "@/lib/utils"
import {
  MidiWriter,
  FL_STRUCTURE_MARKERS,
  generateGhostKickNotes,
  generateRollingBassNotes,
  generateSupersawChordNotes,
  generateHatsClapNotes,
  generateFXRiserNotes,
} from "@/src/lib/midi-writer"
import { useState } from "react"

export function ExportTab() {
  const { sections } = useLyricsStore()
  const { generateStyleLine, bpm, key, vocal, era, mood, presetId, referenceArtists, referenceNotes } = useMetaStore()
  const { entries } = useHistoryStore()
  const { toast } = useToast()
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const styleLine = generateStyleLine()
  const lyricsText = formatLyricsForExport(sections)
  const combinedText = `STYLE: ${styleLine}\n\nLYRICS:\n${lyricsText}`

  const withErrorHandling = async (actionName: string, testId: string, action: () => Promise<void> | void) => {
    setLoadingStates((prev) => ({ ...prev, [testId]: true }))
    try {
      await action()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[v0] Export failed: ${actionName}`, error)
      toast({
        title: "Export Failed",
        description: `${actionName} failed: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setLoadingStates((prev) => ({ ...prev, [testId]: false }))
    }
  }

  const copyToClipboard = async (text: string, type: string, testId: string) => {
    await withErrorHandling(`Copy ${type}`, testId, async () => {
      if (!text || text.trim().length === 0) {
        throw new Error("No content to copy")
      }
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      })
    })
  }

  const downloadTxtFile = async () => {
    await withErrorHandling("Download TXT", "download-txt", async () => {
      if (!combinedText || combinedText.trim().length === 0) {
        throw new Error("No content to export")
      }
      const timestamp = formatTimestamp(new Date())
      const filename = `${timestamp}_suno_lyrics.txt`
      downloadFile(combinedText, filename, "text/plain")
      toast({
        title: "Downloaded!",
        description: `File saved as ${filename}`,
      })
    })
  }

  const downloadJsonProject = async () => {
    await withErrorHandling("Download JSON Project", "download-json", async () => {
      const currentMeta = useMetaStore.getState()
      const projectData = {
        metadata: {
          bpm: currentMeta.bpm,
          key: currentMeta.key,
          vocal: currentMeta.vocal,
          era: currentMeta.era,
          mood: currentMeta.mood,
          presetId: currentMeta.presetId,
          referenceArtists: currentMeta.referenceArtists,
          referenceNotes: currentMeta.referenceNotes,
          exportedAt: new Date().toISOString(),
          version: "1.0.0",
        },
        lyrics: sections,
        style: styleLine,
        combined: combinedText,
      }

      const timestamp = formatTimestamp(new Date())
      const filename = `${timestamp}_vdamm_project.json`
      downloadFile(JSON.stringify(projectData, null, 2), filename, "application/json")
      toast({
        title: "Downloaded!",
        description: `Project saved as ${filename}`,
      })
    })
  }

  const downloadHistoryCsv = async () => {
    await withErrorHandling("Export History CSV", "export-history-csv", async () => {
      if (entries.length === 0) {
        throw new Error("No history entries to export")
      }
      const headers = ["id", "timestamp", "bpm", "key", "preset", "lengthChars"]
      const csvRows = [
        headers.join(","),
        ...entries.map((entry) =>
          [
            entry.id,
            new Date(entry.timestamp).toISOString(),
            entry.bpm,
            entry.key,
            entry.presetId || "custom",
            entry.combined.length,
          ].join(","),
        ),
      ]

      const csvContent = csvRows.join("\n")
      const timestamp = formatTimestamp(new Date())
      const filename = `${timestamp}_vdamm_history.csv`
      downloadFile(csvContent, filename, "text/csv")
      toast({
        title: "Downloaded!",
        description: `History exported as ${filename}`,
      })
    })
  }

  const downloadStructureMidi = async () => {
    await withErrorHandling("Export Structure MIDI", "export-structure", async () => {
      const currentBpm = useMetaStore.getState().bpm
      const writer = new MidiWriter(currentBpm)
      const midiData = writer.generateStructureMidi(FL_STRUCTURE_MARKERS)

      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      if (blob.size === 0) {
        throw new Error("Generated blob is empty")
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_structure_${currentBpm}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Structure MIDI exported for FL Studio",
      })
    })
  }

  const downloadGhostKickMidi = async () => {
    await withErrorHandling("Export Ghost Kick MIDI", "export-ghost", async () => {
      const currentBpm = useMetaStore.getState().bpm
      const writer = new MidiWriter(currentBpm)
      const notes = generateGhostKickNotes()

      if (!notes || notes.length === 0) {
        throw new Error("No ghost kick notes generated")
      }

      const midiData = writer.generateGhostKickMidi(notes)
      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_ghost_kick_${currentBpm}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Ghost kick pattern reference",
      })
    })
  }

  const downloadRollingBassMidi = async () => {
    await withErrorHandling("Export Rolling Bass MIDI", "export-rolling", async () => {
      const currentMeta = useMetaStore.getState()
      const writer = new MidiWriter(currentMeta.bpm)
      const notes = generateRollingBassNotes(currentMeta.bpm, currentMeta.key)

      if (!notes || notes.length === 0) {
        throw new Error("No rolling bass notes generated")
      }

      const midiData = writer.generateInstrumentMidi(notes, 1, currentMeta.bpm)
      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_rolling_bass_${currentMeta.bpm}_${currentMeta.key.replace(" ", "_")}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Rolling bass pattern",
      })
    })
  }

  const downloadSupersawChordsMidi = async () => {
    await withErrorHandling("Export Supersaw Chords MIDI", "export-chords", async () => {
      const currentMeta = useMetaStore.getState()
      const writer = new MidiWriter(currentMeta.bpm)
      const notes = generateSupersawChordNotes(currentMeta.bpm, currentMeta.key)

      if (!notes || notes.length === 0) {
        throw new Error("No supersaw chord notes generated")
      }

      const midiData = writer.generateInstrumentMidi(notes, 2, currentMeta.bpm)
      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_supersaw_chords_${currentMeta.bpm}_${currentMeta.key.replace(" ", "_")}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Supersaw chord progression",
      })
    })
  }

  const downloadHatsClapMidi = async () => {
    await withErrorHandling("Export Hats+Clap MIDI", "export-hatsclap", async () => {
      const currentBpm = useMetaStore.getState().bpm
      const writer = new MidiWriter(currentBpm)
      const notes = generateHatsClapNotes(currentBpm)

      if (!notes || notes.length === 0) {
        throw new Error("No hats/clap notes generated")
      }

      const midiData = writer.generateMultiChannelMidi(notes)
      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_hats_clap_${currentBpm}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Multi-channel hats and claps",
      })
    })
  }

  const downloadFXRiserMidi = async () => {
    await withErrorHandling("Export FX Riser MIDI", "export-riser", async () => {
      const currentBpm = useMetaStore.getState().bpm
      const writer = new MidiWriter(currentBpm)
      const { notes, controlChanges, pitchBends } = generateFXRiserNotes(currentBpm)

      if (!notes || notes.length === 0) {
        throw new Error("No FX riser notes generated")
      }

      const midiData = writer.generateMultiChannelMidi(notes, controlChanges, pitchBends)
      if (!midiData || midiData.byteLength === 0) {
        throw new Error("Generated MIDI data is empty")
      }

      const blob = new Blob([midiData], { type: "audio/midi" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vdamm_fx_riser_${currentBpm}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Automated FX risers with pitch bend",
      })
    })
  }

  const downloadMarkers = async () => {
    await withErrorHandling("Export Markers", "export-markers", async () => {
      const markers = [
        "1, Intro (no kick)",
        "17, Verse 1",
        "33, Pre-Chorus",
        "41, Chorus / Drop 1",
        "57, Break / Pads",
        "73, Verse 2",
        "89, Pre-Chorus 2",
        "97, Chorus / Drop 2",
        "113, Bridge",
        "121, Final Chorus / Outro",
      ]

      const txtContent = markers.join("\n")
      const csvContent =
        "BAR,NAME\n" +
        markers
          .map((line) => {
            const [bar, name] = line.split(", ")
            return `${bar},"${name}"`
          })
          .join("\n")

      const currentMeta = useMetaStore.getState()
      const keyPart = currentMeta.key ? `_${currentMeta.key.replace(" ", "").replace("#", "sharp")}` : ""
      const baseFilename = `vdamm_markers_${currentMeta.bpm}${keyPart}_bars`

      // Download TXT
      const txtBlob = new Blob([txtContent], { type: "text/plain" })
      if (txtBlob.size === 0) throw new Error("TXT blob is empty")

      const txtUrl = URL.createObjectURL(txtBlob)
      const txtLink = document.createElement("a")
      txtLink.href = txtUrl
      txtLink.download = `${baseFilename}.txt`
      document.body.appendChild(txtLink)
      txtLink.click()
      document.body.removeChild(txtLink)
      URL.revokeObjectURL(txtUrl)

      // Download CSV
      const csvBlob = new Blob([csvContent], { type: "text/csv" })
      if (csvBlob.size === 0) throw new Error("CSV blob is empty")

      const csvUrl = URL.createObjectURL(csvBlob)
      const csvLink = document.createElement("a")
      csvLink.href = csvUrl
      csvLink.download = `${baseFilename}.csv`
      document.body.appendChild(csvLink)
      csvLink.click()
      document.body.removeChild(csvLink)
      URL.revokeObjectURL(csvUrl)

      toast({
        title: "Downloaded!",
        description: "Markers exported as TXT and CSV files",
      })
    })
  }

  const downloadMixChecklist = async () => {
    await withErrorHandling("Export Mix Checklist", "export-checklist", async () => {
      const currentMeta = useMetaStore.getState()
      const checklist = `FL Studio Mix Checklist - VDAMM DJ Generator Pro

• Project: BPM ${currentMeta.bpm}, Key ${currentMeta.key}.
• Sidechain: Route "Ghost Kick" to mixer bus "SC" (sidechain only). Set comp ratio 4:1, attack 10ms, release 120ms.
• Drops: enable SC on Bass, Pads/Supersaw, FX (amount ~40–60%).
• Levels (start points, peak dBFS): Kick -6, Bass -9, Clap -12, Hats -14, Pads -12, Vox -10, FX -12, Master headroom -6.
• EQ quick: Kick HP 25Hz, Bass LP 8–10k, Pads HP 120Hz, Vox HP 90–120Hz; tame 3–5 kHz if harsh.
• Arrangement check: Pre 32–40, Drops 40–56 / 96–112; fill on bar 39/47/55/103/111.
• Print: "BPM ${currentMeta.bpm}, Key ${currentMeta.key}, Preset ${currentMeta.presetId || "custom"}".

Generated by VDAMM DJ Generator Pro
${new Date().toISOString()}`

      const keyPart = currentMeta.key ? `_${currentMeta.key.replace(" ", "").replace("#", "sharp")}` : ""
      const filename = `vdamm_mix_checklist_${currentMeta.bpm}${keyPart}.txt`

      const blob = new Blob([checklist], { type: "text/plain" })
      if (blob.size === 0) throw new Error("Checklist blob is empty")

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Mix checklist exported for FL Studio setup",
      })
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              data-testid="copy-combined"
              disabled={loadingStates["copy-combined"]}
              onClick={() => copyToClipboard(combinedText, "Combined (STYLE + LYRICS)", "copy-combined")}
            >
              <Copy className="h-4 w-4 mr-2" />
              {loadingStates["copy-combined"] ? "Copying..." : "Copy Combined"}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start bg-transparent"
              data-testid="download-txt"
              disabled={loadingStates["download-txt"]}
              onClick={downloadTxtFile}
            >
              <FileText className="h-4 w-4 mr-2" />
              {loadingStates["download-txt"] ? "Downloading..." : "Download .txt"}
            </Button>
          </CardContent>
        </Card>

        {/* Project Export */}
        <Card>
          <CardHeader>
            <CardTitle>Project Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start bg-transparent"
              data-testid="download-json"
              disabled={loadingStates["download-json"]}
              onClick={downloadJsonProject}
            >
              <FileJson className="h-4 w-4 mr-2" />
              {loadingStates["download-json"] ? "Downloading..." : "Download .json (Project)"}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start bg-transparent"
              data-testid="export-history-csv"
              disabled={loadingStates["export-history-csv"]}
              onClick={downloadHistoryCsv}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {loadingStates["export-history-csv"] ? "Exporting..." : "Export CSV (History)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Export to FL Studio
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate MIDI files optimized for FL Studio workflow at {bpm} BPM in {key}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-structure"
            disabled={loadingStates["export-structure"]}
            onClick={downloadStructureMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-structure"] ? "Generating..." : `Structure MIDI (vdamm_structure_${bpm}.mid)`}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Tempo markers for song structure: Intro, Verse, Chorus, Drop, Bridge, Outro
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-ghost"
            disabled={loadingStates["export-ghost"]}
            onClick={downloadGhostKickMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-ghost"] ? "Generating..." : `Ghost Kick MIDI (vdamm_ghost_kick_${bpm}.mid)`}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            C1 quarter notes in drop sections (bars 41-56, 97-112) for kick pattern reference
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-rolling"
            disabled={loadingStates["export-rolling"]}
            onClick={downloadRollingBassMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-rolling"] ? "Generating..." : "Download Rolling Bass (MIDI)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            16th note bass pattern in drops with root-root-5th-root progression
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-chords"
            disabled={loadingStates["export-chords"]}
            onClick={downloadSupersawChordsMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-chords"] ? "Generating..." : "Download Supersaw Chords (MIDI)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Add9 chord voicings in pre-chorus (2 bars) and drops (4 bars each)
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-hatsclap"
            disabled={loadingStates["export-hatsclap"]}
            onClick={downloadHatsClapMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-hatsclap"] ? "Generating..." : "Download Hats + Clap (MIDI)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Multi-channel hats and claps: closed hats (ch.3), open hats (ch.4), claps (ch.5)
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-riser"
            disabled={loadingStates["export-riser"]}
            onClick={downloadFXRiserMidi}
          >
            <Music className="h-4 w-4 mr-2" />
            {loadingStates["export-riser"] ? "Generating..." : "Download FX Riser (MIDI)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Automated risers with pitch bend and mod wheel before drops and breaks
          </p>
        </CardContent>
      </Card>

      {/* FL Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            FL Shortcuts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Quick reference files for FL Studio project setup and arrangement
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-markers"
            disabled={loadingStates["export-markers"]}
            onClick={downloadMarkers}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {loadingStates["export-markers"] ? "Generating..." : "Download Markers (TXT/CSV)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Playlist markers by bar: Intro (1), Verse 1 (17), Pre-Chorus (33), Drop 1 (41), etc.
          </p>

          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            data-testid="export-checklist"
            disabled={loadingStates["export-checklist"]}
            onClick={downloadMixChecklist}
          >
            <FileText className="h-4 w-4 mr-2" />
            {loadingStates["export-checklist"] ? "Generating..." : "Download Mix Checklist (TXT)"}
          </Button>
          <p className="text-xs text-muted-foreground ml-6">
            Quick setup guide: sidechain routing, levels, EQ tips, arrangement check
          </p>
        </CardContent>
      </Card>

      {/* Export Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Export Preview</CardTitle>
          <p className="text-sm text-muted-foreground">Exact content that will be exported</p>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">{combinedText}</pre>
          </div>
        </CardContent>
      </Card>

      {/* File Naming Convention */}
      <Card>
        <CardHeader>
          <CardTitle>File Naming Convention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">&lt;YYYYMMDD_HHMM&gt;_suno_lyrics.txt</span>
              <span className="text-muted-foreground">Combined STYLE + LYRICS</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">&lt;YYYYMMDD_HHMM&gt;_vdamm_project.json</span>
              <span className="text-muted-foreground">Complete project data</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">&lt;YYYYMMDD_HHMM&gt;_vdamm_history.csv</span>
              <span className="text-muted-foreground">History with specified columns</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_structure_{bpm}.mid</span>
              <span className="text-muted-foreground">FL Studio structure markers</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_ghost_kick_{bpm}.mid</span>
              <span className="text-muted-foreground">Ghost kick pattern reference</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">
                vdamm_rolling_bass_{bpm}_${key.replace(" ", "_")}.mid
              </span>
              <span className="text-muted-foreground">Rolling bass pattern</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">
                vdamm_supersaw_chords_{bpm}_${key.replace(" ", "_")}.mid
              </span>
              <span className="text-muted-foreground">Supersaw chord progression</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_hats_clap_{bpm}.mid</span>
              <span className="text-muted-foreground">Multi-channel hats and claps</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_fx_riser_{bpm}.mid</span>
              <span className="text-muted-foreground">Automated FX risers with pitch bend</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_markers_{bpm}_bars.txt</span>
              <span className="text-muted-foreground">Markers exported as TXT</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_markers_{bpm}_bars.csv</span>
              <span className="text-muted-foreground">Markers exported as CSV</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="font-mono text-xs">vdamm_mix_checklist_{bpm}.txt</span>
              <span className="text-muted-foreground">Mix checklist exported as TXT</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
