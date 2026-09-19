// src/store/presets.ts
export type StylePreset = {
  id: string
  name: string
  bpm: number
  key: string
  styleLine: string
  tags: string[]
  toggles: { introNoKick: boolean; acapellaOnly: boolean; dryVocals: boolean; noInstruments: boolean }
  defaults: { stylePct: number; weirdPct: number; vocal: "female" | "male" | "duet"; era: string; mood: string }
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "original_gospel_148",
    name: "Original Gospel 148",
    bpm: 148,
    key: "D# minor",
    styleLine:
      "Extreme energy uplifting, 148 BPM, euphoric anthem with gospel-style female vocals and layered harmonies, Inspired by Cobra, 90s/2000s remember dance production with dramatic vocal intensity and emotional peaks, Classic eurodance arrangement with duet vocal interplay and modern clarity, Build gradually with atmospheric pads and vocal elements before kick entry - no purely musical sections",
    tags: ["remember", "gospel", "eurodance"],
    toggles: { introNoKick: true, acapellaOnly: false, dryVocals: false, noInstruments: false },
    defaults: { stylePct: 70, weirdPct: 15, vocal: "female", era: "2000s", mood: "euphoric & nostalgic" },
  },
  {
    id: "diva_148",
    name: "Soulful Diva 148",
    bpm: 148,
    key: "D# minor",
    styleLine:
      "Extreme energy uplifting, 148 BPM, euphoric anthem with soulful diva-style female vocals and strong harmonies, Inspired by Cobra, 90s/2000s remember dance production with dramatic vocal intensity and emotional peaks, Classic eurodance arrangement with duet vocal interplay and modern clarity, Build gradually with atmospheric pads and vocal elements before kick entry - no purely musical sections",
    tags: ["remember", "diva", "eurodance"],
    toggles: { introNoKick: true, acapellaOnly: false, dryVocals: false, noInstruments: false },
    defaults: { stylePct: 75, weirdPct: 15, vocal: "female", era: "2000s", mood: "euphoric & nostalgic" },
  },
  {
    id: "cantadita_club_148",
    name: "Cantadita Club 148",
    bpm: 148,
    key: "D# minor",
    styleLine:
      "Extreme energy uplifting, 148 BPM, euphoric anthem with cantadita-style female vocals and club harmonies, Inspired by Cobra, 90s/2000s remember dance production with dramatic vocal intensity and emotional peaks, Classic eurodance arrangement with duet vocal interplay and modern clarity, Build gradually with atmospheric pads and vocal elements before kick entry - no purely musical sections",
    tags: ["remember", "cantadita", "club"],
    toggles: { introNoKick: true, acapellaOnly: false, dryVocals: false, noInstruments: false },
    defaults: { stylePct: 80, weirdPct: 10, vocal: "female", era: "2000s", mood: "euphoric & nostalgic" },
  },
  {
    id: "trance_vocal_2003",
    name: "Trance Vocal 2003",
    bpm: 138,
    key: "A minor",
    styleLine:
      "Uplifting trance, 138 BPM, emotional vocal trance with ethereal female vocals and atmospheric pads, Inspired by classic 2003 trance productions, Progressive build-ups with emotional breakdowns and euphoric drops, Modern trance arrangement with vocal emphasis and melodic leads, Build gradually with atmospheric elements before main drop",
    tags: ["trance", "vocal", "2003"],
    toggles: { introNoKick: true, acapellaOnly: false, dryVocals: false, noInstruments: false },
    defaults: { stylePct: 85, weirdPct: 5, vocal: "female", era: "2003", mood: "uplifting & emotional" },
  },
  {
    id: "hardhouse_base",
    name: "Hardhouse Base",
    bpm: 150,
    key: "F# minor",
    styleLine:
      "Hard house energy, 150 BPM, driving hardhouse with powerful vocals and aggressive synths, Inspired by UK hardhouse scene, Relentless energy with pounding kicks and acid-influenced leads, Modern hardhouse production with vocal hooks and driving basslines, Immediate impact with full energy from start",
    tags: ["hardhouse", "driving", "uk"],
    toggles: { introNoKick: false, acapellaOnly: false, dryVocals: true, noInstruments: false },
    defaults: { stylePct: 90, weirdPct: 20, vocal: "male", era: "2000s", mood: "aggressive & driving" },
  },
  {
    id: "rock_acapella",
    name: "Rock Acapella",
    bpm: 120,
    key: "E minor",
    styleLine:
      "Rock-influenced acapella, 120 BPM, powerful vocal arrangements with rock energy and harmonies, Inspired by rock vocal traditions, Strong vocal presence with minimal instrumentation focus, Acapella-focused production with vocal layering and rock attitude, Vocal-driven arrangement with minimal backing",
    tags: ["rock", "acapella", "vocal"],
    toggles: { introNoKick: true, acapellaOnly: true, dryVocals: true, noInstruments: true },
    defaults: { stylePct: 60, weirdPct: 25, vocal: "duet", era: "2000s", mood: "powerful & raw" },
  },
]
