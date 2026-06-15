import type { MidiData, MidiNote, MidiTrack } from "./midi";

const SCALE_DEGREES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Convert key name (e.g. "C", "A") to MIDI pitch offset */
function keyToPitchBase(key: string): number {
  const idx = NOTE_NAMES.indexOf(key);
  if (idx < 0) return 60; // default C
  return 48 + idx; // C4 = 60, so key C = 48+0=48 → C3
}

/** Get the set of valid MIDI pitches for a key + scale across 4 octaves */
function getScalePitches(key: string, scale: string): number[] {
  const base = keyToPitchBase(key);
  const degrees = SCALE_DEGREES[scale] ?? SCALE_DEGREES.major;
  const pitches: number[] = [];
  for (let oct = 0; oct < 4; oct++) {
    for (const d of degrees) {
      const p = base + oct * 12 + d;
      if (p >= 24 && p <= 96) pitches.push(p);
    }
  }
  return pitches;
}

export interface MelodyParams {
  key: string;        // "C", "A", "F#", etc.
  scale: string;      // "major", "minor", "dorian", etc.
  complexity: number; // 0–1, controls note density & rhythmic variety
  noteLength: number; // 0–1, 0 = very short pluck, 1 = long legato
  bpm: number;
  bars: number;
}

/** Generate a single-track melody based on parameters */
export function generateMelody(params: MelodyParams): MidiData {
  const { key, scale, complexity, noteLength, bpm, bars } = params;
  const totalBeats = bars * 4;
  const scalePitches = getScalePitches(key, scale);

  // Complexity → rhythmic grid & density
  // 0 = whole notes only, 1 = 16th notes
  const minGrid = 0.5 + (1 - complexity) * 1.5;   // 0.5–2 beats
  const maxGrid = 4 - complexity * 3.5;            // 0.5–4 beats
  const density = 0.15 + complexity * 0.7;          // 15–85% fill

  // NoteLength → seconds (converted from beats)
  const minDur = 0.05 + noteLength * 0.1;           // 0.05–0.15 beats → pluck
  const maxDur = 0.15 + noteLength * 3;             // 0.15–3.15 beats → legato

  // Root & fifth for occasional chord leaps
  const root = keyToPitchBase(key) + 12; // +1 octave
  const fifth = root + 7;

  const notes: MidiNote[] = [];
  let beat = 0;

  // Deterministic seed from key+scale+complexity
  let seed = key.charCodeAt(0) + scale.length + complexity * 100;
  function rng() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  // Generate rhythmic pattern
  while (beat < totalBeats) {
    // Pick grid size for this note
    const gridStep = minGrid + rng() * (maxGrid - minGrid);
    const startTime = Math.round(beat / 0.125) * 0.125;
    if (startTime >= totalBeats) break;

    // Decide if this slot gets a note (density check)
    if (rng() < density) {
      // Pick pitch from scale — favor root, third, fifth
      const r = rng();
      let pitch: number;
      if (r < 0.35) {
        // Root or octave
        pitch = scalePitches[Math.floor(rng() * 3) * 7] ?? scalePitches[0]; // 0, 7, 14
      } else if (r < 0.6) {
        // Third or fifth
        const idx = Math.floor(rng() * 2) * 2 + 1; // 1 (third) or 3 (fifth)
        pitch = scalePitches[Math.min(idx, scalePitches.length - 1)];
      } else {
        // Any scale tone
        pitch = scalePitches[Math.floor(rng() * scalePitches.length)];
      }

      // Add octave leaps for drama
      if (rng() < 0.15 * complexity) pitch += 12;

      const dur = minDur + rng() * (maxDur - minDur);
      const velocity = 0.6 + rng() * 0.35;

      notes.push({ pitch, startTime, duration: dur, velocity, channel: 5 });
    }

    beat += gridStep;
  }

  // Sort by start time
  notes.sort((a, b) => a.startTime - b.startTime);

  // If no notes generated, add a simple root-to-third pattern
  if (notes.length === 0) {
    for (let b = 0; b < totalBeats; b += 2) {
      const pitch = b % 4 === 0 ? scalePitches[0] : scalePitches[2];
      notes.push({ pitch, startTime: b, duration: noteLength > 0.5 ? 1.5 : 0.1, velocity: 0.8, channel: 5 });
    }
  }

  const tracks: MidiTrack[] = [
    { name: `Melody (${key} ${scale})`, channel: 5, instrument: "lead", notes },
  ];

  return {
    bpm,
    totalBeats,
    tracks,
    sections: [{ name: "melody", bars, instruments: ["lead"], description: `${key} ${scale} 旋律` }],
  };
}

/** Generate a chord progression for the given key */
export function generateChords(key: string, scale: string, complexity: number, bars: number): number[][] {
  const degrees = SCALE_DEGREES[scale] ?? SCALE_DEGREES.major;
  const base = keyToPitchBase(key) + 12;

  // Chord qualities by scale degree
  const chordMap = [0, 2, 4, 5, 7, 9, 11]; // root, third, fifth
  const chordTypes = [
    [0, 2, 4],  // I (major)
    [0, 2, 4],  // ii
    [0, 2, 4],  // iii
    [0, 2, 4],  // IV
    [0, 2, 4],  // V
    [0, 2, 4],  // vi
    [0, 2, 4],  // vii°
  ];

  const chords: number[][] = [];
  for (let bar = 0; bar < bars; bar++) {
    const degIdx = bar % 7;
    const rootDeg = degrees[degIdx];
    const chord = chordTypes[degIdx].map((offset) => {
      const deg = degrees[(degIdx + offset) % 7];
      const oct = Math.floor(((degIdx + offset) % 7) / 3);
      return base + deg + oct * 12;
    });
    chords.push(chord);
  }

  return chords;
}
