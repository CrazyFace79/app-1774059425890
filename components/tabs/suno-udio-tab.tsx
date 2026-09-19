"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Copy, Wand2, Sparkles } from "lucide-react"
import { useMetaStore } from "@/store/meta-store"
import { useLyricsStore } from "@/store/lyrics-store"
import { useStylesStore } from "@/store/styles-store"
import { buildStyle } from "@/lib/buildStyle"
import { useToast } from "@/hooks/use-toast"

export function SunoUdioTab() {
  const { toast } = useToast()
  const meta = useMetaStore()
  const { sections } = useLyricsStore()
  const { presets } = useStylesStore()

  const [manualStyle, setManualStyle] = useState("")
  const [isManualEdit, setIsManualEdit] = useState(false)
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])

  // Reference artists options
  const referenceArtists = [
    "Alice Deejay",
    "ATB",
    "Binary Faze",
    "Cascada",
    "Darude",
    "DJ Sammy",
    "Eiffel 65",
    "Fragma",
    "Ian Van Dahl",
    "Lasgo",
    "Madison Avenue",
    "Milk Inc",
    "Nightcrawlers",
    "Robert Miles",
    "Scooter",
    "Vengaboys",
  ]

  // Generate title suggestions from chorus
  useEffect(() => {
    const chorusSection = sections.find((s) => s.type === "chorus")
    if (chorusSection && chorusSection.lines.length > 0) {
      const words = chorusSection.lines[0].split(" ").filter((w) => w.length > 2)
      const suggestions = [
        words.slice(0, 2).join(" "),
        words.slice(1, 3).join(" "),
        words.slice(0, 3).join(" "),
      ].filter((s) => s.length > 0)
      setTitleSuggestions(suggestions.slice(0, 3))
    }
  }, [sections])

  // Auto-generate style when parameters change (only if not manually edited)
  useEffect(() => {
    if (!isManualEdit) {
      const currentPreset = presets.find((p) => p.id === meta.presetId)
      const autoStyle = buildStyle(
        {
          bpm: meta.bpm,
          key: meta.key,
          vocal: meta.vocal,
          era: meta.era,
          mood: meta.mood,
          stylePct: meta.stylePercentage,
          weirdPct: meta.weirdnessPercentage,
          toggles: {
            introNoKick: meta.introWithoutKick,
            acapellaOnly: meta.acapellaOnly,
            noInstruments: meta.noInstruments,
            dryVocals: meta.dryVocals,
          },
          referenceArtists: selectedArtists,
        },
        currentPreset,
      )

      setManualStyle(autoStyle)
      meta.setStyle(autoStyle)
    }
  }, [
    meta.bpm,
    meta.key,
    meta.vocal,
    meta.era,
    meta.mood,
    meta.stylePercentage,
    meta.weirdnessPercentage,
    meta.introWithoutKick,
    meta.acapellaOnly,
    meta.noInstruments,
    meta.dryVocals,
    meta.presetId,
    selectedArtists,
    isManualEdit,
    presets,
  ])

  // Format lyrics for display
  const formatLyrics = () => {
    return sections
      .map((section) => {
        const sectionName = section.type.charAt(0).toUpperCase() + section.type.slice(1).replace("-", "-")
        return `[${sectionName}]\n${section.lines.join("\n")}`
      })
      .join("\n\n")
  }

  // Generate combined prompt
  const generateCombinedPrompt = () => {
    const style = manualStyle || meta.style
    const lyrics = formatLyrics()
    return `STYLE: ${style}\n\nLYRICS:\n${lyrics}`
  }

  // Copy functions
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} copied to clipboard` })
    } catch (error) {
      toast({ title: `Failed to copy ${label}`, variant: "destructive" })
    }
  }

  const handleStyleChange = (value: string) => {
    setManualStyle(value)
    setIsManualEdit(true)
    meta.setStyle(value)
  }

  const toggleArtist = (artist: string) => {
    setSelectedArtists((prev) => (prev.includes(artist) ? prev.filter((a) => a !== artist) : [...prev, artist]))
  }

  return (
    <div className="space-y-6">
      {/* Style Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Style Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="style-input">STYLE ({manualStyle.length} chars)</Label>
            <Textarea
              id="style-input"
              data-testid="style-textarea"
              value={manualStyle}
              onChange={(e) => handleStyleChange(e.target.value)}
              placeholder="Auto-generated style will appear here..."
              className="min-h-[80px] font-mono text-sm"
            />
          </div>

          {/* Style Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Style % ({meta.stylePercentage}%)</Label>
              <Slider
                value={[meta.stylePercentage]}
                onValueChange={([value]) => meta.setStylePercentage(value)}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Weirdness % ({meta.weirdnessPercentage}%)</Label>
              <Slider
                value={[meta.weirdnessPercentage]}
                onValueChange={([value]) => meta.setWeirdnessPercentage(value)}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>

          {/* Intro Toggle */}
          <div className="flex items-center space-x-2">
            <Switch id="intro-no-kick" checked={meta.introWithoutKick} onCheckedChange={meta.setIntroWithoutKick} />
            <Label htmlFor="intro-no-kick">Intro without kick</Label>
          </div>

          {/* Reference Artists */}
          <div>
            <Label>Reference Artists (adds "in the style of..." to STYLE)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {referenceArtists.map((artist) => (
                <Badge
                  key={artist}
                  variant={selectedArtists.includes(artist) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleArtist(artist)}
                >
                  {artist}
                </Badge>
              ))}
            </div>
          </div>

          <Button data-testid="copy-style" onClick={() => copyToClipboard(manualStyle, "Style")} className="w-full">
            <Copy className="h-4 w-4 mr-2" />
            Copy STYLE
          </Button>
        </CardContent>
      </Card>

      {/* Lyrics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Lyrics Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="lyrics-display">LYRICS (structured sections)</Label>
            <Textarea
              id="lyrics-display"
              data-testid="lyrics-textarea"
              value={formatLyrics()}
              readOnly
              className="min-h-[200px] font-mono text-sm bg-muted"
            />
          </div>

          <Button
            data-testid="copy-lyrics"
            onClick={() => copyToClipboard(formatLyrics(), "Lyrics")}
            className="w-full"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy LYRICS
          </Button>
        </CardContent>
      </Card>

      {/* Combined Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Preview (exact format for Suno/Udio)</Label>
            <Textarea value={generateCombinedPrompt()} readOnly className="min-h-[150px] font-mono text-sm bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              data-testid="generate-prompt"
              onClick={() => copyToClipboard(generateCombinedPrompt(), "Combined prompt")}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Prompt
            </Button>
            <Button data-testid="copy-combined" onClick={() => copyToClipboard(generateCombinedPrompt(), "Combined")}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Combined
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Title Suggestions */}
      {titleSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Title Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {titleSuggestions.map((title, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => copyToClipboard(title, "Title")}
                >
                  {title}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
