import type { MidiData, MidiNote } from "@/lib/midi";

function noteToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export async function renderMidiToWav(midi: MidiData): Promise<Blob> {
  const sr = 44100;
  const numChannels = 2;
  const durationSec = (midi.totalBeats || 16) * (60 / midi.bpm);
  const numSamples = Math.ceil(sr * durationSec);
  const buffer = new Float32Array(numSamples * numChannels);
  const secondsPerBeat = 60 / midi.bpm;

  // Simple wavetable oscillators per channel
  function renderChannel(notes: MidiNote[], channelType: string) {
    for (const note of notes) {
      const startSample = Math.floor(note.startTime * secondsPerBeat * sr);
      const durationSamples = Math.floor(note.duration * secondsPerBeat * sr);
      const freq = noteToHz(note.pitch);
      const vel = note.velocity;

      for (let s = 0; s < durationSamples; s++) {
        const idx = startSample + s;
        if (idx >= numSamples) break;
        const t = s / sr;
        const env = Math.max(0, Math.exp(-3 * t) * vel); // simple AD envelope
        const val = env * (
          channelType === "kick" ? Math.sin(2 * Math.PI * freq * t) * Math.exp(-8 * t)
          : channelType === "snare" ? (Math.random() * 2 - 1) * Math.exp(-6 * t) * vel
          : channelType === "hihat" ? (Math.random() * 2 - 1) * Math.exp(-12 * t) * vel * 0.4
          : Math.sin(2 * Math.PI * freq * t) * env
        );

        for (let ch = 0; ch < numChannels; ch++) {
          buffer[idx * numChannels + ch] += val * 0.3;
        }
      }
    }
  }

  for (const track of midi.tracks) {
    renderChannel(track.notes, track.instrument);
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > max) max = abs;
  }
  if (max > 0) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] /= max;
    }
  }

  // WAV header + PCM data
  const bitsPerSample = 16;
  const byteRate = sr * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wav);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples * numChannels; i++) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(44 + i * 2, sample * 32767, true);
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