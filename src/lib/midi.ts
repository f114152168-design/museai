export interface MidiNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
  channel: number;
}

export interface MidiTrack {
  name: string;
  channel: number;
  instrument: string;
  notes: MidiNote[];
}

export interface MusicSection {
  name: string;       // "intro" | "verse" | "chorus" | "bridge" | "outro"
  bars: number;
  instruments: string[];
  description: string;
}

export interface MidiData {
  bpm: number;
  tracks: MidiTrack[];
  totalBeats: number;
  sections?: MusicSection[];
  tier?: "free" | "paid";
}

export function pitchToNote(pitch: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12]}${octave}`;
}

export function noteToPitch(note: string): number {
  const names: Record<string, number> = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
    E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
    Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
  };
  const match = note.match(/^([A-G]#?b?)(\d)$/);
  if (!match) return 69;
  return (parseInt(match[2]) + 1) * 12 + (names[match[1]] ?? 0);
}

export function midiToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function getDurationSeconds(midi: MidiData): number {
  return (midi.totalBeats || 16) * (60 / midi.bpm);
}

export function loopMidi(midi: MidiData, targetBars: number): MidiData {
  const origBeats = midi.totalBeats || 16;
  const targetBeats = targetBars * 4;
  if (targetBeats <= origBeats) return midi;
  const loops = Math.ceil(targetBeats / origBeats);
  const newTracks: MidiTrack[] = midi.tracks.map((track) => {
    const newNotes: MidiNote[] = [];
    for (let i = 0; i < loops; i++) {
      const offset = i * origBeats;
      for (const note of track.notes) {
        if (note.startTime + offset < targetBeats) {
          newNotes.push({ ...note, startTime: note.startTime + offset });
        }
      }
    }
    return { ...track, notes: newNotes };
  });
  return { ...midi, tracks: newTracks, totalBeats: targetBeats };
}

export function generateFreeMidi(bpm: number = 120): MidiData {
  const bars = 8;
  const beats = bars * 4;

  const kickNotes: MidiNote[] = [];
  const snareNotes: MidiNote[] = [];
  const hihatNotes: MidiNote[] = [];
  const bassNotes: MidiNote[] = [];

  for (let beat = 0; beat < beats; beat++) {
    if (beat % 4 === 0 || beat % 4 === 2) {
      kickNotes.push({ pitch: 36, startTime: beat, duration: 0.9, velocity: 0.9, channel: 0 });
    }
    if (beat % 4 === 1 || beat % 4 === 3) {
      snareNotes.push({ pitch: 38, startTime: beat, duration: 0.8, velocity: 0.85, channel: 1 });
    }
    hihatNotes.push({ pitch: 42, startTime: beat, duration: 0.2, velocity: 0.4 + Math.random() * 0.3, channel: 2 });
    hihatNotes.push({ pitch: 42, startTime: beat + 0.5, duration: 0.15, velocity: 0.2 + Math.random() * 0.2, channel: 2 });
    if (beat % 2 === 0) {
      bassNotes.push({ pitch: 36 + [0, 5, 7, 3][beat % 4], startTime: beat, duration: 1.8, velocity: 0.7, channel: 3 });
    }
  }

  return {
    bpm,
    totalBeats: beats,
    tier: "free",
    sections: [
      { name: "loop", bars, instruments: ["kick", "snare", "hihat", "bass"], description: "循環節奏" },
    ],
    tracks: [
      { name: "Kick", channel: 0, instrument: "kick", notes: kickNotes },
      { name: "Snare", channel: 1, instrument: "snare", notes: snareNotes },
      { name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hihatNotes },
      { name: "Bass", channel: 3, instrument: "bass", notes: bassNotes },
    ],
  };
}

export function generatePaidMidi(bpm: number = 128): MidiData {
  const sections: MusicSection[] = [
    { name: "intro", bars: 8, instruments: ["pad", "piano"], description: "導入" },
    { name: "verse", bars: 8, instruments: ["kick", "bass", "pad"], description: "主歌" },
    { name: "chorus", bars: 8, instruments: ["kick", "snare", "hihat", "bass", "lead"], description: "副歌" },
    { name: "bridge", bars: 4, instruments: ["pad", "arp"], description: "橋段" },
    { name: "chorus", bars: 8, instruments: ["kick", "snare", "hihat", "bass", "lead", "pad"], description: "高亢副歌" },
    { name: "outro", bars: 4, instruments: ["pad", "piano"], description: "結尾" },
  ];

  const totalBeats = sections.reduce((sum, s) => sum + s.bars * 4, 0);
  let beat = 0;
  const kicks: MidiNote[] = [];
  const snares: MidiNote[] = [];
  const hihats: MidiNote[] = [];
  const bassNotes: MidiNote[] = [];
  const padNotes: MidiNote[] = [];
  const leadNotes: MidiNote[] = [];
  const arpNotes: MidiNote[] = [];

  for (const section of sections) {
    const end = beat + section.bars * 4;

    for (let b = beat; b < end; b++) {
      if (section.instruments.includes("kick") && (b % 4 === 0 || b % 4 === 2)) {
        const vel = section.name === "chorus" ? 0.95 : 0.8;
        kicks.push({ pitch: 36, startTime: b, duration: 0.9, velocity: vel, channel: 0 });
      }
      if (section.instruments.includes("snare") && (b % 4 === 1 || b % 4 === 3)) {
        snares.push({ pitch: 38, startTime: b, duration: 0.8, velocity: 0.85, channel: 1 });
      }
      if (section.instruments.includes("hihat")) {
        hihats.push({ pitch: 42, startTime: b, duration: 0.2, velocity: 0.5, channel: 2 });
        hihats.push({ pitch: 42, startTime: b + 0.5, duration: 0.15, velocity: 0.3, channel: 2 });
      }
      if (section.instruments.includes("bass") && b % 2 === 0) {
        const root = [36, 43, 38, 41][Math.floor((b - beat) / 4) % 4];
        bassNotes.push({ pitch: root + (section.name === "chorus" ? 12 : 0), startTime: b, duration: 1.8, velocity: 0.75, channel: 3 });
      }
      if (section.instruments.includes("pad") && b % 4 === 0) {
        const chords = [48, 55, 60, 67];
        padNotes.push({ pitch: chords[Math.floor((b - beat) / 4) % 4], startTime: b, duration: 3.5, velocity: 0.5, channel: 4 });
      }
      if (section.instruments.includes("lead") && b % 2 === 0) {
        const melody = [60, 62, 64, 67, 64, 62, 60, 59];
        leadNotes.push({ pitch: melody[(b - beat) % melody.length], startTime: b, duration: 1.5 + Math.random() * 0.5, velocity: 0.8, channel: 5 });
      }
      if (section.instruments.includes("arp") && b % 0.5 === 0) {
        const arp = [60, 64, 67, 72, 67, 64];
        arpNotes.push({ pitch: arp[Math.floor((b - beat) * 2) % arp.length], startTime: b, duration: 0.4, velocity: 0.4, channel: 5 });
      }
    }
    beat = end;
  }

  const tracks: MidiTrack[] = [];
  if (kicks.length > 0) tracks.push({ name: "Kick", channel: 0, instrument: "kick", notes: kicks });
  if (snares.length > 0) tracks.push({ name: "Snare", channel: 1, instrument: "snare", notes: snares });
  if (hihats.length > 0) tracks.push({ name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hihats });
  if (bassNotes.length > 0) tracks.push({ name: "Bass", channel: 3, instrument: "bass", notes: bassNotes });
  if (padNotes.length > 0) tracks.push({ name: "Pad", channel: 4, instrument: "pad", notes: padNotes });
  if (leadNotes.length > 0 || arpNotes.length > 0) {
    tracks.push({ name: "Lead", channel: 5, instrument: "lead", notes: [...leadNotes, ...arpNotes].sort((a, b) => a.startTime - b.startTime) });
  }

  return {
    bpm,
    totalBeats,
    tier: "paid",
    sections,
    tracks,
  };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function getPianoRollRange(midi: MidiData): { low: number; high: number } {
  let low = 127, high = 0;
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      if (note.pitch < low) low = note.pitch;
      if (note.pitch > high) high = note.pitch;
    }
  }
  if (low > high) { low = 36; high = 84; }
  return { low: Math.max(0, low - 3), high: Math.min(127, high + 3) };
}

export function getNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[pitch % 12]}${octave}`;
}

