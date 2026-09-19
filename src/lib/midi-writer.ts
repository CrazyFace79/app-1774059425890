// Simple MIDI writer utility for FL Studio export
// Generates standard MIDI files with tempo, markers, and notes

export interface MidiMarker {
  bar: number
  name: string
}

export interface MidiNote {
  bar: number
  beat: number
  note: number
  velocity: number
  duration: number
  channel?: number
}

export interface MidiControlChange {
  bar: number
  beat: number
  controller: number
  value: number
  channel: number
}

export interface MidiPitchBend {
  bar: number
  beat: number
  value: number // -8192 to +8191
  channel: number
}

export class MidiWriter {
  private tempo: number
  private timeSignature: [number, number]
  private ticksPerQuarter: number

  constructor(tempo = 120, timeSignature: [number, number] = [4, 4], ticksPerQuarter = 480) {
    this.tempo = tempo
    this.timeSignature = timeSignature
    this.ticksPerQuarter = ticksPerQuarter
  }

  private writeVariableLength(value: number): number[] {
    const bytes: number[] = []
    let temp = value

    while (temp > 0x7f) {
      bytes.unshift((temp & 0x7f) | 0x80)
      temp >>= 7
    }
    bytes.push(temp & 0x7f)

    return bytes
  }

  private barToTicks(bar: number, beat = 0): number {
    const beatsPerBar = this.timeSignature[0]
    const totalBeats = (bar - 1) * beatsPerBar + beat
    return Math.floor(totalBeats * this.ticksPerQuarter)
  }

  private createHeader(): number[] {
    return [
      // MThd chunk
      0x4d,
      0x54,
      0x68,
      0x64, // "MThd"
      0x00,
      0x00,
      0x00,
      0x06, // Header length (6 bytes)
      0x00,
      0x00, // Format type 0 (single track)
      0x00,
      0x01, // Number of tracks (1)
      0x01,
      0xe0, // Ticks per quarter note (480)
    ]
  }

  generateStructureMidi(markers: MidiMarker[]): Uint8Array {
    const events: number[] = []
    let currentTick = 0

    // Add tempo event at start
    events.push(
      0x00, // Delta time
      0xff,
      0x51,
      0x03, // Tempo meta event
      Math.floor(60000000 / this.tempo / 65536), // Microseconds per quarter note (high byte)
      Math.floor(60000000 / this.tempo / 256) % 256, // (middle byte)
      (60000000 / this.tempo) % 256, // (low byte)
    )

    // Add time signature event
    events.push(
      0x00, // Delta time
      0xff,
      0x58,
      0x04, // Time signature meta event
      this.timeSignature[0], // Numerator
      Math.log2(this.timeSignature[1]), // Denominator (as power of 2)
      24, // MIDI clocks per metronome click
      8, // 32nd notes per quarter note
    )

    // Add markers
    for (const marker of markers) {
      const targetTick = this.barToTicks(marker.bar)
      const deltaTime = targetTick - currentTick

      events.push(
        ...this.writeVariableLength(deltaTime),
        0xff,
        0x06, // Marker meta event
        marker.name.length,
        ...Array.from(marker.name, (c) => c.charCodeAt(0)),
      )

      currentTick = targetTick
    }

    // End of track
    events.push(0x00, 0xff, 0x2f, 0x00)

    // Create track chunk
    const trackData = [
      0x4d,
      0x54,
      0x72,
      0x6b, // "MTrk"
      (events.length >> 24) & 0xff,
      (events.length >> 16) & 0xff,
      (events.length >> 8) & 0xff,
      events.length & 0xff,
      ...events,
    ]

    return new Uint8Array([...this.createHeader(), ...trackData])
  }

