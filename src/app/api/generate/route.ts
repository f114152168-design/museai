import { NextRequest, NextResponse } from "next/server";
import { generateMidiFromPrompt, generateMelodyFromPrompt, generateLiveCodeFromPrompt, isOpenAIConfigured } from "@/lib/openai";
import { generateFreeMidi, generatePaidMidi, generateStyleMidi, loopMidi, quantizeMidi, pluckMidi, arpeggiateMidi, addFourOnFloor } from "@/lib/midi";
import { generateSongFromPrompt } from "@/lib/song-generator";
import { generateMelody } from "@/lib/melody-generator";

type PostProcess = {
  quantize?: number;
  pluck?: boolean;
  arpeggiate?: "up" | "down" | "updown";
  fourOnFloor?: boolean;
};

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

    // Melody + accompaniment generation
    if (mode === "melody") {
      const tierVal = (tier === "paid" ? "paid" : "free") as "free" | "paid";
      let midi: Awaited<ReturnType<typeof generateMidiFromPrompt>>;

      if (isOpenAIConfigured()) {
        // AI: generate full song (melody + backing)
        midi = await generateMidiFromPrompt(prompt, tierVal);
      } else {
        // Fallback: song generator (melody + drums/bass/chords)
        midi = generateSongFromPrompt(prompt, tierVal);
      }

      // Safety net: remap channel 5 melody/lead tracks to channel 6 (melody synth)
      for (const track of midi.tracks) {
        if (track.channel === 5) {
          const name = track.name.toLowerCase();
          if (name.includes("lead") || name.includes("melody") || name.includes("主旋律")) {
            track.channel = 6;
            for (const note of track.notes) note.channel = 6;
          }
        }
      }

      // Ensure duration limits
      if (tier === "free") {
        const maxFreeBeats = 32;
        if (midi.totalBeats > maxFreeBeats) midi.totalBeats = maxFreeBeats;
        midi = loopMidi(midi, 8);
      }

      return NextResponse.json({ type: "midi", data: midi, prompt });
    }

    // Generate MIDI — song generator produces full arrangement from prompt text
    let midi;

    const tierVal = (tier === "paid" ? "paid" : "free") as "free" | "paid";

    if (isOpenAIConfigured()) {
      midi = await generateMidiFromPrompt(prompt, tierVal);
    } else if (style) {
      midi = generateStyleMidi(style, bpm ?? 128);
    } else {
      midi = generateSongFromPrompt(prompt, tierVal);
    }

    // Safety net: remap channel 5 melody/lead tracks to channel 6 (melody synth)
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