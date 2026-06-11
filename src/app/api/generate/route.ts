import { NextRequest, NextResponse } from "next/server";
import { generateMidiFromPrompt, generateLiveCodeFromPrompt, isOpenAIConfigured } from "@/lib/openai";
import { generateMockMidi } from "@/lib/midi";

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
    const { prompt, mode, bpm } = body;

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
      const code = await generateLiveCodeFromPrompt(prompt, bpm ?? 120);
      return NextResponse.json({ code, prompt });
    }

    // Default: generate MIDI data
    let midi: ReturnType<typeof generateMockMidi>;

    if (isOpenAIConfigured()) {
      midi = await generateMidiFromPrompt(prompt);
    } else {
      midi = generateMockMidi(bpm ?? 120);
    }

    return NextResponse.json({ type: "midi", data: midi, prompt });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "生成失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}