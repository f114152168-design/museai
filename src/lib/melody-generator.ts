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

  // Complexity → rhythmic grid & density (higher density default)
  const minGrid = Math.max(0.25, 0.5 - complexity * 0.3); // 0.2–0.5 beats
  const maxGrid = 2 - complexity * 1.2;                    // 0.8–2 beats
  const density = 0.5 + complexity * 0.4;                  // 50–90% fill

  // NoteLength (beats)
  const minDur = 0.08 + noteLength * 0.2;
  const maxDur = 0.2 + noteLength * 2.5;

  const notes: MidiNote[] = [];
  let beat = 0;

  // Deterministic seed
  let seed = key.charCodeAt(0) + scale.length + complexity * 100;
  function rng() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  let lastPitch = scalePitches[0]; // start on root
  let lastDir = 1; // 1 = up, -1 = down

  while (beat < totalBeats) {
    const gridStep = minGrid + rng() * (maxGrid - minGrid);
    const startTime = Math.round(beat / 0.25) * 0.25;
    if (startTime >= totalBeats) break;

    if (rng() < density) {
      // Stepwise melody: pick next pitch close to last one
      const step = Math.floor(rng() * 3) + 1; // 1–3 steps on scale
      const maxStep = 2 + Math.floor(complexity * 3); // 2–5 steps max

      let pitch: number;
      if (rng() < 0.2) {
        // Jump to root, third, or fifth (resolution points)
        const targets = [0, 2, 4];
        pitch = scalePitches[targets[Math.floor(rng() * targets.length)]];
        // Pick octave
        const targetOct = Math.floor(rng() * 3);
        pitch += targetOct * 12;
      } else {
        // Stepwise motion
        if (rng() < 0.3) lastDir *= -1; // change direction sometimes
        const steps = Math.min(step, maxStep) * lastDir;
        const lastIdx = scalePitches.indexOf(lastPitch) >= 0
          ? scalePitches.indexOf(lastPitch)
          : Math.floor(scalePitches.length / 2);
        const newIdx = Math.max(0, Math.min(scalePitches.length - 1, lastIdx + steps));
        pitch = scalePitches[newIdx];
      }

      // Keep in range
      pitch = Math.max(48, Math.min(96, pitch));

      const dur = minDur + rng() * (maxDur - minDur);
      const velocity = 0.65 + rng() * 0.3;

      notes.push({ pitch, startTime, duration: dur, velocity, channel: 6 });
      lastPitch = pitch;
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
