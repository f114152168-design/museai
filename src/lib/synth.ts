import * as Tone from "tone";
import { midiToFrequency, type MidiData, type MidiNote } from "@/lib/midi";

let _ctx: {
  masterGain: Tone.Gain;
  limiter: Tone.Limiter;
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth | Tone.MonoSynth>;
  perChannel: Record<number, { eq: Tone.EQ3; comp: Tone.Compressor; gain: Tone.Gain }>;
  sidechainBus: Tone.Gain;
  sidechainTrigger: Tone.Gain;
} | null = null;

let initialized = false;
let isLooping = false;
let _sidechainScheduleIds: number[] = [];
let _currentMidi: MidiData | null = null;
let _isPaused = false;

function ensureCtx() {
  if (_ctx) return _ctx;

  // ── Master chain: Limiter → Compressor → Reverb/Delay sends ──
  const limiter = new Tone.Limiter(-3).toDestination();
  const masterComp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.005, release: 0.15 }).connect(limiter);
  const masterGain = new Tone.Gain(0.75).connect(masterComp);

  // Reverb (send effect)
  const reverb = new Tone.Reverb({ decay: 2.8, wet: 0.25 }).connect(masterGain);
  // Delay (send effect)
  const delay = new Tone.FeedbackDelay("8n", 0.15).connect(reverb);

  // Sidechain bus: non-kick → ducking gain → master
  const sidechainBus = new Tone.Gain(1).connect(masterGain);
  // Kick goes directly to master (triggers the sidechain ducking)
  const sidechainTrigger = new Tone.Gain(0.85).connect(masterGain);

  const channelInstruments: Record<number, any> = {};
  const perChannel: Record<number, { eq: Tone.EQ3; comp: Tone.Compressor; gain: Tone.Gain }> = {};

  _ctx = { masterGain, limiter, reverb, delay, channelInstruments, perChannel, sidechainBus, sidechainTrigger };
  return _ctx;
}

function getChannelChain(channel: number, compOpts?: Partial<Tone.CompressorOptions>) {
  const ctx = ensureCtx();
  if (ctx.perChannel[channel]) return ctx.perChannel[channel];

  const eq = new Tone.EQ3(0, 0, 0);
  const comp = new Tone.Compressor({
    threshold: compOpts?.threshold ?? -20,
    ratio: compOpts?.ratio ?? 2.5,
    attack: compOpts?.attack ?? 0.003,
    release: compOpts?.release ?? 0.1,
  });
  const gain = new Tone.Gain(1);

  // Route: instrument → eq → comp → gain → bus
  eq.connect(comp);
  comp.connect(gain);

  if (channel === 0) {
    // Kick → sidechainTrigger (no sidechain ducking)
    gain.connect(ctx.sidechainTrigger);
  } else {
    // Everything else → sidechainBus (gets ducked on kick)
    gain.connect(ctx.sidechainBus);
  }

  ctx.perChannel[channel] = { eq, comp, gain };
  return ctx.perChannel[channel];
}

export async function initAudio() {
  if (typeof window === "undefined") return;
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

function getChannelSynth(channel: number) {
  const ctx = ensureCtx();
  if (ctx.channelInstruments[channel]) return ctx.channelInstruments[channel];

  let synth: any;

  switch (channel) {
    // ── 0: KICK — punchy electronic kick ──
    case 0: {
      const chain = getChannelChain(channel, { threshold: -14, ratio: 4 });
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 5,
        envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.06 },
      });
      chain.eq.low.value = 4;
      chain.eq.high.value = -2;
      chain.gain.gain.value = 1.2;
      synth.connect(chain.eq);
      break;
    }

    // ── 1: SNARE/CLAP — layered noise + tone ──
    case 1: {
      const chain = getChannelChain(channel, { threshold: -16 });
      synth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 },
      });
      chain.eq.low.value = -6;
      chain.eq.mid.value = 3;
      chain.eq.high.value = 4;
      chain.gain.gain.value = 0.7;
      const toneLayer = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } });
      toneLayer.volume.value = -6;
      toneLayer.connect(chain.eq);
      synth.connect(chain.eq);
      (synth as any)._toneLayer = toneLayer;
      break;
    }

    // ── 2: HI-HAT — tight electronic hat ──
    case 2: {
      const chain = getChannelChain(channel);
      synth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 800,
      });
      chain.eq.low.value = -12;
      chain.eq.mid.value = -4;
      chain.eq.high.value = 6;
      chain.gain.gain.value = 0.5;
      synth.connect(chain.eq);
      break;
    }

    // ── 3: BASS — saturated sub + mid bite ──
    case 3: {
      const chain = getChannelChain(channel, { threshold: -16, ratio: 3 });
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.75, modulationIndex: 2.5,
        oscillator: { type: "square" },
        modulation: { type: "sine" },
        envelope: { attack: 0.003, decay: 0.2, sustain: 0.15, release: 0.35 },
        modulationEnvelope: { attack: 0.01, decay: 0.05, sustain: 0.15, release: 0.2 },
      });
      chain.eq.low.value = 5;
      chain.eq.mid.value = 2;
      chain.eq.high.value = -4;
      chain.gain.gain.value = 0.9;
      const sat = new Tone.Distortion(0.15);
      synth.connect(sat);
      sat.connect(chain.eq);
      break;
    }

    // ── 4: CHORD — supersaw with chorus ──
    case 4: {
      const chain = getChannelChain(channel);
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.5, modulationIndex: 4,
        oscillator: { type: "sawtooth" },
        modulation: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.5, release: 1.2 },
        modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.8 },
      });
      chain.eq.low.value = -2;
      chain.eq.mid.value = 3;
      chain.eq.high.value = 4;
      chain.gain.gain.value = 0.6;
      const chorus = new Tone.Chorus(0.5, 2.5, 0.35).start();
      synth.connect(chorus);
      chorus.connect(chain.eq);
      break;
    }

    // ── 5: FX (risers, impacts) ──
    case 5: {
      const chain = getChannelChain(channel);
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.5, modulationIndex: 3,
        oscillator: { type: "sawtooth" },
        modulation: { type: "square" },
        envelope: { attack: 0.002, decay: 0.06, sustain: 0.05, release: 0.08 },
        modulationEnvelope: { attack: 0.005, decay: 0.02, sustain: 0.1, release: 0.05 },
      });
      chain.eq.low.value = -8;
      chain.eq.high.value = 6;
      chain.gain.gain.value = 0.5;
      synth.connect(chain.eq);
      break;
    }

    // ── 6: MELODY — bright square wave lead ──
    case 6: {
      const chain = getChannelChain(channel, { threshold: -14, ratio: 2 });
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.003, decay: 0.15, sustain: 0.35, release: 0.3 },
      });
      chain.eq.low.value = -2;
      chain.eq.mid.value = 5;
      chain.eq.high.value = 4;
      chain.gain.gain.value = 1.3;
      const melDelay = new Tone.FeedbackDelay("8n", 0.2);
      synth.connect(melDelay);
      melDelay.connect(ensureCtx().reverb);
      synth.connect(chain.eq);
      break;
    }

    default: {
      const chain = getChannelChain(channel);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.08, sustain: 0.15, release: 0.15 },
      });
      synth.connect(chain.eq);
    }
  }

  ctx.channelInstruments[channel] = synth;
  return synth;
}

