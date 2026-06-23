"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useProjectStore, type ChatMessage } from "@/lib/store";
import { playMidi, stopMusic, pauseMidi, resumeMidi, initAudio, isPaused as getIsPaused } from "@/lib/synth";
import { useApiStatus } from "@/hooks/use-api-status";
import { useTier } from "@/hooks/use-tier";
import { MidiRoll, MidiInfo, downloadMidiJson } from "@/components/midi-roll";
import { renderMidiToWav, downloadBlob } from "@/lib/audio-export";
import { getDurationSeconds, type MidiData } from "@/lib/midi";
import { TIER_LIMITS } from "@/lib/billing";
import { PROMPT_PRESETS } from "@/lib/presets";

export function ChatMode({ projectId, onSwitchToTimeline }: { projectId: string; onSwitchToTimeline?: () => void }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  const addTrack = useProjectStore((s) => s.addTrack);
  const addCommit = useProjectStore((s) => s.addCommit);
  const addChatMessage = useProjectStore((s) => s.addChatMessage);
  const clearChatMessages = useProjectStore((s) => s.clearChatMessages);
  const apiStatus = useApiStatus();
  const { tier, redeem } = useTier();

  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentMidi, setCurrentMidi] = useState<MidiData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted messages from store on mount
  useEffect(() => {
    if (project?.chatMessages) {
      setMessages(project.chatMessages);
    } else {
      // Default welcome message
      const welcome: ChatMessage = {
        role: "assistant",
        content: apiStatus.configured
          ? "描述你想要的音樂，AI 會生成完整編曲（旋律 + 鼓 + 貝斯 + 和弦）。"
          : "⚠️ OpenAI API 未串接，使用內建 MIDI 示範。",
        timestamp: new Date().toISOString(),
        type: "text",
      };
      setMessages([welcome]);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persistMessage = useCallback((msg: ChatMessage) => {
    addChatMessage(projectId, msg);
  }, [projectId, addChatMessage]);

  const handleRedeem = () => {
    const result = redeem(promoInput);
    setPromoMsg({ ok: result.success, text: result.message });
    if (result.success) setPromoInput("");
  };

  const handleClearHistory = () => {
    clearChatMessages(projectId);
    setMessages([]);
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage(userMsg);
    const prompt = input.trim();
    setInput("");
    setIsGenerating(true);

    try {
      // Always use "melody" mode — unified generation with full arrangement
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "melody", tier }),
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

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: `✅ ${tier === "paid" ? "Pro" : "Free"} · ${midi.bpm} BPM · ${durationDisplay}\n🎹 ${trackSummary}`,
        timestamp: new Date().toISOString(),
        midiJson: JSON.stringify(midi),
        type: "midi",
      };

      setMessages((prev) => [...prev, assistantMsg]);
      persistMessage(assistantMsg);

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
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `❌ ${error instanceof Error ? error.message : "生成失敗"}`,
        timestamp: new Date().toISOString(),
        type: "error",
      };
      setMessages((prev) => [...prev, errMsg]);
      persistMessage(errMsg);
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
      const msg: ChatMessage = {
        role: "assistant",
        content: "💡 升級到 Pro 方案即可匯出 WAV/MP3 音檔！",
        timestamp: new Date().toISOString(),
        type: "text",
      };
      setMessages((prev) => [...prev, msg]);
      persistMessage(msg);
      return;
    }
    setIsExporting(true);
    try {
      const blob = await renderMidiToWav(midi);
      downloadBlob(blob, `museai-${Date.now()}.wav`);
    } catch (err) {
      const msg: ChatMessage = {
        role: "assistant",
        content: `❌ 匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`,
        timestamp: new Date().toISOString(),
        type: "error",
      };
      setMessages((prev) => [...prev, msg]);
      persistMessage(msg);
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

      {/* Pro status / Promo bar */}
      <div className="border-b bg-gray-50 px-4 py-2 flex items-center gap-2">
        {tier === "paid" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600 text-white font-medium">Pro</span>
            <span className="text-xs text-gray-500">完整編曲 · 最長 3 分鐘 · WAV 匯出</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600 text-white font-medium">Free</span>
            <span className="text-xs text-gray-500 mr-auto">30 秒循環 · 輸入優惠碼解鎖 Pro</span>
            <input type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              placeholder="優惠碼" className="w-24 px-2 py-1 rounded border text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500" />
            <button onClick={handleRedeem}
              className="text-xs px-2.5 py-1 rounded bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors">
              解鎖
            </button>
            {promoMsg && (
              <span className={`text-xs ${promoMsg.ok ? "text-green-600" : "text-red-500"}`}>{promoMsg.text}</span>
            )}
          </div>
        )}
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

              {msg.midiJson && (() => {
                let midi: MidiData;
                try { midi = JSON.parse(msg.midiJson); } catch { return null; }
                return (
                  <div className="mt-3 space-y-2">
                    <MidiInfo midi={midi} />
                    <MidiRoll midi={midi} />
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPlaying && currentMidi?.bpm === midi.bpm ? (
                        <button onClick={handleStop} className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-400">■ 停止</button>
                      ) : (
                        <button onClick={() => handleReplay(midi)} className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500">▶ 播放</button>
                      )}
                      <button onClick={() => downloadMidiJson(midi, `museai-${Date.now()}.json`)}
                        className="px-3 py-1 rounded border text-gray-600 text-xs hover:bg-gray-50">
                        匯出 MIDI JSON
                      </button>
                      <button onClick={() => handleExportWav(midi)}
                        disabled={isExporting || tier === "free"}
                        className="px-3 py-1 rounded border text-gray-600 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={tier === "free" ? "升級 Pro 即可匯出 WAV" : "匯出 WAV 音檔"}>
                        {isExporting ? "渲染中..." : "匯出 WAV"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <p className="text-xs opacity-50 mt-1">{new Date(msg.timestamp).toLocaleTimeString("zh-TW")}</p>
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
                  {apiStatus.configured ? "AI 生成完整編曲中..." : "產生 MIDI 示範..."}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mini Timeline — shows current generated MIDI */}
      {currentMidi && (
        <div className="border-t bg-[#1a1a2e] px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 font-medium">🎛️ 時間軸預覽</span>
            <span className="text-[10px] text-gray-500 font-mono">{currentMidi.bpm} BPM</span>
            <span className="text-[10px] text-gray-500 font-mono">{Math.floor(getDurationSeconds(currentMidi))}s</span>
            <div className="flex-1" />
            {onSwitchToTimeline && (
              <button onClick={onSwitchToTimeline}
                className="px-2.5 py-1 rounded text-[10px] bg-purple-600 text-white hover:bg-purple-500 font-medium transition-colors">
                展開時間軸 →
              </button>
            )}
          </div>
          <div className="rounded-lg overflow-hidden bg-[#0f0f1a] border border-[#2a2a3e]">
            <MidiRoll midi={currentMidi} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => {
                if (getIsPaused()) { resumeMidi(); } else { initAudio().then(() => playMidi(currentMidi)); }
              }}
              className="px-3 py-1 rounded bg-green-500 text-black text-xs font-bold hover:bg-green-400">
              {getIsPaused() ? "▶ 繼續" : "▶ 播放"}
            </button>
            <button onClick={() => { pauseMidi(); }}
              className="px-3 py-1 rounded bg-amber-500 text-black text-xs font-bold hover:bg-amber-400">
              ⏸ 暫停
            </button>
            <button onClick={handleStop}
              className="px-3 py-1 rounded bg-[#252540] text-gray-400 text-xs font-bold hover:text-white">
              ■ 停止
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 pt-3 pb-2 bg-white">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PROMPT_PRESETS.map((preset) => (
            <button key={preset.label} onClick={() => setInput(preset.prompt)}
              className="px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs hover:bg-purple-100 hover:border-purple-300 transition-colors">
              {preset.label} · {preset.bpm}BPM
            </button>
          ))}
          <button onClick={handleClearHistory}
            className="px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs hover:bg-gray-100 transition-colors ml-auto">
            🗑️ 清除紀錄
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`${tier === "paid" ? "描述完整編曲" : "描述循環片段"}，AI 會生成完整編曲（旋律+鼓+貝斯+和弦）...`}
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
