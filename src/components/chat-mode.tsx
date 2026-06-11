"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { generateAndPlayMusic, stopMusic, initAudio } from "@/lib/synth";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  audioUrl?: string;
  isMusic?: boolean;
}

export function ChatMode({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "描述你想要的音樂，例如：「製作一首 Deep House，溫暖的貝斯加上柔和的 Pad 音色，120 BPM，C 小調。」\n\n我會用 AI 分析你的描述，然後即時合成音樂。",
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
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "chat" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "生成失敗");
      }

      const params = await res.json();

      const progressMessages: string[] = [];
      let progressIndex = 0;

      await generateAndPlayMusic(params, (msg) => {
        progressMessages.push(msg);
      });

      setIsPlaying(true);

      const description = `✅ ${params.description || prompt.slice(0, 60)}\n🎵 BPM: ${params.bpm} | 調性: ${params.key} ${params.scale}\n🎸 樂器: ${params.instruments.map((i: { name: string }) => i.name).join(", ")}`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: description,
          timestamp: new Date(),
          isMusic: true,
        },
      ]);

      addTrack(projectId, {
        name: prompt.slice(0, 40),
        type: "AUDIO",
        audioUrl: "",
        duration: 30,
        order: Date.now(),
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ ${error instanceof Error ? error.message : "生成失敗"}`,
          timestamp: new Date(),
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

  const handleRetry = () => {
    stopMusic();
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.isMusic && (
                <div className="mt-2 flex items-center gap-2">
                  {isPlaying ? (
                    <button
                      onClick={handleStop}
                      className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-400"
                    >
                      停止播放
                    </button>
                  ) : (
                    <span className="text-xs text-green-600">✓ 已播放完畢</span>
                  )}
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
                <span className="text-sm text-gray-500 ml-1">AI 分析中...</span>
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