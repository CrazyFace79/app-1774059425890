import { create } from "zustand"
import { persist } from "zustand/middleware"
import { db } from "@/lib/database"

interface ConfigState {
  // Defaults
  defaultBpm: number
  defaultKey: string
  defaultVocal: string
  defaultEra: string
  defaultStylePct: number
  defaultWeirdnessPct: number

  // Validators
  validatorsEnabled: {
    linesPerSection: boolean
    wordsPerLine: boolean
    chorusRepeat: boolean
    forbiddenWords: boolean
  }

  // UI Settings
  hotkeysEnabled: boolean
  theme: "dark" | "light"
  autoSaveInterval: number // ms, 0 = disabled
  showOfflineBadge: boolean

  // API Keys (optional)
  youtubeApiKey: string
  geniusApiKey: string
  serpApiKey: string

  // Actions
  setDefaults: (
    defaults: Partial<
      Pick<
        ConfigState,
        "defaultBpm" | "defaultKey" | "defaultVocal" | "defaultEra" | "defaultStylePct" | "defaultWeirdnessPct"
      >
    >,
  ) => void
  setValidators: (validators: Partial<ConfigState["validatorsEnabled"]>) => void
  setHotkeysEnabled: (enabled: boolean) => void
  setTheme: (theme: "dark" | "light") => void
  setAutoSaveInterval: (interval: number) => void
  setShowOfflineBadge: (show: boolean) => void
  setApiKeys: (keys: Partial<Pick<ConfigState, "youtubeApiKey" | "geniusApiKey" | "serpApiKey">>) => void
  resetApp: () => Promise<void>
  exportSettings: () => string
  importSettings: (json: string) => boolean
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // Default values
      defaultBpm: 148,
      defaultKey: "D# minor",
      defaultVocal: "female",
      defaultEra: "2000s",
      defaultStylePct: 80,
      defaultWeirdnessPct: 20,

      // Validators (all enabled by default)
      validatorsEnabled: {
        linesPerSection: true,
        wordsPerLine: true,
        chorusRepeat: true,
        forbiddenWords: true,
      },

      // UI Settings
      hotkeysEnabled: true,
      theme: "dark",
      autoSaveInterval: 2000, // 2 seconds
      showOfflineBadge: true,

      // API Keys
      youtubeApiKey: "",
      geniusApiKey: "",
      serpApiKey: "",

      // Actions
      setDefaults: (defaults) => set((state) => ({ ...state, ...defaults })),

      setValidators: (validators) =>
        set((state) => ({
          validatorsEnabled: { ...state.validatorsEnabled, ...validators },
        })),

      setHotkeysEnabled: (enabled) => set({ hotkeysEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      setShowOfflineBadge: (show) => set({ showOfflineBadge: show }),

      setApiKeys: (keys) => set((state) => ({ ...state, ...keys })),

      resetApp: async () => {
        try {
          // Clear Zustand stores
          localStorage.clear()

          // Clear Dexie database
          await db.delete()
          await db.open()

          // Reload page to reset all state
          window.location.reload()
        } catch (error) {
          console.error("Failed to reset app:", error)
        }
      },

      exportSettings: () => {
        const state = get()
        const settings = {
          defaults: {
            bpm: state.defaultBpm,
            key: state.defaultKey,
            vocal: state.defaultVocal,
            era: state.defaultEra,
            stylePct: state.defaultStylePct,
            weirdnessPct: state.defaultWeirdnessPct,
          },
          validators: state.validatorsEnabled,
          ui: {
            hotkeysEnabled: state.hotkeysEnabled,
            theme: state.theme,
            autoSaveInterval: state.autoSaveInterval,
            showOfflineBadge: state.showOfflineBadge,
          },
          apiKeys: {
            youtubeApiKey: state.youtubeApiKey,
            geniusApiKey: state.geniusApiKey,
            serpApiKey: state.serpApiKey,
          },
        }
        return JSON.stringify(settings, null, 2)
      },

      importSettings: (json) => {
        try {
          const settings = JSON.parse(json)

          if (settings.defaults) {
            get().setDefaults(settings.defaults)
          }
          if (settings.validators) {
            get().setValidators(settings.validators)
          }
          if (settings.ui) {
            if (settings.ui.hotkeysEnabled !== undefined) get().setHotkeysEnabled(settings.ui.hotkeysEnabled)
            if (settings.ui.theme) get().setTheme(settings.ui.theme)
            if (settings.ui.autoSaveInterval !== undefined) get().setAutoSaveInterval(settings.ui.autoSaveInterval)
            if (settings.ui.showOfflineBadge !== undefined) get().setShowOfflineBadge(settings.ui.showOfflineBadge)
          }
          if (settings.apiKeys) {
            get().setApiKeys(settings.apiKeys)
          }

          return true
        } catch (error) {
          console.error("Failed to import settings:", error)
          return false
        }
      },
    }),
    {
      name: "vdamm-config-store",
    },
  ),
)
