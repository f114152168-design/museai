import { NextRequest, NextResponse } from "next/server";
import { generateMidiFromPrompt, generateLiveCodeFromPrompt, isOpenAIConfigured } from "@/lib/openai";
import { generateFreeMidi, generatePaidMidi, loopMidi } from "@/lib/midi";

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
    const { prompt, mode, bpm, tier = "free" } = body;

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
      const code = await generateLiveCodeFromPrompt(prompt, tier, bpm ?? 120);
      return NextResponse.json({ code, prompt });
    }

    // Generate MIDI based on tier
    let midi;

    if (isOpenAIConfigured()) {
      midi = await generateMidiFromPrompt(prompt, tier);
    } else {
      midi = tier === "paid" ? generatePaidMidi(bpm ?? 128) : generateFreeMidi(bpm ?? 120);
    }

    // Ensure duration limits
    if (tier === "free") {
      const maxFreeBeats = 32; // 8 bars
      if (midi.totalBeats > maxFreeBeats) midi.totalBeats = maxFreeBeats;
      midi = loopMidi(midi, 8);
    }

    return NextResponse.json({ type: "midi", data: midi, prompt });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "生成失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}