import OpenAI from "openai";
import type { MidiData } from "@/lib/midi";

let client: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function getOpenAI(): OpenAI {
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

const FREE_SYSTEM_PROMPT = `你是 Museai 的 AI 作曲助手（Free 方案）。使用者用自然語言描述音樂，你要輸出 MIDI 資料。

規則（Free 方案 — 短循環片段，8 小節）：
1. 總長度只能 8 小節（32 拍），以 4/4 拍為單位
2. 大鼓在正拍（0, 4, 8, 12...）
3. 小鼓在反拍（2, 6, 10, 14...）
4. HiHat 每半拍，力度交替強弱
5. 貝斯走根音，每 2 拍一個
6. 和弦用長音（duration: 4），每小節換一個
7. 主旋律必須有！用 8 分音符，旋律要有起伏和重複
8. 根據曲風調整節奏和音符選擇
9. 不得超過 8 小節

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
  ],
  "totalBeats": 32,
  "tier": "free",
  "sections": [
    { "name": "loop", "bars": 8, "instruments": ["kick","snare","hihat","bass","melody"], "description": "循環" }
  ]
}

樂器對照表（channel）:
- 0: Kick, 36=C2
- 1: Snare, 38=D2, 40=E2
- 2: HiHat, 42=F#2(閉), 46=A#2(開)
- 3: Bass, 建議 24-48 範圍
- 4: Chord/Pad, 建議 48-72 範圍
- 6: Melody（主旋律）, 建議 60-84 範圍，這是必須的！`;

const PAID_SYSTEM_PROMPT = `你是 Museai 的 AI 作曲助手（Pro 方案）。使用者用自然語言描述音樂，你要輸出完整編曲的 MIDI 資料。

規則（Pro 方案 — 完整編曲，最長 72 小節）：
1. 必須包含 4-6 個段落：intro, verse, chorus, bridge, chorus, outro
2. 每個段落 4-8 小節
3. intro: 氣氛鋪墊（pad, piano, 無鼓）
4. verse: 主歌（鼓+貝斯+和弦，旋律輕）
5. chorus: 副歌（全樂器，主旋律最強）
6. bridge: 橋段（變化，鋪墊回歸）
7. outro: 結尾（漸弱）
8. 段落之間樂器配置要有層次感
9. 4/4 拍，BPM 60-200
10. 主旋律必須有！放在 channel 6

請嚴格以 JSON 格式回覆：
{
  "bpm": 128,
  "tracks": [
    {
      "name": "Kick",
      "channel": 0,
      "notes": [{ "pitch": 36, "startTime": 0, "duration": 0.9, "velocity": 0.9 }]
    }
  ],
  "totalBeats": 96,
  "tier": "paid",
  "sections": [
    { "name": "intro", "bars": 8, "instruments": ["pad"], "description": "導入" },
    { "name": "verse", "bars": 8, "instruments": ["kick","bass","pad"], "description": "主歌" },
    { "name": "chorus", "bars": 8, "instruments": ["kick","snare","hihat","bass","melody"], "description": "副歌" },
    { "name": "bridge", "bars": 4, "instruments": ["pad","arp"], "description": "橋段" },
    { "name": "chorus", "bars": 8, "instruments": ["kick","snare","hihat","bass","melody","pad"], "description": "高亢副歌" },
    { "name": "outro", "bars": 4, "instruments": ["pad"], "description": "結尾" }
  ]
}

樂器對照表（channel）:
- 0: Kick
- 1: Snare/Clap
- 2: HiHat/cymbal
- 3: Bass
- 4: Chord/Pad/Strings
- 6: Melody（主旋律）, 建議 60-84 範圍，這是必須的！`;

export async function generateMidiFromPrompt(
  prompt: string,
  tier: "free" | "paid" = "free"
): Promise<MidiData> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: tier === "paid" ? PAID_SYSTEM_PROMPT : FREE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 沒有回傳內容");

  const data = JSON.parse(content) as MidiData;

  if (!data.bpm) data.bpm = 120;
  if (!data.tracks) data.tracks = [];
  if (!data.totalBeats) data.totalBeats = tier === "paid" ? 96 : 32;

  return data;
}

const MELODY_SYSTEM_PROMPT = `你是 Museai 的 AI 旋律助手。使用者描述想要的旋律，你要輸出單一旋律軌道的 MIDI 資料。

規則：
1. 只輸出一個軌道：旋律（channel 6）
2. 旋律必須有清晰的樂句結構：2-4 小節為一個短句，重複 2-4 次
3. 使用音階內的音符，相鄰音符距離不超過 5 個音階度數
4. 強調 chord tone（根音、三度、五度）作為短句的起點和終點
5. 節奏要有變化：混合 8 分音符和 4 分音符，避免全部一樣長
6. 每個短句結尾加長音（1-2 拍），創造呼吸感
7. 旋律範圍：MIDI 48-96（C3-C7），建議集中在 60-84
8. velocity 0.7-1.0，有強弱變化
9. 4/4 拍

請嚴格以 JSON 格式回覆，不要加任何其他文字：
{
  "bpm": 128,
  "tracks": [
    {
      "name": "Melody",
      "channel": 6,
      "instrument": "lead",
      "notes": [
        { "pitch": 60, "startTime": 0, "duration": 0.5, "velocity": 0.85, "channel": 6 }
      ]
    }
  ],
  "totalBeats": 32,
  "tier": "free",
  "sections": [
    { "name": "melody", "bars": 8, "instruments": ["lead"], "description": "旋律" }
  ]
}

範例旋律結構（A-B-A-B）：
- 短句 A（0-8 拍）：上行琶音 + 長音結尾
- 短句 B（8-16 拍）：下行音階 + 長音結尾
- 短句 A'（16-24 拍）：A 的變化（八度偏移）
- 短句 B'（24-32 拍）：B 的變化（結尾不同）`;

export async function generateMelodyFromPrompt(
  prompt: string,
  tier: "free" | "paid" = "free"
): Promise<MidiData> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MELODY_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 沒有回傳內容");

  const data = JSON.parse(content) as MidiData;

  if (!data.bpm) data.bpm = 120;
  if (!data.tracks) data.tracks = [];
  if (!data.totalBeats) data.totalBeats = tier === "paid" ? 96 : 32;

  // Ensure melody is on channel 6
  for (const track of data.tracks) {
    for (const note of track.notes) {
      note.channel = 6;
    }
  }

  return data;
}

const PAID_LIVECODE_PROMPT_PREFIX = `你是 Museai Live Coding 助手（Pro 方案）。`;

const FREE_LIVECODE_PROMPT_PREFIX = `你是 Museai Live Coding 助手（Free 方案，只能產生 8 小節循環）。`;

export async function generateLiveCodeFromPrompt(
  prompt: string,
  tier: "free" | "paid" = "free",
  bpm: number = 120
): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${tier === "paid" ? PAID_LIVECODE_PROMPT_PREFIX : FREE_LIVECODE_PROMPT_PREFIX}
使用者描述想要的音樂，你要用 JavaScript 生成 MIDI 音符。

可用函數：
- play(pitch, startBeat, duration, velocity, channel)
  pitch: MIDI 音符編號 (36=C2)
  startBeat: 從第幾拍開始
  duration: 長度（拍）
  velocity: 力度 0-1
  channel: 0=鼓,1=小鼓,2=HH,3=貝斯,4=和弦,5=主旋律

${tier === "paid" ? "總長度最多 144 小節（576 拍），段落需包含 intro/verse/chorus/bridge/outro" : "總長度只能在 8 小節（32 拍）以內，循環結構"}

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