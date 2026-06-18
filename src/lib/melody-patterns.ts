/**
 * Preset melody patterns for each EDM genre.
 * Each pattern uses scale degrees (0-6) instead of absolute pitches,
 * so they can be transposed to any key.
 *
 * Format: { degree: number (0-6 in scale), beat: number (offset in beats), dur: number (beats) }
 */

export interface MelodyNote {
  degree: number; // scale degree 0-6 (root=0, 2nd=1, 3rd=2, 4th=3, 5th=4, 6th=5, 7th=6)
  beat: number;   // offset in beats from start of pattern
  dur: number;    // duration in beats
  vel?: number;   // velocity 0-1 (optional, defaults based on position)
}

export interface MelodyPattern {
  name: string;
  genre: string;
  length: number;        // pattern length in beats (4 = 1 bar)
  notes: MelodyNote[];
}

// ── HOUSE patterns (128 BPM, 4/4) ──

export const housePatterns: MelodyPattern[] = [
  {
    name: "house-hook-1",
    genre: "house",
    length: 8, // 2 bars
    notes: [
      // Bar 1: arpeggio up
      { degree: 0, beat: 0, dur: 0.5, vel: 0.85 },
      { degree: 2, beat: 0.5, dur: 0.5, vel: 0.75 },
      { degree: 4, beat: 1, dur: 0.5, vel: 0.8 },
      { degree: 5, beat: 1.5, dur: 0.5, vel: 0.7 },
      { degree: 4, beat: 2, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 2.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 3, dur: 1, vel: 0.85 },
      // Bar 2: resolution
      { degree: 4, beat: 4, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 4.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 5, dur: 1.5, vel: 0.9 },
      { degree: 2, beat: 6.5, dur: 0.5, vel: 0.7 },
      { degree: 0, beat: 7, dur: 1, vel: 0.85 },
    ],
  },
  {
    name: "house-groove",
    genre: "house",
    length: 8,
    notes: [
      // syncopated groove
      { degree: 4, beat: 0, dur: 0.75, vel: 0.8 },
      { degree: 4, beat: 1, dur: 0.25, vel: 0.65 },
      { degree: 2, beat: 1.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 2, dur: 0.75, vel: 0.85 },
      { degree: 2, beat: 3, dur: 0.5, vel: 0.7 },
      { degree: 4, beat: 3.5, dur: 0.5, vel: 0.75 },
      { degree: 5, beat: 4, dur: 0.5, vel: 0.8 },
      { degree: 4, beat: 4.5, dur: 0.5, vel: 0.75 },
      { degree: 2, beat: 5, dur: 0.5, vel: 0.8 },
      { degree: 0, beat: 5.5, dur: 0.5, vel: 0.75 },
      { degree: 2, beat: 6, dur: 0.5, vel: 0.7 },
      { degree: 0, beat: 6.5, dur: 1.5, vel: 0.9 },
    ],
  },
  {
    name: "house-rise",
    genre: "house",
    length: 8,
    notes: [
      // ascending line
      { degree: 0, beat: 0, dur: 0.5, vel: 0.7 },
      { degree: 1, beat: 0.5, dur: 0.5, vel: 0.7 },
      { degree: 2, beat: 1, dur: 0.5, vel: 0.75 },
      { degree: 3, beat: 1.5, dur: 0.5, vel: 0.75 },
      { degree: 4, beat: 2, dur: 0.5, vel: 0.8 },
      { degree: 5, beat: 2.5, dur: 0.5, vel: 0.8 },
      { degree: 6, beat: 3, dur: 0.5, vel: 0.85 },
      { degree: 4, beat: 3.5, dur: 0.5, vel: 0.8 },
      // descent + resolve
      { degree: 4, beat: 4, dur: 0.75, vel: 0.85 },
      { degree: 2, beat: 5, dur: 0.5, vel: 0.8 },
      { degree: 4, beat: 5.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 6, dur: 2, vel: 0.9 },
    ],
  },
];

// ── TECHNO patterns (126 BPM, 4/4) ──

