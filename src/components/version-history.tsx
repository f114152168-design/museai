"use client";

import { useState } from "react";
import { MidiRoll, MidiInfo, downloadMidiJson } from "./midi-roll";
import { playMidi, stopMusic } from "@/lib/synth";
import { useProjectStore } from "@/lib/store";
import type { VersionCommit } from "@/lib/store";
import type { MidiData } from "@/lib/midi";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "剛剛";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const d = Math.floor(hr / 24);
  return `${d} 天前`;
}

function commitTypeLabel(type: string): string {
  switch (type) {
    case "generate": return "生成";
    case "edit": return "編輯";
    case "export": return "匯出";
    default: return type;
  }
}

export function VersionHistory({
  projectId,
  onSelectMidi,
}: {
  projectId: string;
  onSelectMidi?: (midi: MidiData) => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  const restoreCommit = useProjectStore((s) => s.restoreCommit);
  const project = projects.find((p) => p.id === projectId);
  const commits = project?.commits ?? [];

  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  if (commits.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-gray-400">
        <p className="mb-1">尚無版本記錄</p>
        <p>在聊天模式生成音樂後，</p>
        <p>每次結果會自動記錄在這裡</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full scrollbar-thin">
      <div className="relative pl-6 py-2">
        {/* Vertical timeline line */}
        <div className="absolute left-2.5 top-4 bottom-4 w-px bg-gray-200" />

        {[...commits].reverse().map((commit) => (
          <div key={commit.id} className="relative pb-3">
            {/* Dot */}
            <div className={`absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
              commit.type === "generate" ? "bg-green-500"
              : commit.type === "edit" ? "bg-blue-500"
              : "bg-gray-400"
            }`} />

            <div className="bg-white rounded-lg border p-3 mx-1 hover:border-gray-300 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 mr-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      commit.type === "generate" ? "bg-green-50 text-green-700"
                      : commit.type === "edit" ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      {commitTypeLabel(commit.type)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{commit.id.slice(0, 7)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{commit.prompt}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(commit.timestamp)}</span>
              </div>

              {/* Message */}
              <p className="text-xs font-medium text-gray-700 mb-1">{commit.message}</p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => {
                  const midi = commit.midi;
                  if (isPlaying === commit.id) {
                    stopMusic();
                    setIsPlaying(null);
                  } else {
                    setIsPlaying(commit.id);
                    playMidi(midi).finally(() => setIsPlaying(null));
                  }
                }}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  {isPlaying === commit.id ? "■ 停止" : "▶ 播放"}
                </button>
                <button onClick={() => {
                  setExpandedCommit(expandedCommit === commit.id ? null : commit.id);
                }}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  {expandedCommit === commit.id ? "收合" : "檢視"}
                </button>
                <button onClick={() => {
                  restoreCommit(projectId, commit.id);
                }}
                  className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  ↩ 回復到此版本
                </button>
                <button onClick={() => downloadMidiJson(commit.midi, `commit-${commit.id.slice(0, 7)}.json`)}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ml-auto">
                  匯出
                </button>
              </div>

              {/* Expanded MIDI preview */}
              {expandedCommit === commit.id && (
                <div className="mt-2 pt-2 border-t space-y-1.5">
                  <MidiInfo midi={commit.midi} />
                  <div className="max-h-32 overflow-y-auto">
                    <MidiRoll midi={commit.midi} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}