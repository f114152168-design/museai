import * as Tone from "tone";
import type { MusicGenerationParams } from "@/lib/openai";

let initialized = false;

export async function initAudio() {
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

// ── Master Chain ──────────────────────────────────────────
const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).toDestination();
const delay = new Tone.FeedbackDelay("8n", 0.2).connect(reverb);
const compressor = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25 }).connect(delay);
const masterGain = new Tone.Gain(0.8).connect(compressor);

function connectToMaster(node: Tone.ToneAudioNode) {
  node.connect(masterGain);
}

// ── Instruments ────────────────────────────────────────────
interface InstrumentMap {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.MetalSynth;
  openhat: Tone.MetalSynth;
  clap: Tone.NoiseSynth;
  bass: Tone.PolySynth;
  pad: Tone.PolySynth;
  lead: Tone.PolySynth;
  arp: Tone.PolySynth;
  fx: Tone.MetalSynth;
  [key: string]: Tone.ToneAudioNode | Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;
}

const instruments: Partial<InstrumentMap> = {};

function getOrCreateInstrument(name: string): Tone.ToneAudioNode {
  if (instruments[name]) return instruments[name];

  let inst: Tone.ToneAudioNode;

  switch (name) {
    // ── Drums ──
    case "kick":
      inst = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      }).connect(masterGain);
      break;

    case "snare":
      inst = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      }).connect(masterGain);
      break;

    case "hihat":
      inst = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 800,
      }).connect(masterGain);
      break;

    case "openhat":
      inst = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 800,
      }).connect(masterGain);
      break;

    case "clap":
      inst = new Tone.NoiseSynth({
        noise: { type: "brown" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      }).connect(masterGain);
      break;

    // ── Bass (FM synthesis = rich, warm) ──
    case "bass":
      inst = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.5,
        modulationIndex: 2,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
        modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.3 },
      }).connect(masterGain);
      break;

    // ── Pad (AM synthesis = warm, evolving) ──
    case "pad":
      inst = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: "sawtooth" },
        modulation: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2 },
        modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 0.6, release: 1.5 },
      }).connect(masterGain);
      break;

    // ── Lead (sync synth = punchy) ──
    case "lead":
      inst = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 3,
        oscillator: { type: "sawtooth" },
        modulation: { type: "square" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
        modulationEnvelope: { attack: 0.05, decay: 0.05, sustain: 0.5, release: 0.2 },
      }).connect(masterGain);
      break;

    // ── Arpeggio (clean, bright) ──
    case "arp":
      inst = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.002, decay: 0.1, sustain: 0.1, release: 0.1 },
      }).connect(masterGain);
      break;

    case "fx":
      inst = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
        harmonicity: 8,
        modulationIndex: 64,
        resonance: 2000,
      }).connect(masterGain);
      break;

    default:
      inst = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 },
      }).connect(masterGain);
  }

  instruments[name] = inst as any;
  return inst;
}

// ── Scale / Note utilities ─────────────────────────────────
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

function noteName(root: string, semitoneOffset: number): string {
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) return "C4";
  const idx = (rootIdx + semitoneOffset + 12) % 12;
  const octave = 4 + Math.floor((rootIdx + semitoneOffset) / 12);
  return `${NOTES[idx]}${octave}`;
}

function getScaleNotes(root: string, scale: string): string[] {
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.major;
  const notes: string[] = [];
  for (let oct = -1; oct <= 2; oct++) {
    for (const interval of intervals) {
      notes.push(noteName(root, interval + oct * 12));
    }
  }
  return notes;
}

