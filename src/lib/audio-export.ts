import type { MidiData, MidiNote } from "@/lib/midi";

function noteToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

// Simple ADSR envelope
function adsr(t: number, attack: number, decay: number, sustain: number, release: number, dur: number): number {
  if (t < attack) return t / attack;
  t -= attack;
  if (t < decay) return 1 - (1 - sustain) * (t / decay);
  t -= decay;
  if (t < dur - attack - decay - release) return sustain;
  const relT = t - (dur - attack - decay - release);
  if (relT > 0 && relT < release) return sustain * (1 - relT / release);
  return 0;
}

export async function renderMidiToWav(midi: MidiData): Promise<Blob> {
  const sr = 44100;
  const numChannels = 2;
  const durationSec = (midi.totalBeats || 16) * (60 / midi.bpm);
  const numSamples = Math.ceil(sr * durationSec);
  const spb = 60 / midi.bpm; // seconds per beat
  const buffer = new Float32Array(numSamples * numChannels);

  // Per-channel mix levels (post-production style)
  const mixLevels: Record<number, number> = {
    0: 1.0,  // kick
    1: 0.65, // snare/clap
    2: 0.35, // hi-hat
    3: 0.8,  // bass
    4: 0.5,  // chord
    5: 0.3,  // fx
    6: 0.7,  // melody
  };

  function renderNote(note: MidiNote, idx: number) {
    const startSample = Math.floor(note.startTime * spb * sr);
    const durSamples = Math.floor(note.duration * spb * sr);
    const freq = noteToHz(note.pitch);
    const vel = note.velocity;
    const ch = note.channel;
    const mix = mixLevels[ch] ?? 0.5;
    const durSec = note.duration * spb;

    for (let s = 0; s < durSamples; s++) {
      const sampleIdx = startSample + s;
      if (sampleIdx >= numSamples) break;
      const t = s / sr;
      const env = adsr(t, 0.005, 0.1, 0.3, 0.2, durSec) * vel * mix;

      let val = 0;

      switch (ch) {
        // Kick — sub sine + click
        case 0: {
          const sub = Math.sin(2 * Math.PI * freq * t);
          const click = Math.sin(2 * Math.PI * freq * 4 * t) * Math.exp(-6 * t);
          val = env * (sub * 0.7 + click * 0.3);
          break;
        }
        // Snare/Clap — noise + tone
        case 1: {
          const noise = (Math.random() * 2 - 1) * 0.6;
          const tone = Math.sin(2 * Math.PI * freq * 2 * t) * 0.4;
          val = env * (noise + tone) * Math.exp(-3 * t);
          break;
        }
        // Hi-hat — filtered noise
        case 2: {
          val = env * (Math.random() * 2 - 1) * Math.exp(-8 * t) * 0.5;
          break;
        }
        // Bass — square wave + sub
        case 3: {
          const sq = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * 0.5;
          const sub = Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.5;
          val = env * (sq + sub) * 0.8;
          break;
        }
        // Chord — sawtooth supersaw
        case 4: {
          const saw1 = (2 * ((freq * t) % 1) - 1) * 0.3;
          const saw2 = (2 * ((freq * 1.01 * t) % 1) - 1) * 0.3;
          val = env * (saw1 + saw2);
          break;
        }
        // Melody — clear lead with delay
        case 6: {
          const saw = (2 * ((freq * t) % 1) - 1);
          val = env * saw * 0.7;
          // Add a delayed repeat
          const delaySamples = Math.floor(0.25 * sr);
          const delayIdx = sampleIdx + delaySamples;
          if (delayIdx < numSamples) {
            buffer[delayIdx * numChannels] += val * 0.2;
            buffer[delayIdx * numChannels + 1] += val * 0.2;
          }
          break;
        }
        // FX
        default: {
          val = env * Math.sin(2 * Math.PI * freq * t) * 0.3;
        }
      }

      // Width: slightly different L/R for stereo spread
      const pan = ((idx % numChannels === 0) ? -0.1 : 0.1);
      buffer[sampleIdx * numChannels] += val * (0.5 - pan);
      buffer[sampleIdx * numChannels + 1] += val * (0.5 + pan);
    }
  }

  for (const track of midi.tracks) {
    let noteIdx = 0;
    for (const note of track.notes) {
      renderNote(note, noteIdx++);
    }
  }

  // Master bus compression (simple RMS normalize + limit)
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  const targetRms = 0.25;
  const gain = targetRms / (rms || 1);

  // Apply gain + soft clip
  for (let i = 0; i < buffer.length; i++) {
    let sample = buffer[i] * Math.min(gain, 2);
    // Soft clip
    if (sample > 0.9) sample = 0.9 + (sample - 0.9) * 0.3;
    if (sample < -0.9) sample = -0.9 + (sample + 0.9) * 0.3;
    buffer[i] = Math.max(-1, Math.min(1, sample));
  }

  // WAV header
  const bitsPerSample = 16;
  const byteRate = sr * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples * numChannels; i++) {
    view.setInt16(44 + i * 2, buffer[i] * 32767, true);
  }

  return new Blob([wav], { type: "audio/wav" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
