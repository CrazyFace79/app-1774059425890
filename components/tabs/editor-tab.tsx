"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useLyricsStore } from "@/store/lyrics-store"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw } from "lucide-react"

export function EditorTab() {
  const { sections, addSection, updateSection, removeSection, reorderSections, validateSection } = useLyricsStore()
  const { toast } = useToast()
  const [newSectionName, setNewSectionName] = useState("")

  const handleAddSection = () => {
    if (!newSectionName.trim()) {
      toast({
        title: "Section Name Required",
        description: "Please enter a name for the new section",
        variant: "destructive",
      })
      return
    }

    addSection(newSectionName.trim(), "")
    setNewSectionName("")
    toast({
      title: "Section Added",
      description: `Added new section: ${newSectionName}`,
    })
  }

  const handleRemoveSection = (index: number) => {
    const sectionName = sections[index]?.name
    removeSection(index)
    toast({
      title: "Section Removed",
      description: `Removed section: ${sectionName}`,
    })
  }

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return

    reorderSections(index, newIndex)
    toast({
      title: "Section Moved",
      description: `Moved section ${direction}`,
    })
  }

  const handleSectionContentChange = (index: number, content: string) => {
    const section = sections[index]
    if (section) {
      updateSection(index, section.name, content)
    }
  }

  const handleSectionNameChange = (index: number, name: string) => {
    const section = sections[index]
    if (section) {
      updateSection(index, name, section.content)
    }
  }

  const resetToDefault = () => {
    // Clear all sections and add default structure
    while (sections.length > 0) {
      removeSection(0)
    }

    const defaultSections = [
      { name: "Intro", content: "" },
      { name: "Verse 1", content: "" },
      { name: "Pre-Chorus", content: "" },
      { name: "Chorus", content: "" },
      { name: "Break", content: "" },
      { name: "Verse 2", content: "" },
      { name: "Pre-Chorus 2", content: "" },
      { name: "Chorus 2", content: "" },
      { name: "Bridge", content: "" },
      { name: "Final Chorus", content: "" },
    ]

    defaultSections.forEach((section) => {
      addSection(section.name, section.content)
    })

    toast({
      title: "Reset Complete",
      description: "Restored default song structure",
    })
  }

  const getValidationStatus = (index: number) => {
    const validation = validateSection(index)
    const errors = Object.values(validation).filter((v) => !v).length

    if (errors === 0) return { status: "valid", color: "bg-green-100 text-green-800", text: "✓ Valid" }
    if (errors <= 2) return { status: "warning", color: "bg-yellow-100 text-yellow-800", text: `⚠ ${errors} issues` }
    return { status: "error", color: "bg-red-100 text-red-800", text: `✗ ${errors} errors` }
  }

  const getTotalStats = () => {
    const totalLines = sections.reduce((acc, section) => {
      return acc + section.content.split("\n").filter((line) => line.trim()).length
    }, 0)

    const totalWords = sections.reduce((acc, section) => {
      return acc + section.content.split(/\s+/).filter((word) => word.trim()).length
    }, 0)

    const validSections = sections.filter((_, index) => {
      const validation = validateSection(index)
      return Object.values(validation).every((v) => v)
    }).length

    return { totalLines, totalWords, validSections, totalSections: sections.length }
  }

  const stats = getTotalStats()

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lyrics Editor</span>
            <div className="flex gap-2">
              <Badge variant="outline">{stats.totalSections} sections</Badge>
              <Badge variant="outline">{stats.totalLines} lines</Badge>
              <Badge variant="outline">{stats.totalWords} words</Badge>
              <Badge
                className={
                  stats.validSections === stats.totalSections
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {stats.validSections}/{stats.totalSections} valid
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-2">
              <Input
                placeholder="Section name (e.g., Verse 3)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                className="w-48"
                data-testid="new-section-name"
              />
              <Button onClick={handleAddSection} data-testid="add-section" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            </div>

            <Button
              onClick={resetToDefault}
              variant="outline"
              data-testid="reset-structure"
              className="flex items-center gap-2 bg-transparent"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default Structure
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const validation = getValidationStatus(index)
          const lines = section.content.split("\n").filter((line) => line.trim())
          const wordCount = section.content.split(/\s+/).filter((word) => word.trim()).length

          return (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Input
                      value={section.name}
                      onChange={(e) => handleSectionNameChange(index, e.target.value)}
                      className="font-medium w-48"
                      data-testid={`section-name-${index}`}
                    />
                    <Badge className={validation.color}>{validation.text}</Badge>
                    <div className="text-sm text-muted-foreground">
                      {lines.length} lines • {wordCount} words
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveSection(index, "up")}
                      disabled={index === 0}
                      data-testid={`move-section-up-${index}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveSection(index, "down")}
                      disabled={index === sections.length - 1}
                      data-testid={`move-section-down-${index}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSection(index)}
                      data-testid={`remove-section-${index}`}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Textarea
                  value={section.content}
                  onChange={(e) => handleSectionContentChange(index, e.target.value)}
                  placeholder={`Enter lyrics for ${section.name}...\n\nTip: Use 8 lines with 3-4 words each`}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid={`section-content-${index}`}
                />

                {/* Line-by-line validation preview */}
                {lines.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Line validation:</div>
                    <div className="grid grid-cols-1 gap-1">
                      {lines.slice(0, 8).map((line, lineIndex) => {
                        const words = line
                          .trim()
                          .split(/\s+/)
                          .filter((w) => w.length > 0)
                        const isValidLength = words.length >= 3 && words.length <= 4
                        const hasForbidden = /\b(oh-oh|yeah-yeah|na-na|la-la|hey-hey)\b/i.test(line)

                        return (
                          <div key={lineIndex} className="flex items-center gap-2 text-xs">
                            <span className="w-6 text-muted-foreground">{lineIndex + 1}.</span>
                            <span className={`w-8 text-center ${isValidLength ? "text-green-600" : "text-red-600"}`}>
                              {words.length}w
                            </span>
                            {hasForbidden && <span className="text-red-600">🚫</span>}
                            <span className="flex-1 truncate">{line}</span>
                          </div>
                        )
                      })}
                      {lines.length > 8 && (
                        <div className="text-xs text-red-600">⚠ Extra lines: {lines.length - 8}</div>
                      )}
                      {lines.length < 8 && (
                        <div className="text-xs text-yellow-600">⚠ Missing lines: {8 - lines.length}</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {sections.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground mb-4">No sections yet. Add your first section to get started.</div>
            <Button onClick={() => setNewSectionName("Intro")} data-testid="add-first-section">
              Add First Section
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
