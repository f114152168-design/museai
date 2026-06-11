"use client";

import { useProjectStore } from "@/lib/store";
import { useState } from "react";

function generateMockAudioUrl(): string {
  const demos = [
    "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
    "https://actions.google.com/sounds/v1/cartoon/birds_chirping_single.ogg",
    "https://actions.google.com/sounds/v1/weather/rain.ogg",
  ];
  return demos[Math.floor(Math.random() * demos.length)];
}

export function TimelineMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  const addTrack = useProjectStore((s) => s.addTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const deleteTrack = useProjectStore((s) => s.deleteTrack);

  const [prompt, setPrompt] = useState("");

  if (!project) return null;

  const tracks = project.tracks;

  const handleAddTrack = () => {
    addTrack(projectId, {
      name: `音軌 ${tracks.length + 1}`,
      type: "AUDIO",
      order: tracks.length,
    });
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    addTrack(projectId, {
      name: prompt.trim().slice(0, 40),
      type: "AUDIO",
      audioUrl: generateMockAudioUrl(),
      duration: Math.floor(Math.random() * 30) + 10,
      order: tracks.length,
    });
    setPrompt("");
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b p-3 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="描述要生成的音色..."
          className="flex-1 px-3 py-1.5 rounded-lg border text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleGenerate}
          className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500"
        >
          生成
        </button>
        <button
          onClick={handleAddTrack}
          className="px-4 py-1.5 rounded-lg border text-gray-600 text-sm hover:bg-gray-50"
        >
          + 新增音軌
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            尚無音軌。新增音軌或生成音訊來開始編排。
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border hover:border-purple-200 transition-colors"
              >
                <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-sm">
                  {track.type === "MIDI" ? "🎹" : track.type === "CODE" ? "⌨️" : "🔊"}
                </div>

                <input
                  type="text"
                  defaultValue={track.name}
                  onBlur={(e) => updateTrack(projectId, track.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none focus:bg-white focus:border px-2 py-1 rounded"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateTrack(projectId, track.id, { muted: !track.muted })}
                    className={`text-xs px-2 py-1 rounded ${
                      track.muted ? "bg-red-100 text-red-600" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    M
                  </button>
                  {track.duration && (
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {track.duration.toFixed(1)}s
                    </span>
                  )}
                </div>

                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  defaultValue={track.volume}
                  onChange={(e) => updateTrack(projectId, track.id, { volume: Number(e.target.value) })}
                  className="w-20 accent-purple-500"
                />

                {track.audioUrl && (
                  <audio controls src={track.audioUrl} className="h-8 w-32" />
                )}

                <button
                  onClick={() => deleteTrack(projectId, track.id)}
                  className="text-gray-400 hover:text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-2 flex items-center justify-between text-xs text-gray-400 bg-white">
        <span>{tracks.length} 軌</span>
        <span>{project.bpm} BPM</span>
      </div>
    </div>
  );
}