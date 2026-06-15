import * as Tone from "tone";
import { midiToFrequency, type MidiData, type MidiNote } from "@/lib/midi";

// ── Lazy singleton — only created on first audio use ──
let _ctx: {
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  compressor: Tone.Compressor;
  masterGain: Tone.Gain;
  channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth>;
} | null = null;

let initialized = false;
let isLooping = false;

function ensureCtx() {
  if (_ctx) return _ctx;

  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).toDestination();
  const delay = new Tone.FeedbackDelay("8n", 0.2).connect(reverb);
  const compressor = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25 }).connect(delay);
  const masterGain = new Tone.Gain(0.8).connect(compressor);
  const channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth> = {};

  _ctx = { reverb, delay, compressor, masterGain, channelInstruments };
  return _ctx;
}

export async function initAudio() {
  if (typeof window === "undefined") return;
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

function connectToMaster(node: Tone.ToneAudioNode) {
  node.connect(ensureCtx().masterGain);
}

function getChannelSynth(channel: number) {
  const ctx = ensureCtx();
  if (ctx.channelInstruments[channel]) return ctx.channelInstruments[channel];

  let synth: Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;

  switch (channel) {
    case 0:
      synth = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });
      break;
    case 1:
      synth = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } });
      break;
    case 2:
      synth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 800 });
      break;
    case 3:
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 0.5, modulationIndex: 2, oscillator: { type: "sine" }, modulation: { type: "sine" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.3 } });
      break;
    case 4:
      synth = new Tone.PolySynth(Tone.AMSynth, { harmonicity: 1.5, oscillator: { type: "sawtooth" }, modulation: { type: "sine" }, envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2 }, modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 0.6, release: 1.5 } });
      break;
    case 5:
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 3, oscillator: { type: "sawtooth" }, modulation: { type: "square" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 }, modulationEnvelope: { attack: 0.05, decay: 0.05, sustain: 0.5, release: 0.2 } });
      break;
    default:
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 } });
  }

  synth.connect(ensureCtx().masterGain);
  ctx.channelInstruments[channel] = synth;
  return synth;
}

function scheduleNote(note: MidiNote, bpm: number) {
  const synth = getChannelSynth(note.channel);
  const durSeconds = note.duration * (60 / bpm);

  Tone.Transport.schedule((time) => {
    if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.NoiseSynth || synth instanceof Tone.MetalSynth) {
      (synth as any).triggerAttackRelease?.(midiToFrequency(note.pitch), durSeconds, time, note.velocity);
    } else if (synth instanceof Tone.PolySynth) {
      synth.triggerAttackRelease(note.pitch, durSeconds, time, note.velocity);
    }
  }, note.startTime.toString());
}

export function setLoop(enabled: boolean) {
  isLooping = enabled;
}

export async function playMidi(midi: MidiData): Promise<void> {
  if (typeof window === "undefined") return;
  await initAudio();

  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = midi.bpm;
  Tone.Transport.position = 0;

  const totalBeats = midi.totalBeats || 16;

  for (const track of midi.tracks) {
    if (track.notes.length === 0) continue;
    for (const note of track.notes) {
      scheduleNote(note, midi.bpm);
    }
  }

  Tone.Transport.start();

  if (isLooping) {
    return new Promise(() => {
      Tone.Transport.schedule(() => {
        Tone.Transport.position = 0;
        for (const track of midi.tracks) {
          for (const note of track.notes) {
            scheduleNote(note, midi.bpm);
          }
        }
      }, totalBeats.toString());
    });
  }

  await new Promise((resolve) => setTimeout(resolve, (totalBeats * (60 / midi.bpm) * 1000) + 500));
  Tone.Transport.stop();
}

export function stopMusic() {
  if (typeof window === "undefined") return;
  if (!_ctx) return;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  isLooping = false;
  Object.keys(_ctx.channelInstruments).forEach((key) => {
    const inst = _ctx!.channelInstruments[Number(key)];
    if (inst && "disconnect" in inst) inst.disconnect();
    delete _ctx!.channelInstruments[Number(key)];
  });
}

export function isAudioInitialized(): boolean {
  return initialized;
}