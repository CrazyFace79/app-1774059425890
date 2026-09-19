"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useMetaStore } from "@/store/meta-store"
import { useStylesStore } from "@/store/styles-store"
import { useLyricsStore } from "@/store/lyrics-store"
import { buildStyle } from "@/lib/buildStyle"
import { Search, Download, Upload, Star, Play, Plus, Edit, Trash2 } from "lucide-react"

export function StylesTab() {
  const { toast } = useToast()
  const { setPresetId, setBpm, setKey, setVocal, setStylePct, setWeirdPct, setEra, setMood, setStyle } = useMetaStore()
  const { setStyleLine } = useLyricsStore()

  const {
    presets,
    selectedPreset,
    isLoading,
    searchQuery,
    loadPresets,
    createPreset,
    updatePreset,
    deletePreset,
    selectPreset,
    setSearchQuery,
    exportPresets,
    importPresets,
    getFilteredPresets,
  } = useStylesStore()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const handleApplyPreset = async (preset: any) => {
    setPresetId(preset.id)
    setBpm(preset.bpm)
    setKey(preset.key)
    setVocal(preset.vocal)
    setEra(preset.era)
    setMood(preset.mood)

    const generatedStyle = buildStyle({
      bpm: preset.bpm,
      key: preset.key,
      vocal: preset.vocal,
      era: preset.era,
      mood: preset.mood,
      flags: preset.flags,
      referenceArtists: preset.referenceArtists,
    })

    setStyle(generatedStyle)
    setStyleLine(generatedStyle)

    toast({ title: `Applied preset: ${preset.name}` })
  }

  const handleExportPresets = () => {
    const jsonData = exportPresets()
    const blob = new Blob([jsonData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vdamm_presets_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Presets exported successfully" })
  }

  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const jsonData = e.target?.result as string
        await importPresets(jsonData)
        toast({ title: "Presets imported successfully" })
      } catch (error) {
        toast({ title: "Failed to import presets", variant: "destructive" })
      }
    }
    reader.readAsText(file)
  }

  const handleCreatePreset = async () => {
    try {
      await createPreset({
        name: formData.name,
        bpm: Number.parseInt(formData.bpm),
        key: formData.key,
        vocal: formData.vocal,
        era: formData.era,
        mood: formData.mood,
        flags: formData.flags || {},
        referenceArtists: formData.referenceArtists?.split(",").map((s: string) => s.trim()) || [],
        description: formData.description,
        isDefault: false,
      })
      setIsCreateDialogOpen(false)
      setFormData({})
      toast({ title: "Preset created successfully" })
    } catch (error) {
      toast({ title: "Failed to create preset", variant: "destructive" })
    }
  }

  const handleUpdatePreset = async () => {
    if (!selectedPreset) return
    try {
      await updatePreset(selectedPreset.id, {
        name: formData.name,
        bpm: Number.parseInt(formData.bpm),
        key: formData.key,
        vocal: formData.vocal,
        era: formData.era,
        mood: formData.mood,
        flags: formData.flags || {},
        referenceArtists: formData.referenceArtists?.split(",").map((s: string) => s.trim()) || [],
        description: formData.description,
      })
      setIsEditDialogOpen(false)
      setFormData({})
      toast({ title: "Preset updated successfully" })
    } catch (error) {
      toast({ title: "Failed to update preset", variant: "destructive" })
    }
  }

  const handleDeletePreset = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deletePreset(id)
        toast({ title: "Preset deleted successfully" })
      } catch (error) {
        toast({ title: "Failed to delete preset", variant: "destructive" })
      }
    }
  }

  const filteredPresets = getFilteredPresets()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Style Presets Library
            <div className="flex gap-2">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Preset
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Preset</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bpm">BPM</Label>
                        <Input
                          id="bpm"
                          type="number"
                          value={formData.bpm || ""}
                          onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="key">Key</Label>
                        <Input
                          id="key"
                          value={formData.key || ""}
                          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="vocal">Vocal</Label>
                        <Select
                          value={formData.vocal || ""}
                          onValueChange={(value) => setFormData({ ...formData, vocal: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="era">Era</Label>
                        <Input
                          id="era"
                          value={formData.era || ""}
                          onChange={(e) => setFormData({ ...formData, era: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mood">Mood</Label>
                        <Input
                          id="mood"
                          value={formData.mood || ""}
                          onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="artists">Reference Artists (comma-separated)</Label>
                      <Input
                        id="artists"
                        value={formData.referenceArtists || ""}
                        onChange={(e) => setFormData({ ...formData, referenceArtists: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleCreatePreset} className="w-full">
                      Create Preset
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={handleExportPresets} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import JSON
                  </span>
                </Button>
                <input type="file" accept=".json" onChange={handleImportPresets} className="hidden" />
              </label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search presets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">
              {filteredPresets.length} preset{filteredPresets.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Loading presets...</div>
        ) : filteredPresets.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">No presets found</div>
        ) : (
          filteredPresets.map((preset) => (
            <Card key={preset.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {preset.name}
                      {preset.isDefault && <Star className="w-4 h-4 text-yellow-500" />}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{preset.description}</p>
                  </div>
                  {!preset.isDefault && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          selectPreset(preset)
                          setFormData({
                            name: preset.name,
                            bpm: preset.bpm.toString(),
                            key: preset.key,
                            vocal: preset.vocal,
                            era: preset.era,
                            mood: preset.mood,
                            description: preset.description,
                            referenceArtists: preset.referenceArtists.join(", "),
                            flags: preset.flags,
                          })
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePreset(preset.id, preset.name)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">BPM:</span> {preset.bpm}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key:</span> {preset.key}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vocal:</span> {preset.vocal}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Era:</span> {preset.era}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reference Artists:</p>
                  <div className="flex flex-wrap gap-1">
                    {preset.referenceArtists.map((artist, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {artist}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button onClick={() => handleApplyPreset(preset)} className="w-full" variant="default">
                  <Play className="w-4 h-4 mr-2" />
                  Apply Preset
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-bpm">BPM</Label>
                <Input
                  id="edit-bpm"
                  type="number"
                  value={formData.bpm || ""}
                  onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-key">Key</Label>
                <Input
                  id="edit-key"
                  value={formData.key || ""}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-vocal">Vocal</Label>
                <Select
                  value={formData.vocal || ""}
                  onValueChange={(value) => setFormData({ ...formData, vocal: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-era">Era</Label>
                <Input
                  id="edit-era"
                  value={formData.era || ""}
                  onChange={(e) => setFormData({ ...formData, era: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-mood">Mood</Label>
                <Input
                  id="edit-mood"
                  value={formData.mood || ""}
                  onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-artists">Reference Artists (comma-separated)</Label>
              <Input
                id="edit-artists"
                value={formData.referenceArtists || ""}
                onChange={(e) => setFormData({ ...formData, referenceArtists: e.target.value })}
              />
            </div>
            <Button onClick={handleUpdatePreset} className="w-full">
              Update Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
