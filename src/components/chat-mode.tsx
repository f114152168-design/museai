"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic } from "@/lib/synth";
import { useApiStatus } from "@/hooks/use-api-status";
import { MidiRoll, MidiInfo, downloadMidiJson } from "@/components/midi-roll";
import type { MidiData } from "@/lib/midi";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  midi?: MidiData;
  type?: "text" | "midi" | "error";
}

export function ChatMode({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const apiStatus = useApiStatus();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: apiStatus.configured
        ? "描述你想要的音樂，AI 會生成 MIDI 音符並播放。\n\n例如：「Deep House，120 BPM，C 小調，溫暖的貝斯和柔和 Pad」"
        : "⚠️ OpenAI API 未串接，使用內建 MIDI 示範。\n\n描述你想要的音樂，或直接按發送聽範例。\n\n要啟用 AI 請在 .env 設定：\nOPENAI_API_KEY=\"sk-your-key\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMidi, setCurrentMidi] = useState<MidiData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ prompt, mode: "chat" }),
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

      const msg: Message = {
        role: "assistant",
        content: `✅ 已生成 ${midi.tracks.length} 軌 · ${midi.bpm} BPM\n🎹 ${trackSummary}`,
        timestamp: new Date(),
        midi,
        type: "midi",
      };

      setMessages((prev) => [...prev, msg]);

      // Auto-play
      setIsPlaying(true);
      await playMidi(midi);

      addTrack(projectId, {
        name: prompt.slice(0, 40),
        type: "MIDI",
        midiData: JSON.stringify(midi),
        duration: (midi.totalBeats || 16) * (60 / midi.bpm),
        order: Date.now(),
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

  return (
    <div className="flex flex-col h-full bg-white">
      {!apiStatus.loading && !apiStatus.configured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <span>⚠️</span>
          <span className="flex-1">OpenAI API 未串接 — 使用內建 MIDI 示範</span>
          <button onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")} className="underline hover:text-amber-900">取得金鑰</button>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    {isPlaying && currentMidi === msg.midi ? (
                      <button onClick={handleStop} className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-400">■ 停止</button>
                    ) : (
                      <button onClick={() => handleReplay(msg.midi!)} className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500">▶ 播放</button>
                    )}
                    <button onClick={() => downloadMidiJson(msg.midi!, `museai-${Date.now()}.json`)} className="px-3 py-1 rounded border text-gray-600 text-xs hover:bg-gray-50">
                      匯出 JSON
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
                <span className="text-sm text-gray-500 ml-1">{apiStatus.configured ? "AI 生成 MIDI 中..." : "產生 MIDI 示範..."}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="描述你想要的音樂，AI 會生成 MIDI..."
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