export const technoPatterns: MelodyPattern[] = [
  {
    name: "techno-minimal",
    genre: "techno",
    length: 8,
    notes: [
      // sparse, hypnotic
      { degree: 0, beat: 0, dur: 1, vel: 0.85 },
      { degree: 0, beat: 2, dur: 0.5, vel: 0.6 },
      { degree: 4, beat: 2.5, dur: 0.5, vel: 0.7 },
      { degree: 0, beat: 3, dur: 1, vel: 0.8 },
      { degree: 0, beat: 4, dur: 0.5, vel: 0.7 },
      { degree: 2, beat: 4.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 5, dur: 1, vel: 0.85 },
      { degree: 4, beat: 6, dur: 1, vel: 0.8 },
      { degree: 0, beat: 7, dur: 1, vel: 0.85 },
    ],
  },
  {
    name: "techno-drive",
    genre: "techno",
    length: 8,
    notes: [
      // driving 16th feel
      { degree: 0, beat: 0, dur: 0.25, vel: 0.85 },
      { degree: 0, beat: 0.5, dur: 0.25, vel: 0.65 },
      { degree: 2, beat: 1, dur: 0.5, vel: 0.75 },
      { degree: 4, beat: 1.5, dur: 0.5, vel: 0.8 },
      { degree: 0, beat: 2, dur: 0.25, vel: 0.85 },
      { degree: 0, beat: 2.5, dur: 0.25, vel: 0.65 },
      { degree: 4, beat: 3, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 3.5, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 4, dur: 0.25, vel: 0.85 },
      { degree: 0, beat: 4.5, dur: 0.25, vel: 0.65 },
      { degree: 2, beat: 5, dur: 0.5, vel: 0.75 },
      { degree: 4, beat: 5.5, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 6, dur: 0.5, vel: 0.75 },
      { degree: 0, beat: 6.5, dur: 1.5, vel: 0.9 },
    ],
  },
  {
    name: "techno-dark",
    genre: "techno",
    length: 8,
    notes: [
      // dark descending
      { degree: 6, beat: 0, dur: 1, vel: 0.8 },
      { degree: 4, beat: 1, dur: 0.5, vel: 0.75 },
      { degree: 2, beat: 1.5, dur: 0.5, vel: 0.7 },
      { degree: 0, beat: 2, dur: 1.5, vel: 0.85 },
      { degree: 0, beat: 3.5, dur: 0.5, vel: 0.65 },
      { degree: 2, beat: 4, dur: 0.5, vel: 0.7 },
      { degree: 4, beat: 4.5, dur: 0.5, vel: 0.75 },
      { degree: 6, beat: 5, dur: 1, vel: 0.8 },
      { degree: 4, beat: 6, dur: 0.5, vel: 0.75 },
      { degree: 2, beat: 6.5, dur: 0.5, vel: 0.7 },
      { degree: 0, beat: 7, dur: 1, vel: 0.85 },
    ],
  },
];

// ── TRANCE patterns (138 BPM, 4/4) ──

