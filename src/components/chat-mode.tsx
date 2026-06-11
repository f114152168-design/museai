"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

function generateMockAudioUrl(): string {
  const demoAudios = [
    "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
    "https://actions.google.com/sounds/v1/cartoon/birds_chirping_single.ogg",
    "https://actions.google.com/sounds/v1/weather/rain.ogg",
  ];
  return demoAudios[Math.floor(Math.random() * demoAudios.length)];
}

export function ChatMode({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "描述你想要的音樂。例如：「製作一首 Deep House，溫暖的貝斯加上柔和的 Pad 音色，120 BPM，C 小調。」",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
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
    setInput("");
    setIsGenerating(true);

    setTimeout(() => {
      const audioUrl = generateMockAudioUrl();
      const cleanPrompt = input.trim().slice(0, 60);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `已生成：「${cleanPrompt}${input.trim().length > 60 ? "..." : ""}」\n\nBPM: 120 | 調性: C min | 長度: 30s`,
          timestamp: new Date(),
          audioUrl,
        },
      ]);

      addTrack(projectId, {
        name: cleanPrompt,
        type: "AUDIO",
        audioUrl,
        duration: 30,
        order: Date.now(),
      });

      setIsGenerating(false);
    }, 2500);
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
              {msg.audioUrl && (
                <audio controls src={msg.audioUrl} className="mt-2 w-full max-w-xs">
                  您的瀏覽器不支援此音訊格式。
                </audio>
              )}
              <p className="text-xs opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString("zh-TW")}
              </p>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full animate-waveform" />
              <div className="w-1 h-6 bg-purple-500 rounded-full animate-waveform" style={{ animationDelay: "0.1s" }} />
              <div className="w-1 h-3 bg-purple-500 rounded-full animate-waveform" style={{ animationDelay: "0.2s" }} />
              <span className="text-sm text-gray-500 ml-1">生成中...</span>
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
            發送
          </button>
        </div>
      </div>
    </div>
  );
}