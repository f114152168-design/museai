"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic } from "@/lib/synth";
import { getNoteName, getDurationSeconds } from "@/lib/midi";
import type { MidiData, MidiNote } from "@/lib/midi";

const CHANNEL_COLORS = [
  "#7c3aed", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#f97316",
  "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
];

const CHANNEL_ICONS = ["🥁", "🥁", "🔔", "🎸", "🎹", "🎻", "🎹", "🔔", "🎸", "🥁"];

const STEPS_PER_BAR = 16;
const STEP_WIDTH = 18;
const STEP_HEIGHT = 22;
const ROW_HEIGHT = 34;
const RACK_HEADER_WIDTH = 160;
const RACK_WIDTH = RACK_HEADER_WIDTH + STEPS_PER_BAR * STEP_WIDTH + 40;
const PLAYLIST_LANE_HEIGHT = 48;
const RULER_HEIGHT = 28;
const TRANSPORT_HEIGHT = 44;

function parseLastMidi(tracks: { midiData?: string }[]): MidiData | null {
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].midiData) {
      try { return JSON.parse(tracks[i].midiData!) as MidiData; } catch {}
    }
  }
  return null;
}

function midiToSteps(midi: MidiData, totalBars: number): Map<number, boolean[]> {
  const stepsMap = new Map<number, boolean[]>();
  for (const track of midi.tracks) {
    const steps = new Array(totalBars * STEPS_PER_BAR).fill(false);
    for (const note of track.notes) {
      const stepIdx = Math.floor(note.startTime * (STEPS_PER_BAR / 4));
      if (stepIdx < steps.length) steps[stepIdx] = true;
    }
    stepsMap.set(track.channel, steps);
  }
  return stepsMap;
}

