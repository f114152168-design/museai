"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { ChatMode } from "@/components/chat-mode";
import { TimelineMode } from "@/components/timeline-mode";
import { LiveCodingMode } from "@/components/live-coding-mode";
import { cn } from "@/lib/utils";

type Mode = "chat" | "timeline" | "livecode";

const modes: { key: Mode; label: string; icon: string }[] = [
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "timeline", label: "Timeline", icon: "🎛️" },
  { key: "livecode", label: "Live Code", icon: "⌨️" },
];

export default function ProjectEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const project = useProjectStore((s) => s.getProject(id));
  const updateProject = useProjectStore((s) => s.updateProject);

  const [mode, setMode] = useState<Mode>("chat");
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (project) setProjectName(project.name);
  }, [project]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Project not found</h2>
          <p className="text-gray-400">This project doesn't exist or has been deleted.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500"
          >
            Back to Dashboard
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
      {/* Project Header */}
      <div className="border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => updateProject(id, { name: projectName })}
            className="bg-transparent text-lg font-semibold focus:outline-none focus:bg-gray-800 px-2 py-1 rounded"
          />
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {project.bpm} BPM
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {project.key} {project.scale}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {project.timeSignature}
          </span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="border-b border-gray-800 px-4 flex">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              mode === m.key
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            <span>{m.icon}</span>
            {m.label}
          </button>
        ))}
        {project.tracks.length > 0 && (
          <div className="ml-auto flex items-center text-xs text-gray-500">
            {project.tracks.length} track{project.tracks.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Mode Content */}
      <div className="flex-1 overflow-hidden">
        <ModeComponent projectId={id} />
      </div>
    </div>
  );
}