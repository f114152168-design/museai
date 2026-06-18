"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/lib/store";
import {
  playMidi, stopMusic, pauseMidi, resumeMidi, seekToBeat,
  setLoop, initAudio, getCurrentBeat, isPaused as getIsPaused,
} from "@/lib/synth";
import { getNoteName, getDurationSeconds, type MidiData, type MidiNote } from "@/lib/midi";

const CHANNEL_COLORS = ["#7c3aed","#ef4444","#f59e0b","#10b981","#06b6d4","#f97316","#ec4899","#8b5cf6","#14b8a6","#6366f1"];
const CHANNEL_ICONS = ["🥁","🥁","🔔","🎸","🎹","🎻","🎹","🔔","🎸","🥁"];

const TITLE_H = 44;
const RULER_H = 26;
const TRACK_W = 120;
const KEY_W = 36;
const NOTE_H = 10;
const LANE_PAD = 6;
const PX_PER_BEAT = 48;

/** Merge all project tracks into a single MidiData for timeline display */
function mergeTracks(tracks: { midiData?: string }[]): MidiData | null {
  const allNotes: MidiNote[] = [];
  let bpm = 120;
  let totalBeats = 32;

  for (const track of tracks) {
    if (!track.midiData) continue;
    try {
      const midi = JSON.parse(track.midiData) as MidiData;
      if (midi.bpm) bpm = midi.bpm;
      if (midi.totalBeats && midi.totalBeats > totalBeats) totalBeats = midi.totalBeats;
      for (const t of midi.tracks) {
        allNotes.push(...t.notes);
      }
    } catch {}
  }

  if (allNotes.length === 0) return null;

  // Group notes by channel
  const channelMap = new Map<number, MidiNote[]>();
  for (const note of allNotes) {
    const ch = note.channel ?? 0;
    if (!channelMap.has(ch)) channelMap.set(ch, []);
    channelMap.get(ch)!.push(note);
  }

  const mergedTracks = Array.from(channelMap.entries()).map(([ch, notes]) => ({
    name: ["Kick","Snare","HiHat","Bass","Chord","FX","Melody"][ch] ?? `Ch ${ch}`,
    channel: ch,
    instrument: "",
    notes: notes.sort((a, b) => a.startTime - b.startTime),
  }));

  return { bpm, totalBeats, tracks: mergedTracks };
}

function getNoteRange(tracks: MidiData["tracks"]): { low: number; high: number } {
  let low = 127, high = 0;
  for (const t of tracks) {
    for (const n of t.notes) {
      if (n.pitch < low) low = n.pitch;
      if (n.pitch > high) high = n.pitch;
    }
  }
  if (low > high) { low = 36; high = 84; }
  return { low: Math.max(0, low - 2), high: Math.min(127, high + 2) };
}

function formatBeat(beat: number): string {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  return `${bar}:${beatInBar}`;
}

export function TimelineMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  if (!project) return null;
  return <Timeline project={project} projectId={projectId} />;
}

