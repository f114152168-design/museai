import * as Tone from "tone";
import type { MusicGenerationParams } from "@/lib/openai";

let synthInitialized = false;

export async function initAudio() {
  if (!synthInitialized) {
    await Tone.start();
    synthInitialized = true;
  }
}

const synths: Record<string, Tone.PolySynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.Synth> = {};

function getSynth(type: string) {
  if (!synths[type]) {
    switch (type) {
      case "kick":
      case "rhythmic":
        synths[type] = new Tone.MembraneSynth().toDestination();
        break;
      case "hh":
      case "fx":
        synths[type] = new Tone.MetalSynth().toDestination();
        break;
      case "bass":
        synths[type] = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
        }).toDestination();
        break;
      case "pad":
        synths[type] = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.5 },
        }).toDestination();
        break;
      default:
        synths[type] = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "square" },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
        }).toDestination();
    }
  }
  return synths[type];
}

function getNoteFrequency(note: string): string {
  return note;
}

const PATTERNS: Record<string, number[]> = {
  fourOnFloor: [0, 1, 0.5, 1],
  offBeat: [0, 0, 1, 0.5],
  halfTime: [0, 0.5, 0, 0.5],
  walking: [0, 0.25, 0.5, 0.75],
  arpeggio: [0, 0.25, 0.5, 0.75],
  chordal: [0, 0.5],
  random: [],
};

export function playPattern(
  instrument: { name: string; type: string; pattern: string; notes?: string[] },
  bpm: number,
  startTime: number = 0
) {
  const synth = getSynth(instrument.type);
  const noteDuration = 60 / bpm;
  const patternSteps = PATTERNS[instrument.pattern] ?? [0, 0.5];
  const notes = instrument.notes ?? ["C4"];

  const now = Tone.now() + startTime;

  if (instrument.pattern === "random") {
    for (let i = 0; i < 8; i++) {
      const time = now + i * noteDuration * 0.5;
      const note = notes[Math.floor(Math.random() * notes.length)];
      const octaveOffset = Math.floor(Math.random() * 3) - 1;
      const noteWithOctave = note.replace(/\d/, (m) => String(Number(m) + octaveOffset));
      synth.triggerAttackRelease(noteWithOctave, `${noteDuration * 0.4}s`, time);
    }
    return;
  }

  for (let bar = 0; bar < 4; bar++) {
    for (const step of patternSteps) {
      const time = now + bar * 4 * noteDuration + step * noteDuration;
      const note = notes[Math.floor(Math.random() * notes.length)];
      const duration = instrument.type === "pad" ? `${noteDuration * 1.5}s` : `${noteDuration * 0.4}s`;
      synth.triggerAttackRelease(note, duration, time);
    }
  }
}

export async function playMusicParams(params: MusicGenerationParams): Promise<void> {
  await initAudio();

  Tone.Transport.bpm.value = params.bpm;
  Tone.Transport.stop();
  Tone.Transport.cancel();

  const noteDuration = 60 / params.bpm;
  let totalDuration = 0;

  // Schedule each instrument
  for (let i = 0; i < params.instruments.length; i++) {
    const inst = params.instruments[i];
    const synth = getSynth(inst.type);
    const patternSteps = PATTERNS[inst.pattern] ?? [0, 0.5];
    const notes = inst.notes ?? ["C4"];

    const instrumentDuration = 16 * noteDuration; // 4 bars default
    totalDuration = Math.max(totalDuration, instrumentDuration);

    if (inst.pattern === "random") {
      for (let beat = 0; beat < 32; beat++) {
        const time = `+${beat * noteDuration * 0.5}`;
        const note = notes[Math.floor(Math.random() * notes.length)];
        Tone.getDraw().schedule(() => {
          synth.triggerAttackRelease(note, `${noteDuration * 0.4}s`);
        }, time);
      }
      continue;
    }

    for (let bar = 0; bar < 4; bar++) {
      for (const step of patternSteps) {
        const beatInBar = step;
        const time = `+${(bar * 4 + beatInBar) * noteDuration}`;
        const note = notes[Math.floor(Math.random() * notes.length)];
        const dur = inst.type === "pad" ? `${noteDuration * 1.5}s` : `${noteDuration * 0.4}s`;

        Tone.getDraw().schedule(() => {
          synth.triggerAttackRelease(note, dur);
        }, time);
      }
    }
  }

  Tone.Transport.start();

  // Auto-stop after duration
  await new Promise((resolve) => setTimeout(resolve, totalDuration * 1000 + 2000));
  Tone.Transport.stop();
}

export function stopMusic() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  for (const key of Object.keys(synths)) {
    synths[key].disconnect();
    delete synths[key];
  }
}

export async function playNotes(
  notes: Array<{ note: string; duration: number; instrument?: string }>,
  bpm: number = 120
) {
  await initAudio();
  Tone.Transport.bpm.value = bpm;

  const noteDuration = 60 / bpm;
  let time = 0;

  for (const n of notes) {
    const synth = getSynth(n.instrument ?? "default");
    const delay = time * noteDuration;
    const timeStr = `+${delay}`;
    Tone.getDraw().schedule(() => {
      synth.triggerAttackRelease(n.note, `${n.duration * noteDuration * 0.8}s`);
    }, timeStr);
    time += n.duration;
  }

  Tone.Transport.start();
}

export async function generateAndPlayMusic(
  params: MusicGenerationParams,
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.("初始化音訊引擎...");
  await initAudio();

  onProgress?.(`設定 BPM: ${params.bpm}，調性: ${params.key} ${params.scale}`);

  Tone.Transport.bpm.value = params.bpm;
  Tone.Transport.stop();
  Tone.Transport.cancel();

  const noteDuration = 60 / params.bpm;
  let totalDuration = 0;

  for (let i = 0; i < params.instruments.length; i++) {
    const inst = params.instruments[i];
    onProgress?.(`編排 ${inst.name} (${inst.type}) - ${inst.pattern}`);
    const synth = getSynth(inst.type);
    const patternSteps = PATTERNS[inst.pattern] ?? [0, 0.5];
    const notes = inst.notes ?? ["C4"];

    const instrumentDuration = 16 * noteDuration;
    totalDuration = Math.max(totalDuration, instrumentDuration);

    if (inst.pattern === "random") {
      for (let beat = 0; beat < 32; beat++) {
        const time = `+${beat * noteDuration * 0.5}`;
        const note = notes[Math.floor(Math.random() * notes.length)];
        Tone.getDraw().schedule(() => {
          synth.triggerAttackRelease(note, `${noteDuration * 0.4}s`);
        }, time);
      }
      continue;
    }

    for (let bar = 0; bar < 4; bar++) {
      for (const step of patternSteps) {
        const beatInBar = step;
        const time = `+${(bar * 4 + beatInBar) * noteDuration}`;
        const note = notes[Math.floor(Math.random() * notes.length)];
        const dur = inst.type === "pad" ? `${noteDuration * 1.5}s` : `${noteDuration * 0.4}s`;
        Tone.getDraw().schedule(() => {
          synth.triggerAttackRelease(note, dur);
        }, time);
      }
    }
  }

  onProgress?.("播放中...");
  Tone.Transport.start();

  await new Promise((resolve) => setTimeout(resolve, totalDuration * 1000 + 2000));
  Tone.Transport.stop();
  onProgress?.("播放完成");
}