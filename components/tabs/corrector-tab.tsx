"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useLyricsStore } from "@/store/lyrics-store"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, Wand2, RotateCcw, Copy } from "lucide-react"

interface CorrectionSuggestion {
  type: "word-count" | "line-count" | "chorus-match" | "forbidden-words"
  section: string
  lineIndex: number
  original: string
  suggested: string
  reason: string
}

export function CorrectorTab() {
  const { sections, updateSection } = useLyricsStore()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<CorrectionSuggestion[]>([])
  const [showDiff, setShowDiff] = useState(false)
  const [originalSections, setOriginalSections] = useState(sections)

  const validateAndGenerateSuggestions = () => {
    const newSuggestions: CorrectionSuggestion[] = []

    sections.forEach((section) => {
      const lines = section.content.split("\n").filter((line) => line.trim())

      // Rule 1: 8 lines per section
      if (lines.length !== 8) {
        const targetLines =
          lines.length < 8 ? [...lines, ...Array(8 - lines.length).fill("[new line]")] : lines.slice(0, 8)

        newSuggestions.push({
          type: "line-count",
          section: section.name,
          lineIndex: -1,
          original: section.content,
          suggested: targetLines.join("\n"),
          reason: `Section should have exactly 8 lines (currently ${lines.length})`,
        })
      }

      // Rule 2: 3-4 words per line
      lines.forEach((line, index) => {
        const words = line
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0)
        if (words.length < 3 || words.length > 4) {
          let suggested = line
          if (words.length < 3) {
            suggested = words.join(" ") + " [add word]"
          } else if (words.length > 4) {
            suggested = words.slice(0, 4).join(" ")
          }

          newSuggestions.push({
            type: "word-count",
            section: section.name,
            lineIndex: index,
            original: line,
            suggested,
            reason: `Line should have 3-4 words (currently ${words.length})`,
          })
        }
      })

      // Rule 3: Chorus line 1 = line 5
      if (section.name.toLowerCase().includes("chorus")) {
        if (lines.length >= 5 && lines[0] !== lines[4]) {
          newSuggestions.push({
            type: "chorus-match",
            section: section.name,
            lineIndex: 4,
            original: lines[4],
            suggested: lines[0],
            reason: "Chorus line 5 should match line 1",
          })
        }
      }

      // Rule 4: No forbidden words
      const forbiddenWords = ["oh-oh", "yeah-yeah", "na-na", "la-la", "hey-hey"]
      lines.forEach((line, index) => {
        forbiddenWords.forEach((word) => {
          if (line.toLowerCase().includes(word)) {
            const suggested = line.replace(new RegExp(word, "gi"), "[replace]")
            newSuggestions.push({
              type: "forbidden-words",
              section: section.name,
              lineIndex: index,
              original: line,
              suggested,
              reason: `Remove forbidden word: "${word}"`,
            })
          }
        })
      })
    })

    setSuggestions(newSuggestions)
    setOriginalSections([...sections])
    setShowDiff(true)

    toast({
      title: "Analysis Complete",
      description: `Found ${newSuggestions.length} suggestions for improvement`,
    })
  }

  const applyAllSuggestions = () => {
    const updatedSections = [...sections]

    suggestions.forEach((suggestion) => {
      const sectionIndex = updatedSections.findIndex((s) => s.name === suggestion.section)
      if (sectionIndex === -1) return

      if (suggestion.type === "line-count") {
        updatedSections[sectionIndex] = {
          ...updatedSections[sectionIndex],
          content: suggestion.suggested,
        }
      } else {
        const lines = updatedSections[sectionIndex].content.split("\n")
        if (suggestion.lineIndex >= 0 && suggestion.lineIndex < lines.length) {
          lines[suggestion.lineIndex] = suggestion.suggested
          updatedSections[sectionIndex] = {
            ...updatedSections[sectionIndex],
            content: lines.join("\n"),
          }
        }
      }
    })

    updatedSections.forEach((section, index) => {
      updateSection(index, section.name, section.content)
    })

    setSuggestions([])
    toast({
      title: "Auto-fix Applied",
      description: "All suggestions have been applied to your lyrics",
    })
  }

  const applySuggestion = (suggestionIndex: number) => {
    const suggestion = suggestions[suggestionIndex]
    const sectionIndex = sections.findIndex((s) => s.name === suggestion.section)

    if (sectionIndex === -1) return

    if (suggestion.type === "line-count") {
      updateSection(sectionIndex, suggestion.section, suggestion.suggested)
    } else {
      const lines = sections[sectionIndex].content.split("\n")
      if (suggestion.lineIndex >= 0 && suggestion.lineIndex < lines.length) {
        lines[suggestion.lineIndex] = suggestion.suggested
        updateSection(sectionIndex, suggestion.section, lines.join("\n"))
      }
    }

    setSuggestions((prev) => prev.filter((_, i) => i !== suggestionIndex))
    toast({
      title: "Suggestion Applied",
      description: "Individual correction has been applied",
    })
  }

  const revertChanges = () => {
    originalSections.forEach((section, index) => {
      updateSection(index, section.name, section.content)
    })
    setSuggestions([])
    setShowDiff(false)
    toast({
      title: "Changes Reverted",
      description: "All changes have been reverted to original",
    })
  }

  const copyCorrectedText = async () => {
    const correctedText = sections.map((section) => `[${section.name}]\n${section.content}`).join("\n\n")

    try {
      await navigator.clipboard.writeText(correctedText)
      toast({
        title: "Copied to Clipboard",
        description: "Corrected lyrics copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "word-count":
        return "📝"
      case "line-count":
        return "📏"
      case "chorus-match":
        return "🔄"
      case "forbidden-words":
        return "🚫"
      default:
        return "✨"
    }
  }

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case "word-count":
        return "bg-blue-100 text-blue-800"
      case "line-count":
        return "bg-yellow-100 text-yellow-800"
      case "chorus-match":
        return "bg-purple-100 text-purple-800"
      case "forbidden-words":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const makeMoreEnergetic = () => {
    const energeticWords = {
      love: "passion",
      feel: "explode",
      heart: "soul",
      night: "fire",
      dance: "move wild",
      music: "beat drops",
      together: "united",
      forever: "eternal",
    }

    applyWordReplacements(energeticWords, "Made lyrics more energetic")
  }

  const makeMoreRomantic = () => {
    const romanticWords = {
      party: "embrace",
      club: "moonlight",
      beat: "heartbeat",
      loud: "gentle",
      crazy: "dreamy",
      wild: "tender",
      fire: "starlight",
      power: "love",
    }

    applyWordReplacements(romanticWords, "Made lyrics more romantic")
  }

  const simplifyWords = () => {
    const simpleWords = {
      magnificent: "great",
      extraordinary: "amazing",
      incredible: "awesome",
      phenomenal: "fantastic",
      spectacular: "wonderful",
      marvelous: "perfect",
      tremendous: "huge",
      exceptional: "special",
    }

    applyWordReplacements(simpleWords, "Simplified complex words")
  }

  const addBetterRhymes = () => {
    const rhymeReplacements = {
      day: "way",
      night: "light",
      heart: "start",
      love: "above",
      feel: "real",
      time: "shine",
      dance: "chance",
      free: "me",
    }

    applyWordReplacements(rhymeReplacements, "Improved rhyme scheme")
  }

  const applyWordReplacements = (replacements: Record<string, string>, message: string) => {
    const updatedSections = sections.map((section) => {
      let content = section.content

      Object.entries(replacements).forEach(([from, to]) => {
        const regex = new RegExp(`\\b${from}\\b`, "gi")
        content = content.replace(regex, to)
      })

      return { ...section, content }
    })

    updatedSections.forEach((section, index) => {
      updateSection(index, section.name, section.content)
    })

    toast({
      title: "Rewrite Applied",
      description: message,
    })
  }

  return (
    <div className="space-y-6">
      {/* Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Lyrics Corrector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={validateAndGenerateSuggestions}
              data-testid="analyze-lyrics"
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Analyze & Suggest Fixes
            </Button>

            {suggestions.length > 0 && (
              <>
                <Button
                  onClick={applyAllSuggestions}
                  data-testid="apply-all-fixes"
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Apply All Fixes ({suggestions.length})
                </Button>

                <Button
                  onClick={revertChanges}
                  data-testid="revert-changes"
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <RotateCcw className="h-4 w-4" />
                  Revert Changes
                </Button>

                <Button
                  onClick={copyCorrectedText}
                  data-testid="copy-corrected"
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Copy className="h-4 w-4" />
                  Copy Corrected
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correction Suggestions ({suggestions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getSuggestionIcon(suggestion.type)}</span>
                      <Badge className={getSuggestionColor(suggestion.type)}>{suggestion.type.replace("-", " ")}</Badge>
                      <span className="font-medium">{suggestion.section}</span>
                      {suggestion.lineIndex >= 0 && (
                        <span className="text-sm text-muted-foreground">Line {suggestion.lineIndex + 1}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => applySuggestion(index)}
                      data-testid={`apply-suggestion-${index}`}
                      className="flex items-center gap-1"
                    >
                      Apply Fix
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">{suggestion.reason}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-red-600">Original:</label>
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm">
                        {suggestion.original}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-600">Suggested:</label>
                      <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-sm">
                        {suggestion.suggested}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diff View */}
      {showDiff && originalSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Changes Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sections.map((section, index) => {
                const original = originalSections[index]?.content || ""
                const current = section.content
                const hasChanges = original !== current

                return (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium">{section.name}</h4>
                      {hasChanges ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Modified</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">No Changes</Badge>
                      )}
                    </div>

                    {hasChanges && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Before:</label>
                          <Textarea value={original} readOnly className="mt-1 bg-red-50 border-red-200" rows={4} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">After:</label>
                          <Textarea value={current} readOnly className="mt-1 bg-green-50 border-green-200" rows={4} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Rewrite Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Rewrite Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" data-testid="make-more-energetic" onClick={makeMoreEnergetic}>
              More Energetic
            </Button>
            <Button variant="outline" size="sm" data-testid="make-more-romantic" onClick={makeMoreRomantic}>
              More Romantic
            </Button>
            <Button variant="outline" size="sm" data-testid="simplify-words" onClick={simplifyWords}>
              Simplify Words
            </Button>
            <Button variant="outline" size="sm" data-testid="add-rhymes" onClick={addBetterRhymes}>
              Better Rhymes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
