"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { generateAndPlayMusic, stopMusic } from "@/lib/synth";
import { useApiStatus } from "@/hooks/use-api-status";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "music" | "error";
}

export function ChatMode({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const apiStatus = useApiStatus();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: apiStatus.configured
        ? "描述你想要的音樂，我會用 AI 分析並即時合成。\n\n例如：「製作一首 Deep House，溫暖的貝斯加上柔和的 Pad 音色，120 BPM，C 小調。」"
        : "⚠️ OpenAI API 尚未串接\n\n描述你想要的音樂，我會用內建引擎示範播放（未使用 AI）。\n\n要啟用 AI 功能，請在 .env 設定：\nOPENAI_API_KEY=\"sk-your-key\"\n\n例如：「製作一首 Deep House，溫暖的貝斯加上柔和的 Pad 音色，120 BPM，C 小調。」",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
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
      if (apiStatus.configured) {
        // AI mode
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, mode: "chat" }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? err.hint ?? "生成失敗");
        }

        const params = await res.json();

        await generateAndPlayMusic(params);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ ${params.description || prompt.slice(0, 60)}\n🎵 BPM: ${params.bpm} | 調性: ${params.key} ${params.scale}\n🎸 樂器: ${params.instruments.map((i: { name: string }) => i.name).join(", ")}`,
            timestamp: new Date(),
            type: "music",
          },
        ]);

        addTrack(projectId, {
          name: prompt.slice(0, 40),
          type: "AUDIO",
          duration: 30,
          order: Date.now(),
        });
      } else {
        // Demo mode - use built-in patterns
        await generateAndPlayMusic({
          bpm: 120,
          key: "C",
          scale: "minor",
          timeSignature: "4/4",
          instruments: [
            { name: "kick", type: "rhythmic", pattern: "fourOnFloor", notes: ["C2"] },
            { name: "hihat", type: "rhythmic", pattern: "offBeat", notes: ["C5"] },
            { name: "bass", type: "bass", pattern: "walking", notes: ["C2", "Eb2", "G2", "Ab2"] },
          ],
          description: `🎵 示範播放（無 AI）：${prompt.slice(0, 40)}`,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `🎵 示範播放（未使用 AI）\n⚡️ 提示詞：${prompt.slice(0, 60)}\n💡 若要啟用 AI 智慧生成，請在 .env 設定 OPENAI_API_KEY`,
            timestamp: new Date(),
            type: "music",
          },
        ]);

        addTrack(projectId, {
          name: prompt.slice(0, 40),
          type: "AUDIO",
          duration: 30,
          order: Date.now(),
        });
      }

      setIsPlaying(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失敗";
      const isApiKeyError = message.includes("OPENAI_API_KEY") || message.includes("API 金鑰");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isApiKeyError
            ? `❌ OpenAI API 未串接\n\n請在專案根目錄的 .env 檔案中加入：\nOPENAI_API_KEY="sk-your-key-here"\n\n然後重新啟動 dev server。\n\n或直接輸入文字，我會用內建引擎示範播放。`
            : `❌ ${message}`,
          timestamp: new Date(),
          type: "error",
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    stopMusic();
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* API Status Banner */}
      {!apiStatus.loading && !apiStatus.configured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <span>⚠️</span>
          <span className="flex-1">OpenAI API 未串接 — 使用內建示範模式播放</span>
          <button
            onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")}
            className="underline hover:text-amber-900"
          >
            取得金鑰
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : msg.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.type === "music" && isPlaying && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleStop}
                    className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-400"
                  >
                    停止播放
                  </button>
                </div>
              )}
              {msg.type === "error" && !msg.content.includes("OPENAI_API_KEY") && (
                <div className="mt-2">
                  <button
                    onClick={handleSend}
                    className="px-3 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-500"
                  >
                    重試
                  </button>
                </div>
              )}
              <p className="text-xs opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString("zh-TW")}
              </p>
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
                  {apiStatus.configured ? "AI 分析中..." : "播放中..."}
                </span>
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
            placeholder="用自然語言描述你想要的音樂..."
            className="flex-1 px-4 py-2.5 rounded-lg border text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
            disabled={isGenerating}
          />
          <button
            onClick={handleSend}
            disabled={isGenerating || !input.trim()}
            className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {isGenerating ? "生成中..." : "發送"}
          </button>
        </div>
      </div>
    </div>
  );
}