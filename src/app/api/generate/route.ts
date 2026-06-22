import { NextRequest, NextResponse } from "next/server";
import { generateMidiFromPrompt, generateMelodyFromPrompt, generateLiveCodeFromPrompt, isOpenAIConfigured } from "@/lib/openai";
import { generateFreeMidi, generatePaidMidi, generateStyleMidi, loopMidi, quantizeMidi, pluckMidi, arpeggiateMidi, addFourOnFloor } from "@/lib/midi";
import { generateSongFromPrompt } from "@/lib/song-generator";
import { generateMelody } from "@/lib/melody-generator";
import type { MidiData } from "@/lib/midi";

type PostProcess = {
  quantize?: number;
  pluck?: boolean;
  arpeggiate?: "up" | "down" | "updown";
  fourOnFloor?: boolean;
};

/** Validate that a MidiData object has actual usable tracks with notes */
function isValidMidi(midi: MidiData | null | undefined): midi is MidiData {
  if (!midi) return false;
  if (!midi.tracks || midi.tracks.length === 0) return false;
  const totalNotes = midi.tracks.reduce((s, t) => s + (t.notes?.length ?? 0), 0);
  return totalNotes > 0;
}

/** Try OpenAI generation, fall back to algorithmic if it fails or returns empty */
async function generateWithFallback(
  prompt: string,
  tier: "free" | "paid",
  style?: string,
  bpm?: number,
): Promise<MidiData> {
  // Try OpenAI first
  if (isOpenAIConfigured()) {
    try {
      const aiMidi = await generateMidiFromPrompt(prompt, tier);
      if (isValidMidi(aiMidi)) {
        console.log(`[generate] OpenAI success: ${aiMidi.tracks.length} tracks, ${aiMidi.tracks.reduce((s, t) => s + t.notes.length, 0)} notes`);
        return aiMidi;
      }
      console.warn("[generate] OpenAI returned empty/invalid MIDI, falling back to algorithmic");
    } catch (err) {
      console.error("[generate] OpenAI failed, falling back to algorithmic:", err);
    }
  }

  // Fallback: algorithmic generation
  if (style) {
    return generateStyleMidi(style, bpm ?? 128);
  }
  return generateSongFromPrompt(prompt, tier);
}

export async function GET() {
  return NextResponse.json({
    configured: isOpenAIConfigured(),
    message: isOpenAIConfigured()
      ? "OpenAI API 已串接"
      : "OpenAI API 未串接 - 請在 .env 設定 OPENAI_API_KEY",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode, bpm, tier = "free", style, postProcess } = body as {
      prompt: string; mode?: string; bpm?: number; tier?: string; style?: string; postProcess?: PostProcess;
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "請提供音樂描述" }, { status: 400 });
    }

    if (mode === "livecode") {
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY 未設定", code: "// 請先在 .env 設定 OPENAI_API_KEY" },
          { status: 503 }
        );
      }
      const code = await generateLiveCodeFromPrompt(prompt, (tier as "free" | "paid") ?? "free", bpm ?? 120);
      return NextResponse.json({ code, prompt });
    }

    const tierVal = (tier === "paid" ? "paid" : "free") as "free" | "paid";

    // Melody + accompaniment generation
    if (mode === "melody") {
      let midi: MidiData;

      if (isOpenAIConfigured()) {
        try {
          const aiMidi = await generateMidiFromPrompt(prompt, tierVal);
          if (isValidMidi(aiMidi)) {
            midi = aiMidi;
          } else {
            console.warn("[melody] OpenAI returned empty MIDI, using song generator");
            midi = generateSongFromPrompt(prompt, tierVal);
          }
        } catch {
          midi = generateSongFromPrompt(prompt, tierVal);
        }
      } else {
        midi = generateSongFromPrompt(prompt, tierVal);
      }

      // Remap channel 5 melody/lead tracks to channel 6
      for (const track of midi.tracks) {
        if (track.channel === 5) {
          const name = track.name.toLowerCase();
          if (name.includes("lead") || name.includes("melody") || name.includes("主旋律")) {
            track.channel = 6;
            for (const note of track.notes) note.channel = 6;
          }
        }
      }

      if (tier === "free") {
        const maxFreeBeats = 32;
        if (midi.totalBeats > maxFreeBeats) midi.totalBeats = maxFreeBeats;
        midi = loopMidi(midi, 8);
      }

      return NextResponse.json({ type: "midi", data: midi, prompt });
    }

    // Default: full arrangement generation
    let midi = await generateWithFallback(prompt, tierVal, style, bpm);

    // Remap channel 5 melody/lead tracks to channel 6
    for (const track of midi.tracks) {
      if (track.channel === 5) {
        const name = track.name.toLowerCase();
        if (name.includes("lead") || name.includes("melody") || name.includes("主旋律")) {
          track.channel = 6;
          for (const note of track.notes) note.channel = 6;
        }
      }
    }

    // Apply EDM post-processing
    if (postProcess) {
      if (postProcess.quantize) midi = quantizeMidi(midi, postProcess.quantize);
      if (postProcess.pluck) midi = pluckMidi(midi);
      if (postProcess.arpeggiate) midi = arpeggiateMidi(midi, postProcess.arpeggiate);
      if (postProcess.fourOnFloor) midi = addFourOnFloor(midi);
    }

    // Ensure duration limits
    if (tier === "free") {
      const maxFreeBeats = 32;
      if (midi.totalBeats > maxFreeBeats) midi.totalBeats = maxFreeBeats;
      midi = loopMidi(midi, 8);
    }

    return NextResponse.json({ type: "midi", data: midi, prompt, style });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "生成失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}