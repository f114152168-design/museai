"use client";

import { useRef, useEffect, useState } from "react";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic } from "@/lib/synth";
import { getNoteName, getDurationSeconds } from "@/lib/midi";
import type { MidiData, MidiNote } from "@/lib/midi";

const CHANNEL_COLORS = [
  "#7c3aed", // 0 Kick
  "#ef4444", // 1 Snare
  "#f59e0b", // 2 HiHat
  "#10b981", // 3 Bass
  "#06b6d4", // 4 Pad
  "#f97316", // 5 Lead
];

const CHANNEL_ICONS = ["🥁", "🥁", "🔔", "🎸", "🎹", "🎻"];

const LANE_HEIGHT = 64;
const RULER_HEIGHT = 24;
const TRACK_LIST_WIDTH = 180;
const PX_PER_BEAT = 40;

function parseLastMidi(tracks: { midiData?: string }[]): MidiData | null {
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].midiData) {
      try { return JSON.parse(tracks[i].midiData!) as MidiData; } catch {}
    }
  }
  return null;
}

export function TimelineMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  const updateTrack = useProjectStore((s) => s.updateTrack);

  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNote, setHoveredNote] = useState<{ track: string; note: MidiNote } | null>(null);

  if (!project) return null;

  const midi = parseLastMidi(project.tracks);
  const lanes = midi?.tracks.map((t, i) => ({
    ...t,
    color: CHANNEL_COLORS[t.channel] ?? CHANNEL_COLORS[i],
    icon: CHANNEL_ICONS[t.channel] ?? "🎵",
  })) ?? [];

  const totalBeats = midi?.totalBeats ?? 16;
  const canvasWidth = TRACK_LIST_WIDTH + totalBeats * PX_PER_BEAT + 40;
  const canvasHeight = RULER_HEIGHT + lanes.length * LANE_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Time ruler
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(TRACK_LIST_WIDTH, 0, canvasWidth - TRACK_LIST_WIDTH, RULER_HEIGHT);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TRACK_LIST_WIDTH, RULER_HEIGHT);
    ctx.lineTo(canvasWidth, RULER_HEIGHT);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = TRACK_LIST_WIDTH + beat * PX_PER_BEAT;
      ctx.fillStyle = beat % 4 === 0 ? "#94a3b8" : "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, RULER_HEIGHT + lanes.length * LANE_HEIGHT);
      ctx.stroke();
      if (beat % 4 === 0) {
        ctx.fillStyle = "#64748b";
        ctx.fillText(`${beat / 4 + 1}`, x, RULER_HEIGHT - 6);
      }
    }

    // Track lanes
    for (let t = 0; t < lanes.length; t++) {
      const lane = lanes[t];
      const y = RULER_HEIGHT + t * LANE_HEIGHT;

      // Lane bg
      ctx.fillStyle = t % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(0, y, canvasWidth, LANE_HEIGHT);

      // Track strip (left area)
      ctx.fillStyle = lane.color + "15";
      ctx.fillRect(0, y, TRACK_LIST_WIDTH, LANE_HEIGHT);
      ctx.fillStyle = lane.color;
      ctx.fillRect(0, y, 4, LANE_HEIGHT);

      ctx.fillStyle = "#1e293b";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${lane.icon} ${lane.name}`, 12, y + LANE_HEIGHT / 2 + 4);

      // MIDI notes
      for (const note of lane.notes) {
        const nx = TRACK_LIST_WIDTH + note.startTime * PX_PER_BEAT;
        const ny = y + 4;
        const nw = Math.max(4, note.duration * PX_PER_BEAT);
        const nh = LANE_HEIGHT - 8;

        ctx.fillStyle = lane.color;
        ctx.globalAlpha = 0.3 + note.velocity * 0.5;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, nh, 3);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, nh, 3);
        ctx.stroke();

        // Note name label for longer notes
        if (nw > 20) {
          ctx.fillStyle = "#1e293b";
          ctx.font = "9px monospace";
          ctx.textAlign = "left";
          ctx.fillText(getNoteName(note.pitch), nx + 4, ny + nh / 2 + 3);
        }
      }

      // Lane bottom border
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_HEIGHT);
      ctx.lineTo(canvasWidth, y + LANE_HEIGHT);
      ctx.stroke();
    }

    // Separator between track list and piano roll
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TRACK_LIST_WIDTH, 0);
    ctx.lineTo(TRACK_LIST_WIDTH, RULER_HEIGHT + lanes.length * LANE_HEIGHT);
    ctx.stroke();
  }, [midi, canvasWidth, canvasHeight, lanes, totalBeats]);

  const handlePlay = async () => {
    if (!midi) return;
    setIsPlaying(true);
    await playMidi(midi);
    setIsPlaying(false);
  };

  const handleStop = () => {
    stopMusic();
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Transport bar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-white">
        <div className="flex items-center gap-1.5">
          <button onClick={handlePlay} disabled={!midi || isPlaying}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-40 flex items-center gap-1">
            ▶ 播放
          </button>
          <button onClick={handleStop}
            className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-400 flex items-center gap-1">
            ■ 停止
          </button>
        </div>

        {midi && (
          <>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-600 font-medium">{midi.bpm} BPM</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{getDurationSeconds(midi).toFixed(0)}s</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{lanes.length} 軌 · {midi.totalBeats} 拍</span>
          </>
        )}
      </div>

      {/* Piano Roll Grid */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {lanes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <div className="text-center space-y-2">
              <p className="text-2xl">🎵</p>
              <p>尚無 MIDI 資料</p>
              <p className="text-xs">在聊天模式生成音樂後，會在此顯示各樂器音軌</p>
            </div>
          </div>
        ) : (
          <div className="relative" onMouseMove={(e) => {
            if (!canvasRef.current || !midi) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasWidth / rect.width;
            const scaleY = canvasHeight / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;

            if (mx < TRACK_LIST_WIDTH) { setHoveredNote(null); return; }
            const laneIdx = Math.floor((my - RULER_HEIGHT) / LANE_HEIGHT);
            if (laneIdx < 0 || laneIdx >= lanes.length) { setHoveredNote(null); return; }
            const beat = (mx - TRACK_LIST_WIDTH) / PX_PER_BEAT;
            const lane = lanes[laneIdx];
            const found = lane.notes.find(
              (n) => Math.abs(n.startTime - beat) < n.duration
            );
            setHoveredNote(found ? { track: lane.name, note: found } : null);
          }}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="min-w-full block"
              style={{ cursor: "crosshair" }}
            />

            {hoveredNote && (
              <div className="absolute bottom-2 left-2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-10">
                {hoveredNote.track} · {getNoteName(hoveredNote.note.pitch)} ·
                拍 {hoveredNote.note.startTime.toFixed(1)} ·
                長 {hoveredNote.note.duration.toFixed(2)} ·
                力度 {(hoveredNote.note.velocity * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}