// ── EDM Post-processing ──

/** Snap all notes to nearest grid division (e.g. 0.25 = 16th note) */
export function quantizeMidi(midi: MidiData, gridSize = 0.25): MidiData {
  return {
    ...midi,
    tracks: midi.tracks.map((t) => ({
      ...t,
      notes: t.notes.map((n) => ({
        ...n,
        startTime: Math.round(n.startTime / gridSize) * gridSize,
      })),
    })),
  };
}

/** Shorten all note durations for pluck effect */
export function pluckMidi(midi: MidiData, maxDuration = 0.15): MidiData {
  return {
    ...midi,
    tracks: midi.tracks.map((t) => ({
      ...t,
      notes: t.notes.map((n) => ({
        ...n,
        duration: Math.min(n.duration, maxDuration),
        velocity: Math.min(n.velocity + 0.15, 1),
      })),
    })),
  };
}

/** Add four-on-the-floor kick + clap/hat pattern to drum channels */
export function addFourOnFloor(midi: MidiData): MidiData {
  const beats = midi.totalBeats || 16;
  const tracks = midi.tracks.map((t) => {
    // Kick: channel 0 — every beat
    if (t.channel === 0) {
      const newNotes: MidiNote[] = [];
      for (let b = 0; b < beats; b++) {
        newNotes.push({ pitch: 36, startTime: b, duration: 0.9, velocity: 0.9, channel: 0 });
      }
      return { ...t, notes: newNotes };
    }
    // Snare/Clap: channel 1 — beat 2 & 4
    if (t.channel === 1) {
      const newNotes: MidiNote[] = [];
      for (let b = 0; b < beats; b++) {
        if (b % 4 === 1 || b % 4 === 3) {
          newNotes.push({ pitch: 38, startTime: b, duration: 0.2, velocity: 0.85, channel: 1 });
        }
      }
      return { ...t, notes: newNotes };
    }
    // Hi-hat: channel 2 — every 8th note
    if (t.channel === 2) {
      const newNotes: MidiNote[] = [];
      for (let b = 0; b < beats; b++) {
        for (let eighth = 0; eighth < 2; eighth++) {
          const time = b + eighth * 0.5;
          const isOffbeat = eighth === 1;
          newNotes.push({
            pitch: isOffbeat ? 46 : 42,
            startTime: time,
            duration: isOffbeat ? 0.3 : 0.15,
            velocity: isOffbeat ? 0.5 : 0.4,
            channel: 2,
          });
        }
      }
      return { ...t, notes: newNotes };
    }
    return t;
  });
  return { ...midi, tracks };
}