// ── Pattern engine ─────────────────────────────────────────
function getRandomNote(scaleNotes: string[], octaveShift: number = 0): string {
  const base = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
  const noteMatch = base.match(/^([A-G]#?)(\d)$/);
  if (!noteMatch) return "C4";
  return `${noteMatch[1]}${Number(noteMatch[2]) + octaveShift}`;
}

interface PatternStep {
  time: string;
  note?: string;
  duration: string;
  velocity?: number;
}

function generatePattern(
  type: string,
  instrumentName: string,
  notes: string[],
  bpm: number,
  scaleNotes: string[],
  bars: number = 4
): PatternStep[] {
  const steps: PatternStep[] = [];
  const beatDuration = 60 / bpm;

  switch (type) {
    // ── Rhythmic patterns ──
    case "fourOnFloor": {
      for (let bar = 0; bar < bars; bar++) {
        for (let beat = 0; beat < 4; beat++) {
          steps.push({
            time: `+${(bar * 4 + beat) * beatDuration}`,
            note: notes[0],
            duration: `${beatDuration * 0.9}s`,
            velocity: 0.8 + Math.random() * 0.2,
          });
        }
      }
      break;
    }

    case "offBeat": {
      for (let bar = 0; bar < bars; bar++) {
        for (let beat = 0; beat < 4; beat++) {
          const offTime = bar * 4 + beat + 0.5;
          steps.push({
            time: `+${offTime * beatDuration}`,
            note: notes[Math.floor(Math.random() * notes.length)],
            duration: `${beatDuration * 0.3}s`,
            velocity: 0.3 + Math.random() * 0.3,
          });
        }
      }
      break;
    }

    case "halfTime": {
      for (let bar = 0; bar < bars; bar++) {
        steps.push({
          time: `+${bar * 4 * beatDuration}`,
          note: notes[0],
          duration: `${beatDuration * 0.9}s`,
        });
        steps.push({
          time: `+${(bar * 4 + 2) * beatDuration}`,
          note: notes[0],
          duration: `${beatDuration * 0.9}s`,
        });
      }
      break;
    }

    // ── Melodic patterns ──
    case "walking": {
      for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < 4; step++) {
          const note = notes[Math.floor(Math.random() * notes.length)] || getRandomNote(scaleNotes, -1);
          steps.push({
            time: `+${(bar * 4 + step) * beatDuration}`,
            note,
            duration: `${beatDuration * 0.7}s`,
            velocity: 0.6 + Math.random() * 0.3,
          });
        }
      }
      break;
    }

    case "arpeggio": {
      for (let bar = 0; bar < bars; bar++) {
        for (let i = 0; i < 8; i++) {
          const note = notes[i % notes.length] || getRandomNote(scaleNotes);
          const stripped = note.replace(/\d/, "");
          const oct = Math.floor(i / notes.length);
          const noteWithOct = `${stripped}${4 + oct}`;
          steps.push({
            time: `+${(bar * 4 + i * 0.5) * beatDuration}`,
            note: noteWithOct,
            duration: `${beatDuration * 0.35}s`,
            velocity: 0.5 + Math.random() * 0.3,
          });
        }
      }
      break;
    }

    case "chordal": {
      for (let bar = 0; bar < bars; bar++) {
        const chordNotes = notes.slice(0, Math.min(3, notes.length));
        for (const note of chordNotes) {
          steps.push({
            time: `+${bar * 4 * beatDuration}`,
            note,
            duration: `${beatDuration * 3.5}s`,
            velocity: 0.5,
          });
        }
      }
      break;
    }

    case "random": {
      for (let i = 0; i < bars * 8; i++) {
        const note = getRandomNote(scaleNotes);
        steps.push({
          time: `+${i * beatDuration * 0.5}`,
          note,
          duration: `${beatDuration * 0.35}s`,
          velocity: 0.3 + Math.random() * 0.5,
        });
      }
      break;
    }

    default: {
      // custom / unknown pattern: play notes sequentially
      for (let bar = 0; bar < bars; bar++) {
        for (let i = 0; i < notes.length; i++) {
          steps.push({
            time: `+${(bar * 4 + i * (4 / notes.length)) * beatDuration}`,
            note: notes[i],
            duration: `${beatDuration * 0.5}s`,
            velocity: 0.7,
          });
        }
      }
    }
  }

  return steps;
}

// ── Public API ──────────────────────────────────────────────
export async function generateAndPlayMusic(
  params: MusicGenerationParams,
  onProgress?: (msg: string) => void
): Promise<void> {
  await initAudio();

  const scaleNotes = getScaleNotes(params.key, params.scale);
  const bpm = params.bpm;
  const bars = 4;

  Tone.Transport.bpm.value = bpm;
  Tone.Transport.stop();
  Tone.Transport.cancel();

  onProgress?.(`${params.bpm} BPM · ${params.key} ${params.scale}`);

  for (const inst of params.instruments) {
    const synth = getOrCreateInstrument(inst.type || "lead") as any;
    const patternType = inst.pattern || "fourOnFloor";
    const notes = inst.notes?.length ? inst.notes : [getRandomNote(scaleNotes)];

    onProgress?.(`🎹 ${inst.name} (${patternType})`);

    const steps = generatePattern(patternType, inst.name, notes, bpm, scaleNotes, bars);

    for (const step of steps) {
      Tone.getDraw().schedule(() => {
        if (synth.triggerAttackRelease) {
          synth.triggerAttackRelease(step.note || notes[0], step.duration, undefined, step.velocity);
        }
      }, step.time);
    }
  }

  const totalDuration = bars * 4 * (60 / bpm);
  onProgress?.("▶ 播放中...");
  Tone.Transport.start();

  await new Promise((resolve) => setTimeout(resolve, totalDuration * 1000 + 1500));
  Tone.Transport.stop();
  onProgress?.("✓ 播放完成");
}

export function stopMusic() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Object.keys(instruments).forEach((key) => {
    delete instruments[key];
  });
}

export async function playNotes(
  noteList: Array<{ note: string; duration: number; instrument?: string }>,
  bpm: number = 120
) {
  await initAudio();
  Tone.Transport.bpm.value = bpm;

  const beatDuration = 60 / bpm;
  let time = 0;

  for (const n of noteList) {
    const synth = getOrCreateInstrument(n.instrument || "lead") as any;
    const delay = time * beatDuration;
    const timeStr = `+${delay}`;
    Tone.getDraw().schedule(() => {
      synth.triggerAttackRelease?.(n.note, `${n.duration * beatDuration * 0.9}s`);
    }, timeStr);
    time += n.duration;
  }

  Tone.Transport.start();
}

export async function playMusicParams(params: MusicGenerationParams): Promise<void> {
  return generateAndPlayMusic(params);
}