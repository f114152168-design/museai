import * as Tone from "tone";
import { midiToFrequency, type MidiData, type MidiNote } from "@/lib/midi";

let initialized = false;

export async function initAudio() {
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

// ── Master Chain ──
const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).toDestination();
const delay = new Tone.FeedbackDelay("8n", 0.2).connect(reverb);
const compressor = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25 }).connect(delay);
const masterGain = new Tone.Gain(0.8).connect(compressor);

function connectToMaster(node: Tone.ToneAudioNode) {
  node.connect(masterGain);
}

// ── Channel → Instrument mapping ──
const channelInstruments: Record<number, Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth> = {};

function getChannelSynth(channel: number) {
  if (channelInstruments[channel]) return channelInstruments[channel];

  let synth: Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;

  switch (channel) {
    case 0: // Kick
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      });
      break;

    case 1: // Snare
      synth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      });
      break;

    case 2: // Hi-Hat
      synth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 800,
      });
      break;

    case 3: // Bass (FM)
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.5,
        modulationIndex: 2,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
        modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.3 },
      });
      break;

    case 4: // Chord/Pad (AM)
      synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: "sawtooth" },
        modulation: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2 },
        modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 0.6, release: 1.5 },
      });
      break;

    case 5: // Lead (FM)
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 3,
        oscillator: { type: "sawtooth" },
        modulation: { type: "square" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
        modulationEnvelope: { attack: 0.05, decay: 0.05, sustain: 0.5, release: 0.2 },
      });
      break;

    default:
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 },
      });
  }

  synth.connect(masterGain);
  channelInstruments[channel] = synth;
  return synth;
}

function playMidiNote(note: MidiNote, bpm: number) {
  const synth = getChannelSynth(note.channel);
  const beatDuration = 60 / bpm;
  const startTime = note.startTime * beatDuration;
  const duration = note.duration * beatDuration * 0.9;
  const timeStr = `+${startTime}`;

  if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.NoiseSynth || synth instanceof Tone.MetalSynth) {
    Tone.getDraw().schedule(() => {
      (synth as any).triggerAttackRelease?.(midiToFrequency(note.pitch), `${duration}s`, undefined, note.velocity);
    }, timeStr);
  } else if (synth instanceof Tone.PolySynth) {
    Tone.getDraw().schedule(() => {
      synth.triggerAttackRelease(note.pitch, `${duration}s`, undefined, note.velocity);
    }, timeStr);
  }
}

// ── Public API ──

export async function playMidi(midi: MidiData, onProgress?: (msg: string) => void): Promise<void> {
  await initAudio();

  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = midi.bpm;

  const totalBeats = midi.totalBeats || 16;
  const beatDuration = 60 / midi.bpm;

  onProgress?.(`🎵 ${midi.bpm} BPM · ${midi.tracks.length} 軌 · ${midi.tracks.map(t => t.name).join(", ")}`);

  for (const track of midi.tracks) {
    if (track.notes.length === 0) continue;
    onProgress?.(`🎹 ${track.name}: ${track.notes.length} 個音符`);

    for (const note of track.notes) {
      playMidiNote(note, midi.bpm);
    }
  }

  onProgress?.("▶ 播放中...");
  Tone.Transport.start();

  const totalDuration = totalBeats * beatDuration;
  await new Promise((resolve) => setTimeout(resolve, totalDuration * 1000 + 2000));
  Tone.Transport.stop();
  onProgress?.("✓ 播放完成");
}

export function stopMusic() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Object.keys(channelInstruments).forEach((key) => {
    const inst = channelInstruments[Number(key)];
    if (inst && "disconnect" in inst) inst.disconnect();
    delete channelInstruments[Number(key)];
  });
}