/** Arpeggiate: split chord notes into rhythmic pattern */
export function arpeggiateMidi(midi: MidiData, pattern: ("up" | "down" | "updown") = "up", gate = 0.5): MidiData {
  const grid = 0.25; // 16th notes
  return {
    ...midi,
    tracks: midi.tracks.map((t) => {
      // Find overlapping chords (notes starting at same time)
      const groups = new Map<number, MidiNote[]>();
      for (const n of t.notes) {
        const key = Math.round(n.startTime / grid);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(n);
      }

      const newNotes: MidiNote[] = [];
      for (const [beatKey, chord] of groups) {
        if (chord.length < 2) {
          newNotes.push(...chord);
          continue;
        }
        // Sort by pitch
        const sorted = [...chord].sort((a, b) => a.pitch - b.pitch);
        if (pattern === "down") sorted.reverse();
        else if (pattern === "updown") {
          // up then down: C E G → C E G E
          sorted.push(...sorted.slice(1, -1).reverse());
        }
        const step = gate / sorted.length;
        for (let i = 0; i < sorted.length; i++) {
          const time = beatKey * grid + i * step;
          newNotes.push({ ...sorted[i], startTime: time, duration: step * 0.8, velocity: sorted[i].velocity });
        }
      }
      return { ...t, notes: newNotes.sort((a, b) => a.startTime - b.startTime) };
    }),
  };
}

// ── Style-specific generators ──