  generateGhostKickMidi(notes: MidiNote[]): Uint8Array {
    const events: number[] = []
    let currentTick = 0

    // Add tempo event at start
    events.push(
      0x00, // Delta time
      0xff,
      0x51,
      0x03, // Tempo meta event
      Math.floor(60000000 / this.tempo / 65536),
      Math.floor(60000000 / this.tempo / 256) % 256,
      (60000000 / this.tempo) % 256,
    )

    // Add time signature event
    events.push(
      0x00, // Delta time
      0xff,
      0x58,
      0x04, // Time signature meta event
      this.timeSignature[0],
      Math.log2(this.timeSignature[1]),
      24,
      8,
    )

    // Sort notes by time
    const sortedNotes = [...notes].sort((a, b) => {
      const ticksA = this.barToTicks(a.bar, a.beat)
      const ticksB = this.barToTicks(b.bar, b.beat)
      return ticksA - ticksB
    })

    // Add note events
    for (const note of sortedNotes) {
      const noteTick = this.barToTicks(note.bar, note.beat)
      const deltaTime = noteTick - currentTick

      // Note on
      events.push(
        ...this.writeVariableLength(deltaTime),
        0x99, // Note on, channel 10 (drums)
        note.note,
        note.velocity,
      )

      currentTick = noteTick

      // Note off (after duration)
      const offTick = currentTick + Math.floor(note.duration * this.ticksPerQuarter)
      const offDelta = offTick - currentTick

      events.push(
        ...this.writeVariableLength(offDelta),
        0x89, // Note off, channel 10
        note.note,
        0x00,
      )

      currentTick = offTick
    }

    // End of track
    events.push(0x00, 0xff, 0x2f, 0x00)

    // Create track chunk
    const trackData = [
      0x4d,
      0x54,
      0x72,
      0x6b, // "MTrk"
      (events.length >> 24) & 0xff,
      (events.length >> 16) & 0xff,
      (events.length >> 8) & 0xff,
      events.length & 0xff,
      ...events,
    ]

    return new Uint8Array([...this.createHeader(), ...trackData])
  }

  generateInstrumentMidi(notes: MidiNote[], channel: number, tempo: number): Uint8Array {
    const events: number[] = []
    let currentTick = 0

    // Add tempo event at start
    events.push(
      0x00, // Delta time
      0xff,
      0x51,
      0x03, // Tempo meta event
      Math.floor(60000000 / tempo / 65536),
      Math.floor(60000000 / tempo / 256) % 256,
      (60000000 / tempo) % 256,
    )

    // Add time signature event
    events.push(
      0x00, // Delta time
      0xff,
      0x58,
      0x04, // Time signature meta event
      4,
      Math.log2(4),
      24,
      8,
    )

    // Sort notes by time
    const sortedNotes = [...notes].sort((a, b) => {
      const ticksA = (a.bar - 1) * 4 * this.ticksPerQuarter + a.beat * this.ticksPerQuarter
      const ticksB = (b.bar - 1) * 4 * this.ticksPerQuarter + b.beat * this.ticksPerQuarter
      return ticksA - ticksB
    })

    // Add note events
    for (const note of sortedNotes) {
      const noteTick = (note.bar - 1) * 4 * this.ticksPerQuarter + note.beat * this.ticksPerQuarter
      const deltaTime = noteTick - currentTick

      // Note on
      events.push(
        ...this.writeVariableLength(deltaTime),
        0x90 + (channel - 1), // Note on, specified channel
        note.note,
        note.velocity,
      )

      currentTick = noteTick

      // Note off (after duration)
      const offTick = currentTick + Math.floor(note.duration * this.ticksPerQuarter)
      const offDelta = offTick - currentTick

      events.push(
        ...this.writeVariableLength(offDelta),
        0x80 + (channel - 1), // Note off, specified channel
        note.note,
        0x00,
      )

      currentTick = offTick
    }

    // End of track
    events.push(0x00, 0xff, 0x2f, 0x00)

    // Create track chunk
    const trackData = [
      0x4d,
      0x54,
      0x72,
      0x6b, // "MTrk"
      (events.length >> 24) & 0xff,
      (events.length >> 16) & 0xff,
      (events.length >> 8) & 0xff,
      events.length & 0xff,
      ...events,
    ]

    return new Uint8Array([...this.createHeader(), ...trackData])
  }

