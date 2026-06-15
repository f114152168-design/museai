"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic, setLoop, initAudio } from "@/lib/synth";
import { getNoteName, getDurationSeconds, type MidiData, type MidiNote } from "@/lib/midi";

const CHANNEL_COLORS = ["#7c3aed","#ef4444","#f59e0b","#10b981","#06b6d4","#f97316","#8b5cf6","#ec4899","#14b8a6","#6366f1"];
const CHANNEL_ICONS = ["🥁","🥁","🔔","🎸","🎹","🎻","🎹","🔔","🎸","🥁"];

const STEPS = 16;
const STEP_W = 20;
const STEP_H = 24;
const ROW_H = 36;
const RACK_HEADER = 140;
const LANE_H = 48;
const RULER_H = 28;
const TITLE_H = 48;

export function TimelineMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));

  if (!project) return null;
  return <Timeline project={project} projectId={projectId} />;
}

function Timeline({ project, projectId }: { project: ReturnType<typeof useProjectStore.getState>["projects"][number]; projectId: string }) {
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const addCommit = useProjectStore((s) => s.addCommit);
  const addTrack = useProjectStore((s) => s.addTrack);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [playBeat, setPlayBeat] = useState(0);
  const [editingChannel, setEditingChannel] = useState(0);

  // Parse and maintain editable MIDI state
  const [midi, setMidi] = useState<MidiData | null>(() => {
    for (let i = project.tracks.length - 1; i >= 0; i--) {
      const d = project.tracks[i].midiData;
      if (d) try { return JSON.parse(d) as MidiData; } catch {}
    }
    return null;
  });

  const totalBeats = midi?.totalBeats ?? 16;
  const lanes = midi?.tracks.map((t, i) => ({
    ...t, color: CHANNEL_COLORS[t.channel] ?? CHANNEL_COLORS[i], icon: CHANNEL_ICONS[t.channel] ?? "🎵",
  })) ?? [];

  // Steps: for each channel, which steps are active
  function notesToSteps(notes: MidiNote[]): boolean[] {
    const steps = new Array(STEPS).fill(false);
    for (const n of notes) {
      const idx = Math.round(n.startTime * (STEPS / 16));
      if (idx >= 0 && idx < STEPS) steps[idx] = true;
    }
    return steps;
  }

  function stepsToNotes(steps: boolean[], channel: number, pitch: number): MidiNote[] {
    return steps.map((on, i) => on ? { pitch, startTime: (i / STEPS) * 16, duration: 0.8, velocity: 0.8, channel } : null).filter(Boolean) as MidiNote[];
  }

  function toggleStep(channel: number, stepIdx: number) {
    if (!midi) return;
    const tIdx = midi.tracks.findIndex((t) => t.channel === channel);
    if (tIdx < 0) return;
    const track = midi.tracks[tIdx];
    const pitch = track.notes.length > 0 ? track.notes[0].pitch : 60 + channel * 2;
    const steps = notesToSteps(track.notes);
    steps[stepIdx] = !steps[stepIdx];
    const newNotes = stepsToNotes(steps, channel, pitch);
    const newTracks = [...midi.tracks];
    newTracks[tIdx] = { ...track, notes: newNotes };
    const newMidi = { ...midi, tracks: newTracks };
    setMidi(newMidi);
  }

  // Canvas dimensions
  const bars = Math.ceil(totalBeats / 4);
  const pxPerBar = 100;
  const plWidth = bars * pxPerBar + 40;
  const cvsWidth = RACK_HEADER + STEPS * STEP_W + 60 + plWidth;
  const cvsHeight = TITLE_H + RULER_H + Math.max(lanes.length * ROW_H, lanes.length * LANE_H, 200) + 40;

  // Rack area
  const rackW = RACK_HEADER + STEPS * STEP_W + 40;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // ── Canvas paint ──
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvsWidth, cvsHeight);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, cvsWidth, cvsHeight);

    // ── Top Transport bar ──
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, cvsWidth, TITLE_H);
    ctx.strokeStyle = "#2a2a3e";
    ctx.beginPath(); ctx.moveTo(0, TITLE_H); ctx.lineTo(cvsWidth, TITLE_H); ctx.stroke();

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Museai · ${midi?.bpm ?? 120} BPM · ${lanes.length} 軌 · ${bars} 小節`, 14, 30);

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("時間軸模式", cvsWidth - 14, 30);

    // ── CHANNEL RACK ──
    const rackY = TITLE_H;
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, rackY, rackW, cvsHeight - rackY);
    ctx.strokeStyle = "#2a2a3e";
    ctx.beginPath(); ctx.moveTo(rackW, rackY); ctx.lineTo(rackW, cvsHeight); ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("CHANNEL RACK", 10, rackY + 16);

    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const y = rackY + 26 + i * ROW_H;
      const sel = editingChannel === lane.channel;

      ctx.fillStyle = sel ? "#252540" : (i % 2 ? "#1f1f35" : "#1a1a2e");
      ctx.fillRect(0, y, rackW, ROW_H);
      ctx.fillStyle = lane.color;
      ctx.fillRect(0, y, 3, ROW_H);

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.fillText(`${lane.channel}`, 8, y + ROW_H / 2 + 3);
      ctx.font = "12px sans-serif";
      ctx.fillText(lane.icon, 24, y + ROW_H / 2 + 4);
      ctx.fillStyle = sel ? "#e2e8f0" : "#94a3b8";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(lane.name, 44, y + ROW_H / 2 + 4);

      // Step buttons
      const steps = notesToSteps(lane.notes);
      for (let s = 0; s < STEPS; s++) {
        const sx = RACK_HEADER + s * STEP_W;
        const on = steps[s];
        const beat = s % 4 === 0;
        ctx.fillStyle = on ? lane.color + "dd" : (beat ? "#2a2a3e" : "#252540");
        ctx.beginPath();
        ctx.roundRect(sx + 1, y + 6, STEP_W - 2, ROW_H - 12, 2);
        ctx.fill();
        if (on) { ctx.strokeStyle = "#ffffff44"; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
    }

    // ── PLAYLIST ──
    const plX = rackW + 20;
    const plWid = cvsWidth - plX - 10;

    // Ruler
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(plX, TITLE_H, plWid, RULER_H);
    ctx.strokeStyle = "#2a2a3e";
    ctx.beginPath(); ctx.moveTo(plX, TITLE_H + RULER_H); ctx.lineTo(cvsWidth, TITLE_H + RULER_H); ctx.stroke();

    const ppb = (plWid - 20) / bars;
    for (let b = 0; b <= bars; b++) {
      const bx = plX + 10 + b * ppb;
      ctx.strokeStyle = b % 4 === 0 ? "#4a4a6a" : "#2a2a3e";
      ctx.lineWidth = b % 4 === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(bx, TITLE_H); ctx.lineTo(bx, TITLE_H + RULER_H); ctx.stroke();
      if (b % 4 === 0) { ctx.fillStyle = "#94a3b8"; ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${b + 1}`, bx, TITLE_H + RULER_H - 6); }
    }

    // Lanes
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const py = TITLE_H + RULER_H + i * LANE_H;
      ctx.fillStyle = i % 2 ? "#1f1f35" : "#1a1a2e";
      ctx.fillRect(plX, py, plWid, LANE_H);

      // Lane label
      ctx.fillStyle = lane.color + "30";
      ctx.fillRect(plX, py, 60, LANE_H);
      ctx.fillStyle = lane.color;
      ctx.fillRect(plX, py, 3, LANE_H);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${lane.icon} ${lane.name}`, plX + 6, py + LANE_H / 2 + 3);

      // Note blocks per bar
      for (let b = 0; b < bars; b++) {
        const barNotes = lane.notes.filter((n) => n.startTime >= b * 4 && n.startTime < (b + 1) * 4);
        if (barNotes.length === 0) continue;
        const cx = plX + 10 + b * ppb;
        const cw = ppb - 3;

        ctx.fillStyle = lane.color + "50";
        ctx.beginPath(); ctx.roundRect(cx, py + 3, cw, LANE_H - 6, 3); ctx.fill();
        ctx.strokeStyle = lane.color + "77";
        ctx.lineWidth = 0.5; ctx.stroke();

        // Mini note lines
        for (const n of barNotes) {
          const relBeat = n.startTime - b * 4;
          const nnx = cx + (relBeat / 4) * cw;
          const nnw = Math.max(1, (n.duration / 4) * cw);
          const nnYrange = LANE_H - 10;
          const nny = py + 4 + (1 - (n.pitch - 36) / 60) * nnYrange;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(nnx, nny, nnw, 1.5);
        }
      }

      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(plX, py + LANE_H); ctx.lineTo(cvsWidth, py + LANE_H); ctx.stroke();
    }

    // Play position
    if (isPlaying) {
      const posX = plX + 10 + (playBeat / totalBeats) * (plWid - 20);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(posX, TITLE_H); ctx.lineTo(posX, cvsHeight); ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.moveTo(posX - 4, TITLE_H); ctx.lineTo(posX + 4, TITLE_H); ctx.lineTo(posX, TITLE_H + 7); ctx.closePath(); ctx.fill();
    }

  }, [midi, cvsWidth, cvsHeight, lanes, bars, isPlaying, playBeat, editingChannel, rackW, totalBeats]);

  // ── Handlers ──
  const getMidiFromProject = useCallback((): MidiData | null => {
    for (let i = project.tracks.length - 1; i >= 0; i--) {
      const d = project.tracks[i].midiData;
      if (d) try { return JSON.parse(d) as MidiData; } catch {}
    }
    return midi;
  }, [project.tracks, midi]);

  const handlePlay = useCallback(async () => {
    if (!midi) return;
    await initAudio();
    setLoop(loopOn);
    setIsPlaying(true);
    setPlayBeat(0);

    const durBeats = totalBeats;
    const startTime = Date.now();
    const durMs = getDurationSeconds(midi) * 1000;

    // Animation loop for play position
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durMs, 1);
      setPlayBeat(progress * durBeats);
      if (progress < 1 && isPlaying) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);

    await playMidi(midi);
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setPlayBeat(0);
  }, [midi, totalBeats, loopOn, isPlaying]);

  const handleStop = useCallback(() => {
    stopMusic();
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setPlayBeat(0);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const sx = cvsWidth / r.width;
    const sy = cvsHeight / r.height;
    const mx = (e.clientX - r.left) * sx;
    const my = (e.clientY - r.top) * sy;

    // Click on channel rack steps
    const rackY = TITLE_H;
    if (mx < rackW && my > rackY + 26) {
      const row = Math.floor((my - rackY - 26) / ROW_H);
      if (row >= 0 && row < lanes.length) {
        const lane = lanes[row];
        setEditingChannel(lane.channel);
        const stepX = Math.floor((mx - RACK_HEADER) / STEP_W);
        if (stepX >= 0 && stepX < STEPS) {
          toggleStep(lane.channel, stepX);
        }
      }
    }
  }, [cvsWidth, cvsHeight, lanes, rackW, editingChannel]);

  const handleSave = useCallback(() => {
    if (!midi || !project) return;
    // Save current MIDI state back to project
    addTrack(projectId, {
      name: "Timeline Edit",
      type: "MIDI",
      midiData: JSON.stringify(midi),
      duration: getDurationSeconds(midi),
      order: Date.now(),
    });
    addCommit(projectId, { prompt: "時間軸編輯", midi, type: "edit" });
  }, [midi, project, projectId, addTrack, addCommit]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Floating Transport */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-[#0f0f1a]/90 backdrop-blur rounded-lg border border-[#2a2a3e] px-2.5 py-1.5 shadow-xl">
        <button onClick={isPlaying ? handleStop : handlePlay}
          className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${isPlaying ? "bg-red-500 text-white" : "bg-green-500 text-black hover:bg-green-400"}`}>
          {isPlaying ? "■" : "▶"}
        </button>
        <button onClick={() => { const v = !loopOn; setLoopOn(v); setLoop(v); }}
          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${loopOn ? "bg-amber-500 text-black" : "bg-[#252540] text-gray-400"}`}>
          🔁
        </button>
        <span className="text-[#3b82f6] text-xs font-mono font-bold">{midi?.bpm ?? 120}</span>
        <span className="text-[#22c55e] text-xs font-mono">{getDurationSeconds(midi ?? { bpm: 120, totalBeats: 16 } as MidiData).toFixed(0)}s</span>
        {midi && (
          <button onClick={handleSave}
            className="ml-1 px-2 py-1 rounded text-[10px] bg-blue-600 text-white hover:bg-blue-500 font-medium">
            儲存
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <canvas ref={canvasRef} width={cvsWidth} height={cvsHeight} className="block"
          onClick={handleCanvasClick} style={{ cursor: "crosshair" }} />
      </div>

      {/* Editing hint */}
      {lanes.length > 0 && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-[#0f0f1a]/80 text-[10px] text-gray-400 border border-[#2a2a3e]">
          點擊 Channel Rack 的方格開關音符 · 選擇樂器音軌編輯
        </div>
      )}
    </div>
  );
}