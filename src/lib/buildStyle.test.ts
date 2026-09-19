import { describe, it, expect } from "vitest"
import { buildStyle } from "./buildStyle"

describe("buildStyle", () => {
  const baseParams = {
    bpm: 148,
    key: "D# minor",
    vocal: "female",
    era: "2000s",
    mood: "euphoric",
    stylePct: 80,
    weirdPct: 20,
    toggles: {
      introNoKick: false,
      acapellaOnly: false,
      noInstruments: false,
      dryVocals: false,
    },
    referenceArtists: [],
  }

  it("should return preset styleLine when preset is provided", () => {
    const preset = { styleLine: "Custom preset style line" }
    const result = buildStyle(baseParams, preset)
    expect(result).toBe("Custom preset style line")
  })

  it("should generate auto style with introNoKick toggle", () => {
    const params = {
      ...baseParams,
      toggles: {
        ...baseParams.toggles,
        introNoKick: true,
      },
    }
    const result = buildStyle(params)
    expect(result).toBe(
      "2000s Remember Dance, 148 BPM, key D# minor, female vocals, euphoric, intro with pads only (no kick), driving hi-hats, bright trance leads, rolling bassline, euphoric and nostalgic, clean club mix",
    )
  })

  it("should append reference artists when provided", () => {
    const params = {
      ...baseParams,
      referenceArtists: ["Cascada", "Basshunter", "Scooter"],
    }
    const result = buildStyle(params)
    expect(result).toBe(
      "2000s Remember Dance, 148 BPM, key D# minor, female vocals, euphoric, driving hi-hats, bright trance leads, rolling bassline, euphoric and nostalgic, clean club mix, in the style of Cascada, Basshunter, Scooter",
    )
  })

  it("should handle empty mood", () => {
    const params = {
      ...baseParams,
      mood: "",
    }
    const result = buildStyle(params)
    expect(result).toBe(
      "2000s Remember Dance, 148 BPM, key D# minor, female vocals, driving hi-hats, bright trance leads, rolling bassline, euphoric and nostalgic, clean club mix",
    )
  })
})
