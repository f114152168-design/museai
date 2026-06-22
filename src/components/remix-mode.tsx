"use client";

import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import {
  playMidi, stopMusic, pauseMidi, resumeMidi, initAudio,
  isPaused as getIsPaused, setLoop as setSynthLoop,
} from "@/lib/synth";
import {
  type MidiData, type MidiNote, type MidiTrack,
  quantizeMidi, pluckMidi, arpeggiateMidi, addFourOnFloor,
  loopMidi, getDurationSeconds, midiToFrequency,
} from "@/lib/midi";
import { useTier } from "@/hooks/use-tier";
import { useApiStatus } from "@/hooks/use-api-status";

const CHANNEL_NAMES = ["Kick", "Snare/Clap", "Hi-Hat", "Bass", "Chord/Pad", "FX", "Melody"];
const CHANNEL_ICONS = ["🥁", "🥁", "🔔", "🎸", "🎹", "✨", "🎵"];
const CHANNEL_COLORS = ["#7c3aed", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#f97316", "#ec4899"];

const INSTRUMENT_PRESETS: Record<number, { label: string; synth: string }[]> = {
  0: [{ label: "電子大鼓", synth: "kick" }, { label: "Acoustic", synth: "kick-acoustic" }],
  1: [{ label: "小鼓/掌聲", synth: "snare" }, { label: "拍手", synth: "clap" }],
  2: [{ label: "閉合鈸", synth: "hihat-closed" }, { label: "開放鈸", synth: "hihat-open" }],
  3: [{ label: "FM Bass", synth: "bass-fm" }, { label: "Sub Bass", synth: "bass-sub" }, { label: "Reese", synth: "bass-reese" }],
  4: [{ label: "Supersaw", synth: "pad-supersaw" }, { label: "Warm Pad", synth: "pad-warm" }, { label: "Strings", synth: "pad-strings" }],
  5: [{ label: "Riser FX", synth: "fx-riser" }, { label: "Impact", synth: "fx-impact" }, { label: "Noise", synth: "fx-noise" }],
  6: [{ label: "Square Lead", synth: "melody-square" }, { label: "Saw Lead", synth: "melody-saw" }, { label: "Sine Lead", synth: "melody-sine" }, { label: "Pluck", synth: "melody-pluck" }],
};

interface ChannelState {
  channel: number;
  name: string;
  icon: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  notes: MidiNote[];
  instrument: string;
}

function mergeProjectTracks(tracks: { midiData?: string }[]): MidiData | null {
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

  const channelMap = new Map<number, MidiNote[]>();
  for (const note of allNotes) {
    const ch = note.channel ?? 0;
    if (!channelMap.has(ch)) channelMap.set(ch, []);
    channelMap.get(ch)!.push(note);
  }

  const mergedTracks = Array.from(channelMap.entries()).map(([ch, notes]) => ({
    name: CHANNEL_NAMES[ch] ?? `Ch ${ch}`,
    channel: ch,
    instrument: "",
    notes: notes.sort((a, b) => a.startTime - b.startTime),
  }));

  return { bpm, totalBeats, tracks: mergedTracks };
}

export function RemixMode({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.getProject(projectId));
  const addTrack = useProjectStore((s) => s.addTrack);
  const addCommit = useProjectStore((s) => s.addCommit);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const { tier } = useTier();
  const apiStatus = useApiStatus();

  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<number>(6);
  const [variations, setVariations] = useState<MidiData[]>([]);
  const [activeTab, setActiveTab] = useState<"mixer" | "ai" | "transform">("mixer");

  // Merge tracks on project change
  useEffect(() => {
    if (!project) return;
    const merged = mergeProjectTracks(project.tracks);
    if (!merged) {
      setChannels([]);
      return;
    }

    const chStates: ChannelState[] = merged.tracks.map((t) => ({
      channel: t.channel,
      name: t.name,
      icon: CHANNEL_ICONS[t.channel] ?? "🎵",
      color: CHANNEL_COLORS[t.channel] ?? "#6b7280",
      volume: 1,
      pan: 0,
      muted: false,
      soloed: false,
      notes: t.notes,
      instrument: INSTRUMENT_PRESETS[t.channel]?.[0]?.synth ?? "default",
    }));

    setChannels(chStates);
  }, [project?.tracks]);

  // Build playable MidiData from channel states
  const buildMidi = useCallback((): MidiData | null => {
    if (channels.length === 0 || !project) return null;
    const tracks: MidiTrack[] = channels
      .filter((ch) => !ch.muted && ch.notes.length > 0)
      .map((ch) => ({
        name: ch.name,
        channel: ch.channel,
        instrument: ch.instrument,
        notes: ch.notes.map((n) => ({
          ...n,
          velocity: n.velocity * ch.volume,
          channel: ch.channel,
        })),
      }));

    if (tracks.length === 0) return null;

    const totalBeats = Math.max(...channels.flatMap((ch) => ch.notes.map((n) => n.startTime + n.duration)), 32);
    return {
      bpm: project.bpm,
      totalBeats: Math.ceil(totalBeats),
      tracks,
      tier: tier === "paid" ? "paid" : "free",
    };
  }, [channels, project, tier]);

  const handlePlay = useCallback(async () => {
    const midi = buildMidi();
    if (!midi) return;
    await initAudio();
    setSynthLoop(loopOn);
    setIsPlaying(true);
    await playMidi(midi);
    setIsPlaying(false);
  }, [buildMidi, loopOn]);

  const handlePause = useCallback(() => {
    if (getIsPaused()) { resumeMidi(); setIsPlaying(true); }
    else { pauseMidi(); setIsPlaying(false); }
  }, []);

  const handleStop = useCallback(() => {
    stopMusic();
    setIsPlaying(false);
  }, []);

  // Channel state updates
  const updateChannel = (ch: number, patch: Partial<ChannelState>) => {
    setChannels((prev) => prev.map((c) => (c.channel === ch ? { ...c, ...patch } : c)));
  };

  const toggleMute = (ch: number) => {
    updateChannel(ch, { muted: !channels.find((c) => c.channel === ch)?.muted });
  };

  const toggleSolo = (ch: number) => {
    updateChannel(ch, { soloed: !channels.find((c) => c.channel === ch)?.soloed });
  };

  // ── MIDI Transform Functions ──
  const applyTransform = (fn: (midi: MidiData) => MidiData) => {
    const midi = buildMidi();
    if (!midi) return;
    const transformed = fn(midi);
    // Update channels from transformed midi
    const newChannels: ChannelState[] = transformed.tracks.map((t) => ({
      channel: t.channel,
      name: t.name,
      icon: CHANNEL_ICONS[t.channel] ?? "🎵",
      color: CHANNEL_COLORS[t.channel] ?? "#6b7280",
      volume: channels.find((c) => c.channel === t.channel)?.volume ?? 1,
      pan: channels.find((c) => c.channel === t.channel)?.pan ?? 0,
      muted: false,
      soloed: false,
      notes: t.notes,
      instrument: channels.find((c) => c.channel === t.channel)?.instrument ?? "default",
    }));
    setChannels(newChannels);
  };

  const handleQuantize = (grid: number) => applyTransform((m) => quantizeMidi(m, grid));
  const handlePluck = () => applyTransform((m) => pluckMidi(m, 0.12));
  const handleArpeggiate = (pattern: "up" | "down" | "updown") => applyTransform((m) => arpeggiateMidi(m, pattern));
  const handleFourOnFloor = () => applyTransform((m) => addFourOnFloor(m));

  // ── AI Remix ──
  const handleRemix = async () => {
    if (!remixPrompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
      const midi = buildMidi();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: remixPrompt.trim(),
          mode: "melody",
          tier,
          context: midi ? {
            existingTracks: midi.tracks.map((t) => ({
              channel: t.channel,
              name: t.name,
              noteCount: t.notes.length,
            })),
            bpm: midi.bpm,
            totalBeats: midi.totalBeats,
          } : undefined,
        }),
      });

      if (!res.ok) throw new Error("生成失敗");
      const result = await res.json();

      if (result.type === "midi" && result.data) {
        const newMidi = result.data as MidiData;
        setVariations((prev) => [newMidi, ...prev].slice(0, 5));

        // Merge new melody into existing channels
        const melodyTrack = newMidi.tracks.find((t) => t.channel === 6);
        if (melodyTrack) {
          updateChannel(6, { notes: melodyTrack.notes });
        } else if (newMidi.tracks.length > 0) {
          // If no melody track, add the first track as new layer
          const newTrack = newMidi.tracks[0];
          updateChannel(newTrack.channel, { notes: newTrack.notes });
        }
      }
    } catch (err) {
      console.error("Remix error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyVariation = (variation: MidiData) => {
    const newChannels: ChannelState[] = variation.tracks.map((t) => ({
      channel: t.channel,
      name: t.name,
      icon: CHANNEL_ICONS[t.channel] ?? "🎵",
      color: CHANNEL_COLORS[t.channel] ?? "#6b7280",
      volume: channels.find((c) => c.channel === t.channel)?.volume ?? 1,
      pan: channels.find((c) => c.channel === t.channel)?.pan ?? 0,
      muted: false,
      soloed: false,
      notes: t.notes,
      instrument: channels.find((c) => c.channel === t.channel)?.instrument ?? "default",
    }));
    setChannels(newChannels);
  };

  // ── Save remix ──
  const handleSaveRemix = () => {
    const midi = buildMidi();
    if (!midi) return;
    addTrack(projectId, {
      name: `Remix - ${remixPrompt.slice(0, 30) || "自定義"}`,
      type: "MIDI",
      midiData: JSON.stringify(midi),
      duration: getDurationSeconds(midi),
      order: Date.now(),
    });
    addCommit(projectId, { prompt: `Remix: ${remixPrompt || "手動混音"}`, midi, type: "edit" });
  };

  const totalNotes = channels.reduce((s, ch) => s + ch.notes.length, 0);
  const duration = project ? (Math.max(...channels.flatMap((ch) => ch.notes.map((n) => n.startTime + n.duration)), 32) * (60 / project.bpm)) : 0;

  if (!project || channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1a1a2e]">
        <div className="text-center">
          <div className="text-4xl mb-3">🎛️</div>
          <h3 className="text-lg font-bold text-white mb-1">Remix 工作站</h3>
          <p className="text-sm text-gray-400">先在聊天模式生成音樂，然後到這裡混音</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Transport Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0f0f1a] border-b border-[#2a2a3e]">
        <button onClick={isPlaying ? handlePause : handlePlay}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${isPlaying ? "bg-amber-500 text-black" : "bg-green-500 text-black hover:bg-green-400"}`}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={handleStop}
          className="px-3 py-1.5 rounded text-sm font-bold bg-[#252540] text-gray-400 hover:text-white">■</button>
        <button onClick={() => { const v = !loopOn; setLoopOn(v); setSynthLoop(v); }}
          className={`px-2 py-1.5 rounded text-xs font-bold ${loopOn ? "bg-amber-500 text-black" : "bg-[#252540] text-gray-400"}`}>🔁</button>

        <div className="w-px h-5 bg-[#2a2a3e] mx-1" />
        <span className="text-[#3b82f6] text-xs font-mono font-bold">{project.bpm} BPM</span>
        <span className="text-gray-500 text-xs font-mono">{Math.floor(duration)}s</span>
        <span className="text-gray-500 text-xs font-mono">{channels.length} 軌 · {totalNotes} 音符</span>

        <div className="flex-1" />

        <button onClick={handleSaveRemix}
          className="px-3 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-500 font-medium">
          💾 儲存 Remix
        </button>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0f0f1a] border-b border-[#2a2a3e]">
        {([
          { key: "mixer" as const, label: "🎚️ 混音器", desc: "音量/靜音/獨奏" },
          { key: "ai" as const, label: "🤖 AI Remix", desc: "AI 生成變化" },
          { key: "transform" as const, label: "🔄 變換", desc: "量化/撥弦/琶音" },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-purple-600 text-white"
                : "bg-[#252540] text-gray-400 hover:text-white"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Channel Strips */}
        <div className="w-64 border-r border-[#2a2a3e] overflow-y-auto scrollbar-thin bg-[#0f0f1a]">
          {channels.map((ch) => (
            <div key={ch.channel}
              className={`border-b border-[#2a2a3e] p-2 transition-colors ${
                selectedChannel === ch.channel ? "bg-purple-900/30" : "hover:bg-[#1a1a2e]"
              }`}
              onClick={() => setSelectedChannel(ch.channel)}>
              {/* Channel Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{ch.name}</div>
                  <div className="text-[10px] text-gray-500">{ch.notes.length} notes · Ch {ch.channel}</div>
                </div>
                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: ch.color }} />
              </div>

              {/* Mute / Solo */}
              <div className="flex items-center gap-1 mb-2">
                <button onClick={(e) => { e.stopPropagation(); toggleMute(ch.channel); }}
                  className={`flex-1 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    ch.muted ? "bg-red-500 text-white" : "bg-[#252540] text-gray-500 hover:text-white"
                  }`}>
                  M
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleSolo(ch.channel); }}
                  className={`flex-1 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    ch.soloed ? "bg-amber-500 text-black" : "bg-[#252540] text-gray-500 hover:text-white"
                  }`}>
                  S
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-6">Vol</span>
                <input type="range" min="0" max="2" step="0.05" value={ch.volume}
                  onChange={(e) => updateChannel(ch.channel, { volume: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1 accent-purple-500" />
                <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(ch.volume * 100)}%</span>
              </div>

              {/* Pan Slider */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500 w-6">Pan</span>
                <input type="range" min="-1" max="1" step="0.1" value={ch.pan}
                  onChange={(e) => updateChannel(ch.channel, { pan: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1 accent-cyan-500" />
                <span className="text-[10px] text-gray-400 w-8 text-right">
                  {ch.pan === 0 ? "C" : ch.pan < 0 ? `L${Math.round(Math.abs(ch.pan) * 100)}` : `R${Math.round(ch.pan * 100)}`}
                </span>
              </div>

              {/* Instrument Selector */}
              {INSTRUMENT_PRESETS[ch.channel] && (
                <select value={ch.instrument}
                  onChange={(e) => updateChannel(ch.channel, { instrument: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 w-full bg-[#252540] text-gray-300 text-[10px] rounded px-1.5 py-0.5 border border-[#3a3a4e]">
                  {INSTRUMENT_PRESETS[ch.channel].map((inst) => (
                    <option key={inst.synth} value={inst.synth}>{inst.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Right: Panel Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === "mixer" && (
            <div className="p-4">
              <h3 className="text-sm font-bold text-white mb-3">🎚️ 混音控制</h3>
              <p className="text-xs text-gray-400 mb-4">調整每個軌道的音量、聲像、靜音和獨奏。點擊右側的音軌進行編輯。</p>

              {/* Mini Piano Roll Preview */}
              <div className="bg-[#0f0f1a] rounded-lg border border-[#2a2a3e] p-3 mb-4">
                <div className="text-xs text-gray-400 mb-2">軌道預覽</div>
                <div className="space-y-1">
                  {channels.map((ch) => (
                    <div key={ch.channel} className="flex items-center gap-2">
                      <span className="text-xs w-16 truncate" style={{ color: ch.color }}>{ch.name}</span>
                      <div className="flex-1 h-4 bg-[#1a1a2e] rounded overflow-hidden relative">
                        {ch.notes.map((note, i) => {
                          const maxBeat = Math.max(...ch.notes.map((n) => n.startTime + n.duration), 32);
                          const left = (note.startTime / maxBeat) * 100;
                          const width = Math.max(0.5, (note.duration / maxBeat) * 100);
                          return (
                            <div key={i} className="absolute h-full rounded-sm" style={{
                              left: `${left}%`, width: `${width}%`,
                              backgroundColor: ch.color, opacity: 0.3 + note.velocity * 0.6,
                            }} />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-gray-500 w-8 text-right">{ch.notes.length}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => {
                  const hasSolo = channels.some((c) => c.soloed);
                  setChannels((prev) => prev.map((c) => ({ ...c, muted: false, soloed: false })));
                }}
                  className="px-3 py-1.5 rounded text-xs bg-[#252540] text-gray-300 hover:text-white">
                  全部取消靜音
                </button>
                <button onClick={() => setChannels((prev) => prev.map((c) => ({ ...c, volume: 1 })))}
                  className="px-3 py-1.5 rounded text-xs bg-[#252540] text-gray-300 hover:text-white">
                  音量重置
                </button>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="p-4">
              <h3 className="text-sm font-bold text-white mb-1">🤖 AI Remix</h3>
              <p className="text-xs text-gray-400 mb-4">用 AI 重新生成或變化特定軌道的旋律、節奏</p>

              {/* Remix Prompt */}
              <div className="flex gap-2 mb-4">
                <input type="text" value={remixPrompt} onChange={(e) => setRemixPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRemix()}
                  placeholder="描述你想要的變化，例如：更 uplifting 的旋律、更重的 bassline..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#252540] text-white text-sm placeholder-gray-500 border border-[#3a3a4e] focus:outline-none focus:border-purple-500"
                  disabled={isGenerating} />
                <button onClick={handleRemix} disabled={isGenerating || !remixPrompt.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50 shrink-0">
                  {isGenerating ? "生成中..." : "🎵 Remix"}
                </button>
              </div>

              {/* Target Channel */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">目標軌道</label>
                <div className="flex flex-wrap gap-1">
                  {channels.map((ch) => (
                    <button key={ch.channel} onClick={() => setSelectedChannel(ch.channel)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        selectedChannel === ch.channel
                          ? "text-white" : "bg-[#252540] text-gray-400 hover:text-white"
                      }`}
                      style={{ backgroundColor: selectedChannel === ch.channel ? ch.color : undefined }}>
                      {ch.icon} {ch.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Remix Prompts */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">快速提示</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    "更 uplifting 的旋律",
                    "更黑暗的 bassline",
                    "加入琶音",
                    "更強烈的節奏",
                    "夢幻的和弦進行",
                    "減少音符，更簡潔",
                    "加入切分音",
                    "更豐富的節奏變化",
                  ].map((prompt) => (
                    <button key={prompt} onClick={() => setRemixPrompt(prompt)}
                      className="px-2 py-0.5 rounded text-[10px] bg-[#252540] text-gray-400 hover:text-white hover:bg-[#3a3a4e]">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Variations */}
              {variations.length > 0 && (
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">已生成的變化 ({variations.length})</label>
                  <div className="space-y-2">
                    {variations.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#252540] border border-[#3a3a4e]">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-medium">
                            {v.tracks.length} 軌 · {v.tracks.reduce((s, t) => s + t.notes.length, 0)} 音符
                          </div>
                          <div className="text-[10px] text-gray-500">{v.bpm} BPM</div>
                        </div>
                        <button onClick={() => applyVariation(v)}
                          className="px-2 py-0.5 rounded text-[10px] bg-green-600 text-white hover:bg-green-500">
                          套用
                        </button>
                        <button onClick={() => setVariations((prev) => prev.filter((_, j) => j !== i))}
                          className="px-2 py-0.5 rounded text-[10px] bg-red-600/50 text-red-300 hover:bg-red-500">
                          刪除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "transform" && (
            <div className="p-4">
              <h3 className="text-sm font-bold text-white mb-1">🔄 MIDI 變換</h3>
              <p className="text-xs text-gray-400 mb-4">對所有軌道套用 MIDI 效果</p>

              <div className="space-y-3">
                {/* Quantize */}
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#2a2a3e]">
                  <div className="text-xs font-bold text-white mb-2">📏 量化 (Quantize)</div>
                  <p className="text-[10px] text-gray-500 mb-2">將音符 snapping 到最近的網格位置</p>
                  <div className="flex gap-1">
                    {[{ label: "1/4", value: 1 }, { label: "1/8", value: 0.5 }, { label: "1/16", value: 0.25 }, { label: "1/32", value: 0.125 }].map((g) => (
                      <button key={g.value} onClick={() => handleQuantize(g.value)}
                        className="px-2.5 py-1 rounded text-[10px] bg-[#252540] text-gray-300 hover:text-white hover:bg-purple-600">
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pluck */}
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#2a2a3e]">
                  <div className="text-xs font-bold text-white mb-2">🎸 撥弦效果 (Pluck)</div>
                  <p className="text-[10px] text-gray-500 mb-2">縮短所有音符持續時間，創造撥弦感</p>
                  <button onClick={handlePluck}
                    className="px-3 py-1 rounded text-[10px] bg-[#252540] text-gray-300 hover:text-white hover:bg-purple-600">
                    套用 Pluck
                  </button>
                </div>

                {/* Arpeggiate */}
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#2a2a3e]">
                  <div className="text-xs font-bold text-white mb-2">🎼 琶音 (Arpeggiate)</div>
                  <p className="text-[10px] text-gray-500 mb-2">將和弦音符分解為節奏模式</p>
                  <div className="flex gap-1">
                    {([["up", "上行 ↑"], ["down", "下行 ↓"], ["updown", "上下 ↕"]] as const).map(([p, label]) => (
                      <button key={p} onClick={() => handleArpeggiate(p)}
                        className="px-2.5 py-1 rounded text-[10px] bg-[#252540] text-gray-300 hover:text-white hover:bg-purple-600">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Four on the Floor */}
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#2a2a3e]">
                  <div className="text-xs font-bold text-white mb-2">🥁 Four-on-the-Floor</div>
                  <p className="text-[10px] text-gray-500 mb-2">套用標準 EDM 節奏模式（大鼓每拍 + 小鼓 2/4 拍）</p>
                  <button onClick={handleFourOnFloor}
                    className="px-3 py-1 rounded text-[10px] bg-[#252540] text-gray-300 hover:text-white hover:bg-purple-600">
                    套用 4/4 節奏
                  </button>
                </div>

                {/* Loop Extend */}
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#2a2a3e]">
                  <div className="text-xs font-bold text-white mb-2">🔁 循環延伸</div>
                  <p className="text-[10px] text-gray-500 mb-2">將目前的音樂延伸到指定小節數</p>
                  <div className="flex gap-1">
                    {[8, 16, 32, 64].map((bars) => (
                      <button key={bars} onClick={() => {
                        const midi = buildMidi();
                        if (!midi) return;
                        const looped = loopMidi(midi, bars);
                        applyVariation(looped);
                      }}
                        className="px-2.5 py-1 rounded text-[10px] bg-[#252540] text-gray-300 hover:text-white hover:bg-purple-600">
                        {bars} 小節
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