function scheduleNote(note: MidiNote, bpm: number) {
  const synth = getChannelSynth(note.channel);
  const durSeconds = note.duration * (60 / bpm);
  const freq = midiToFrequency(note.pitch);
  const scheduleTime = note.startTime * (60 / bpm);

  Tone.Transport.schedule((time) => {
    if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.NoiseSynth || synth instanceof Tone.MetalSynth) {
      (synth as any).triggerAttackRelease?.(freq, durSeconds, time, note.velocity);
      if ((synth as any)._toneLayer) {
        (synth as any)._toneLayer.triggerAttackRelease(freq, durSeconds, time, note.velocity * 0.5);
      }
    } else if (synth && typeof synth.triggerAttackRelease === "function") {
      synth.triggerAttackRelease(freq, durSeconds, time, note.velocity);
    }
  }, scheduleTime);
}

function scheduleSidechainPumping(midi: MidiData) {
  const ctx = ensureCtx();
  for (const id of _sidechainScheduleIds) Tone.Transport.clear(id);
  _sidechainScheduleIds = [];

  const kickTrack = midi.tracks.find((t) => t.channel === 0);
  const kickTimes = kickTrack?.notes.map((n) => n.startTime) ?? [];
  const bpm = midi.bpm;

  for (const time of kickTimes) {
    const id = Tone.Transport.schedule(() => {
      ctx.sidechainBus.gain.rampTo(0.25, 0.005);
      ctx.sidechainBus.gain.rampTo(1, 0.18);
    }, time * (60 / bpm));
    _sidechainScheduleIds.push(id);
  }
}

export function setLoop(enabled: boolean) {
  isLooping = enabled;
}

export async function playMidi(midi: MidiData): Promise<void> {
  if (typeof window === "undefined") return;
  await initAudio();
  const ctx = ensureCtx();

  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = midi.bpm;
  Tone.Transport.position = 0;

  _currentMidi = midi;
  _isPaused = false;

  const totalBeats = midi.totalBeats || 16;

  ctx.sidechainBus.gain.value = 1;
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
    const loopDuration = totalBeats * (60 / midi.bpm);
    return new Promise(() => {
      Tone.Transport.schedule(() => {
        Tone.Transport.position = 0;
        for (const track of midi.tracks) {
          for (const note of track.notes) {
            scheduleNote(note, midi.bpm);
          }
        }
      }, loopDuration);
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
  _isPaused = false;
  _currentMidi = null;
  for (const id of _sidechainScheduleIds) Tone.Transport.clear(id);
  _sidechainScheduleIds = [];
  _ctx.sidechainBus.gain.value = 1;
  Object.keys(_ctx.channelInstruments).forEach((key) => {
    const inst = _ctx!.channelInstruments[Number(key)];
    if (inst && "disconnect" in inst) inst.disconnect();
    delete _ctx!.channelInstruments[Number(key)];
  });
}

/** Pause playback, preserving position */
export function pauseMidi() {
  if (typeof window === "undefined") return;
  if (!_isPaused) {
    Tone.Transport.pause();
    _isPaused = true;
  }
}

/** Resume from paused position */
export async function resumeMidi() {
  if (typeof window === "undefined") return;
  if (_isPaused && _currentMidi) {
    _isPaused = false;
    Tone.Transport.start();
  }
}

/** Seek to a specific beat position */
export function seekToBeat(beat: number) {
  if (typeof window === "undefined") return;
  Tone.Transport.position = beat;
}

/** Get current playback position in beats */
export function getCurrentBeat(): number {
  if (typeof window === "undefined") return 0;
  const pos = Tone.Transport.position;
  if (typeof pos === "string") {
    const parts = pos.split(":").map(Number);
    return (parts[0] ?? 0) * 4 + (parts[1] ?? 0) + (parts[2] ?? 0) / 4;
  }
  return Number(pos) || 0;
}

/** Check if currently paused */
export function isPaused(): boolean {
  return _isPaused;
}

export function isAudioInitialized(): boolean {
  return initialized;
}
