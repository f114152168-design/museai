"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/lib/store";
import { useApiStatus } from "@/hooks/use-api-status";
import { playMidi, stopMusic } from "@/lib/synth";
import { MidiRoll, MidiInfo, downloadMidiJson } from "@/components/midi-roll";
import { getDurationSeconds, type MidiData, type MidiNote } from "@/lib/midi";
import { generateFreeMidi, generatePaidMidi } from "@/lib/midi";
import { getTier, setTier, TIER_LIMITS } from "@/lib/billing";
import type { Tier } from "@/lib/billing";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE = `// Museai Live Coding — MIDI 模式
// 可用函數：
//   playMidi(midi)     - 播放 MIDI 資料
//   addNote(track, pitch, start, dur, vel, ch)
//   setBpm(bpm)
//   generate(prompt)   - AI 生成 MIDI（需 OpenAI）

// 建立 4 軌 MIDI
const kick = createTrack("Kick", 0);
const snare = createTrack("Snare", 1);
const hat = createTrack("HiHat", 2);
const bass = createTrack("Bass", 3);

// 大鼓 4-on-the-floor
for (let i = 0; i < 16; i += 2) {
  addNote(kick, 36, i, 0.9, 0.9);
}

// 小鼓 2 & 4
for (let i = 4; i < 16; i += 4) {
  addNote(snare, 38, i - 2, 0.8, 0.85);
}

// HiHat 每半拍
for (let i = 0; i < 16; i += 0.5) {
  addNote(hat, 42, i, 0.15, i % 1 === 0 ? 0.6 : 0.3);
}

// 貝斯
const bassNotes = [36, 43, 38, 41]; // C2, G2, D2, F2
for (let i = 0; i < 16; i += 2) {
  addNote(bass, bassNotes[Math.floor(i / 4) % 4], i, 1.8, 0.7);
}

playMidi(buildMidi(128));
`;

