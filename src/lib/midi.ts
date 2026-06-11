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

export function generateMockMidi(bpm: number = 120): MidiData {
  return generateFreeMidi(bpm);
}