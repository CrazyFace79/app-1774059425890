import { create } from "zustand"
import { STYLE_PRESETS, type StylePreset } from "@/store/presets"

type LibraryPreset = StylePreset & {
  vocal?: string
  era?: string
  mood?: string
  description?: string
  isDefault?: boolean
  referenceArtists?: string[]
  flags?: Record<string, boolean>
}

interface StylesState {
  presets: LibraryPreset[]
  selectedPreset: LibraryPreset | null
  isLoading: boolean
  searchQuery: string
  loadPresets: () => Promise<void>
  createPreset: (preset: Omit<LibraryPreset, "id">) => Promise<void>
  updatePreset: (id: string, updates: Partial<LibraryPreset>) => Promise<void>
  deletePreset: (id: string) => Promise<void>
  selectPreset: (preset: LibraryPreset) => void
  setSearchQuery: (query: string) => void
  exportPresets: () => string
  importPresets: (jsonData: string) => Promise<void>
  getFilteredPresets: () => LibraryPreset[]
}

export const useStylesStore = create<StylesState>((set, get) => ({
  presets: [],
  selectedPreset: null,
  isLoading: false,
  searchQuery: "",

  loadPresets: async () => {
    set({ isLoading: true })
    try {
      const presets = STYLE_PRESETS.map((preset) => ({
        ...preset,
        vocal: preset.defaults.vocal,
        era: preset.defaults.era,
        mood: preset.defaults.mood,
        description: preset.styleLine,
        isDefault: true,
        referenceArtists: [],
        flags: {
          introWithoutKick: preset.toggles.introNoKick,
          acapellaOnly: preset.toggles.acapellaOnly,
          dryVocals: preset.toggles.dryVocals,
          noInstruments: preset.toggles.noInstruments,
        },
      }))
      set({ presets, isLoading: false })
    } catch (error) {
      console.error("Failed to load presets:", error)
      set({ isLoading: false })
    }
  },

  createPreset: async (presetData) => {
    const preset: LibraryPreset = {
      ...presetData,
      id: crypto.randomUUID(),
    }

    set((state) => ({ presets: [...state.presets, preset] }))
  },

  updatePreset: async (id, updates) => {
    set((state) => ({
      presets: state.presets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  },

  deletePreset: async (id) => {
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
      selectedPreset: state.selectedPreset?.id === id ? null : state.selectedPreset,
    }))
  },

  selectPreset: (preset) => set({ selectedPreset: preset }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  exportPresets: () => {
    const { presets } = get()
    return JSON.stringify(presets, null, 2)
  },

  importPresets: async (jsonData) => {
    try {
      const importedPresets: LibraryPreset[] = JSON.parse(jsonData)
      set((state) => ({ presets: [...state.presets, ...importedPresets] }))
    } catch (error) {
      throw new Error("Invalid JSON format")
    }
  },

  getFilteredPresets: () => {
    const { presets, searchQuery } = get()
    if (!searchQuery.trim()) return presets

    const query = searchQuery.toLowerCase()
    return presets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(query) ||
        preset.styleLine.toLowerCase().includes(query) ||
        preset.key.toLowerCase().includes(query) ||
        preset.defaults.vocal.toLowerCase().includes(query) ||
        preset.tags.some((tag) => tag.toLowerCase().includes(query)),
    )
  },
}))
