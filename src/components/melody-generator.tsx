"use client";

import { useState, useCallback, useRef } from "react";
import { generateMelody, type MelodyParams } from "@/lib/melody-generator";
import { useProjectStore } from "@/lib/store";
import { playMidi, stopMusic } from "@/lib/synth";
import { getDurationSeconds } from "@/lib/midi";
import type { MidiData } from "@/lib/midi";

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = [
  { id: "minor", label: "小調" },
  { id: "major", label: "大調" },
  { id: "dorian", label: "多利安" },
  { id: "phrygian", label: "弗里吉安" },
  { id: "lydian", label: "利底安" },
  { id: "mixolydian", label: "混合利底安" },
];

export function MelodyGenerator({ projectId }: { projectId: string }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const [key, setKey] = useState("A");
  const [scale, setScale] = useState("minor");
  const [complexity, setComplexity] = useState(0.5);
  const [noteLength, setNoteLength] = useState(0.3);
  const [bpm, setBpm] = useState(128);
  const [bars, setBars] = useState(4);
  const [midi, setMidi] = useState<MidiData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(() => {
    const params: MelodyParams = { key, scale, complexity, noteLength, bpm, bars };
    const result = generateMelody(params);
    setMidi(result);
  }, [key, scale, complexity, noteLength, bpm, bars]);

  const handlePlay = useCallback(async () => {
    if (!midi) return;
    setIsPlaying(true);
    await playMidi(midi);
    setIsPlaying(false);
  }, [midi]);

  const handleStop = useCallback(() => {
    stopMusic();
    setIsPlaying(false);
  }, []);

  const handleAddToProject = useCallback(() => {
    if (!midi) return;
    addTrack(projectId, {
      name: `Melody ${key}${scale} (${bpm}BPM)`,
      type: "MIDI",
      midiData: JSON.stringify(midi),
      duration: getDurationSeconds(midi),
      order: Date.now(),
    });
  }, [midi, projectId, addTrack, key, scale, bpm]);

  // Drag-and-drop: serialize MIDI data into the drag event
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!midi) { e.preventDefault(); return; }
    e.dataTransfer.setData("application/x-museai-midi", JSON.stringify(midi));
    e.dataTransfer.setData("text/plain", `Melody ${key} ${scale}`);
    e.dataTransfer.effectAllowed = "copy";
    setIsDragging(true);
  }, [midi, key, scale]);

  const noteCount = midi?.tracks.reduce((s, t) => s + t.notes.length, 0) ?? 0;

  // Generate chord colors for the key
  const chordRoot = key;

  return (
    <div className="border-t bg-white">
      {/* Collapsible header */}
      <details className="group" open>
        <summary className="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-cyan-50 border-b cursor-pointer hover:from-purple-100 hover:to-cyan-100 transition-colors select-none flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🎼 旋律產生器</span>
          <span className="text-xs text-gray-400 group-open:rotate-90 transition-transform">▶</span>
        </summary>

        <div className="p-4 space-y-4">
          {/* Row 1: Key + Scale */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">調性</label>
              <select value={key} onChange={(e) => setKey(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm text-gray-900 bg-white focus:outline-none focus:border-purple-500">
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">音階</label>
              <select value={scale} onChange={(e) => setScale(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm text-gray-900 bg-white focus:outline-none focus:border-purple-500">
                {SCALES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="w-20">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">BPM</label>
              <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
                min={60} max={200}
                className="w-full px-2 py-1.5 rounded border text-sm text-gray-900 focus:outline-none focus:border-purple-500" />
            </div>
            <div className="w-16">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">小節</label>
              <input type="number" value={bars} onChange={(e) => setBars(Number(e.target.value))}
                min={1} max={16}
                className="w-full px-2 py-1.5 rounded border text-sm text-gray-900 focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          {/* Row 2: Sliders */}
          <div className="flex gap-6">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">
                複雜度 <span className="text-purple-600 font-bold">{Math.round(complexity * 100)}%</span>
              </label>
              <input type="range" min={0} max={1} step={0.01} value={complexity}
                onChange={(e) => setComplexity(Number(e.target.value))}
                className="w-full accent-purple-600" />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>簡單</span>
                <span>密集</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium block mb-1">
                音符長度 <span className="text-cyan-600 font-bold">{noteLength < 0.3 ? "短促" : noteLength < 0.6 ? "中等" : "連奏"}</span>
              </label>
              <input type="range" min={0} max={1} step={0.01} value={noteLength}
                onChange={(e) => setNoteLength(Number(e.target.value))}
                className="w-full accent-cyan-600" />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>Pluck</span>
                <span>Legato</span>
              </div>
            </div>
          </div>

          {/* Row 3: Preview + actions */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              {/* Mini preview */}
              {midi ? (
                <div ref={previewRef}
                  draggable={!!midi}
                  onDragStart={handleDragStart}
                  onDragEnd={() => setIsDragging(false)}
                  className={`relative border rounded-lg p-2 h-14 overflow-hidden transition-colors ${isDragging ? "bg-purple-50 border-purple-400 border-dashed" : "bg-gray-50 border-gray-200 hover:border-purple-300"}`}>
                  {/* Mini piano roll preview */}
                  <div className="flex items-end h-full gap-[1px]">
                    {(() => {
                      if (!midi) return null;
                      const beats = midi.totalBeats || 16;
                      const grid = 0.25;
                      const totalSlots = Math.ceil(beats / grid);
                      const slots = new Array(totalSlots).fill(0);
                      for (const t of midi.tracks) {
                        for (const n of t.notes) {
                          const idx = Math.round(n.startTime / grid);
                          if (idx >= 0 && idx < totalSlots) slots[idx] = Math.max(slots[idx], n.velocity);
                        }
                      }
                      return slots.map((v, i) => (
                        <div key={i} className="flex-1 rounded-sm self-end"
                          style={{
                            height: `${Math.max(5, v * 100)}%`,
                            backgroundColor: i % 4 === 0 ? "#7c3aed" : "#a78bfa",
                            opacity: 0.3 + v * 0.5,
                          }} />
                      ));
                    })()}
                  </div>
                  {/* Drag hint */}
                  {!isDragging && noteCount > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-white/60 transition-opacity">
                      <span className="text-[10px] text-purple-600 font-medium">拖曳到時間軸</span>
                    </div>
                  )}
                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-purple-100/80">
                      <span className="text-xs text-purple-700 font-bold">拖曳中...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-2 h-14 flex items-center justify-center">
                  <span className="text-xs text-gray-400">按 Generate 產生旋律預覽</span>
                </div>
              )}
            </div>

            <div className="flex gap-1.5 shrink-0">
              <button onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors shadow-sm">
                Generate
              </button>
              {midi && (
                <>
                  <button onClick={isPlaying ? handleStop : handlePlay}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isPlaying ? "bg-red-500 text-white" : "bg-green-600 text-white hover:bg-green-500"}`}>
                    {isPlaying ? "■" : "▶"}
                  </button>
                  <button onClick={handleAddToProject}
                    className="px-3 py-2 rounded-lg border border-purple-300 text-purple-700 text-xs font-medium hover:bg-purple-50 transition-colors">
                    + 加入
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Info */}
          {midi && (
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="text-purple-600 font-bold">{key} {SCALES.find(s => s.id === scale)?.label ?? scale}</span>
              <span>{noteCount} 個音符</span>
              <span>{getDurationSeconds(midi).toFixed(1)}s</span>
              <span>{bpm} BPM</span>
              <span className="text-gray-400 italic ml-auto">拖曳預覽區塊到時間軸即可加入</span>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