  generateMultiChannelMidi(
    notes: MidiNote[],
    controlChanges: MidiControlChange[] = [],
    pitchBends: MidiPitchBend[] = [],
  ): Uint8Array {
    const events: number[] = []
    let currentTick = 0

    // Add tempo event at start
    events.push(
      0x00, // Delta time
      0xff,
      0x51,
      0x03, // Tempo meta event
      Math.floor(60000000 / this.tempo / 65536),
      Math.floor(60000000 / this.tempo / 256) % 256,
      (60000000 / this.tempo) % 256,
    )

    // Add time signature event
    events.push(
      0x00, // Delta time
      0xff,
      0x58,
      0x04, // Time signature meta event
      this.timeSignature[0],
      Math.log2(this.timeSignature[1]),
      24,
      8,
    )

    // Collect all events and sort by time
    const allEvents: Array<{
      tick: number
      type: "note_on" | "note_off" | "cc" | "pitch_bend"
      data: any
    }> = []

    // Add note events
    for (const note of notes) {
      const noteTick = this.barToTicks(note.bar, note.beat)
      const offTick = noteTick + Math.floor(note.duration * this.ticksPerQuarter)

      allEvents.push({
        tick: noteTick,
        type: "note_on",
        data: { note: note.note, velocity: note.velocity, channel: note.channel || 1 },
      })

      allEvents.push({
        tick: offTick,
        type: "note_off",
        data: { note: note.note, channel: note.channel || 1 },
      })
    }

    // Add control changes
    for (const cc of controlChanges) {
      const ccTick = this.barToTicks(cc.bar, cc.beat)
      allEvents.push({
        tick: ccTick,
        type: "cc",
        data: cc,
      })
    }

    // Add pitch bends
    for (const pb of pitchBends) {
      const pbTick = this.barToTicks(pb.bar, pb.beat)
      allEvents.push({
        tick: pbTick,
        type: "pitch_bend",
        data: pb,
      })
    }

    // Sort all events by tick
    allEvents.sort((a, b) => a.tick - b.tick)

    // Write events
    for (const event of allEvents) {
      const deltaTime = event.tick - currentTick

      switch (event.type) {
        case "note_on":
          events.push(
            ...this.writeVariableLength(deltaTime),
            0x90 + (event.data.channel - 1),
            event.data.note,
            event.data.velocity,
          )
          break
        case "note_off":
          events.push(...this.writeVariableLength(deltaTime), 0x80 + (event.data.channel - 1), event.data.note, 0x00)
          break
        case "cc":
          events.push(
            ...this.writeVariableLength(deltaTime),
            0xb0 + (event.data.channel - 1),
            event.data.controller,
            event.data.value,
          )
          break
        case "pitch_bend":
          const bendValue = event.data.value + 8192 // Convert to 0-16383 range
          const lsb = bendValue & 0x7f
          const msb = (bendValue >> 7) & 0x7f
          events.push(...this.writeVariableLength(deltaTime), 0xe0 + (event.data.channel - 1), lsb, msb)
          break
      }

      currentTick = event.tick
    }

    // End of track
    events.push(0x00, 0xff, 0x2f, 0x00)

    // Create track chunk
    const trackData = [
      0x4d,
      0x54,
      0x72,
      0x6b, // "MTrk"
      (events.length >> 24) & 0xff,
      (events.length >> 16) & 0xff,
      (events.length >> 8) & 0xff,
      events.length & 0xff,
      ...events,
    ]

    return new Uint8Array([...this.createHeader(), ...trackData])
  }
}

// FL Studio export presets
export const FL_STRUCTURE_MARKERS: MidiMarker[] = [
  { bar: 1, name: "Intro (no kick)" },
  { bar: 17, name: "Verse 1" },
  { bar: 33, name: "Pre-Chorus" },
  { bar: 41, name: "Chorus / Drop 1" },
  { bar: 57, name: "Break / Pads" },
  { bar: 73, name: "Verse 2" },
  { bar: 89, name: "Pre-Chorus 2" },
  { bar: 97, name: "Chorus / Drop 2" },
  { bar: 113, name: "Bridge" },
  { bar: 121, name: "Final Chorus / Outro" },
]

export function generateGhostKickNotes(): MidiNote[] {
  const notes: MidiNote[] = []
  const C1 = 36 // MIDI note number for C1

  // Drop 1: bars 41-56 (16 bars)
  for (let bar = 41; bar <= 56; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      notes.push({
        bar,
        beat,
        note: C1,
        velocity: 100,
        duration: 0.25, // Quarter note
      })
    }
  }

  // Drop 2: bars 97-112 (16 bars)
  for (let bar = 97; bar <= 112; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      notes.push({
        bar,
        beat,
        note: C1,
        velocity: 100,
        duration: 0.25, // Quarter note
      })
    }
  }

  return notes
}

// Note utility functions and chord progression data
export function noteToMidi(note: string, octave: number): number {
  const noteMap: { [key: string]: number } = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  }
  return (octave + 1) * 12 + noteMap[note]
}

// D# minor chord progression: i – VI – III – VII → D#m, B, F#, C#
export const CHORD_PROGRESSION = {
  "D# minor": {
    chords: [
      { name: "D#m", root: "D#", fifth: "A#" },
      { name: "B", root: "B", fifth: "F#" },
      { name: "F#", root: "F#", fifth: "C#" },
      { name: "C#", root: "C#", fifth: "G#" },
    ],
    voicings: {
      "D#m": [noteToMidi("D#", 4), noteToMidi("A#", 4), noteToMidi("D#", 5), noteToMidi("F#", 5), noteToMidi("A#", 5)],
      B: [noteToMidi("B", 3), noteToMidi("F#", 4), noteToMidi("B", 4), noteToMidi("D#", 5), noteToMidi("F#", 5)],
      "F#": [noteToMidi("F#", 3), noteToMidi("C#", 4), noteToMidi("F#", 4), noteToMidi("A#", 4), noteToMidi("C#", 5)],
      "C#": [noteToMidi("C#", 4), noteToMidi("G#", 4), noteToMidi("C#", 5), noteToMidi("F", 5), noteToMidi("G#", 5)],
    },
  },
}

