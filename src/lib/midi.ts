export interface MidiNote {
  pitch: number;      // MIDI note number 0-127 (69 = A4)
  startTime: number;  // in beats from start
  duration: number;   // in beats
  velocity: number;   // 0-1
  channel: number;    // 0-15, maps to instrument
}

export interface MidiTrack {
  name: string;
  channel: number;
  instrument: string;
  notes: MidiNote[];
}

export interface MidiData {
  bpm: number;
  tracks: MidiTrack[];
  totalBeats: number;
}

export function pitchToNote(pitch: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  const name = names[pitch % 12];
  return `${name}${octave}`;
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

export function generateMockMidi(bpm: number = 120): MidiData {
  const beats = 16;
  const beatDuration = 60 / bpm;

  const kickNotes: MidiNote[] = [];
  const snareNotes: MidiNote[] = [];
  const hihatNotes: MidiNote[] = [];
  const bassNotes: MidiNote[] = [];

  for (let beat = 0; beat < beats; beat++) {
    // Kick on 1 and 3
    if (beat % 4 === 0 || beat % 4 === 2) {
      kickNotes.push({ pitch: 36, startTime: beat, duration: 0.9, velocity: 0.9, channel: 0 });
    }
    // Snare on 2 and 4
    if (beat % 4 === 1 || beat % 4 === 3) {
      snareNotes.push({ pitch: 38, startTime: beat, duration: 0.8, velocity: 0.85, channel: 1 });
    }
    // Hi-hat every 8th note
    hihatNotes.push({ pitch: 42, startTime: beat, duration: 0.2, velocity: 0.4 + Math.random() * 0.3, channel: 2 });
    hihatNotes.push({ pitch: 42, startTime: beat + 0.5, duration: 0.15, velocity: 0.2 + Math.random() * 0.2, channel: 2 });

    // Bass line
    if (beat % 2 === 0) {
      bassNotes.push({ pitch: 36 + [0, 5, 7, 3][beat % 4], startTime: beat, duration: 1.8, velocity: 0.7, channel: 3 });
    }
  }

  return {
    bpm,
    totalBeats: beats,
    tracks: [
      { name: "Kick", channel: 0, instrument: "kick", notes: kickNotes },
      { name: "Snare", channel: 1, instrument: "snare", notes: snareNotes },
      { name: "Hi-Hat", channel: 2, instrument: "hihat", notes: hihatNotes },
      { name: "Bass", channel: 3, instrument: "bass", notes: bassNotes },
    ],
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