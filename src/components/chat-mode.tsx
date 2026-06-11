"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic } from "@/lib/synth";
import { useApiStatus } from "@/hooks/use-api-status";
import { MidiRoll, MidiInfo, downloadMidiJson } from "@/components/midi-roll";
import { renderMidiToWav, downloadBlob } from "@/lib/audio-export";
import { getDurationSeconds } from "@/lib/midi";
import { getTier, setTier, TIER_LIMITS } from "@/lib/billing";
import { PROMPT_PRESETS } from "@/lib/presets";
import type { MidiData } from "@/lib/midi";
import type { Tier } from "@/lib/billing";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  midi?: MidiData;
  type?: "text" | "midi" | "error";
}

export function ChatMode({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const addCommit = useProjectStore((s) => s.addCommit);
  const apiStatus = useApiStatus();

  const [tier, setTierState] = useState<Tier>(getTier);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: apiStatus.configured
        ? "描述你想要的音樂，AI 會生成 MIDI 音符並播放。"
        : "⚠️ OpenAI API 未串接，使用內建 MIDI 示範。",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentMidi, setCurrentMidi] = useState<MidiData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTierSwitch = (newTier: Tier) => {
    setTierState(newTier);
    setTier(newTier);
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const prompt = input.trim();
    setInput("");
    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "chat", tier }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? err.hint ?? "生成失敗");
      }

      const result = await res.json();

      if (result.type !== "midi" || !result.data) {
        throw new Error("回傳格式錯誤");
      }

      const midi = result.data as MidiData;

      setCurrentMidi(midi);

      const trackSummary = midi.tracks
        .filter((t) => t.notes.length > 0)
        .map((t) => `${t.name}(${t.notes.length})`)
        .join(", ");

      const durationSec = getDurationSeconds(midi);
      const durationDisplay = durationSec >= 60
        ? `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`
        : `${Math.floor(durationSec)}s`;

      const msg: Message = {
        role: "assistant",
        content: `✅ ${tier === "paid" ? "Pro" : "Free"} · ${midi.bpm} BPM · ${durationDisplay}\n🎹 ${trackSummary}`,
        timestamp: new Date(),
        midi,
        type: "midi",
      };

      setMessages((prev) => [...prev, msg]);

      setIsPlaying(true);
      await playMidi(midi);

      addTrack(projectId, {
        name: prompt.slice(0, 40),
        type: "MIDI",
        midiData: JSON.stringify(midi),
        duration: durationSec,
        order: Date.now(),
      });

      addCommit(projectId, {
        prompt,
        midi,
        type: "generate",
      });

      setIsPlaying(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失敗";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ ${message}`,
          timestamp: new Date(),
          type: "error",
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplay = async (midi: MidiData) => {
    setIsPlaying(true);
    setCurrentMidi(midi);
    await playMidi(midi);
    setIsPlaying(false);
  };

  const handleStop = () => {
    stopMusic();
    setIsPlaying(false);
  };

  const handleExportWav = async (midi: MidiData) => {
    if (tier === "free") {
      const msg: Message = {
        role: "assistant",
        content: "💡 升級到 Pro 方案即可匯出 WAV/MP3 音檔！",
        timestamp: new Date(),
        type: "text",
      };
      setMessages((prev) => [...prev, msg]);
      return;
    }
    setIsExporting(true);
    try {
      const blob = await renderMidiToWav(midi);
      downloadBlob(blob, `museai-${Date.now()}.wav`);
    } catch (err) {
      const msg: Message = {
        role: "assistant",
        content: `❌ 匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`,
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, msg]);
    } finally {
      setIsExporting(false);
    }
  };

  const limits = TIER_LIMITS[tier];

  return (
    <div className="flex flex-col h-full bg-white">
      {!apiStatus.loading && !apiStatus.configured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <span>⚠️</span>
          <span className="flex-1">OpenAI API 未串接 — 使用內建 MIDI 示範</span>
          <button onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")} className="underline hover:text-amber-900">取得金鑰</button>
        </div>
      )}

      {/* Tier selector */}
      <div className="border-b bg-gray-50 px-4 py-2 flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">方案：</span>
        <button onClick={() => handleTierSwitch("free")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            tier === "free"
              ? "bg-gray-800 text-white"
              : "bg-white border text-gray-600 hover:bg-gray-100"
          }`}>
          Free · 30s 循環
        </button>
        <button onClick={() => handleTierSwitch("paid")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            tier === "paid"
              ? "bg-purple-600 text-white"
              : "bg-white border text-gray-600 hover:bg-gray-100"
          }`}>
          Pro · 最長 3 分鐘
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
              msg.role === "user" ? "bg-purple-600 text-white"
              : msg.type === "error" ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-gray-100 text-gray-800"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {msg.midi && (
                <div className="mt-3 space-y-2">
                  <MidiInfo midi={msg.midi} />
                  <MidiRoll midi={msg.midi} />
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPlaying && currentMidi === msg.midi ? (
                      <button onClick={handleStop} className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-400">■ 停止</button>
                    ) : (
                      <button onClick={() => handleReplay(msg.midi!)} className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500">▶ 播放</button>
                    )}
                    <button onClick={() => downloadMidiJson(msg.midi!, `museai-${Date.now()}.json`)}
                      className="px-3 py-1 rounded border text-gray-600 text-xs hover:bg-gray-50">
                      匯出 MIDI JSON
                    </button>
                    <button onClick={() => handleExportWav(msg.midi!)}
                      disabled={isExporting || tier === "free"}
                      className="px-3 py-1 rounded border text-gray-600 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={tier === "free" ? "升級 Pro 即可匯出 WAV" : "匯出 WAV 音檔"}>
                      {isExporting ? "渲染中..." : "匯出 WAV"}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs opacity-50 mt-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</p>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-purple-500 rounded-full animate-waveform" />
                <div className="w-1 h-6 bg-purple-500 rounded-full animate-waveform" style={{ animationDelay: "0.1s" }} />
                <div className="w-1 h-3 bg-purple-500 rounded-full animate-waveform" style={{ animationDelay: "0.2s" }} />
                <span className="text-sm text-gray-500 ml-1">
                  {apiStatus.configured
                    ? `${tier === "paid" ? "AI 生成編曲中..." : "AI 生成循環中..."}`
                    : "產生 MIDI 示範..."}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 pt-3 pb-2 bg-white">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PROMPT_PRESETS.map((preset) => (
            <button key={preset.label} onClick={() => setInput(preset.prompt)}
              className="px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs hover:bg-purple-100 hover:border-purple-300 transition-colors">
              {preset.label} · {preset.bpm}BPM
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`${tier === "paid" ? "描述完整編曲" : "描述循環片段"}，AI 會生成 MIDI...`}
            className="flex-1 px-4 py-2.5 rounded-lg border text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
            disabled={isGenerating}
          />
          <button onClick={handleSend} disabled={isGenerating || !input.trim()}
            className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50">
            {isGenerating ? "生成中..." : "發送"}
          </button>
        </div>
      </div>
    </div>
  );
}