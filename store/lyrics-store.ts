import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface LyricsSection {
  id: string
  type: "intro" | "verse" | "pre-chorus" | "chorus" | "bridge" | "outro"
  lines: string[]
  errors: string[]
}

interface LyricsState {
  sections: LyricsSection[]
  validationErrors: Record<string, string[]>
  setSections: (sections: LyricsSection[]) => void
  updateSection: (id: string, lines: string[]) => void
  addSection: (section: LyricsSection) => void
  removeSection: (id: string) => void
  validateSection: (id: string) => void
  validateAll: () => boolean
}

export const useLyricsStore = create<LyricsState>()(
  persist(
    (set, get) => ({
      sections: [],
      validationErrors: {},
      setSections: (sections) => set({ sections }),
      updateSection: (id, lines) => {
        const sections = get().sections.map((section) => (section.id === id ? { ...section, lines } : section))
        set({ sections })
        get().validateSection(id)
      },
      addSection: (section) => {
        set((state) => ({ sections: [...state.sections, section] }))
      },
      removeSection: (id) => {
        set((state) => ({
          sections: state.sections.filter((s) => s.id !== id),
          validationErrors: Object.fromEntries(Object.entries(state.validationErrors).filter(([key]) => key !== id)),
        }))
      },
      validateSection: (id) => {
        const section = get().sections.find((s) => s.id === id)
        if (!section) return

        const validators = {
          linesPerSection: true,
          wordsPerLine: true,
          chorusRepeat: true,
          forbiddenWords: true,
        }

        const errors: string[] = []

        // Rule: exactly 8 lines (if enabled)
        if (validators.linesPerSection && section.lines.length !== 8) {
          errors.push(`Must have exactly 8 lines (current: ${section.lines.length})`)
        }

        // Rule: 3-4 words per line (if enabled)
        if (validators.wordsPerLine) {
          section.lines.forEach((line, index) => {
            const words = line
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0)
            if (words.length < 3 || words.length > 4) {
              errors.push(`Line ${index + 1}: Must have 3-4 words (current: ${words.length})`)
            }
          })
        }

        // Rule: chorus line 1 === line 5 (if enabled)
        if (validators.chorusRepeat && section.type === "chorus" && section.lines.length >= 5) {
          if (section.lines[0].trim() !== section.lines[4].trim()) {
            errors.push("Chorus: Line 1 must be identical to line 5")
          }
        }

        // Rule: no forbidden words (if enabled)
        if (validators.forbiddenWords) {
          const forbiddenWords = ["oh-oh", "yeah-yeah"]
          section.lines.forEach((line, index) => {
            forbiddenWords.forEach((word) => {
              if (line.toLowerCase().includes(word.toLowerCase())) {
                errors.push(`Line ${index + 1}: Contains forbidden word "${word}"`)
              }
            })
          })
        }

        set((state) => ({
          validationErrors: {
            ...state.validationErrors,
            [id]: errors,
          },
        }))
      },
      validateAll: () => {
        const sections = get().sections
        sections.forEach((section) => get().validateSection(section.id))
        const errors = get().validationErrors
        return Object.values(errors).every((sectionErrors) => sectionErrors.length === 0)
      },
    }),
    {
      name: "vdamm-lyrics-store",
    },
  ),
)
