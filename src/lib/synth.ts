import * as Tone from "tone";
import { midiToFrequency, type MidiData, type MidiNote } from "@/lib/midi";

// ── Lazy singleton — only created on first audio use ──
let _ctx: {
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  compressor: Tone.Compressor;
  masterGain: Tone.Gain;
  sidechainBus: Tone.Gain;       // non-kick instruments go through this
  sidechainTrigger: Tone.Gain;   // kick goes directly to compressor (sidechain trigger)
  channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth>;
} | null = null;

let initialized = false;
let isLooping = false;

// Sidechain ducking state
let _sidechainScheduleIds: number[] = [];

function ensureCtx() {
  if (_ctx) return _ctx;

  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).toDestination();
  const delay = new Tone.FeedbackDelay("8n", 0.2).connect(reverb);
  const compressor = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25 }).connect(delay);

  // Master output bus
  const masterGain = new Tone.Gain(0.8).connect(compressor);

  // Sidechain bus: all non-kick instruments → this gain → compressor
  // This gain gets automated down on every kick beat to simulate sidechain pumping
  const sidechainBus = new Tone.Gain(1).connect(masterGain);

  // Sidechain trigger bus: kick connects here (directly to compressor for sidechain detection)
  // Actually, Tone.js doesn't have native sidechain input for Compressor,
  // so we simulate by automating sidechainBus.gain on each kick beat
  const sidechainTrigger = new Tone.Gain(0.8).connect(masterGain);

  const channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth> = {};

  _ctx = { reverb, delay, compressor, masterGain, sidechainBus, sidechainTrigger, channelInstruments };
  return _ctx;
}

/** Schedule the sidechain pumping automation */
function scheduleSidechainPumping(midi: MidiData) {
  const ctx = ensureCtx();
  // Clear previous schedules
  for (const id of _sidechainScheduleIds) Tone.Transport.clear(id);
  _sidechainScheduleIds = [];

  const totalBeats = midi.totalBeats || 16;
  // Find kick notes (channel 0)
  const kickTrack = midi.tracks.find((t) => t.channel === 0);
  const kickTimes = kickTrack?.notes.map((n) => n.startTime) ?? [];

  for (const time of kickTimes) {
    // Duck gain at kick time, recover over ~0.2s
    const id = Tone.Transport.schedule(() => {
      if (ctx.sidechainBus.gain.value === 1) {
        // Quick duck to 30% then recover with envelope
        ctx.sidechainBus.gain.rampTo(0.3, 0.01);
        ctx.sidechainBus.gain.rampTo(1, 0.2);
      }
    }, time.toString());
    _sidechainScheduleIds.push(id);
  }
}

export async function initAudio() {
  if (typeof window === "undefined") return;
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

function connectToMaster(node: Tone.ToneAudioNode, channel: number) {
  const ctx = ensureCtx();
  // Kick (channel 0) bypasses sidechain and goes directly to compressor
  if (channel === 0) {
    node.connect(ctx.sidechainTrigger);
  } else {
    node.connect(ctx.sidechainBus);
  }
}

function getChannelSynth(channel: number) {
  const ctx = ensureCtx();
  if (ctx.channelInstruments[channel]) return ctx.channelInstruments[channel];

  let synth: Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;

  switch (channel) {
    // Kick — punchy sub
    case 0:
      synth = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 5, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 } });
      break;
    // Snare / Clap
    case 1:
      synth = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.12 } });
      break;
    // Hi-hat — tight click
    case 2:
      synth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 800 });
      break;
    // Bass — gritty FM sub
    case 3:
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 0.75, modulationIndex: 2.5, oscillator: { type: "square" }, modulation: { type: "sine" }, envelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.3 }, modulationEnvelope: { attack: 0.01, decay: 0.05, sustain: 0.2, release: 0.2 } });
      break;
    // Chord / Supersaw — fast attack for stabs, full for pads
    case 4:
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 1.5, modulationIndex: 4, oscillator: { type: "sawtooth" }, modulation: { type: "sine" }, envelope: { attack: 0.003, decay: 0.3, sustain: 0.6, release: 1 }, modulationEnvelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.8 } });
      break;
    // Lead / Pluck / Arp — very short percussive
    case 5:
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2.5, modulationIndex: 3, oscillator: { type: "sawtooth" }, modulation: { type: "square" }, envelope: { attack: 0.002, decay: 0.06, sustain: 0.05, release: 0.08 }, modulationEnvelope: { attack: 0.005, decay: 0.02, sustain: 0.1, release: 0.05 } });
      break;
    default:
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.08, sustain: 0.15, release: 0.15 } });
  }

  connectToMaster(synth, channel);
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

  // Reset sidechain bus gain
  ensureCtx().sidechainBus.gain.value = 1;

  // Schedule sidechain pumping if kick channel exists
  if (midi.tracks.some((t) => t.channel === 0 && t.notes.length > 0)) {
    scheduleSidechainPumping(midi);
  }

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
  // Clear sidechain schedules
  for (const id of _sidechainScheduleIds) Tone.Transport.clear(id);
  _sidechainScheduleIds = [];
  _ctx.sidechainBus.gain.value = 1;
  Object.keys(_ctx.channelInstruments).forEach((key) => {
    const inst = _ctx!.channelInstruments[Number(key)];
    if (inst && "disconnect" in inst) inst.disconnect();
    delete _ctx!.channelInstruments[Number(key)];
  });
}

export function isAudioInitialized(): boolean {
  return initialized;
}