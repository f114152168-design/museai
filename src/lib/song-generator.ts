import { generateMelody, generateChords, type MelodyParams } from "./melody-generator";
import type { MidiData, MidiNote, MidiTrack } from "./midi";

const GENRE_PROFILES: Record<string, { bpm: number; key: string; scale: string; instruments: string[] }> = {
  house: { bpm: 128, key: "A", scale: "minor", instruments: ["kick", "clap", "hat", "bass", "chord", "lead"] },
  techno: { bpm: 126, key: "D", scale: "minor", instruments: ["kick", "clap", "hat", "bass", "pad", "arp"] },
  trance: { bpm: 138, key: "F", scale: "minor", instruments: ["kick", "snare", "hat", "bass", "supersaw", "arp"] },
  progressive: { bpm: 130, key: "C", scale: "minor", instruments: ["kick", "clap", "hat", "bass", "pad", "lead"] },
  dubstep: { bpm: 140, key: "A", scale: "minor", instruments: ["kick", "snare", "hat", "bass", "synth", "lead"] },
  ambient: { bpm: 90, key: "C", scale: "major", instruments: ["pad", "bass", "arp"] },
  loFi: { bpm: 85, key: "C", scale: "major", instruments: ["kick", "snare", "hat", "bass", "pad", "lead"] },
};

const MOOD_ADJUSTMENTS: Record<string, { complexity: number; noteLength: number }> = {
  uplifting: { complexity: 0.7, noteLength: 0.4 },
  emotional: { complexity: 0.5, noteLength: 0.7 },
  dark: { complexity: 0.6, noteLength: 0.5 },
  euphoric: { complexity: 0.8, noteLength: 0.3 },
  chill: { complexity: 0.3, noteLength: 0.7 },
  aggressive: { complexity: 0.85, noteLength: 0.15 },
  hypnotic: { complexity: 0.75, noteLength: 0.25 },
  atmospheric: { complexity: 0.4, noteLength: 0.8 },
};

interface SongParams {
  bpm: number;
  key: string;
  scale: string;
  complexity: number;
  noteLength: number;
  genre: string;
  mood: string[];
  bars: number; // total bars
}

