"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/lib/store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE = `// Museai 即時編程
// 使用這些函數來創作音樂：
//
// play(音符, 拍長, 音色) - 播放單音
//   音符: "C4", "D#3", "A4" 等
//   拍長: 0.25, 0.5, 1, 2 等（以拍為單位）
//   音色: "sine", "square", "sawtooth", "triangle"
//
// sequence(音符陣列) - 播放一段旋律
//   音符陣列: [{ note, duration, instrument }]
//
// pattern(名稱, 音符陣列) - 定義可重複的模式
// pattern("kick", [
//   { note: "C2", duration: 1 },
//   { note: "C2", duration: 0.5 },
// ])
// playPattern("kick")
//
// setBpm(bpm) - 改變速度
// setVolume(0.8) - 主音量 (0 到 1)

setBpm(120);
setVolume(0.7);

// 四地板大鼓
pattern("kick", [
  { note: "C2", duration: 1, instrument: "sine" },
]);

// 開合鈸
pattern("hat", [
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
]);

// 貝斯線
pattern("bass", [
  { note: "C3", duration: 1, instrument: "sawtooth" },
  { note: "E3", duration: 1, instrument: "sawtooth" },
  { note: "G3", duration: 0.5, instrument: "sawtooth" },
  { note: "A3", duration: 0.5, instrument: "sawtooth" },
]);

// 播放模式
playPattern("kick");
playPattern("hat");

// 加入旋律
sequence([
  { note: "C4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 1, instrument: "square" },
  { note: "A4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 1, instrument: "square" },
]);

// 用 AI 生成背景音
generate("加入溫暖的 Pad 音色");
`;

export function LiveCodingMode({ projectId }: { projectId: string }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const addTrack = useProjectStore((s) => s.addTrack);

  const addOutput = (msg: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString("zh-TW")}] ${msg}`]);
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
          if (!notes) {
            addOutput(`找不到模式「${name}」`);
            return;
          }
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
            audioUrl: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
            duration: 30,
            order: Date.now(),
          });
          addOutput("已加入音軌！");
        },
      };

      const fn = new Function(...Object.keys(evalEnv), code);
      await fn(...Object.values(evalEnv));

      addOutput("執行完畢！");
    } catch (err) {
      addOutput(`錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
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
            <p className="text-xs text-gray-400">點擊「執行」來執行程式碼</p>
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