# Museai — AI 音樂創作平台

用自然語言描述你想要的音樂，AI 即時生成 MIDI 樂譜。鋼琴卷軸編輯、三種創作模式、版本歷史管理、一鍵匯出音檔。

## ✨ 功能

### 🎤 聊天模式
輸入文字描述音樂風格、節奏、情緒，AI 生成 MIDI 音符並即時播放。支援 OpenAI API 真實生成或內建 MIDI 示範（無需 API 金鑰也可體驗）。

### 🎛️ 時間軸模式
多軌 MIDI 編輯器，類似 DAW 的編排介面。

### ⌨️ 即時編程模式
用 JavaScript 撰寫演算法音樂，內建 `createTrack` / `addNote` / `playMidi` API，AI 可幫你生成程式碼。使用 Monaco Editor。

### 🎹 鋼琴卷軸
Canvas 繪製的 pitch-vs-time 網格，彩色音符方塊依 channel 分色，支援縮放與點擊選取。

### ⏱ 版本歷史
每次生成自動記錄為一個 commit（類似 GitHub），包含：
- 產生的完整 MIDI 資料
- Prompt 與時間戳
- 可播放、檢視、回朔、匯出

### 💳 商業模式
| 方案 | Free | Pro |
|------|------|-----|
| 時長 | 30 秒循環（8 小節） | 最長 3 分鐘（144 小節） |
| 結構 | 單段循環 | Intro → Verse → Chorus → Bridge → Outro |
| 樂器 | 4 軌 | 6 軌 |
| 匯出 | MIDI JSON | MIDI JSON + WAV |
| 價格 | 免費 | $19/月 |

### 📦 匯出格式
- MIDI JSON — 保留完整音符資料，可匯入其他 DAW
- WAV — 離線渲染音檔下載（Pro）

## 🏗 架構

```
User Prompt → /api/generate → OpenAI / 本地示範 → MidiData (JSON)
                                                      ↓
                                             Tone.js Synth Engine
                                             (FM/AM/Noise/Membrane)
                                                      ↓
                                             播放 / WAV 匯出 / MIDI 匯出
```

### 核心目錄結構

```
src/
├── lib/
│   ├── midi.ts          # MidiData 型別、音符工具、分層 MIDI 生成
│   ├── openai.ts        # OpenAI 整合、分層 system prompt
│   ├── synth.ts         # Tone.js 合成引擎（6 channel）
│   ├── audio-export.ts  # WAV 離線渲染
│   ├── billing.ts       # 分層管理（Free/Pro）
│   ├── presets.ts       # 範例 prompt
│   └── store.ts         # Zustand 狀態管理 + localStorage 持久化
├── components/
│   ├── chat-mode.tsx    # 聊天模式
│   ├── live-coding-mode.tsx  # 即時編程模式
│   ├── timeline-mode.tsx     # 時間軸模式
│   ├── midi-roll.tsx    # 鋼琴卷軸元件
│   └── version-history.tsx   # 版本歷史面板
├── app/
│   ├── page.tsx         # 首頁落地頁
│   ├── pricing/         # 定價頁
│   ├── dashboard/       # 專案儀表板
│   └── project/[id]/    # 專案編輯器
└── hooks/
    └── use-api-status.ts # API 狀態偵測
```

## 🛠 技術棧

| 技術 | 用途 |
|------|------|
| Next.js 16 (App Router + Turbopack) | 前端框架 |
| TypeScript | 型別安全 |
| Tailwind CSS v4 | 樣式 |
| Zustand + persist | 狀態管理 + localStorage |
| Tone.js | Web Audio 合成引擎 |
| Monaco Editor | 即時編程編輯器 |
| NextAuth.js | 第三方登入 |
| OpenAI SDK | AI MIDI 生成 |

## 🚀 快速開始

```bash
git clone https://github.com/f114152168-design/museai.git
cd museai
npm install
```

### 環境變數

建立 `.env.local`：

```env
# OpenAI API（選填 — 未設定時使用內建 MIDI 示範）
OPENAI_API_KEY="sk-your-key-here"

# NextAuth（選填 — 未設定時仍可使用訪客模式）
AUTH_SECRET="your-secret"
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可開始創作。

### 生產構建

```bash
npm run build
npm start
```

## 🧪 試用

無需註冊、無需 API 金鑰即可使用 Free 方案：
1. 開啟 [http://localhost:3000](https://museai.vercel.app)
2. 點「開始創作」或點範例 prompt
3. AI 自動生成 MIDI 並播放

## ☁️ 部署

推薦一鍵部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ff114152168-design%2Fmuseai)

環境變數同樣設定 `.env.local` 的內容到 Vercel Project Settings → Environment Variables。

## 📄 授權

MIT License
