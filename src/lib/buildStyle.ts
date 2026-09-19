interface BuildStyleParams {
  bpm: number
  key: string
  vocal: string
  era: string
  mood: string
  stylePct: number
  weirdPct: number
  toggles: {
    introNoKick: boolean
    acapellaOnly: boolean
    noInstruments: boolean
    dryVocals: boolean
  }
  referenceArtists: string[]
}

interface Preset {
  styleLine: string
}

export function buildStyle(params: BuildStyleParams, preset?: Preset): string {
  // If preset exists, return its styleLine unchanged
  if (preset) {
    return preset.styleLine
  }

  // Build automatic style line
  const { bpm, key, vocal, era, mood, toggles, referenceArtists } = params

  let styleLine = `${era} Remember Dance, ${bpm} BPM, key ${key}, ${vocal} vocals`

  if (mood) {
    styleLine += `, ${mood}`
  }

  if (toggles.introNoKick) {
    styleLine += ", intro with pads only (no kick), "
  } else {
    styleLine += ", "
  }

  styleLine += "driving hi-hats, bright trance leads, rolling bassline, euphoric and nostalgic, clean club mix"

  if (referenceArtists.length > 0) {
    styleLine += `, in the style of ${referenceArtists.join(", ")}`
  }

  return styleLine
}