export function generateRollingBassNotes(bpm: number, key = "D# minor"): MidiNote[] {
  const notes: MidiNote[] = []
  const progression = CHORD_PROGRESSION[key as keyof typeof CHORD_PROGRESSION]
  if (!progression) return notes

  const drops = [
    { start: 41, end: 56 }, // Drop 1: bars 41-56
    { start: 97, end: 112 }, // Drop 2: bars 97-112
  ]

  drops.forEach((drop) => {
    let chordIndex = 0
    for (let bar = drop.start; bar <= drop.end; bar++) {
      // Change chord every 4 bars
      if ((bar - drop.start) % 4 === 0 && bar > drop.start) {
        chordIndex = (chordIndex + 1) % 4
      }

      const chord = progression.chords[chordIndex]
      const rootNote = noteToMidi(chord.root, 2) // Octave 2
      const fifthNote = noteToMidi(chord.fifth, 2)

      // 16th note pattern: root-root-5th-root (4 times per bar)
      for (let beat = 0; beat < 4; beat++) {
        const pattern = [rootNote, rootNote, fifthNote, rootNote]
        pattern.forEach((note, step) => {
          const isAccent = step === 3 // Every 4th step
          notes.push({
            bar,
            beat: beat + step * 0.25,
            note,
            velocity: isAccent ? 110 : 90,
            duration: 0.25 * 0.45, // 45% gate
            channel: 1,
          })
        })
      }
    }
  })

  return notes
}

export function generateSupersawChordNotes(bpm: number, key = "D# minor"): MidiNote[] {
  const notes: MidiNote[] = []
  const progression = CHORD_PROGRESSION[key as keyof typeof CHORD_PROGRESSION]
  if (!progression) return notes

  const sections = [
    // Pre-Chorus: 2 bars per chord
    { start: 33, end: 41, barsPerChord: 2, velocity: 95 },
    // Drop 1: 4 bars per chord (stabs)
    { start: 41, end: 57, barsPerChord: 4, velocity: 110 },
    // Drop 2: 4 bars per chord (stabs)
    { start: 97, end: 113, barsPerChord: 4, velocity: 110 },
  ]

  sections.forEach((section) => {
    let chordIndex = 0
    for (let bar = section.start; bar < section.end; bar += section.barsPerChord) {
      const chordName = progression.chords[chordIndex].name
      const voicing = progression.voicings[chordName as keyof typeof progression.voicings]

      // Add all notes of the chord at the start of the section
      voicing.forEach((note) => {
        notes.push({
          bar,
          beat: 0,
          note,
          velocity: section.velocity,
          duration: section.barsPerChord * 4, // Sustain for the full duration
          channel: 2,
        })
      })

      chordIndex = (chordIndex + 1) % 4
    }
  })

  return notes
}

