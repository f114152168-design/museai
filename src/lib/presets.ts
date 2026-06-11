export interface PromptPreset {
  label: string;
  genre: string;
  bpm: number;
  mood: string[];
  prompt: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    label: "Progressive House",
    genre: "Progressive House",
    bpm: 128,
    mood: ["uplifting", "emotional", "festival"],
    prompt: `Create a 1-minute progressive house track at 128 BPM. Start with atmospheric pads and emotional piano chords, gradually introducing a driving kick and uplifting pluck melody. Build tension over 30 seconds with risers and snare rolls, then release into a euphoric festival-style drop featuring supersaw leads, wide stereo imaging, and powerful sidechain compression. Inspired by the energy and melodic style of Martin Garrix and Matisse & Sadko. The track should feel uplifting, emotional, and suitable for a main stage EDM festival.`,
  },
  {
    label: "Melodic Techno",
    genre: "Melodic Techno",
    bpm: 126,
    mood: ["immersive", "cyberpunk", "emotional"],
    prompt: `Create a 1-minute melodic techno track at 126 BPM. Begin with dark atmospheric textures, evolving synth pads, and subtle percussion. Introduce a hypnotic rolling bassline and cinematic arpeggios. Build slowly with tension, automation, and layered synth movements before reaching an emotional peak around 45 seconds. Inspired by the futuristic sound design of Anyma and Tale Of Us. The mood should feel immersive, cyberpunk, emotional, and suitable for a large-scale audiovisual performance.`,
  },
  {
    label: "Uplifting Trance",
    genre: "Uplifting Trance",
    bpm: 138,
    mood: ["hope", "freedom", "euphoric"],
    prompt: `Create a 1-minute uplifting trance track at 138 BPM. Start with dreamy pads, soft piano motifs, and atmospheric effects. Gradually introduce a driving trance bassline and energetic percussion. Build emotional tension through evolving melodies and layered synths before delivering a euphoric uplifting climax with soaring supersaw leads and rich harmonies. Inspired by the melodic storytelling of Armin van Buuren and Above & Beyond. The track should evoke feelings of hope, freedom, and emotional release.`,
  },
];