export function generateHouseMidi(bpm = 128): MidiData {
  const beats = 32; // 8 bars
  const kick: MidiNote[] = [];
  const clap: MidiNote[] = [];
  const hat: MidiNote[] = [];
  const bass: MidiNote[] = [];
  const chordStab: MidiNote[] = [];
  const pluck: MidiNote[] = [];

  // Four-on-floor kick
  for (let b = 0; b < beats; b++) kick.push({ pitch: 36, startTime: b, duration: 0.85, velocity: 0.9 + Math.random() * 0.1, channel: 0 });

  // Clap on 2 & 4
  for (let b = 0; b < beats; b++) {
    if (b % 4 === 1 || b % 4 === 3) clap.push({ pitch: 38, startTime: b, duration: 0.2, velocity: 0.85, channel: 1 });
  }

  // Open hat on offbeats
  for (let b = 0; b < beats; b++) {
    hat.push({ pitch: 42, startTime: b, duration: 0.12, velocity: 0.35, channel: 2 });
    hat.push({ pitch: 46, startTime: b + 0.5, duration: 0.25, velocity: 0.5, channel: 2 });
  }

  // Bass — root-fifth pattern
  const bassPattern = [36, 43, 38, 41];
  for (let b = 0; b < beats; b++) {
    if (b % 2 === 0) {
      const root = bassPattern[Math.floor(b / 4) % 4];
      bass.push({ pitch: root, startTime: b, duration: 1.5, velocity: 0.75, channel: 3 });
    }
  }

  // Chord stabs (every 2 bars)
  const chords = [
    [48, 55, 60, 64], // Cm
    [50, 57, 62, 65], // Dm
    [55, 59, 63, 67], // G
    [53, 58, 62, 66], // F
  ];
  for (let bar = 0; bar < 8; bar++) {
    const c = chords[bar % 4];
    const beat = bar * 4;
    for (const p of c) {
      chordStab.push({ pitch: p, startTime: beat, duration: 0.15, velocity: 0.7, channel: 4 });
    }
  }

  // Pluck melody (8th notes, filtered, short)
  const melodyNotes = [60, 62, 64, 67, 64, 62, 60, 59, 57, 59, 60, 62, 64, 67, 64, 62];
  for (let i = 0; i < Math.min(melodyNotes.length, beats * 2); i++) {
    const time = i * 0.5;
    pluck.push({ pitch: melodyNotes[i % melodyNotes.length], startTime: time, duration: 0.1, velocity: 0.8, channel: 5 });
  }

  return {
    bpm,
    totalBeats: beats,
    tier: "free",
    sections: [{ name: "loop", bars: 8, instruments: ["kick", "clap", "hat", "bass", "chord", "pluck"], description: "House 循環" }],
    tracks: [
      { name: "Kick", channel: 0, instrument: "kick", notes: kick },
      { name: "Clap", channel: 1, instrument: "clap", notes: clap },
      { name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hat },
      { name: "Bass", channel: 3, instrument: "bass", notes: bass },
      { name: "Chord", channel: 4, instrument: "pad", notes: chordStab },
      { name: "Pluck", channel: 5, instrument: "lead", notes: pluck },
    ],
  };
}

export function generateTechnoMidi(bpm = 126): MidiData {
  const beats = 32;
  const kick: MidiNote[] = [];
  const clap: MidiNote[] = [];
  const hat: MidiNote[] = [];
  const bass: MidiNote[] = [];
  const pad: MidiNote[] = [];
  const arp: MidiNote[] = [];

  // Heavy kick every beat
  for (let b = 0; b < beats; b++) kick.push({ pitch: 35, startTime: b, duration: 0.8, velocity: 0.95, channel: 0 });

  // Clap on 2 & 4 with reverb effect
  for (let b = 0; b < beats; b++) {
    if (b % 4 === 1) clap.push({ pitch: 39, startTime: b, duration: 0.25, velocity: 0.75, channel: 1 });
    if (b % 4 === 3) clap.push({ pitch: 39, startTime: b, duration: 0.2, velocity: 0.65, channel: 1 });
  }

  // Closed hat shuffle pattern
  for (let b = 0; b < beats; b++) {
    hat.push({ pitch: 42, startTime: b, duration: 0.08, velocity: 0.3, channel: 2 });
    if (b % 2 === 0) hat.push({ pitch: 42, startTime: b + 0.25, duration: 0.06, velocity: 0.2, channel: 2 });
  }

  // Rolling bassline
  const bassPattern = [35, 38, 33, 36];
  for (let b = 0; b < beats; b++) {
    if (b % 2 === 0) {
      const root = bassPattern[Math.floor(b / 4) % 4];
      bass.push({ pitch: root, startTime: b, duration: 1.8, velocity: 0.7, channel: 3 });
    }
  }

  // Dark pad — slow evolving
  for (let bar = 0; bar < 8; bar++) {
    const root = 45 + [0, 5, 3, 7][bar % 4];
    pad.push({ pitch: root, startTime: bar * 4, duration: 3.5, velocity: 0.45, channel: 4 });
  }

  // Arp — hypnotic 16th notes
  const arpPattern = [60, 63, 67, 72, 67, 63];
  for (let i = 0; i < beats * 4; i++) {
    const time = i * 0.25;
    if (time >= beats) break;
    arp.push({ pitch: arpPattern[i % arpPattern.length], startTime: time, duration: 0.08, velocity: 0.5, channel: 5 });
  }

  return {
    bpm,
    totalBeats: beats,
    tier: "free",
    sections: [{ name: "loop", bars: 8, instruments: ["kick", "clap", "hat", "bass", "pad", "arp"], description: "Techno 循環" }],
    tracks: [
      { name: "Kick", channel: 0, instrument: "kick", notes: kick },
      { name: "Clap", channel: 1, instrument: "clap", notes: clap },
      { name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hat },
      { name: "Bass", channel: 3, instrument: "bass", notes: bass },
      { name: "Pad", channel: 4, instrument: "pad", notes: pad },
      { name: "Arp", channel: 5, instrument: "lead", notes: arp },
    ],
  };
}

