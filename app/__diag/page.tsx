"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface ButtonStatus {
  id: string
  name: string
  mounted: boolean
  enabled: boolean
  onClickBound: boolean
  lastError?: string
}

export default function DiagnosticsPage() {
  const [buttonStatuses, setButtonStatuses] = useState<ButtonStatus[]>([])

  const checkButtonStatus = (testId: string, name: string): ButtonStatus => {
    const element = document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement

    return {
      id: testId,
      name,
      mounted: !!element,
      enabled: element ? !element.disabled : false,
      onClickBound: element ? !!element.onclick || element.hasAttribute("onclick") : false,
      lastError: undefined,
    }
  }

  useEffect(() => {
    const checkAllButtons = () => {
      const buttons = [
        { testId: "export-structure", name: "Export Structure MIDI" },
        { testId: "export-ghost", name: "Export Ghost Kick MIDI" },
        { testId: "export-rolling", name: "Export Rolling Bass MIDI" },
        { testId: "export-chords", name: "Export Supersaw Chords MIDI" },
        { testId: "export-hatsclap", name: "Export Hats+Clap MIDI" },
        { testId: "export-riser", name: "Export FX Riser MIDI" },
        { testId: "export-markers", name: "Export Markers TXT/CSV" },
        { testId: "export-checklist", name: "Export Mix Checklist" },
        { testId: "copy-style", name: "Copy STYLE" },
        { testId: "copy-lyrics", name: "Copy LYRICS" },
        { testId: "copy-combined", name: "Copy Combined" },
        { testId: "save-history", name: "Save to History" },
      ]

      const statuses = buttons.map(({ testId, name }) => checkButtonStatus(testId, name))
      setButtonStatuses(statuses)
    }

    // Initial check
    checkAllButtons()

    // Check every 2 seconds
    const interval = setInterval(checkAllButtons, 2000)

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: ButtonStatus) => {
    if (!status.mounted) return <XCircle className="h-4 w-4 text-red-500" />
    if (!status.enabled) return <AlertCircle className="h-4 w-4 text-yellow-500" />
    if (!status.onClickBound) return <AlertCircle className="h-4 w-4 text-yellow-500" />
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = (status: ButtonStatus) => {
    if (!status.mounted) return <Badge variant="destructive">Not Mounted</Badge>
    if (!status.enabled) return <Badge variant="secondary">Disabled</Badge>
    if (!status.onClickBound) return <Badge variant="secondary">No Handler</Badge>
    return <Badge variant="default">Ready</Badge>
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Export Diagnostics</h1>
        <p className="text-muted-foreground">Real-time status monitoring for all export buttons and actions</p>
      </header>

      <div className="grid gap-4">
        {buttonStatuses.map((status) => (
          <Card key={status.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(status)}
                  <div>
                    <h3 className="font-medium">{status.name}</h3>
                    <p className="text-sm text-muted-foreground">data-testid: {status.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(status)}
                  <div className="text-xs text-muted-foreground">
                    <div>Mounted: {status.mounted ? "✓" : "✗"}</div>
                    <div>Enabled: {status.enabled ? "✓" : "✗"}</div>
                    <div>Handler: {status.onClickBound ? "✓" : "✗"}</div>
                  </div>
                </div>
              </div>
              {status.lastError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  Last Error: {status.lastError}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {buttonStatuses.filter((s) => s.mounted && s.enabled && s.onClickBound).length}
              </div>
              <div className="text-sm text-muted-foreground">Ready</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {buttonStatuses.filter((s) => s.mounted && (!s.enabled || !s.onClickBound)).length}
              </div>
              <div className="text-sm text-muted-foreground">Issues</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{buttonStatuses.filter((s) => !s.mounted).length}</div>
              <div className="text-sm text-muted-foreground">Missing</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{buttonStatuses.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
