"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, XCircle } from "lucide-react"
import { useLyricsStore } from "@/store/lyrics-store"
import { useMetaStore } from "@/store/meta-store"
import { useToast } from "@/hooks/use-toast"
import { formatLyricsForExport } from "@/lib/utils"
import { useState } from "react"

export function ResultTab() {
  const { sections, validationErrors, validateAll } = useLyricsStore()
  const { generateStyleLine } = useMetaStore()
  const { toast } = useToast()
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const styleLine = generateStyleLine()
  const lyricsText = formatLyricsForExport(sections)
  const combinedText = `STYLE: ${styleLine}\n\nLYRICS:\n${lyricsText}`

  const copyToClipboard = async (text: string, type: string, testId: string) => {
    setLoadingStates((prev) => ({ ...prev, [testId]: true }))
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("No content to copy")
      }
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[v0] Copy failed: ${type}`, error)
      toast({
        title: "Copy Failed",
        description: `${type} copy failed: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setLoadingStates((prev) => ({ ...prev, [testId]: false }))
    }
  }

  const qaChecks = [
    {
      name: "8 lines per section",
      passed: sections.length > 0 && sections.every((section) => section.lines.length === 8),
      description: "Each section must have exactly 8 lines",
    },
    {
      name: "3-4 words per line",
      passed:
        sections.length > 0 &&
        sections.every((section) =>
          section.lines.every((line) => {
            const words = line
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0)
            return words.length >= 3 && words.length <= 4
          }),
        ),
      description: "Each line must contain 3-4 words",
    },
    {
      name: "Chorus line 1 = line 5",
      passed: sections
        .filter((section) => section.type === "chorus")
        .every((section) => section.lines.length >= 5 && section.lines[0].trim() === section.lines[4].trim()),
      description: "In chorus sections, first line must equal fifth line",
    },
    {
      name: "No forbidden words",
      passed: sections.every((section) =>
        section.lines.every(
          (line) => !line.toLowerCase().includes("oh-oh") && !line.toLowerCase().includes("yeah-yeah"),
        ),
      ),
      description: "No 'oh-oh' or 'yeah-yeah' allowed",
    },
  ]

  const allChecksPassed = qaChecks.every((check) => check.passed)

  return (
    <div className="space-y-6">
      {/* Side-by-side preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STYLE Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              STYLE
              <Button
                variant="outline"
                size="sm"
                data-testid="copy-style"
                disabled={loadingStates["copy-style"]}
                onClick={() => copyToClipboard(styleLine, "STYLE", "copy-style")}
              >
                <Copy className="h-4 w-4 mr-2" />
                {loadingStates["copy-style"] ? "Copying..." : "Copy STYLE"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-mono break-words">{styleLine}</p>
            </div>
          </CardContent>
        </Card>

        {/* LYRICS Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              LYRICS
              <Button
                variant="outline"
                size="sm"
                data-testid="copy-lyrics"
                disabled={loadingStates["copy-lyrics"]}
                onClick={() => copyToClipboard(lyricsText, "LYRICS", "copy-lyrics")}
              >
                <Copy className="h-4 w-4 mr-2" />
                {loadingStates["copy-lyrics"] ? "Copying..." : "Copy LYRICS"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">{lyricsText}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Copy Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          data-testid="copy-combined"
          disabled={loadingStates["copy-combined"]}
          onClick={() => copyToClipboard(combinedText, "Combined (STYLE + LYRICS)", "copy-combined")}
          className="px-8"
        >
          <Copy className="h-4 w-4 mr-2" />
          {loadingStates["copy-combined"] ? "Copying..." : "Copy Combined (STYLE + LYRICS)"}
        </Button>
      </div>

      {/* Final Export Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Final Export Preview</CardTitle>
          <p className="text-sm text-muted-foreground">Exact format for Suno/Udio</p>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm font-mono whitespace-pre-wrap">{combinedText}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced QA Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>QA Checklist</CardTitle>
          <p className="text-sm text-muted-foreground">All checks must be green before export</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {qaChecks.map((check, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border">
                {check.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant={check.passed ? "default" : "destructive"}>{check.name}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{check.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Status */}
          <div className="mt-6 pt-4 border-t">
            <div
              className="flex items-center space-x-3 p-4 rounded-lg border-2"
              style={{
                borderColor: allChecksPassed ? "rgb(34 197 94)" : "rgb(239 68 68)",
                backgroundColor: allChecksPassed ? "rgb(240 253 244)" : "rgb(254 242 242)",
              }}
            >
              {allChecksPassed ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <div>
                    <span className="text-green-700 font-semibold text-lg">Ready for Export</span>
                    <p className="text-green-600 text-sm">All validation rules passed</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <span className="text-red-700 font-semibold text-lg">Fix Issues Before Export</span>
                    <p className="text-red-600 text-sm">Some validation rules failed</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
