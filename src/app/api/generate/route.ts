import { NextRequest, NextResponse } from "next/server";
import { generateMusicParams, generateLiveCode } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode, bpm, key } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "請提供音樂描述" }, { status: 400 });
    }

    if (mode === "livecode") {
      const code = await generateLiveCode(prompt, bpm ?? 120, key ?? "C");
      return NextResponse.json({ code, prompt });
    }

    // Default: chat/timeline mode - return structured music params
    const params = await generateMusicParams(prompt);
    return NextResponse.json({ ...params, prompt });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "生成失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}