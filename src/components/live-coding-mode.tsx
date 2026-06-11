"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/lib/store";
import { useApiStatus } from "@/hooks/use-api-status";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE = `// Museai 即時編程
// play(音符, 拍長, 音色)
// sequence(音符陣列)
// pattern(名稱, 音符陣列)
// playPattern("名稱")
// setBpm(bpm)
// setVolume(vol)
// generate("提示詞")

setBpm(120);
setVolume(0.7);

pattern("kick", [
  { note: "C2", duration: 1, instrument: "sine" },
]);
pattern("hat", [
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
]);
pattern("bass", [
  { note: "C3", duration: 1, instrument: "sawtooth" },
  { note: "E3", duration: 1, instrument: "sawtooth" },
  { note: "G3", duration: 0.5, instrument: "sawtooth" },
  { note: "A3", duration: 0.5, instrument: "sawtooth" },
]);

playPattern("kick");
playPattern("hat");

sequence([
  { note: "C4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 1, instrument: "square" },
  { note: "A4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 1, instrument: "square" },
]);
`;

export function LiveCodingMode({ projectId }: { projectId: string }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const addTrack = useProjectStore((s) => s.addTrack);
  const apiStatus = useApiStatus();

  const addOutput = (msg: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString("zh-TW")}] ${msg}`]);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      if (!apiStatus.configured) {
        addOutput("⚠️ OpenAI API 未串接，無法使用 AI 生成程式碼");
        addOutput("💡 請在 .env 設定 OPENAI_API_KEY");
        setIsAiLoading(false);
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, mode: "livecode" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "AI 生成失敗");
      }
      const data = await res.json();
      setCode((prev) => prev + `\n\n// === AI 生成的程式碼 ===\n${data.code}`);
      addOutput(`✅ AI 已根據「${aiPrompt}」生成程式碼`);
      setAiPrompt("");
    } catch (err) {
      addOutput(`❌ 錯誤：${err instanceof Error ? err.message : "AI 生成失敗"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRun = useCallback(async () => {
    try {
      setIsPlaying(true);
      setOutput([]);

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      let bpm = 120;
      let volume = 0.7;
      const patterns = new Map<string, Array<{ note: string; duration: number; instrument?: string }>>();

      const noteToFreq = (note: string): number => {
        const scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const match = note.match(/^([A-G]#?)(\d)$/);
        if (!match) return 440;
        const semitones = scale.indexOf(match[1]);
        const octave = parseInt(match[2]);
        return 440 * Math.pow(2, (semitones - 9 + (octave - 4) * 12) / 12);
      };

      const playNote = (note: string, duration: number, instrument = "sine", startDelay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = instrument as OscillatorType;
        osc.frequency.value = noteToFreq(note);
        const startTime = ctx.currentTime + startDelay;
        gain.gain.setValueAtTime(volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * (60 / bpm));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration * (60 / bpm));
      };

      const evalEnv = {
        setBpm: (newBpm: number) => {
          bpm = Math.max(60, Math.min(200, newBpm));
          addOutput(`速度設為 ${bpm}`);
        },
        setVolume: (vol: number) => {
          volume = Math.max(0, Math.min(1, vol));
          addOutput(`音量設為 ${volume}`);
        },
        play: (note: string, duration: number, instrument = "sine") => {
          playNote(note, duration, instrument);
        },
        sequence: (notes: Array<{ note: string; duration: number; instrument?: string }>) => {
          let time = 0;
          for (const n of notes) {
            playNote(n.note, n.duration, n.instrument || "sine", time);
            time += n.duration;
          }
          addOutput(`播放旋律（${notes.length} 個音符）`);
        },
        pattern: (name: string, notes: Array<{ note: string; duration: number; instrument?: string }>) => {
          patterns.set(name, notes);
          addOutput(`已定義模式「${name}」（${notes.length} 步）`);
        },
        playPattern: (name: string) => {
          const notes = patterns.get(name);
          if (!notes) { addOutput(`找不到模式「${name}」`); return; }
          let time = 0;
          for (const n of notes) {
            playNote(n.note, n.duration, n.instrument || "sine", time);
            time += n.duration;
          }
          addOutput(`播放模式「${name}」`);
        },
        generate: (prompt: string) => {
          addOutput(`AI 生成：「${prompt}」`);
          addTrack(projectId, {
            name: prompt.slice(0, 40),
            type: "AUDIO",
            duration: 30,
            order: Date.now(),
          });
          addOutput("已加入音軌！");
        },
      };

      const fn = new Function(...Object.keys(evalEnv), code);
      await fn(...Object.values(evalEnv));
      addOutput("✅ 執行完畢！");
    } catch (err) {
      addOutput(`❌ 錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setTimeout(() => setIsPlaying(false), 500);
    }
  }, [code, projectId, addTrack]);

  const handleStop = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
    addOutput("已停止播放");
  };

  return (
    <div className="flex h-full bg-white">
      <div className="flex-1 flex flex-col border-r">
        {/* API Status */}
        {!apiStatus.loading && !apiStatus.configured && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">AI 程式碼生成未啟用（需在 .env 設定 OPENAI_API_KEY）</span>
            <button
              onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")}
              className="underline hover:text-amber-900"
            >
              取得金鑰
            </button>
          </div>
        )}

        {/* AI Prompt Bar */}
        <div className="border-b p-2 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            placeholder={
              apiStatus.configured
                ? "用中文描述想要的音樂，AI 幫你寫程式碼..."
                : "請先在 .env 設定 OPENAI_API_KEY..."
            }
            className="flex-1 px-3 py-1.5 rounded-lg border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleAiGenerate}
            disabled={isAiLoading || !aiPrompt.trim() || !apiStatus.configured}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50"
            title={!apiStatus.configured ? "需設定 OPENAI_API_KEY" : undefined}
          >
            {isAiLoading ? "生成中..." : "AI 幫我寫"}
          </button>
        </div>

        <div className="flex-1">
          <MonacoEditor
            language="javascript"
            theme="light"
            value={code}
            onChange={(val) => setCode(val ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              fontFamily: "'Geist Mono', 'Fira Code', monospace",
            }}
          />
        </div>

        <div className="border-t p-2 flex items-center gap-2 bg-white">
          <button
            onClick={handleRun}
            disabled={isPlaying}
            className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>▶</span> 執行
          </button>
          <button
            onClick={handleStop}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>■</span> 停止
          </button>
        </div>
      </div>

      <div className="w-80 flex flex-col">
        <div className="text-xs text-gray-500 px-3 py-2 border-b font-medium bg-white">
          輸出
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin bg-white">
          {output.length === 0 ? (
            <div className="text-xs text-gray-400 space-y-1">
              <p>點「執行」播放程式碼</p>
              {!apiStatus.configured && (
                <p className="text-amber-600">「AI 幫我寫」需設定 OPENAI_API_KEY</p>
              )}
            </div>
          ) : (
            output.map((line, i) => (
              <p key={i} className="text-xs text-gray-600 font-mono">{line}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}