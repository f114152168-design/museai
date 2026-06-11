import OpenAI from "openai";
import type { MidiData } from "@/lib/midi";

let client: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getOpenAI(): OpenAI {
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY 未設定");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

const MIDI_SYSTEM_PROMPT = `你是 Museai 的 AI 作曲助手。使用者的需求是用自然語言描述音樂，你要輸出 MIDI 音符資料。

請嚴格以 JSON 格式回覆，不要加任何其他文字：

{
  "bpm": 120,
  "tracks": [
    {
      "name": "Kick",
      "channel": 0,
      "notes": [
        { "pitch": 36, "startTime": 0, "duration": 0.9, "velocity": 0.9 }
      ]
    }
  ]
}

規則：
- pitch: MIDI 音符編號 0-127（69=A4=440Hz）。36=C2(大鼓), 38=D2(小鼓), 42=F#2(HiHat), 43=G2(OpenHat)
- startTime: 以拍為單位（0 = 第一拍開頭）
- duration: 以拍為單位（一拍 = 0.25 在 4/4 的意思是四分音符）
- velocity: 0-1（力度）
- channel: 0=鼓, 1=小鼓/鈸, 2=HiHat, 3=貝斯, 4=和弦, 5=主旋律
- bpm: 60-200

樂器對照表（channel）:
- 0: Kick, 36=C2
- 1: Snare, 38=D2, 40=E2
- 2: HiHat, 42=F#2(閉), 46=A#2(開)
- 3: Bass, 建議 24-48 範圍
- 4: Chord/Pad, 建議 48-72 範圍
- 5: Lead/Arp, 建議 60-84 範圍

請確保：
1. 4/4 拍，總長度 16 拍（4 小節）
2. 大鼓在正拍（0, 4, 8, 12）
3. 小鼓在反拍（2, 6, 10, 14）
4. HiHat 每半拍（0, 0.5, 1, 1.5...），力度交替強弱
5. 貝斯走根音，每 2 拍一個
6. 和弦用長音（duration: 4），每小節換一個
7. 主旋律用 8 分音符為主
8. 根據使用者描述的曲風調整節奏和音符選擇`;

export async function generateMidiFromPrompt(prompt: string): Promise<MidiData> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MIDI_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 沒有回傳內容");

  const data = JSON.parse(content) as MidiData;

  // Ensure required fields
  if (!data.bpm) data.bpm = 120;
  if (!data.tracks) data.tracks = [];
  data.totalBeats = 16;

  return data;
}

export async function generateLiveCodeFromPrompt(
  prompt: string,
  bpm: number = 120
): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `你是 Museai Live Coding 助手。使用者描述想要的音樂，你要用 JavaScript 生成 MIDI 音符。

可用函數：
- play(pitch, startBeat, duration, velocity, channel)
  pitch: MIDI 音符編號 (36=C2)
  startBeat: 從第幾拍開始
  duration: 長度（拍）
  velocity: 力度 0-1
  channel: 0=鼓,1=小鼓,2=HH,3=貝斯,4=和弦,5=主旋律

當前 BPM: ${bpm}

請只回傳 JavaScript 程式碼，不要解說。用 / 註解說明曲風。`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content ?? "// 無法生成程式碼";
}