export function TimelineMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  const updateTrack = useProjectStore((s) => s.updateTrack);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [showPattern, setShowPattern] = useState<"pattern" | "song">("song");
  const [selectedChannel, setSelectedChannel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  if (!project) return null;

  const midi = parseLastMidi(project.tracks);
  const totalBars = midi ? Math.ceil((midi.totalBeats || 16) / 4) : 4;
  const lanes = midi?.tracks.map((t, i) => ({
    ...t,
    color: CHANNEL_COLORS[t.channel] ?? CHANNEL_COLORS[i],
    icon: CHANNEL_ICONS[t.channel] ?? "🎵",
  })) ?? [];

  const stepsMap = midi ? midiToSteps(midi, totalBars) : new Map<number, boolean[]>();

  const canvasWidth = Math.max(800, RACK_WIDTH + totalBars * STEPS_PER_BAR * STEP_WIDTH / 4 + 40);
  const canvasHeight = TRANSPORT_HEIGHT + RULER_HEIGHT + lanes.length * PLAYLIST_LANE_HEIGHT + 20;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // === TRANSPORT BAR ===
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, canvasWidth, TRANSPORT_HEIGHT);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TRANSPORT_HEIGHT);
    ctx.lineTo(canvasWidth, TRANSPORT_HEIGHT);
    ctx.stroke();

    // Play button
    ctx.fillStyle = isPlaying ? "#22c55e" : "#4ade80";
    ctx.beginPath();
    ctx.roundRect(12, 10, 56, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isPlaying ? "■" : "▶", 40, 26);

    // BPM display
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(80, 10, 70, 24, 4);
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${midi?.bpm ?? 120}`, 115, 26);

    // Time display
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(160, 10, 100, 24, 4);
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 12px monospace";
    const dur = midi ? getDurationSeconds(midi) : 0;
    const min = Math.floor(dur / 60);
    const sec = Math.floor(dur % 60);
    const ms = Math.floor((dur % 1) * 100);
    ctx.fillText(`${min}:${String(sec).padStart(2, "0")}:${String(ms).padStart(2, "0")}`, 210, 26);

    // Pattern/Song selector
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(270, 10, 44, 24, 4);
    ctx.fill();
    ctx.fillStyle = showPattern === "pattern" ? "#f59e0b" : "#64748b";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("PAT", 292, 26);

    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(318, 10, 44, 24, 4);
    ctx.fill();
    ctx.fillStyle = showPattern === "song" ? "#22c55e" : "#64748b";
    ctx.fillText("SONG", 340, 26);

    // Track count
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${lanes.length} 軌 · ${totalBars} 小節`, canvasWidth - 16, 26);

    // === CHANNEL RACK HEADER ===
    const rackY = TRANSPORT_HEIGHT;
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, rackY, RACK_WIDTH, canvasHeight - rackY);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RACK_WIDTH, rackY);
    ctx.lineTo(RACK_WIDTH, canvasHeight);
    ctx.stroke();

    // Channel rack title
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("CHANNEL RACK", 12, rackY + 18);

    // === CHANNEL RACK ROWS ===
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const y = rackY + RULER_HEIGHT + i * ROW_HEIGHT;
      const isSelected = selectedChannel === lane.channel;

      // Row bg
      ctx.fillStyle = isSelected ? "#252540" : (i % 2 === 0 ? "#1a1a2e" : "#1f1f35");
      ctx.fillRect(0, y, RACK_WIDTH, ROW_HEIGHT);

      // Color indicator
      ctx.fillStyle = lane.color;
      ctx.fillRect(0, y, 4, ROW_HEIGHT);

      // Channel number
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${lane.channel}`, 8, y + ROW_HEIGHT / 2 + 3);

      // Icon
      ctx.font = "12px sans-serif";
      ctx.fillText(lane.icon, 22, y + ROW_HEIGHT / 2 + 4);

      // Name
      ctx.fillStyle = isSelected ? "#e2e8f0" : "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.fillText(lane.name, 38, y + ROW_HEIGHT / 2 + 4);

      // Step sequencer buttons
      const steps = stepsMap.get(lane.channel) ?? new Array(STEPS_PER_BAR).fill(false);
      const firstBarSteps = steps.slice(0, STEPS_PER_BAR);
      for (let s = 0; s < firstBarSteps.length; s++) {
        const sx = RACK_HEADER_WIDTH + s * STEP_WIDTH;
        const isOn = firstBarSteps[s];
        const isBeat = s % 4 === 0;

        ctx.fillStyle = isOn ? lane.color + "dd" : (isBeat ? "#2a2a3e" : "#252540");
        ctx.beginPath();
        ctx.roundRect(sx + 1, y + 6, STEP_WIDTH - 2, ROW_HEIGHT - 12, 2);
        ctx.fill();

        if (isOn) {
          ctx.strokeStyle = lane.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Track count label
      ctx.fillStyle = "#4a4a6a";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${lane.notes.length}`, RACK_WIDTH - 8, y + ROW_HEIGHT / 2 + 3);
    }

    // === PLAYLIST AREA ===
    const playlistX = RACK_WIDTH;
    const playlistWidth = canvasWidth - playlistX;

    // Ruler
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(playlistX, TRANSPORT_HEIGHT, playlistWidth, RULER_HEIGHT);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playlistX, TRANSPORT_HEIGHT + RULER_HEIGHT);
    ctx.lineTo(canvasWidth, TRANSPORT_HEIGHT + RULER_HEIGHT);
    ctx.stroke();

    // Ruler bars
    const pxPerBar = (playlistWidth - 20) / totalBars;
    for (let bar = 0; bar <= totalBars; bar++) {
      const bx = playlistX + 10 + bar * pxPerBar;
      ctx.strokeStyle = bar % 4 === 0 ? "#4a4a6a" : "#2a2a3e";
      ctx.lineWidth = bar % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, TRANSPORT_HEIGHT);
      ctx.lineTo(bx, TRANSPORT_HEIGHT + RULER_HEIGHT);
      ctx.stroke();

      if (bar % 4 === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${bar + 1}`, bx, TRANSPORT_HEIGHT + 18);
      }
    }

    // Playlist lanes
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const py = TRANSPORT_HEIGHT + RULER_HEIGHT + i * PLAYLIST_LANE_HEIGHT;
      const isEven = i % 2 === 0;

      // Lane bg
      ctx.fillStyle = isEven ? "#1a1a2e" : "#1f1f35";
      ctx.fillRect(playlistX, py, playlistWidth, PLAYLIST_LANE_HEIGHT);

      // Track label
      ctx.fillStyle = lane.color + "40";
      ctx.fillRect(playlistX, py, 80, PLAYLIST_LANE_HEIGHT);
      ctx.fillStyle = lane.color;
      ctx.fillRect(playlistX, py, 3, PLAYLIST_LANE_HEIGHT);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${lane.icon} ${lane.name}`, playlistX + 8, py + PLAYLIST_LANE_HEIGHT / 2 + 3);

      // MIDI clips/blocks
      for (let bar = 0; bar < totalBars; bar++) {
        const barStartBeat = bar * 4;
        const barEndBeat = (bar + 1) * 4;
        const barNotes = lane.notes.filter(
          (n) => n.startTime < barEndBeat && n.startTime + n.duration > barStartBeat
        );

        if (barNotes.length > 0) {
          const cx = playlistX + 10 + bar * pxPerBar;
          const cw = pxPerBar - 4;

          // Clip block
          ctx.fillStyle = lane.color + "55";
          ctx.beginPath();
          ctx.roundRect(cx, py + 4, cw, PLAYLIST_LANE_HEIGHT - 8, 3);
          ctx.fill();

          ctx.strokeStyle = lane.color + "88";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Mini note lines inside clip
          for (const note of barNotes) {
            const noteBarStart = Math.max(barStartBeat, note.startTime);
            const noteBarEnd = Math.min(barEndBeat, note.startTime + note.duration);
            const nx = cx + ((noteBarStart - barStartBeat) / 4) * cw;
            const nw = ((noteBarEnd - noteBarStart) / 4) * cw;
            const pitchRange = 127 - 0;
            const ny = py + 4 + ((127 - note.pitch) / pitchRange) * (PLAYLIST_LANE_HEIGHT - 8);
            const nh = 2;

            ctx.fillStyle = lane.color;
            ctx.fillRect(nx, ny, Math.max(1, nw), nh);
          }

          // Beat grid lines inside clip
          for (let b = 0; b < 4; b++) {
            const bx = cx + (b / 4) * cw;
            ctx.strokeStyle = "#ffffff15";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bx, py + 4);
            ctx.lineTo(bx, py + PLAYLIST_LANE_HEIGHT - 4);
            ctx.stroke();
          }
        }
      }

      // Lane bottom border
      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(playlistX, py + PLAYLIST_LANE_HEIGHT);
      ctx.lineTo(canvasWidth, py + PLAYLIST_LANE_HEIGHT);
      ctx.stroke();
    }

    // Play position line
    if (isPlaying && playPosition > 0) {
      const posX = playlistX + 10 + (playPosition / totalBars) * (playlistWidth - 20);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(posX, TRANSPORT_HEIGHT);
      ctx.lineTo(posX, canvasHeight);
      ctx.stroke();

      // Triangle head
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(posX - 5, TRANSPORT_HEIGHT);
      ctx.lineTo(posX + 5, TRANSPORT_HEIGHT);
      ctx.lineTo(posX, TRANSPORT_HEIGHT + 8);
      ctx.closePath();
      ctx.fill();
    }

    // Grid lines
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 0.5;
    for (let bar = 0; bar <= totalBars; bar++) {
      const gx = playlistX + 10 + bar * pxPerBar;
      ctx.beginPath();
      ctx.moveTo(gx, TRANSPORT_HEIGHT + RULER_HEIGHT);
      ctx.lineTo(gx, canvasHeight);
      ctx.stroke();
    }

  }, [midi, canvasWidth, canvasHeight, lanes, totalBars, isPlaying, playPosition, selectedChannel, showPattern, stepsMap]);

  const handlePlay = useCallback(async () => {
    if (!midi) return;
    setIsPlaying(true);
    setPlayPosition(0);
    const dur = getDurationSeconds(midi);
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / dur, 1);
      setPlayPosition(progress * totalBars);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    await playMidi(midi);
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setPlayPosition(0);
  }, [midi, totalBars]);

  const handleStop = useCallback(() => {
    stopMusic();
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setPlayPosition(0);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Click on channel rack steps
    if (mx < RACK_WIDTH && my > TRANSPORT_HEIGHT + RULER_HEIGHT) {
      const rowIdx = Math.floor((my - TRANSPORT_HEIGHT - RULER_HEIGHT) / ROW_HEIGHT);
      if (rowIdx >= 0 && rowIdx < lanes.length) {
        setSelectedChannel(lanes[rowIdx].channel);
        const stepIdx = Math.floor((mx - RACK_HEADER_WIDTH) / STEP_WIDTH);
        if (stepIdx >= 0 && stepIdx < STEPS_PER_BAR) {
          // Toggle step visual feedback
          const lane = lanes[rowIdx];
          const steps = stepsMap.get(lane.channel) ?? [];
          if (stepIdx < steps.length) {
            steps[stepIdx] = !steps[stepIdx];
          }
        }
      }
    }
  }, [lanes, stepsMap, canvasWidth, canvasHeight]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Floating Transport Controls */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#0f0f1a]/90 backdrop-blur rounded-lg border border-[#2a2a3e] px-3 py-1.5 shadow-xl">
        <button onClick={isPlaying ? handleStop : handlePlay}
          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
            isPlaying ? "bg-red-500 text-white" : "bg-green-500 text-black hover:bg-green-400"
          }`}>
          {isPlaying ? "■" : "▶"}
        </button>
        <div className="text-[#3b82f6] text-xs font-mono font-bold">{midi?.bpm ?? 120}</div>
        <div className="text-[#22c55e] text-xs font-mono">{getDurationSeconds(midi ?? { bpm: 120, totalBeats: 16 } as MidiData).toFixed(0)}s</div>
        <div className="text-[#64748b] text-[10px]">{lanes.length} 軌</div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="block"
          onClick={handleCanvasClick}
          style={{ cursor: "crosshair" }}
        />
      </div>
    </div>
  );
}