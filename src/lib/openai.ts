import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

export interface MusicGenerationParams {
  bpm: number;
  key: string;
  scale: string;
  timeSignature: string;
  chordProgression?: string[];
  instruments: {
    name: string;
    type: "melodic" | "rhythmic" | "bass" | "pad" | "fx";
    pattern: string;
    notes?: string[];
  }[];
  structure?: {
    sections: { name: string; bars: number }[];
  };
  description: string;
}

export const MUSIC_GENERATION_SYSTEM_PROMPT = `你是 Museai 的音樂分析 AI。你的任務是將使用者的自然語言音樂描述轉換為結構化音樂參數。

請嚴格以 JSON 格式回覆，格式如下：
{
  "bpm": 120,
  "key": "C",
  "scale": "minor",
  "timeSignature": "4/4",
  "chordProgression": ["Cm", "Fm", "Ab", "Eb"],
  "instruments": [
    {
      "name": "kick",
      "type": "rhythmic",
      "pattern": "fourOnFloor",
      "notes": ["C2"]
    },
    {
      "name": "bass",
      "type": "bass",
      "pattern": "walking",
      "notes": ["C2", "E2", "G2", "A2"]
    }
  ],
  "structure": {
    "sections": [
      { "name": "intro", "bars": 4 },
      { "name": "verse", "bars": 8 }
    ]
  },
  "description": "對生成音樂的簡短文字描述"
}

pattern 可選值: fourOnFloor, offBeat, halfTime, walking, arpeggio, chordal, random, silence, custom
type 可選值: melodic, rhythmic, bass, pad, fx

請確保:
1. 調性支援: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
2. 音階支援: major, minor, dorian, phrygian, lydian, mixolydian
3. BPM 範圍: 60-200
4. 若有指定樂風請根據該樂風的特色參數回應
5. 如果使用者的描述太模糊，請根據常見的電子音樂風格補上合理的預設值`;

export async function generateMusicParams(prompt: string): Promise<MusicGenerationParams> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MUSIC_GENERATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 沒有回傳內容");

  const params = JSON.parse(content) as MusicGenerationParams;
  return params;
}

export async function generateLiveCode(
  prompt: string,
  bpm: number = 120,
  key: string = "C"
): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `你是 Museai Live Coding 模式的 AI 助手。使用者會描述想要的音樂，你需要用 JavaScript 程式碼來生成。

可用的函數：
- play(note, duration, instrument) - 播放單音 (note: "C4", duration: 拍數, instrument: "sine"/"square"/"sawtooth"/"triangle")
- sequence(notes) - 播放音符陣列 [{note, duration, instrument}]
- pattern(name, notes) - 定義模式
- playPattern(name) - 播放已定義的模式
- setBpm(bpm) - 設速度
- setVolume(vol) - 設音量 (0-1)

當前設定: BPM=${bpm}, Key=${key}

請只回傳可執行的 JavaScript 程式碼，不要加解說。`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content ?? "// 無法生成程式碼";
}