export const trancePatterns: MelodyPattern[] = [
  {
    name: "trance-euphoric",
    genre: "trance",
    length: 8,
    notes: [
      // euphoric ascending
      { degree: 0, beat: 0, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 0.5, dur: 0.5, vel: 0.8 },
      { degree: 4, beat: 1, dur: 0.5, vel: 0.85 },
      { degree: 5, beat: 1.5, dur: 0.5, vel: 0.85 },
      { degree: 6, beat: 2, dur: 0.5, vel: 0.9 },
      { degree: 5, beat: 2.5, dur: 0.5, vel: 0.85 },
      { degree: 4, beat: 3, dur: 0.5, vel: 0.85 },
      { degree: 2, beat: 3.5, dur: 0.5, vel: 0.8 },
      // repeat with higher octave feel
      { degree: 4, beat: 4, dur: 0.5, vel: 0.85 },
      { degree: 5, beat: 4.5, dur: 0.5, vel: 0.85 },
      { degree: 6, beat: 5, dur: 0.5, vel: 0.9 },
      { degree: 4, beat: 5.5, dur: 0.5, vel: 0.85 },
      { degree: 2, beat: 6, dur: 1, vel: 0.85 },
      { degree: 0, beat: 7, dur: 1, vel: 0.9 },
    ],
  },
  {
    name: "trance-arpeggio",
    genre: "trance",
    length: 8,
    notes: [
      // classic trance arp
      { degree: 0, beat: 0, dur: 0.25, vel: 0.8 },
      { degree: 4, beat: 0.25, dur: 0.25, vel: 0.75 },
      { degree: 2, beat: 0.5, dur: 0.25, vel: 0.8 },
      { degree: 4, beat: 0.75, dur: 0.25, vel: 0.75 },
      { degree: 0, beat: 1, dur: 0.25, vel: 0.85 },
      { degree: 4, beat: 1.25, dur: 0.25, vel: 0.75 },
      { degree: 2, beat: 1.5, dur: 0.25, vel: 0.8 },
      { degree: 4, beat: 1.75, dur: 0.25, vel: 0.75 },
      { degree: 0, beat: 2, dur: 0.25, vel: 0.85 },
      { degree: 4, beat: 2.25, dur: 0.25, vel: 0.75 },
      { degree: 2, beat: 2.5, dur: 0.25, vel: 0.8 },
      { degree: 4, beat: 2.75, dur: 0.25, vel: 0.75 },
      { degree: 0, beat: 3, dur: 0.25, vel: 0.85 },
      { degree: 4, beat: 3.25, dur: 0.25, vel: 0.75 },
      { degree: 2, beat: 3.5, dur: 0.25, vel: 0.8 },
      { degree: 4, beat: 3.75, dur: 0.25, vel: 0.75 },
      // variation in bar 2
      { degree: 5, beat: 4, dur: 0.25, vel: 0.8 },
      { degree: 2, beat: 4.25, dur: 0.25, vel: 0.75 },
      { degree: 4, beat: 4.5, dur: 0.25, vel: 0.8 },
      { degree: 2, beat: 4.75, dur: 0.25, vel: 0.75 },
      { degree: 5, beat: 5, dur: 0.25, vel: 0.8 },
      { degree: 2, beat: 5.25, dur: 0.25, vel: 0.75 },
      { degree: 4, beat: 5.5, dur: 0.25, vel: 0.8 },
      { degree: 2, beat: 5.75, dur: 0.25, vel: 0.75 },
      { degree: 0, beat: 6, dur: 1, vel: 0.9 },
      { degree: 0, beat: 7, dur: 1, vel: 0.85 },
    ],
  },
  {
    name: "trance-anthem",
    genre: "trance",
    length: 8,
    notes: [
      // anthem-style with long notes
      { degree: 4, beat: 0, dur: 1.5, vel: 0.9 },
      { degree: 5, beat: 1.5, dur: 0.5, vel: 0.8 },
      { degree: 6, beat: 2, dur: 1, vel: 0.85 },
      { degree: 5, beat: 3, dur: 0.5, vel: 0.8 },
      { degree: 4, beat: 3.5, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 4, dur: 1.5, vel: 0.85 },
      { degree: 4, beat: 5.5, dur: 0.5, vel: 0.8 },
      { degree: 5, beat: 6, dur: 0.5, vel: 0.85 },
      { degree: 4, beat: 6.5, dur: 0.5, vel: 0.8 },
      { degree: 2, beat: 7, dur: 0.5, vel: 0.85 },
      { degree: 0, beat: 7.5, dur: 0.5, vel: 0.9 },
    ],
  },
];

// ── All patterns combined ──

export const allPatterns: MelodyPattern[] = [
  ...housePatterns,
  ...technoPatterns,
  ...trancePatterns,
];

/** Get patterns for a given genre */
export function getPatternsForGenre(genre: string): MelodyPattern[] {
  const lower = genre.toLowerCase();
  if (lower.includes("techno")) return technoPatterns;
  if (lower.includes("trance")) return trancePatterns;
  if (lower.includes("house")) return housePatterns;
  // Default: return all (random pick later)
  return allPatterns;
}