export function generateTranceMidi(bpm = 138): MidiData {
  const beats = 32;
  const kick: MidiNote[] = [];
  const snare: MidiNote[] = [];
  const hat: MidiNote[] = [];
  const bass: MidiNote[] = [];
  const supersaw: MidiNote[] = [];
  const arp: MidiNote[] = [];

  // Kick 4-on-floor
  for (let b = 0; b < beats; b++) kick.push({ pitch: 36, startTime: b, duration: 0.85, velocity: 0.9, channel: 0 });

  // Snare on 2 & 4
  for (let b = 0; b < beats; b++) {
    if (b % 4 === 1 || b % 4 === 3) snare.push({ pitch: 40, startTime: b, duration: 0.15, velocity: 0.8, channel: 1 });
  }

  // Hat: every 8th + 16th shuffle
  for (let b = 0; b < beats; b++) {
    for (let s = 0; s < 2; s++) {
      const time = b + s * 0.5;
      hat.push({ pitch: s === 0 ? 42 : 46, startTime: time, duration: s === 0 ? 0.1 : 0.2, velocity: s === 0 ? 0.3 : 0.45, channel: 2 });
    }
  }

  // Rolling trance bassline (root-octave pattern)
  const bassRoots = [41, 43, 36, 38];
  for (let b = 0; b < beats; b++) {
    if (b % 2 === 0) {
      const root = bassRoots[Math.floor(b / 4) % 4];
      bass.push({ pitch: root, startTime: b, duration: 1.2, velocity: 0.75, channel: 3 });
      bass.push({ pitch: root + 12, startTime: b, duration: 0.6, velocity: 0.5, channel: 3 });
    }
  }

  // Supersaw pad — emotional chord progression
  const chordProg = [
    [52, 56, 59, 63], // Fm
    [50, 53, 57, 62], // Dm
    [48, 52, 55, 60], // Cm
    [55, 59, 62, 66], // G
  ];
  for (let bar = 0; bar < 8; bar++) {
    const c = chordProg[bar % 4];
    const beat = bar * 4;
    for (const p of c) {
      supersaw.push({ pitch: p + 12, startTime: beat, duration: 3.5, velocity: 0.55, channel: 4 });
    }
  }

  // Trance arp — rapid 16th notes
  const tranceArp = [60, 64, 67, 72, 67, 64, 60, 59, 57, 59, 60, 64, 67, 72, 76, 72];
  for (let i = 0; i < beats * 4; i++) {
    const time = i * 0.25;
    if (time >= beats) break;
    arp.push({ pitch: tranceArp[i % tranceArp.length], startTime: time, duration: 0.1, velocity: 0.55, channel: 5 });
  }

  return {
    bpm,
    totalBeats: beats,
    tier: "free",
    sections: [{ name: "loop", bars: 8, instruments: ["kick", "snare", "hat", "bass", "supersaw", "arp"], description: "Trance 循環" }],
    tracks: [
      { name: "Kick", channel: 0, instrument: "kick", notes: kick },
      { name: "Snare", channel: 1, instrument: "snare", notes: snare },
      { name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hat },
      { name: "Bass", channel: 3, instrument: "bass", notes: bass },
      { name: "Supersaw", channel: 4, instrument: "pad", notes: supersaw },
      { name: "Arp", channel: 5, instrument: "lead", notes: arp },
    ],
  };
}

const STYLE_GENERATORS: Record<string, (bpm: number) => MidiData> = {
  house: generateHouseMidi,
  techno: generateTechnoMidi,
  trance: generateTranceMidi,
};

export function generateStyleMidi(style: string, bpm: number = 128): MidiData {
  const gen = STYLE_GENERATORS[style.toLowerCase()];
  if (gen) return gen(bpm);
  return generateFreeMidi(bpm);
}

export function generateMockMidi(bpm: number = 120): MidiData {
  return generateFreeMidi(bpm);
}