function Timeline({ project, projectId }: { project: ReturnType<typeof useProjectStore.getState>["projects"][number]; projectId: string }) {
  const addCommit = useProjectStore((s) => s.addCommit);
  const addTrack = useProjectStore((s) => s.addTrack);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [playBeat, setPlayBeat] = useState(0);
  const [showNoteNames, setShowNoteNames] = useState(true);

  const [midi, setMidi] = useState<MidiData | null>(null);

  // Reactive to project.tracks — merge ALL tracks
  useEffect(() => {
    const merged = mergeTracks(project.tracks);
    if (merged) setMidi(merged);
  }, [project.tracks]);

  const totalBeats = midi?.totalBeats ?? 16;
  const bars = Math.ceil(totalBeats / 4);
  const tracks = midi?.tracks ?? [];
  const noteRange = getNoteRange(tracks);
  const rangeSize = noteRange.high - noteRange.low + 1;
  const laneH = Math.max(rangeSize * NOTE_H + LANE_PAD * 2, 70);
  const lanes = tracks.map((t, i) => ({
    ...t,
    color: CHANNEL_COLORS[t.channel] ?? CHANNEL_COLORS[i],
    icon: CHANNEL_ICONS[t.channel] ?? "🎵",
  }));

  const plWidth = totalBeats * PX_PER_BEAT + 40;
  const cvsWidth = TRACK_W + KEY_W + plWidth;
  const cvsHeight = TITLE_H + RULER_H + lanes.length * laneH + 20;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvsWidth, cvsHeight);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, cvsWidth, cvsHeight);

    // ── Title ──
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, cvsWidth, TITLE_H);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, TITLE_H); ctx.lineTo(cvsWidth, TITLE_H); ctx.stroke();

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Museai · ${midi?.bpm ?? 120} BPM · ${tracks.length} 軌 · ${bars} 小節`, 14, 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("時間軸模式", cvsWidth - 14, 28);

    // ── Track Headers (left) ──
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, TITLE_H, TRACK_W, cvsHeight - TITLE_H);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TRACK_W, TITLE_H); ctx.lineTo(TRACK_W, cvsHeight); ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TRACKS", TRACK_W / 2, TITLE_H + 18);

    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const y = TITLE_H + RULER_H + i * laneH;

      ctx.fillStyle = lane.color + "15";
      ctx.fillRect(0, y, TRACK_W, laneH);
      ctx.fillStyle = lane.color;
      ctx.fillRect(0, y, 3, laneH);

      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lane.icon, TRACK_W / 2, y + laneH / 2 - 4);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(lane.name, TRACK_W / 2, y + laneH / 2 + 14);

      ctx.fillStyle = "#64748b";
      ctx.font = "8px sans-serif";
      ctx.fillText(`${lane.notes.length} notes`, TRACK_W / 2, y + laneH / 2 + 26);

      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, y + laneH); ctx.lineTo(TRACK_W, y + laneH); ctx.stroke();
    }

    // ── Piano Roll ──
    const plX = TRACK_W + KEY_W;

    // Draw key labels + grid per track
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const y = TITLE_H + RULER_H + i * laneH;

      for (let p = 0; p < rangeSize; p++) {
        const pitch = noteRange.high - p;
        const ny = y + LANE_PAD + p * NOTE_H;
        const isWhite = [0,2,4,5,7,9,11].includes(pitch % 12);
        const isC = pitch % 12 === 0;

        ctx.fillStyle = isWhite ? "#1a1a2e" : "#0f0f1a";
        ctx.fillRect(TRACK_W, ny, KEY_W, NOTE_H);

        if (isC && showNoteNames) {
          ctx.fillStyle = "#64748b";
          ctx.font = "7px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(getNoteName(pitch), TRACK_W + KEY_W - 3, ny + NOTE_H - 1);
        }
      }

      for (let p = 0; p < rangeSize; p++) {
        const ny = y + LANE_PAD + p * NOTE_H;
        ctx.strokeStyle = "#2a2a3e";
        ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(plX, ny); ctx.lineTo(cvsWidth, ny); ctx.stroke();
      }
    }

    // Vertical beat lines
    for (let b = 0; b < totalBeats; b++) {
      const bx = plX + b * PX_PER_BEAT;
      if (b % 4 === 0) { ctx.strokeStyle = "#4a4a6a"; ctx.lineWidth = 1; }
      else { ctx.strokeStyle = "#2a2a3e"; ctx.lineWidth = 0.3; }
      ctx.beginPath(); ctx.moveTo(bx, TITLE_H + RULER_H); ctx.lineTo(bx, cvsHeight); ctx.stroke();
    }

    // Ruler
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(plX, TITLE_H, plWidth, RULER_H);
    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(plX, TITLE_H + RULER_H); ctx.lineTo(cvsWidth, TITLE_H + RULER_H); ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    for (let b = 0; b <= totalBeats; b++) {
      const bx = plX + b * PX_PER_BEAT;
      if (b % 4 === 0) {
        ctx.fillText(`${b / 4 + 1}`, bx + 1, TITLE_H + RULER_H - 6);
      }
    }

    // ── Draw MIDI Notes ──
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const y = TITLE_H + RULER_H + i * laneH;

      for (const note of lane.notes) {
        const nx = plX + note.startTime * PX_PER_BEAT;
        const nw = Math.max(3, note.duration * PX_PER_BEAT - 1);
        const pitchIdx = noteRange.high - note.pitch;
        const ny = y + LANE_PAD + pitchIdx * NOTE_H;

        ctx.fillStyle = lane.color;
        ctx.globalAlpha = 0.35 + note.velocity * 0.5;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, NOTE_H - 1, 1.5);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = lane.color + "aa";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, NOTE_H - 1, 1.5);
        ctx.stroke();
      }
    }

    // ── Play position line ──
    if (isPlaying || getIsPaused()) {
      const posX = plX + (playBeat / totalBeats) * plWidth;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(posX, TITLE_H); ctx.lineTo(posX, cvsHeight); ctx.stroke();
    }

  }, [midi, cvsWidth, cvsHeight, lanes, tracks, bars, isPlaying, playBeat, noteRange, rangeSize, showNoteNames, plWidth, totalBeats]);

  // Playhead animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const animate = () => {
      setPlayBeat(getCurrentBeat());
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  const handlePlay = useCallback(async () => {
    if (!midi) return;
    await initAudio();
    setLoop(loopOn);
    setIsPlaying(true);

    await playMidi(midi);
    setIsPlaying(false);
    setPlayBeat(0);
  }, [midi, loopOn]);

  const handlePause = useCallback(() => {
    if (getIsPaused()) {
      resumeMidi();
      setIsPlaying(true);
    } else {
      pauseMidi();
      setIsPlaying(false);
    }
  }, []);

  const handleStop = useCallback(() => {
    stopMusic();
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setPlayBeat(0);
  }, []);

  // Click on ruler to seek
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!midi) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plX = TRACK_W + KEY_W;
    if (x < plX) return;
    const beat = ((x - plX) / PX_PER_BEAT);
    const clampedBeat = Math.max(0, Math.min(totalBeats, beat));
    seekToBeat(clampedBeat);
    setPlayBeat(clampedBeat);
  }, [midi, totalBeats]);

  const handleSave = useCallback(() => {
    if (!midi) return;
    addTrack(projectId, {
      name: "Timeline Edit", type: "MIDI",
      midiData: JSON.stringify(midi), duration: getDurationSeconds(midi), order: Date.now(),
    });
    addCommit(projectId, { prompt: "時間軸編輯", midi, type: "edit" });
  }, [midi, projectId, addTrack, addCommit]);

  const toggleNoteName = () => setShowNoteNames(!showNoteNames);

  const currentBar = Math.floor(playBeat / 4) + 1;
  const currentBeatInBar = Math.floor(playBeat % 4) + 1;
  const duration = midi ? getDurationSeconds(midi) : 0;
  const currentTime = midi ? (playBeat / (midi.bpm / 60)) : 0;

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Transport bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0f0f1a] border-b border-[#2a2a3e]">
        {/* Play / Pause / Stop */}
        <button onClick={isPlaying ? handlePause : handlePlay}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${isPlaying ? "bg-amber-500 text-black" : "bg-green-500 text-black hover:bg-green-400"}`}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={handleStop}
          className="px-3 py-1.5 rounded text-sm font-bold bg-[#252540] text-gray-400 hover:text-white transition-colors">
          ■
        </button>

        {/* Loop */}
        <button onClick={() => { const v = !loopOn; setLoopOn(v); setLoop(v); }}
          className={`px-2 py-1.5 rounded text-xs font-bold transition-colors ${loopOn ? "bg-amber-500 text-black" : "bg-[#252540] text-gray-400"}`}>
          🔁
        </button>

        <div className="w-px h-5 bg-[#2a2a3e] mx-1" />

        {/* Position display */}
        <div className="flex items-center gap-1.5">
          <span className="text-green-400 text-xs font-mono font-bold min-w-[40px]">{formatBeat(playBeat)}</span>
          <span className="text-gray-500 text-xs">/</span>
          <span className="text-gray-400 text-xs font-mono">{bars}</span>
        </div>

        <div className="w-px h-5 bg-[#2a2a3e] mx-1" />

        {/* BPM + Duration */}
        <span className="text-[#3b82f6] text-xs font-mono font-bold">{midi?.bpm ?? 120} BPM</span>
        <span className="text-gray-500 text-xs font-mono">{Math.floor(duration)}s</span>

        <div className="flex-1" />

        {/* Note names toggle */}
        <button onClick={toggleNoteName}
          className={`px-2 py-1 rounded text-[10px] font-medium ${showNoteNames ? "bg-blue-600 text-white" : "bg-[#252540] text-gray-400"}`}>
          🎹 音名
        </button>

        {/* Save */}
        {midi && (
          <button onClick={handleSave} className="px-2 py-1 rounded text-[10px] bg-blue-600 text-white hover:bg-blue-500 font-medium">
            儲存
          </button>
        )}
      </div>

      {/* Canvas — click to seek, accepts drops */}
      <div className="flex-1 overflow-auto scrollbar-thin"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/x-museai-midi");
          if (!raw) return;
          try {
            const dropped = JSON.parse(raw) as MidiData;
            addTrack(projectId, {
              name: `Melody ${dropped.bpm}BPM`,
              type: "MIDI",
              midiData: raw,
              duration: getDurationSeconds(dropped),
              order: Date.now(),
            });
            setMidi(dropped);
          } catch {}
        }}>
        <canvas ref={canvasRef} width={cvsWidth} height={cvsHeight} className="block" style={{ cursor: "crosshair" }}
          onClick={handleCanvasClick} />
      </div>

      {/* Legend */}
      {lanes.length > 0 && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-[#0f0f1a]/80 text-[10px] text-gray-400 border border-[#2a2a3e] flex items-center gap-2">
          {lanes.map((l) => (
            <span key={l.channel} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.icon}{l.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
