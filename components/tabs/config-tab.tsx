"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Settings, Download, Upload, RotateCcw, Wifi, WifiOff } from "lucide-react"
import { useConfigStore } from "@/store/config-store"
import { useToast } from "@/hooks/use-toast"

export function ConfigTab() {
  const { toast } = useToast()
  const config = useConfigStore()
  const [isOnline, setIsOnline] = useState(true)
  const [importJson, setImportJson] = useState("")

  // Monitor online status
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
    }
  }, [])

  const handleExportSettings = () => {
    const settings = config.exportSettings()
    const blob = new Blob([settings], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vdamm-settings-${new Date().toISOString().slice(0, 16).replace(/:/g, "")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: "Settings exported successfully" })
  }

  const handleImportSettings = () => {
    if (!importJson.trim()) {
      toast({ title: "Please paste settings JSON", variant: "destructive" })
      return
    }

    const success = config.importSettings(importJson)
    if (success) {
      toast({ title: "Settings imported successfully" })
      setImportJson("")
    } else {
      toast({ title: "Failed to import settings", variant: "destructive" })
    }
  }

  const handleResetApp = async () => {
    await config.resetApp()
  }

  return (
    <div className="space-y-6">
      {/* Online Status Badge */}
      {config.showOfflineBadge && (
        <div className="flex justify-end">
          <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>
      )}

      {/* Default Values */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Default Values
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default BPM</Label>
              <Input
                type="number"
                min="80"
                max="200"
                value={config.defaultBpm}
                onChange={(e) => config.setDefaults({ defaultBpm: Number.parseInt(e.target.value) || 148 })}
              />
            </div>
            <div>
              <Label>Default Key</Label>
              <Select value={config.defaultKey} onValueChange={(value) => config.setDefaults({ defaultKey: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C major">C major</SelectItem>
                  <SelectItem value="D# minor">D# minor</SelectItem>
                  <SelectItem value="F major">F major</SelectItem>
                  <SelectItem value="G minor">G minor</SelectItem>
                  <SelectItem value="A minor">A minor</SelectItem>
                  <SelectItem value="Bb major">Bb major</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Vocal</Label>
              <Select
                value={config.defaultVocal}
                onValueChange={(value) => config.setDefaults({ defaultVocal: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="duet">Duet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Era</Label>
              <Select value={config.defaultEra} onValueChange={(value) => config.setDefaults({ defaultEra: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90s">90s</SelectItem>
                  <SelectItem value="2000s">2000s</SelectItem>
                  <SelectItem value="2003">2003</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Style % ({config.defaultStylePct}%)</Label>
              <Slider
                value={[config.defaultStylePct]}
                onValueChange={([value]) => config.setDefaults({ defaultStylePct: value })}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Default Weirdness % ({config.defaultWeirdnessPct}%)</Label>
              <Slider
                value={[config.defaultWeirdnessPct]}
                onValueChange={([value]) => config.setDefaults({ defaultWeirdnessPct: value })}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="lines-per-section">8 lines per section</Label>
              <Switch
                id="lines-per-section"
                checked={config.validatorsEnabled.linesPerSection}
                onCheckedChange={(checked) => config.setValidators({ linesPerSection: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="words-per-line">3-4 words per line</Label>
              <Switch
                id="words-per-line"
                checked={config.validatorsEnabled.wordsPerLine}
                onCheckedChange={(checked) => config.setValidators({ wordsPerLine: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="chorus-repeat">Chorus line 1 = line 5</Label>
              <Switch
                id="chorus-repeat"
                checked={config.validatorsEnabled.chorusRepeat}
                onCheckedChange={(checked) => config.setValidators({ chorusRepeat: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="forbidden-words">No "oh-oh/yeah-yeah"</Label>
              <Switch
                id="forbidden-words"
                checked={config.validatorsEnabled.forbiddenWords}
                onCheckedChange={(checked) => config.setValidators({ forbiddenWords: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Interface Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hotkeys">Enable Hotkeys (Ctrl+Enter, Alt+↑/↓)</Label>
            <Switch id="hotkeys" checked={config.hotkeysEnabled} onCheckedChange={config.setHotkeysEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="theme">Theme</Label>
            <Select value={config.theme} onValueChange={config.setTheme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Auto-save Interval ({config.autoSaveInterval === 0 ? "Disabled" : `${config.autoSaveInterval}ms`})
            </Label>
            <Slider
              value={[config.autoSaveInterval]}
              onValueChange={([value]) => config.setAutoSaveInterval(value)}
              max={10000}
              step={1000}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="offline-badge">Show Offline Badge</Label>
            <Switch id="offline-badge" checked={config.showOfflineBadge} onCheckedChange={config.setShowOfflineBadge} />
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="youtube-key">YouTube API Key</Label>
            <Input
              id="youtube-key"
              type="password"
              placeholder="Leave empty if not using"
              value={config.youtubeApiKey}
              onChange={(e) => config.setApiKeys({ youtubeApiKey: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="genius-key">Genius API Key</Label>
            <Input
              id="genius-key"
              type="password"
              placeholder="Leave empty if not using"
              value={config.geniusApiKey}
              onChange={(e) => config.setApiKeys({ geniusApiKey: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="serp-key">SerpAPI Key</Label>
            <Input
              id="serp-key"
              type="password"
              placeholder="Leave empty if not using"
              value={config.serpApiKey}
              onChange={(e) => config.setApiKeys({ serpApiKey: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Import/Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleExportSettings} data-testid="export-settings">
              <Download className="h-4 w-4 mr-2" />
              Export Settings
            </Button>
            <Button onClick={handleImportSettings} variant="outline" data-testid="import-settings">
              <Upload className="h-4 w-4 mr-2" />
              Import Settings
            </Button>
          </div>

          <div>
            <Label htmlFor="import-json">Paste Settings JSON</Label>
            <Textarea
              id="import-json"
              placeholder="Paste exported settings JSON here..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="min-h-[100px] font-mono text-sm"
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" data-testid="reset-app">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset App (Clear All Data)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Application</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your data including presets, history, and settings. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetApp} className="bg-destructive text-destructive-foreground">
                  Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