export function LiveCodingMode({ projectId }: { projectId: string }) {
  const [tier, setTierState] = useState<Tier>(getTier);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastMidi, setLastMidi] = useState<MidiData | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const addTrack = useProjectStore((s) => s.addTrack);
  const addCommit = useProjectStore((s) => s.addCommit);
  const apiStatus = useApiStatus();

  const addOutput = (msg: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString("zh-TW")}] ${msg}`]);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      if (!apiStatus.configured) {
        addOutput("⚠️ OpenAI API 未串接，無法使用 AI");
        setIsAiLoading(false);
        return;
      }
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, mode: "livecode", tier }),
      });
      if (!res.ok) throw new Error("生成失敗");
      const data = await res.json();
      setCode((prev) => prev + `\n\n// === AI 生成 ===\n${data.code}`);
      addOutput(`✅ AI 已根據「${aiPrompt}」生成程式碼`);
      setAiPrompt("");
    } catch (err) {
      addOutput(`❌ 錯誤：${err instanceof Error ? err.message : "生成失敗"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRun = useCallback(async () => {
    try {
      stopMusic();
      setOutput([]);
      setIsPlaying(true);

      let currentBpm = 128;
      let tracks: Array<{ name: string; channel: number; instrument: string; notes: MidiNote[] }> = [];
      let currentTrack: { name: string; channel: number; instrument: string; notes: MidiNote[] } | null = null;

      const env = {
        createTrack: (name: string, channel: number) => {
          const instr = ["kick","snare","hihat","bass","pad","lead"][channel] || "synth";
        const t = { name, channel, instrument: instr, notes: [] as MidiNote[] };
          tracks.push(t);
          currentTrack = t;
          addOutput(`建立音軌：${name} (ch.${channel})`);
          return t;
        },
        addNote: (track: any, pitch: number, startTime: number, duration: number, velocity: number = 0.7) => {
          if (!track) { addOutput("⚠️ addNote: 請先用 createTrack"); return; }
          track.notes.push({ pitch, startTime, duration, velocity, channel: track.channel });
        },
        setBpm: (bpm: number) => {
          currentBpm = Math.max(60, Math.min(200, bpm));
          addOutput(`BPM = ${currentBpm}`);
        },
        buildMidi: (bpm?: number) => {
          const midi: MidiData = {
            bpm: bpm ?? currentBpm,
            totalBeats: 16,
            tracks,
          };
          addOutput(`MIDI 建立完成：${tracks.length} 軌`);
          return midi;
        },
        playMidi: async (midi: MidiData) => {
          setLastMidi(midi);
          addOutput("▶ 播放 MIDI...");

          // Save to project (sync with timeline)
          addTrack(projectId, {
            name: `Live Coding ${midi.bpm}BPM`,
            type: "MIDI",
            midiData: JSON.stringify(midi),
            duration: getDurationSeconds(midi),
            order: Date.now(),
          });
          addCommit(projectId, {
            prompt: "即時編程",
            midi,
            type: "generate",
          });

          await playMidi(midi);
          addOutput("✓ 播放完成");
        },
        generate: async (prompt: string) => {
          addOutput(`AI 生成：「${prompt}」`);
          if (apiStatus.configured) {
            try {
              const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, mode: "chat" }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.type === "midi") {
                  setLastMidi(data.data);
                  addOutput("✅ AI 生成 MIDI 完成");
                  addTrack(projectId, {
                    name: prompt.slice(0, 40),
                    type: "MIDI",
                    midiData: JSON.stringify(data.data),
                    duration: 30,
                    order: Date.now(),
                  });
                  return;
                }
              }
            } catch { /* fallback */ }
          }
          // Fallback: use tier-based MIDI
          const mockMidi = tier === "paid" ? generatePaidMidi() : generateFreeMidi();
          setLastMidi(mockMidi);
          addOutput(`🎵 使用內建 ${tier === "paid" ? "編曲" : "循環"} MIDI 示範`);
        },
      };

      const fn = new Function(...Object.keys(env), code);
      await fn(...Object.values(env));
      addOutput("✅ 執行完畢");
    } catch (err) {
      addOutput(`❌ 錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setTimeout(() => setIsPlaying(false), 500);
    }
  }, [code, projectId, addTrack, addCommit, apiStatus.configured]);

  const handleStop = () => {
    stopMusic();
    setIsPlaying(false);
    addOutput("已停止");
  };

  return (
    <div className="flex h-full bg-white">
      <div className="flex-1 flex flex-col border-r">
        {!apiStatus.loading && !apiStatus.configured && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
            <span>⚠️</span><span className="flex-1">AI 程式碼生成未啟用（需設定 OPENAI_API_KEY）</span>
            <button onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")} className="underline">取得金鑰</button>
          </div>
        )}

        <div className="border-b flex">
          <div className="border-r px-2 flex items-center gap-1 bg-gray-50">
            <button onClick={() => { setTierState("free"); setTier("free"); }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                tier === "free" ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-200"
              }`}>Free</button>
            <button onClick={() => { setTierState("paid"); setTier("paid"); }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                tier === "paid" ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-200"
              }`}>Pro</button>
          </div>
          <div className="flex-1 flex items-center gap-2 px-2 py-1.5 bg-white">
          <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            placeholder={`用中文描述，${tier === "paid" ? "AI 幫你寫完整編曲" : "AI 幫你寫循環片段"}...`} className="flex-1 px-3 py-1.5 rounded-lg border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500" />
          <button onClick={handleAiGenerate} disabled={isAiLoading || !aiPrompt.trim() || !apiStatus.configured}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50">
            {isAiLoading ? "生成中..." : "AI 幫我寫"}
          </button>
        </div>
        </div>

        <div className="flex-1">
          <MonacoEditor language="javascript" theme="light" value={code} onChange={(val) => setCode(val ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false, padding: { top: 8 }, fontFamily: "'Geist Mono', 'Fira Code', monospace" }} />
        </div>

        <div className="border-t p-2 flex items-center gap-2 bg-white">
          <button onClick={handleRun} disabled={isPlaying}
            className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5">▶ 執行</button>
          <button onClick={handleStop}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400 disabled:opacity-50 flex items-center gap-1.5">■ 停止</button>
        </div>
      </div>

      <div className="w-96 flex flex-col">
        <div className="text-xs text-gray-500 px-3 py-2 border-b font-medium bg-white">
          輸出
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin bg-white">
          {output.length === 0 ? (
            <div className="text-xs text-gray-400 space-y-1">
              <p>點「執行」播放 MIDI</p>
              <p>或輸入描述讓 AI 寫程式碼</p>
            </div>
          ) : (
            output.map((line, i) => <p key={i} className="text-xs text-gray-600 font-mono">{line}</p>)
          )}
          {lastMidi && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <MidiInfo midi={lastMidi} />
              <div className="max-h-40 overflow-y-auto">
                <MidiRoll midi={lastMidi} />
              </div>
              <button onClick={() => downloadMidiJson(lastMidi)} className="text-xs text-purple-600 hover:underline">
                匯出 MIDI JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}