import Dexie, { type Table } from "dexie"

export interface StylePreset {
  id: string
  name: string
  bpm: number
  key: string
  vocal: string
  era: string
  mood: string
  flags: {
    introWithoutKick: boolean
    drivingHats: boolean
    brightLeads: boolean
    rollingBass: boolean
    acapellaOnly: boolean
    dryVocals: boolean
  }
  referenceArtists: string[]
  description: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  style: string
  lyrics: string
  bpm: number
  key: string
  presetId: string
  toggles: {
    acapellaOnly: boolean
    noInstruments: boolean
    dryVocals: boolean
    introWithoutKick: boolean
  }
  hash: string
  pinned: boolean
}

export class VdammDatabase extends Dexie {
  stylePresets!: Table<StylePreset>
  history!: Table<HistoryEntry>

  constructor() {
    super("VdammDatabase")
    this.version(1).stores({
      stylePresets: "id, name, bpm, key, vocal, era, isDefault, createdAt",
      history: "id, timestamp, presetId, pinned, hash",
    })
  }
}

export const db = new VdammDatabase()

// Initialize default presets
export const initializeDefaultPresets = async () => {
  const count = await db.stylePresets.count()
  if (count === 0) {
    const defaultPresets: StylePreset[] = [
      {
        id: "2000s-remember-default",
        name: "2000s Remember (Default)",
        bpm: 148,
        key: "D# minor",
        vocal: "female",
        era: "2000s",
        mood: "euphoric",
        flags: {
          introWithoutKick: true,
          drivingHats: true,
          brightLeads: true,
          rollingBass: true,
          acapellaOnly: false,
          dryVocals: false,
        },
        referenceArtists: ["Cascada", "Basshunter", "Scooter"],
        description: "Classic 2000s Eurodance with emotional vocals and nostalgic feel",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "cantadita-club",
        name: "Cantadita Club",
        bpm: 132,
        key: "A minor",
        vocal: "female",
        era: "2000s",
        mood: "playful",
        flags: {
          introWithoutKick: false,
          drivingHats: true,
          brightLeads: false,
          rollingBass: true,
          acapellaOnly: false,
          dryVocals: true,
        },
        referenceArtists: ["Las Ketchup", "King Africa"],
        description: "Spanish-influenced club sound with catchy vocal hooks",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "trance-vocal-2003",
        name: "Trance Vocal 2003",
        bpm: 138,
        key: "F# minor",
        vocal: "female",
        era: "2003",
        mood: "emotional",
        flags: {
          introWithoutKick: true,
          drivingHats: false,
          brightLeads: true,
          rollingBass: false,
          acapellaOnly: false,
          dryVocals: false,
        },
        referenceArtists: ["ATB", "Armin van Buuren", "Above & Beyond"],
        description: "Emotional trance with soaring vocals and uplifting breakdowns",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "hardhouse-base",
        name: "Hardhouse Base",
        bpm: 155,
        key: "E minor",
        vocal: "male",
        era: "2000s",
        mood: "aggressive",
        flags: {
          introWithoutKick: false,
          drivingHats: true,
          brightLeads: false,
          rollingBass: true,
          acapellaOnly: false,
          dryVocals: true,
        },
        referenceArtists: ["Scooter", "Dune", "Brooklyn Bounce"],
        description: "Hard-hitting house with aggressive vocals and driving beats",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "rock-acapella",
        name: "Rock Acapella",
        bpm: 120,
        key: "G major",
        vocal: "mixed",
        era: "2000s",
        mood: "energetic",
        flags: {
          introWithoutKick: true,
          drivingHats: false,
          brightLeads: false,
          rollingBass: false,
          acapellaOnly: true,
          dryVocals: true,
        },
        referenceArtists: ["Pentatonix", "Rockapella"],
        description: "Pure vocal arrangement with rock-inspired harmonies",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    await db.stylePresets.bulkAdd(defaultPresets)
  }
}
