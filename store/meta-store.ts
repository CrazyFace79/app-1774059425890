import { create } from "zustand"
import { persist } from "zustand/middleware"
import { buildStyle } from "@/lib/buildStyle"

interface MetaState {
  bpm: number
  key: string
  vocal: string
  era: string
  mood: string
  stylePercentage: number
  weirdnessPercentage: number
  acapellaOnly: boolean
  noInstruments: boolean
  dryVocals: boolean
  introWithoutKick: boolean
  referenceNotes: string
  referenceArtists: string[]
  presetId: string
  style: string
  setBpm: (bpm: number) => void
  setKey: (key: string) => void
  setVocal: (vocal: string) => void
  setEra: (era: string) => void
  setMood: (mood: string) => void
  setStylePercentage: (percentage: number) => void
  setWeirdnessPercentage: (percentage: number) => void
  setAcapellaOnly: (enabled: boolean) => void
  setNoInstruments: (enabled: boolean) => void
  setDryVocals: (enabled: boolean) => void
  setIntroWithoutKick: (enabled: boolean) => void
  setReferenceNotes: (notes: string) => void
  setReferenceArtists: (artists: string[]) => void
  setPresetId: (id: string) => void
  setStyle: (style: string) => void
  generateStyleLine: () => string
  updateStyleFromParams: () => void
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      bpm: 148,
      key: "D# minor",
      vocal: "female",
      era: "2000s",
      mood: "euphoric",
      stylePercentage: 80,
      weirdnessPercentage: 20,
      acapellaOnly: false,
      noInstruments: false,
      dryVocals: false,
      introWithoutKick: true,
      referenceNotes: "",
      referenceArtists: [],
      presetId: "original_gospel_148",
      style: "",

      setBpm: (bpm) => {
        set({ bpm })
        get().updateStyleFromParams()
      },
      setKey: (key) => {
        set({ key })
        get().updateStyleFromParams()
      },
      setVocal: (vocal) => {
        set({ vocal })
        get().updateStyleFromParams()
      },
      setEra: (era) => {
        set({ era })
        get().updateStyleFromParams()
      },
      setMood: (mood) => {
        set({ mood })
        get().updateStyleFromParams()
      },
      setStylePercentage: (percentage) => {
        set({ stylePercentage: percentage })
        get().updateStyleFromParams()
      },
      setWeirdnessPercentage: (percentage) => {
        set({ weirdnessPercentage: percentage })
        get().updateStyleFromParams()
      },
      setAcapellaOnly: (enabled) => {
        set({ acapellaOnly: enabled })
        get().updateStyleFromParams()
      },
      setNoInstruments: (enabled) => {
        set({ noInstruments: enabled })
        get().updateStyleFromParams()
      },
      setDryVocals: (enabled) => {
        set({ dryVocals: enabled })
        get().updateStyleFromParams()
      },
      setIntroWithoutKick: (enabled) => {
        set({ introWithoutKick: enabled })
        get().updateStyleFromParams()
      },
      setReferenceNotes: (notes) => set({ referenceNotes: notes }),
      setReferenceArtists: (artists) => {
        set({ referenceArtists: artists })
        get().updateStyleFromParams()
      },
      setPresetId: (id) => set({ presetId: id }),
      setStyle: (style) => set({ style }),

      generateStyleLine: () => {
        const state = get()
        const parts = [
          `${state.era} Remember Dance`,
          `${state.bpm} BPM`,
          `key ${state.key}`,
          `emotional ${state.vocal} vocals with reverb and delay`,
        ]

        if (state.introWithoutKick) parts.push("intro with pads only (no kick)")
        if (!state.noInstruments) {
          parts.push("driving hi-hats", "bright trance leads", "rolling bassline")
        }
        if (state.dryVocals) parts.push("dry vocals")
        if (state.acapellaOnly) parts.push("acapella only")

        parts.push(`${state.mood} and nostalgic`, "clean club mix")

        if (state.referenceArtists.length > 0) {
          parts.push(`in the style of ${state.referenceArtists.join(", ")}`)
        }

        return parts.join(", ")
      },

      updateStyleFromParams: () => {
        const state = get()
        const generatedStyle = buildStyle({
          bpm: state.bpm,
          key: state.key,
          vocal: state.vocal,
          era: state.era,
          mood: state.mood,
          stylePercentage: state.stylePercentage,
          weirdnessPercentage: state.weirdnessPercentage,
          toggles: {
            introNoKick: state.introWithoutKick,
            acapellaOnly: state.acapellaOnly,
            dryVocals: state.dryVocals,
            noInstruments: state.noInstruments,
          },
          referenceArtists: state.referenceArtists,
          presetId: state.presetId,
        })
        set({ style: generatedStyle })
      },
    }),
    {
      name: "vdamm-meta-store",
    },
  ),
)
