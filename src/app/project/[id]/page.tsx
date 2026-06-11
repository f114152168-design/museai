"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectStore } from "@/lib/store";
import { ChatMode } from "@/components/chat-mode";
import { TimelineMode } from "@/components/timeline-mode";
import { LiveCodingMode } from "@/components/live-coding-mode";
import { cn } from "@/lib/utils";
import { getTier } from "@/lib/billing";

type Mode = "chat" | "timeline" | "livecode";

const modes: { key: Mode; label: string; icon: string }[] = [
  { key: "chat", label: "聊天生成", icon: "💬" },
  { key: "timeline", label: "時間軸", icon: "🎛️" },
  { key: "livecode", label: "即時編程", icon: "⌨️" },
];

export default function ProjectEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const project = useProjectStore((s) => s.getProject(id));
  const updateProject = useProjectStore((s) => s.updateProject);
  const hydrated = useProjectStore((s) => s.hydrated);

  const [mode, setMode] = useState<Mode>("chat");

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">找不到專案</h2>
          <p className="text-gray-500">此專案不存在或已被刪除。</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500"
          >
            返回儀表板
          </button>
        </div>
      </div>
    );
  }

  const ModeComponent = {
    chat: ChatMode,
    timeline: TimelineMode,
    livecode: LiveCodingMode,
  }[mode];

  return (
    <div className="flex-1 flex flex-col">
      {getTier() === "free" && (
        <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-cyan-50 border-b border-purple-200 flex items-center justify-between text-sm">
          <p className="text-xs text-gray-600">Free 方案 — 每次最多生成 30 秒循環。升級 Pro 解鎖完整編曲。</p>
          <a href="/pricing" className="shrink-0 text-xs px-3 py-1 rounded-full bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors">升級 Pro</a>
        </div>
      )}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <input
            type="text"
            defaultValue={project.name}
            onBlur={(e) => updateProject(id, { name: e.target.value })}
            className="bg-transparent text-lg font-semibold focus:outline-none focus:bg-gray-50 px-2 py-1 rounded"
          />
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {project.bpm} BPM
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {project.key} {project.scale}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {project.timeSignature}
          </span>
        </div>
      </div>

      <div className="border-b px-4 flex bg-white">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              mode === m.key
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <span>{m.icon}</span>
            {m.label}
          </button>
        ))}
        {hydrated && project.tracks.length > 0 && (
          <div className="ml-auto flex items-center text-xs text-gray-400">
            {project.tracks.length} 軌
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ModeComponent projectId={id} />
      </div>
    </div>
  );
}