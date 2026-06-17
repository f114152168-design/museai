"use client";

import { useRef, useEffect } from "react";
import type { MidiData, MidiNote } from "@/lib/midi";
import { getNoteName } from "@/lib/midi";

const NOTE_HEIGHT = 14;
const NOTE_WIDTH = 12;
const MARGIN_LEFT = 40;
const MARGIN_TOP = 20;

const CHANNEL_COLORS = [
  "#7c3aed", // 0 Kick - purple
  "#ef4444", // 1 Snare - red
  "#f59e0b", // 2 HiHat - amber
  "#10b981", // 3 Bass - green
  "#06b6d4", // 4 Pad - cyan
  "#f97316", // 5 FX - orange
  "#ec4899", // 6 Melody - pink
  "#8b5cf6", // other
];

function getChannelColor(channel: number): string {
  return CHANNEL_COLORS[channel] ?? CHANNEL_COLORS[CHANNEL_COLORS.length - 1];
}

export function MidiRoll({ midi, onNoteClick }: { midi: MidiData; onNoteClick?: (note: MidiNote) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const allNotes = midi.tracks.flatMap((t) => t.notes);
  const lowPitch = Math.max(0, Math.min(...allNotes.map((n) => n.pitch)) - 3);
  const highPitch = Math.min(127, Math.max(...allNotes.map((n) => n.pitch)) + 3);
  const pitchRange = highPitch - lowPitch + 1;
  const totalBeats = midi.totalBeats || 16;

  const canvasWidth = MARGIN_LEFT + totalBeats * NOTE_WIDTH + 20;
  const canvasHeight = MARGIN_TOP + pitchRange * NOTE_HEIGHT + 20;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;

    // Horizontal grid lines (per pitch)
    for (let i = 0; i < pitchRange; i++) {
      const y = MARGIN_TOP + i * NOTE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, y);
      ctx.lineTo(canvasWidth - 10, y);
      ctx.stroke();

      // Note name labels
      const pitch = highPitch - i;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(getNoteName(pitch), MARGIN_LEFT - 4, y + NOTE_HEIGHT / 2 + 3);
    }

    // Vertical grid lines (per beat)
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = MARGIN_LEFT + beat * NOTE_WIDTH;
      ctx.strokeStyle = beat % 4 === 0 ? "#cbd5e1" : "#e2e8f0";
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN_TOP);
      ctx.lineTo(x, MARGIN_TOP + pitchRange * NOTE_HEIGHT);
      ctx.stroke();

      // Beat labels
      if (beat % 4 === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${beat / 4 + 1}`, x, MARGIN_TOP - 4);
      }
    }

    // Draw notes
    for (const track of midi.tracks) {
      const color = getChannelColor(track.channel);
      for (const note of track.notes) {
        const y = MARGIN_TOP + (highPitch - note.pitch) * NOTE_HEIGHT;
        const x = MARGIN_LEFT + note.startTime * NOTE_WIDTH;
        const w = Math.max(4, note.duration * NOTE_WIDTH);
        const h = NOTE_HEIGHT - 1;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5 + note.velocity * 0.5;
        ctx.fillRect(x, y, w, h);

        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      }
    }
  }, [midi, canvasWidth, canvasHeight, pitchRange, totalBeats, lowPitch, highPitch, allNotes]);

  return (
    <div className="overflow-auto border rounded-lg bg-white max-h-80 scrollbar-thin">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="min-w-full"
        onClick={(e) => {
          if (!onNoteClick || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const scaleX = canvasWidth / rect.width;
          const scaleY = canvasHeight / rect.height;
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleY;
          const beat = (mx - MARGIN_LEFT) / NOTE_WIDTH;
          const pitch = highPitch - Math.floor((my - MARGIN_TOP) / NOTE_HEIGHT);

          for (const track of midi.tracks) {
            for (const note of track.notes) {
              if (note.pitch === pitch && Math.abs(note.startTime - beat) < note.duration) {
                onNoteClick(note);
                return;
              }
            }
          }
        }}
      />
    </div>
  );
}

export function MidiInfo({ midi }: { midi: MidiData }) {
  const totalNotes = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0);

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-gray-500">{midi.bpm} BPM</span>
      <span className="text-gray-500">|</span>
      <span className="text-gray-500">{midi.tracks.length} 軌</span>
      <span className="text-gray-500">|</span>
      <span className="text-gray-500">{totalNotes} 個音符</span>
      <span className="text-gray-500">|</span>
      <span className="text-gray-500">{midi.totalBeats || 16} 拍 ({(midi.totalBeats || 16) / 4} 小節)</span>
    </div>
  );
}

export function downloadMidiJson(midi: MidiData, filename: string = "museai-export.json") {
  const blob = new Blob([JSON.stringify(midi, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}