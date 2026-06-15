export interface PromptPreset {
  label: string;
  genre: string;
  bpm: number;
  mood: string[];
  prompt: string;
  style?: string;            // maps to generateStyleMidi style key
  postProcess?: {
    quantize?: number;        // grid size (0.25 = 16th note)
    pluck?: boolean;          // shorten all notes
    arpeggiate?: "up" | "down" | "updown";
    fourOnFloor?: boolean;    // ensure kick/clap/hat pattern
    sidechain?: boolean;
  };
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    label: "Progressive House",
    genre: "Progressive House",
    bpm: 128,
    mood: ["uplifting", "emotional", "festival"],
    prompt: `Create a 1-minute progressive house track at 128 BPM. Start with atmospheric pads and emotional piano chords, gradually introducing a driving kick and uplifting pluck melody. Build tension over 30 seconds with risers and snare rolls, then release into a euphoric festival-style drop featuring supersaw leads, wide stereo imaging, and powerful sidechain compression.`,
    style: "house",
    postProcess: { quantize: 0.25, pluck: true, arpeggiate: "up", fourOnFloor: true, sidechain: true },
  },
  {
    label: "Melodic Techno",
    genre: "Melodic Techno",
    bpm: 126,
    mood: ["immersive", "cyberpunk", "emotional"],
    prompt: `Create a 1-minute melodic techno track at 126 BPM. Begin with dark atmospheric textures, evolving synth pads, and subtle percussion. Introduce a hypnotic rolling bassline and cinematic arpeggios. Build slowly with tension, automation, and layered synth movements before reaching an emotional peak.`,
    style: "techno",
    postProcess: { quantize: 0.25, pluck: false, arpeggiate: "updown", fourOnFloor: true, sidechain: true },
  },
  {
    label: "Uplifting Trance",
    genre: "Uplifting Trance",
    bpm: 138,
    mood: ["hope", "freedom", "euphoric"],
    prompt: `Create a 1-minute uplifting trance track at 138 BPM. Start with dreamy pads, soft piano motifs, and atmospheric effects. Gradually introduce a driving trance bassline and energetic percussion. Build emotional tension through evolving melodies and layered synths before delivering a euphoric uplifting climax with soaring supersaw leads and rich harmonies.`,
    style: "trance",
    postProcess: { quantize: 0.125, pluck: false, arpeggiate: "up", fourOnFloor: true, sidechain: true },
  },
];