function parsePrompt(prompt: string): Partial<SongParams> {
  const lower = prompt.toLowerCase();
  const result: Partial<SongParams> = {};

  // Detect genre
  for (const [genre] of Object.entries(GENRE_PROFILES)) {
    if (lower.includes(genre)) {
      const profile = GENRE_PROFILES[genre];
      result.genre = genre;
      result.bpm = profile.bpm;
      result.key = profile.key;
      result.scale = profile.scale;
      break;
    }
  }

  // Detect mood
  result.mood = [];
  for (const [mood] of Object.entries(MOOD_ADJUSTMENTS)) {
    if (lower.includes(mood)) result.mood.push(mood);
  }

  // Detect key
  const keyMatch = lower.match(/\b([A-G][#b]?)\s*(major|minor|maj|min|大調|小調)\b/);
  if (keyMatch) {
    result.key = keyMatch[1];
    const mode = keyMatch[2];
    if (mode === "major" || mode === "maj" || mode === "大調") result.scale = "major";
    else if (mode === "minor" || mode === "min" || mode === "小調") result.scale = "minor";
  }

  // Detect BPM
  const bpmMatch = lower.match(/(\d+)\s*(bpm|BPM)/);
  if (bpmMatch) result.bpm = parseInt(bpmMatch[1]);

  return result;
}

/** Generate a full song arrangement from a text prompt */
export function generateSongFromPrompt(prompt: string, tier: "free" | "paid" = "free"): MidiData {
  const parsed = parsePrompt(prompt);
  const genre = parsed.genre || "house";
  const profile = GENRE_PROFILES[genre] ?? GENRE_PROFILES.house;
  const mood = parsed.mood?.[0] || "uplifting";
  const moodAdj = MOOD_ADJUSTMENTS[mood] ?? MOOD_ADJUSTMENTS.uplifting;

  const bpm = parsed.bpm || profile.bpm;
  const key = parsed.key || profile.key;
  const scale = parsed.scale || profile.scale;

  // Total bars: 8 for free, 32 for paid (full song)
  const totalBars = tier === "paid" ? 32 : 8;
  const totalBeats = totalBars * 4;

  // Generate main melody motif (used across sections)
  const melodyParams: MelodyParams = {
    key, scale,
    complexity: moodAdj.complexity,
    noteLength: moodAdj.noteLength,
    bpm, bars: totalBars,
  };
  const melodyMidi = generateMelody(melodyParams);
  const melodyNotes = melodyMidi.tracks[0]?.notes ?? [];

  // Generate chord progression
  const chordProg = generateChords(key, scale, moodAdj.complexity, totalBars);

  // Build track data
  const allKicks: MidiNote[] = [];
  const allPerc: MidiNote[] = [];  // snare/clap
  const allHats: MidiNote[] = [];
  const allBass: MidiNote[] = [];
  const allChords: MidiNote[] = [];
  const allFx: MidiNote[] = [];

  let seed = prompt.length + bpm + key.charCodeAt(0);
  function rng() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  // Section structure
  interface Section { startBar: number; bars: number; name: string; energy: number; }
  const sections: Section[] = tier === "paid"
    ? [
        { startBar: 0, bars: 4, name: "intro", energy: 0.3 },
        { startBar: 4, bars: 4, name: "build-1", energy: 0.5 },
        { startBar: 8, bars: 8, name: "verse", energy: 0.6 },
        { startBar: 16, bars: 4, name: "build-2", energy: 0.8 },
        { startBar: 20, bars: 8, name: "drop", energy: 1.0 },
        { startBar: 28, bars: 4, name: "outro", energy: 0.3 },
      ]
    : [{ startBar: 0, bars: 8, name: "loop", energy: 0.8 }];

  for (const section of sections) {
    const secStart = section.startBar * 4;
    const secEnd = (section.startBar + section.bars) * 4;
    const energy = section.energy;
    const hasDrums = energy > 0.3;
    const hasBass = energy > 0.4;
    const hasChords = energy > 0.3;
    const hasMelody = energy > 0.5;
    const isBuild = section.name.includes("build");
    const isDrop = section.name === "drop";
    const isIntro = section.name === "intro";
    const isOutro = section.name === "outro";

    // ── Drums ──
    if (hasDrums) {
      for (let b = secStart; b < secEnd; b++) {
        // Kick: every beat (reduced in intro)
        if (isIntro && b % 2 !== 0) continue;
        allKicks.push({
          pitch: 36, startTime: b, duration: 0.85,
          velocity: 0.7 + energy * 0.25, channel: 0,
        });

        // Snare/Clap: 2 & 4 (skip in intro)
        if (!isIntro && (b % 4 === 1 || b % 4 === 3)) {
          allPerc.push({
            pitch: 38, startTime: b, duration: 0.2,
            velocity: 0.6 + energy * 0.3, channel: 1,
          });
        }

        // Hi-hat: 8th notes
        allHats.push({
          pitch: 42, startTime: b, duration: 0.1,
          velocity: 0.2 + energy * 0.2, channel: 2,
        });
        allHats.push({
          pitch: 46, startTime: b + 0.5, duration: 0.2,
          velocity: 0.2 + energy * 0.3, channel: 2,
        });
      }
    }

    // ── Bass ──
    if (hasBass) {
      for (let b = secStart; b < secEnd; b++) {
        if (b % 2 !== 0) continue;
        const chordIdx = Math.floor(b / 4) % chordProg.length;
        const chord = chordProg[chordIdx];
        const root = (chord?.[0] ?? 48) - 12; // one octave down
        allBass.push({
          pitch: root, startTime: b, duration: 1.5,
          velocity: 0.5 + energy * 0.3, channel: 3,
        });
        // Ghost note on offbeat for groove
        if (!isIntro && energy > 0.5) {
          allBass.push({
            pitch: root + 5, startTime: b + 0.75, duration: 0.15,
            velocity: 0.2, channel: 3,
          });
        }
      }
    }

    // ── Chord stab / Pad ──
    if (hasChords) {
      const chordInterval = isIntro || isOutro ? 4 : 2; // every bar or every 2 beats
      for (let b = secStart; b < secEnd; b += chordInterval) {
        const chordIdx = Math.floor(b / 4) % chordProg.length;
        const chord = chordProg[chordIdx];
        if (!chord) continue;
        for (const p of chord) {
          const vel = isIntro || isOutro ? 0.3 : 0.4 + energy * 0.35;
          allChords.push({
            pitch: p + 12, // +1 octave
            startTime: b, duration: isBuild ? 0.15 : 1.5,
            velocity: vel, channel: 4,
          });
        }
      }
    }

    // ── Main melody (from generated motif) ──
    if (hasMelody) {
      // Select a portion of the melody for this section
      const sectionLength = section.bars * 4;
      const melodySlice = melodyNotes.filter((n) => {
        const relStart = n.startTime % totalBeats;
        return relStart >= (n.startTime) && relStart < (n.startTime + sectionLength);
      });

      for (const note of melodySlice) {
        // Adjust velocity by energy
        const adjustedNote = {
          ...note,
          startTime: secStart + (note.startTime % sectionLength),
          velocity: note.velocity * (0.5 + energy * 0.5),
          channel: 5,
        };
        allFx.push(adjustedNote);
      }
    }

    // ── Build-up riser ──
    if (isBuild) {
      for (let b = secStart; b < secEnd; b++) {
        const progress = (b - secStart) / (secEnd - secStart);
        // Rising pitch
        const pitch = 48 + Math.floor(progress * 36);
        allFx.push({
          pitch, startTime: b, duration: 0.5,
          velocity: 0.3 + progress * 0.5, channel: 5,
        });
      }
    }

    // ── Drop impact FX ──
    if (isDrop) {
      allFx.push({
        pitch: 36, startTime: secStart, duration: 0.05,
        velocity: 1.0, channel: 5,
      });
    }
  }

  // Sort per-track notes by time
  const sortNotes = (notes: MidiNote[]) => notes.sort((a, b) => a.startTime - b.startTime);
  sortNotes(allKicks);
  sortNotes(allPerc);
  sortNotes(allHats);
  sortNotes(allBass);
  sortNotes(allChords);
  sortNotes(allFx);

  const tracks: MidiTrack[] = [];
  if (allKicks.length > 0) tracks.push({ name: "Kick", channel: 0, instrument: "kick", notes: allKicks });
  if (allPerc.length > 0) tracks.push({ name: "Snare/Clap", channel: 1, instrument: "clap", notes: allPerc });
  if (allHats.length > 0) tracks.push({ name: "Hi-Hat", channel: 2, instrument: "hihat", notes: allHats });
  if (allBass.length > 0) tracks.push({ name: "Bass", channel: 3, instrument: "bass", notes: allBass });
  if (allChords.length > 0) tracks.push({ name: "Chord", channel: 4, instrument: "pad", notes: allChords });
  if (allFx.length > 0) tracks.push({ name: "Lead", channel: 5, instrument: "lead", notes: allFx });

  const songSections = sections.map((s) => ({
    name: s.name,
    bars: s.bars,
    instruments: [],
    description: `${s.name} (energy ${Math.round(s.energy * 100)}%)`,
  }));

  return {
    bpm,
    totalBeats,
    tier: tier === "paid" ? "paid" : "free",
    sections: songSections,
    tracks,
  };
}

/** Generate multiple song variations from a single prompt */
export function generateSongVariations(prompt: string, count: number = 3): MidiData[] {
  const results: MidiData[] = [];
  for (let i = 0; i < count; i++) {
    const song = generateSongFromPrompt(prompt, "paid");
    // Slightly shift BPM for variation
    results.push({ ...song, bpm: song.bpm + (i - 1) * 2 });
  }
  return results;
}
