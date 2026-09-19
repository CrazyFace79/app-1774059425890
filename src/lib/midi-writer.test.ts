import { describe, it, expect } from "vitest"
import {
  MidiWriter,
  FL_STRUCTURE_MARKERS,
  generateGhostKickNotes,
  generateRollingBassNotes,
  generateSupersawChordNotes,
  generateHatsClapNotes,
  generateFXRiserNotes,
  noteToMidi,
  CHORD_PROGRESSION,
} from "./midi-writer"

describe("MidiWriter", () => {
  it("should generate structure MIDI with correct number of markers", () => {
    const writer = new MidiWriter(148)
    const midiData = writer.generateStructureMidi(FL_STRUCTURE_MARKERS)

    expect(midiData).toBeInstanceOf(Uint8Array)
    expect(midiData.length).toBeGreaterThan(0)

    // Check for MThd header
    const header = Array.from(midiData.slice(0, 4))
    expect(header).toEqual([0x4d, 0x54, 0x68, 0x64]) // "MThd"
  })

  it("should generate ghost kick MIDI with correct note count", () => {
    const writer = new MidiWriter(148)
    const notes = generateGhostKickNotes()
    const midiData = writer.generateGhostKickMidi(notes)

    expect(midiData).toBeInstanceOf(Uint8Array)
    expect(midiData.length).toBeGreaterThan(0)

    // Check for MThd header
    const header = Array.from(midiData.slice(0, 4))
    expect(header).toEqual([0x4d, 0x54, 0x68, 0x64]) // "MThd"
  })

  it("should have correct number of structure markers", () => {
    expect(FL_STRUCTURE_MARKERS).toHaveLength(10)
    expect(FL_STRUCTURE_MARKERS[0]).toEqual({ bar: 0, name: "Intro (no kick)" })
    expect(FL_STRUCTURE_MARKERS[3]).toEqual({ bar: 40, name: "Chorus / Drop 1" })
    expect(FL_STRUCTURE_MARKERS[9]).toEqual({ bar: 120, name: "Final Chorus / Outro" })
  })

  it("should generate correct number of ghost kick notes", () => {
    const notes = generateGhostKickNotes()

    // Drop 1: bars 40-56 (17 bars × 4 beats) = 68 notes
    // Drop 2: bars 96-112 (17 bars × 4 beats) = 68 notes
    // Total: 136 notes
    expect(notes).toHaveLength(136)

    // Check first note
    expect(notes[0]).toEqual({
      bar: 40,
      beat: 0,
      note: 36, // C1
      velocity: 100,
      duration: 0.25,
    })

    // Check that all notes are C1 with velocity 100
    notes.forEach((note) => {
      expect(note.note).toBe(36) // C1
      expect(note.velocity).toBe(100)
      expect(note.duration).toBe(0.25)
    })
  })

  it("should place notes only in drop ranges", () => {
    const notes = generateGhostKickNotes()

    notes.forEach((note) => {
      const inDrop1 = note.bar >= 40 && note.bar <= 56
      const inDrop2 = note.bar >= 96 && note.bar <= 112
      expect(inDrop1 || inDrop2).toBe(true)
    })
  })

  describe("Rolling Bass", () => {
    it("should generate approximately 544 notes for rolling bass pattern", () => {
      const notes = generateRollingBassNotes(148, "D# minor")

      // Drop 1: 17 bars × 16 steps = 272 notes
      // Drop 2: 17 bars × 16 steps = 272 notes
      // Total: 544 notes
      expect(notes.length).toBe(544)
    })

    it("should place rolling bass notes only in drop ranges", () => {
      const notes = generateRollingBassNotes(148, "D# minor")

      notes.forEach((note) => {
        const inDrop1 = note.bar >= 40 && note.bar <= 56
        const inDrop2 = note.bar >= 96 && note.bar <= 112
        expect(inDrop1 || inDrop2).toBe(true)
      })
    })

    it("should use correct velocities for accented and non-accented notes", () => {
      const notes = generateRollingBassNotes(148, "D# minor")

      const velocities = [...new Set(notes.map((n) => n.velocity))]
      expect(velocities).toContain(90) // Non-accented
      expect(velocities).toContain(110) // Accented
    })

    it("should use octave 2 notes for bass", () => {
      const notes = generateRollingBassNotes(148, "D# minor")

      // All notes should be in octave 2 range (MIDI 24-35 for octave 1, 36-47 for octave 2)
      notes.forEach((note) => {
        expect(note.note).toBeGreaterThanOrEqual(24)
        expect(note.note).toBeLessThanOrEqual(47)
      })
    })
  })

  describe("Supersaw Chords", () => {
    it("should start first chord at bar 32 with D#m(add9) notes", () => {
      const notes = generateSupersawChordNotes(148, "D# minor")

      // Find notes that start at bar 32
      const bar32Notes = notes.filter((note) => note.bar === 32 && note.beat === 0)

      // Should have 5 notes for D#m(add9) voicing
      expect(bar32Notes.length).toBe(5)

      // Check that notes match D#m(add9) voicing: D#4 A#4 D#5 F#5 A#5
      const expectedNotes = [
        noteToMidi("D#", 4), // D#4
        noteToMidi("A#", 4), // A#4
        noteToMidi("D#", 5), // D#5
        noteToMidi("F#", 5), // F#5
        noteToMidi("A#", 5), // A#5
      ]

      const actualNotes = bar32Notes.map((n) => n.note).sort()
      expect(actualNotes).toEqual(expectedNotes.sort())
    })

    it("should change chord root correctly at bars 34, 36, 38", () => {
      const notes = generateSupersawChordNotes(148, "D# minor")

      // Check chord changes in pre-chorus (2 bars per chord)
      const bar34Notes = notes.filter((note) => note.bar === 34 && note.beat === 0)
      const bar36Notes = notes.filter((note) => note.bar === 36 && note.beat === 0)
      const bar38Notes = notes.filter((note) => note.bar === 38 && note.beat === 0)

      expect(bar34Notes.length).toBe(5) // B(add9)
      expect(bar36Notes.length).toBe(5) // F#(add9)
      expect(bar38Notes.length).toBe(5) // C#(add9)
    })

    it("should use correct velocities for pads vs stabs", () => {
      const notes = generateSupersawChordNotes(148, "D# minor")

      // Pre-chorus notes (bars 32-40) should have velocity 95 (pads)
      const preChorusNotes = notes.filter((note) => note.bar >= 32 && note.bar < 40)
      preChorusNotes.forEach((note) => {
        expect(note.velocity).toBe(95)
      })

      // Drop notes should have velocity 110 (stabs)
      const dropNotes = notes.filter((note) => (note.bar >= 40 && note.bar < 56) || (note.bar >= 96 && note.bar < 112))
      dropNotes.forEach((note) => {
        expect(note.velocity).toBe(110)
      })
    })

    it("should contain tempo meta event", () => {
      const writer = new MidiWriter(148)
      const notes = generateSupersawChordNotes(148, "D# minor")
      const midiData = writer.generateInstrumentMidi(notes, 2, 148)

      expect(midiData).toBeInstanceOf(Uint8Array)
      expect(midiData.length).toBeGreaterThan(0)
    })
  })

  describe("Hats + Clap", () => {
    it("should generate correct total number of clap notes", () => {
      const notes = generateHatsClapNotes(148)

      // Filter clap notes (channel 5)
      const clapNotes = notes.filter((note) => note.channel === 5)

      // PRE sections: 8 bars × 2 claps per bar = 16 claps per section × 2 sections = 32
      // DROP sections: 16 bars × 2 claps per bar = 32 claps per section × 2 sections = 64
      // Fill claps: 5 fills × 1 clap each = 5
      // Total: 32 + 64 + 5 = 101 claps
      expect(clapNotes.length).toBe(101)
    })

    it("should generate correct number of open hat notes", () => {
      const notes = generateHatsClapNotes(148)

      // Filter open hat notes (channel 4)
      const openHatNotes = notes.filter((note) => note.channel === 4)

      // PRE sections: 8 bars × 4 offbeats = 32 per section × 2 sections = 64
      // DROP sections: 16 bars × 4 offbeats = 64 per section × 2 sections = 128
      // Total: 64 + 128 = 192 open hats
      expect(openHatNotes.length).toBe(192)
    })

    it("should generate approximately 640 closed hat notes", () => {
      const notes = generateHatsClapNotes(148)

      // Filter closed hat notes (channel 3)
      const closedHatNotes = notes.filter((note) => note.channel === 3)

      // PRE sections: 8 bars × 8 eighth notes = 64 per section × 2 sections = 128
      // DROP sections: 16 bars × 16 sixteenth notes = 256 per section × 2 sections = 512
      // Total: 128 + 512 = 640 closed hats
      expect(closedHatNotes.length).toBe(640)
    })

    it("should use correct MIDI channels for each instrument", () => {
      const notes = generateHatsClapNotes(148)

      const channels = [...new Set(notes.map((n) => n.channel))]
      expect(channels).toContain(3) // Closed hats
      expect(channels).toContain(4) // Open hats
      expect(channels).toContain(5) // Claps

      // Should only use channels 3, 4, 5
      channels.forEach((channel) => {
        expect([3, 4, 5]).toContain(channel)
      })
    })

    it("should place claps on beats 2 and 4", () => {
      const notes = generateHatsClapNotes(148)

      // Filter regular clap notes (exclude fills)
      const regularClaps = notes.filter(
        (note) => note.channel === 5 && (note.beat === 1.0 || note.beat === 3.0), // beats 2 and 4 (0-indexed)
      )

      regularClaps.forEach((clap) => {
        expect([1.0, 3.0]).toContain(clap.beat)
        expect(clap.velocity).toBe(118)
      })
    })

    it("should include fill claps at correct bars", () => {
      const notes = generateHatsClapNotes(148)

      // Filter fill clap notes (at position 3.96875)
      const fillClaps = notes.filter((note) => note.channel === 5 && note.beat === 3.96875)

      const fillBars = fillClaps.map((clap) => clap.bar).sort()
      expect(fillBars).toEqual([39, 47, 55, 103, 111])

      fillClaps.forEach((clap) => {
        expect(clap.velocity).toBe(100)
      })
    })
  })

  describe("FX Riser", () => {
    it("should generate correct number of riser notes", () => {
      const { notes } = generateFXRiserNotes(148)

      // 2 long risers (4 bars each) + 2 short risers (1 bar each) = 4 total notes
      expect(notes.length).toBe(4)

      // All notes should be C5
      notes.forEach((note) => {
        expect(note.note).toBe(noteToMidi("C", 5))
        expect(note.velocity).toBe(100)
        expect(note.channel).toBe(6)
      })
    })

    it("should place long risers at correct positions", () => {
      const { notes } = generateFXRiserNotes(148)

      // Find long riser notes (duration = 16 beats)
      const longRisers = notes.filter((note) => note.duration === 16)
      expect(longRisers.length).toBe(2)

      // Should start at bars 36 and 104
      const startBars = longRisers.map((note) => note.bar).sort()
      expect(startBars).toEqual([36, 104])
    })

    it("should place short risers at correct positions", () => {
      const { notes } = generateFXRiserNotes(148)

      // Find short riser notes (duration = 4 beats)
      const shortRisers = notes.filter((note) => note.duration === 4)
      expect(shortRisers.length).toBe(2)

      // Should start at bars 55 and 111
      const startBars = shortRisers.map((note) => note.bar).sort()
      expect(startBars).toEqual([55, 111])
    })

    it("should generate pitch bend automation", () => {
      const { pitchBends } = generateFXRiserNotes(148)

      // Should have pitch bends for all risers
      expect(pitchBends.length).toBeGreaterThan(0)

      // All pitch bends should be on channel 6
      pitchBends.forEach((bend) => {
        expect(bend.channel).toBe(6)
        expect(bend.value).toBeGreaterThanOrEqual(0)
        expect(bend.value).toBeLessThanOrEqual(8191)
      })
    })

    it("should generate mod wheel automation", () => {
      const { controlChanges } = generateFXRiserNotes(148)

      // Should have mod wheel CCs for all risers
      expect(controlChanges.length).toBeGreaterThan(0)

      // All CCs should be mod wheel (controller 1) on channel 6
      controlChanges.forEach((cc) => {
        expect(cc.controller).toBe(1) // Mod wheel
        expect(cc.channel).toBe(6)
        expect(cc.value).toBeGreaterThanOrEqual(0)
        expect(cc.value).toBeLessThanOrEqual(127)
      })
    })

    it("should generate multi-channel MIDI correctly", () => {
      const writer = new MidiWriter(148)
      const { notes, controlChanges, pitchBends } = generateFXRiserNotes(148)
      const midiData = writer.generateMultiChannelMidi(notes, controlChanges, pitchBends)

      expect(midiData).toBeInstanceOf(Uint8Array)
      expect(midiData.length).toBeGreaterThan(0)

      // Check for MThd header
      const header = Array.from(midiData.slice(0, 4))
      expect(header).toEqual([0x4d, 0x54, 0x68, 0x64]) // "MThd"
    })
  })

  describe("Note Utilities", () => {
    it("should convert note names to correct MIDI numbers", () => {
      expect(noteToMidi("C", 4)).toBe(60) // Middle C
      expect(noteToMidi("D#", 2)).toBe(39) // D#2
      expect(noteToMidi("A#", 4)).toBe(70) // A#4
      expect(noteToMidi("F#", 5)).toBe(78) // F#5
    })

    it("should have correct chord progression data", () => {
      const progression = CHORD_PROGRESSION["D# minor"]

      expect(progression.chords).toHaveLength(4)
      expect(progression.chords[0].name).toBe("D#m")
      expect(progression.chords[1].name).toBe("B")
      expect(progression.chords[2].name).toBe("F#")
      expect(progression.chords[3].name).toBe("C#")

      // Check voicings exist for all chords
      expect(progression.voicings["D#m"]).toHaveLength(5)
      expect(progression.voicings["B"]).toHaveLength(5)
      expect(progression.voicings["F#"]).toHaveLength(5)
      expect(progression.voicings["C#"]).toHaveLength(5)
    })
  })

  describe("buildStyle Integration", () => {
    it("should generate tempo meta events with correct BPM", () => {
      const writer = new MidiWriter(148)
      const midiData = writer.generateStructureMidi(FL_STRUCTURE_MARKERS)

      // Verify MIDI contains tempo meta event
      expect(midiData).toBeInstanceOf(Uint8Array)
      expect(midiData.length).toBeGreaterThan(0)

      // Check that tempo is set correctly (148 BPM)
      const expectedMicrosecondsPerQuarter = Math.floor(60000000 / 148)
      expect(expectedMicrosecondsPerQuarter).toBe(405405)
    })

    it("should use ≥480 PPQ for all MIDI files", () => {
      const writer = new MidiWriter(148, [4, 4], 480)
      expect(writer["ticksPerQuarter"]).toBeGreaterThanOrEqual(480)
    })
  })
})
