import type { MidiData, MidiNote, MidiTrack } from "./midi";
import {
  type MelodyPattern,
  type MelodyNote,
  getPatternsForGenre,
} from "./melody-patterns";

const SCALE_DEGREES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 3, 5, 7, 8, 10, 1],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function keyToPitchBase(key: string): number {
  const idx = NOTE_NAMES.indexOf(key);
  if (idx < 0) return 60;
  return 48 + idx;
}

function getScalePitches(key: string, scale: string): number[] {
  const base = keyToPitchBase(key);
  const degrees = SCALE_DEGREES[scale] ?? SCALE_DEGREES.major;
  const pitches: number[] = [];
  for (let oct = 0; oct < 4; oct++) {
    for (const d of degrees) {
      const p = base + oct * 12 + d;
      if (p >= 36 && p <= 96) pitches.push(p);
    }
  }
  return pitches;
}

export interface MelodyParams {
  key: string;
  scale: string;
  complexity: number;
  noteLength: number;
  bpm: number;
  bars: number;
  genre?: string; // optional genre hint for pattern selection
}

/**
 * Generate a melody using preset patterns + algorithmic variation.
 *
 * 1. Pick a pattern from the genre library (or random if no genre match)
 * 2. Transpose pattern notes to the target key using scale degrees
 * 3. Repeat the pattern across the full duration with variations:
 *    - Octave shift (±12 semitones, random per repetition)
 *    - Note substitution (swap 1 note per repetition)
 *    - Rhythm stretch on last repetition (longer ending note)
 */
export function generateMelody(params: MelodyParams): MidiData {
  const { key, scale, complexity, noteLength, bpm, bars, genre } = params;
  const totalBeats = bars * 4;
  const scalePitches = getScalePitches(key, scale);

  // Deterministic seed
  let seed = key.charCodeAt(0) + scale.length + complexity * 100;
  function rng() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  // Pick a pattern based on genre
  const candidates = getPatternsForGenre(genre ?? "");
  const pattern = candidates[Math.floor(rng() * candidates.length)];

  const notes: MidiNote[] = [];

  // Repeat pattern across the full song duration
  let patternStart = 0;
  let repCount = 0;

  while (patternStart < totalBeats) {
    const isLast = patternStart + pattern.length >= totalBeats;
    const octaveShift = repCount === 0 ? 0 : (rng() < 0.5 ? 12 : -12);
    const noteToSwap = Math.floor(rng() * pattern.notes.length);

    for (let i = 0; i < pattern.notes.length; i++) {
      const mn = pattern.notes[i];
      const startTime = patternStart + mn.beat;
      if (startTime >= totalBeats) continue;

      // Map scale degree to actual pitch
      const degreeIdx = ((mn.degree % 7) + 7) % 7;
      let pitch = scalePitches[degreeIdx] ?? scalePitches[0];
      pitch += octaveShift;

      // Variation: on non-first repetitions, swap one note to a neighbor
      if (repCount > 0 && i === noteToSwap && rng() < complexity) {
        const neighbors = [
          scalePitches[Math.max(0, degreeIdx - 1)] ?? pitch,
          scalePitches[Math.min(scalePitches.length - 1, degreeIdx + 1)] ?? pitch,
        ];
        pitch = neighbors[Math.floor(rng() * neighbors.length)] + octaveShift;
      }

      // Keep in playable range
      pitch = Math.max(48, Math.min(96, pitch));

      // Duration: scale by noteLength, stretch on last rep
      let dur = mn.dur * (0.5 + noteLength * 0.5);
      if (isLast) dur *= 1.5; // longer ending notes

      // Velocity
      let vel = mn.vel ?? 0.8;
      vel *= 0.8 + rng() * 0.2; // slight variation

      notes.push({ pitch, startTime, duration: dur, velocity: vel, channel: 6 });
    }

    patternStart += pattern.length;
    repCount++;
  }

  // Sort by start time
  notes.sort((a, b) => a.startTime - b.startTime);

  // Fallback if nothing generated
  if (notes.length === 0) {
    const root = scalePitches[0] ?? 60;
    for (let b = 0; b < totalBeats; b += 2) {
      notes.push({ pitch: root, startTime: b, duration: 1.5, velocity: 0.8, channel: 6 });
    }
  }

  const tracks: MidiTrack[] = [
    { name: `Melody (${key} ${scale})`, channel: 6, instrument: "lead", notes },
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

  const chordTypes = [
    [0, 2, 4],
    [0, 2, 4],
    [0, 2, 4],
    [0, 2, 4],
    [0, 2, 4],
    [0, 2, 4],
    [0, 2, 4],
  ];

  const chords: number[][] = [];
  for (let bar = 0; bar < bars; bar++) {
    const degIdx = bar % 7;
    const chord = chordTypes[degIdx].map((offset) => {
      const deg = degrees[(degIdx + offset) % 7];
      const oct = Math.floor(((degIdx + offset) % 7) / 3);
      return base + deg + oct * 12;
    });
    chords.push(chord);
  }

  return chords;
}
