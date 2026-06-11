"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/lib/store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE = `// Museai Live Coding
// Use these functions to create music:
//
// play(note, duration, instrument) - Play a single note
//   note: "C4", "D#3", "A4" etc.
//   duration: 0.25, 0.5, 1, 2 etc. (in beats)
//   instrument: "sine", "square", "sawtooth", "triangle"
//
// sequence(notes) - Play a sequence of notes
//   notes: Array of { note, duration, instrument }
//
// pattern(name, notes) - Define a reusable pattern
// pattern("kick", [
//   { note: "C2", duration: 1 },
//   { note: "C2", duration: 0.5 },
// ])
// playPattern("kick")
//
// setBpm(bpm) - Change tempo
// setVolume(0.8) - Master volume (0 to 1)

setBpm(120);
setVolume(0.7);

// Four-on-the-floor kick
pattern("kick", [
  { note: "C2", duration: 1, instrument: "sine" },
]);

// Hi-hat pattern
pattern("hat", [
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
  { note: "C5", duration: 0.25, instrument: "triangle" },
]);

// Bassline
pattern("bass", [
  { note: "C3", duration: 1, instrument: "sawtooth" },
  { note: "E3", duration: 1, instrument: "sawtooth" },
  { note: "G3", duration: 0.5, instrument: "sawtooth" },
  { note: "A3", duration: 0.5, instrument: "sawtooth" },
]);

// Play patterns
playPattern("kick");
playPattern("hat");

// Add melody
sequence([
  { note: "C4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 1, instrument: "square" },
  { note: "A4", duration: 0.5, instrument: "square" },
  { note: "G4", duration: 0.5, instrument: "square" },
  { note: "E4", duration: 1, instrument: "square" },
]);

// Generate AI track
generate("Add a warm pad in the background");
`;

export function LiveCodingMode({ projectId }: { projectId: string }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const addTrack = useProjectStore((s) => s.addTrack);

  const addOutput = (msg: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleRun = useCallback(async () => {
    try {
      setIsPlaying(true);
      setOutput([]);

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      let bpm = 120;
      let volume = 0.7;
      const patterns = new Map<string, Array<{ note: string; duration: number; instrument?: string }>>();

      const noteToFreq = (note: string): number => {
        const scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const match = note.match(/^([A-G]#?)(\d)$/);
        if (!match) return 440;
        const semitones = scale.indexOf(match[1]);
        const octave = parseInt(match[2]);
        return 440 * Math.pow(2, (semitones - 9 + (octave - 4) * 12) / 12);
      };

      const playNote = (note: string, duration: number, instrument = "sine", startDelay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = instrument as OscillatorType;
        osc.frequency.value = noteToFreq(note);
        const startTime = ctx.currentTime + startDelay;
        gain.gain.setValueAtTime(volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * (60 / bpm));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration * (60 / bpm));
      };

      const evalEnv = {
        setBpm: (newBpm: number) => {
          bpm = Math.max(60, Math.min(200, newBpm));
          addOutput(`BPM set to ${bpm}`);
        },
        setVolume: (vol: number) => {
          volume = Math.max(0, Math.min(1, vol));
          addOutput(`Volume set to ${volume}`);
        },
        play: (note: string, duration: number, instrument = "sine") => {
          playNote(note, duration, instrument);
        },
        sequence: (notes: Array<{ note: string; duration: number; instrument?: string }>) => {
          let time = 0;
          for (const n of notes) {
            playNote(n.note, n.duration, n.instrument || "sine", time);
            time += n.duration;
          }
          addOutput(`Playing sequence (${notes.length} notes)`);
        },
        pattern: (name: string, notes: Array<{ note: string; duration: number; instrument?: string }>) => {
          patterns.set(name, notes);
          addOutput(`Pattern "${name}" defined (${notes.length} steps)`);
        },
        playPattern: (name: string) => {
          const notes = patterns.get(name);
          if (!notes) {
            addOutput(`Pattern "${name}" not found`);
            return;
          }
          let time = 0;
          for (const n of notes) {
            playNote(n.note, n.duration, n.instrument || "sine", time);
            time += n.duration;
          }
          addOutput(`Playing pattern "${name}"`);
        },
        generate: (prompt: string) => {
          addOutput(`AI generation: "${prompt}"`);
          addTrack(projectId, {
            name: prompt.slice(0, 40),
            type: "AUDIO",
            audioUrl: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
            duration: 30,
            order: Date.now(),
          });
          addOutput("Track added to project!");
        },
      };

      const fn = new Function(...Object.keys(evalEnv), code);
      await fn(...Object.values(evalEnv));

      addOutput("Code executed successfully!");
    } catch (err) {
      addOutput(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTimeout(() => setIsPlaying(false), 500);
    }
  }, [code, projectId, addTrack]);

  const handleStop = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
    addOutput("Playback stopped");
  };

  return (
    <div className="flex h-full">
      {/* Editor */}
      <div className="flex-1 flex flex-col border-r border-gray-800">
        <div className="flex-1">
          <MonacoEditor
            language="javascript"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              fontFamily: "'Geist Mono', 'Fira Code', monospace",
            }}
          />
        </div>
        <div className="border-t border-gray-800 p-2 flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isPlaying}
            className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>▶</span> Run
          </button>
          <button
            onClick={handleStop}
            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>■</span> Stop
          </button>
        </div>
      </div>

      {/* Output panel */}
      <div className="w-80 flex flex-col bg-gray-950">
        <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-800 font-medium">
          Output
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {output.length === 0 ? (
            <p className="text-xs text-gray-600">Click Run to execute the code</p>
          ) : (
            output.map((line, i) => (
              <p key={i} className="text-xs text-gray-400 font-mono">{line}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}