export function generateHatsClapNotes(bpm: number): MidiNote[] {
  const notes: MidiNote[] = []

  // Section ranges
  const preSections = [
    { start: 33, end: 41 }, // Pre-Chorus 1
    { start: 89, end: 97 }, // Pre-Chorus 2
  ]

  const dropSections = [
    { start: 41, end: 57 }, // Drop 1
    { start: 97, end: 113 }, // Drop 2
  ]

  // Closed Hat (channel 3)
  preSections.forEach((section) => {
    const totalBars = section.end - section.start
    for (let bar = section.start; bar < section.end; bar++) {
      const progress = (bar - section.start) / totalBars
      const velocity = Math.floor(60 + (105 - 60) * progress) // Ramp 60→105

      // 1/8 notes on every 8th (positions 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5)
      for (let eighth = 0; eighth < 8; eighth++) {
        notes.push({
          bar,
          beat: eighth * 0.5,
          note: 42, // Closed Hi-Hat
          velocity,
          duration: 0.125,
          channel: 3,
        })
      }
    }
  })

  // Closed Hat in drops - 1/16 continuous
  dropSections.forEach((section) => {
    for (let bar = section.start; bar < section.end; bar++) {
      for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
        const isAccent = sixteenth % 4 === 3 // Every 4th step
        notes.push({
          bar,
          beat: sixteenth * 0.25,
          note: 42, // Closed Hi-Hat
          velocity: isAccent ? 110 : 95,
          duration: 0.125 * 0.4, // ~40% gate
          channel: 3,
        })
      }
    }
  })

  // Open Hat (channel 4) - Offbeats in PRE and DROPS
  const allActiveSections = [...preSections, ...dropSections]
  allActiveSections.forEach((section) => {
    for (let bar = section.start; bar < section.end; bar++) {
      // Positions 1.5, 2.5, 3.5, 4.5 (offbeats)
      for (let offbeat = 0; offbeat < 4; offbeat++) {
        notes.push({
          bar,
          beat: offbeat + 0.5,
          note: 46, // Open Hi-Hat
          velocity: 100,
          duration: 0.125,
          channel: 4,
        })
      }
    }
  })

  // Clap (channel 5) - Beats 2 and 4 in PRE and DROPS
  allActiveSections.forEach((section) => {
    for (let bar = section.start; bar < section.end; bar++) {
      // Beat 2 and 4 (positions 2.0 and 4.0)
      notes.push({
        bar,
        beat: 1.0, // Beat 2 (0-indexed)
        note: 39, // Hand Clap
        velocity: 118,
        duration: 0.125,
        channel: 5,
      })

      notes.push({
        bar,
        beat: 3.0, // Beat 4 (0-indexed)
        note: 39, // Hand Clap
        velocity: 118,
        duration: 0.125,
        channel: 5,
      })

      // Fill at end of 8-bar blocks (bars 40, 48, 56, 104, 112)
      const fillBars = [40, 48, 56, 104, 112]
      if (fillBars.includes(bar)) {
        // Flam 1/32 before beat 4 (position 3.96875)
        notes.push({
          bar,
          beat: 3.96875,
          note: 39, // Hand Clap
          velocity: 100,
          duration: 0.03125, // 1/32 duration
          channel: 5,
        })
      }
    }
  })

  return notes
}

export function generateFXRiserNotes(bpm: number): {
  notes: MidiNote[]
  controlChanges: MidiControlChange[]
  pitchBends: MidiPitchBend[]
} {
  const notes: MidiNote[] = []
  const controlChanges: MidiControlChange[] = []
  const pitchBends: MidiPitchBend[] = []

  const C5 = noteToMidi("C", 5)

  // Long risers before drops
  const longRisers = [
    { start: 37, end: 41 }, // PRE→DROP1: bar 37 to 41
    { start: 105, end: 109 }, // PRE2→DROP2: bar 105 to 109
  ]

  // Short risers before breaks
  const shortRisers = [
    { start: 56, end: 57 }, // Before break
    { start: 112, end: 113 }, // Before bridge
  ]

  // Generate long risers
  longRisers.forEach((riser) => {
    const duration = (riser.end - riser.start) * 4 // 4 beats per bar

    // Sustained note
    notes.push({
      bar: riser.start,
      beat: 0,
      note: C5,
      velocity: 100,
      duration,
      channel: 6,
    })

    // Pitch bend automation (0 to max over duration)
    const steps = duration * 4 // 16th note resolution
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps
      const bendValue = Math.floor(progress * 8191) // 0 to +8191

      pitchBends.push({
        bar: riser.start,
        beat: step * 0.25,
        value: bendValue,
        channel: 6,
      })
    }

    // Mod wheel automation (0 to 127 over duration)
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps
      const modValue = Math.floor(progress * 127)

      controlChanges.push({
        bar: riser.start,
        beat: step * 0.25,
        controller: 1, // Mod wheel
        value: modValue,
        channel: 6,
      })
    }
  })

  // Generate short risers (1 bar)
  shortRisers.forEach((riser) => {
    const duration = 4 // 4 beats

    // Sustained note
    notes.push({
      bar: riser.start,
      beat: 0,
      note: C5,
      velocity: 100,
      duration,
      channel: 6,
    })

    // Pitch bend automation (0 to max over 1 bar)
    const steps = 16 // 16th note resolution for 1 bar
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps
      const bendValue = Math.floor(progress * 8191)

      pitchBends.push({
        bar: riser.start,
        beat: step * 0.25,
        value: bendValue,
        channel: 6,
      })
    }

    // Mod wheel automation
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps
      const modValue = Math.floor(progress * 127)

      controlChanges.push({
        bar: riser.start,
        beat: step * 0.25,
        controller: 1,
        value: modValue,
        channel: 6,
      })
    }
  })

  return { notes, controlChanges, pitchBends }
}
