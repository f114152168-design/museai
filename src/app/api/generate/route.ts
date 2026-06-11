import { NextRequest, NextResponse } from "next/server";
import { generateMusicParams, generateLiveCode, isOpenAIConfigured } from "@/lib/openai";

export async function GET() {
  return NextResponse.json({
    configured: isOpenAIConfigured(),
    message: isOpenAIConfigured() ? "OpenAI API 已串接" : "OpenAI API 未串接 - 請在 .env 設定 OPENAI_API_KEY",
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY 未設定",
          hint: "請在專案根目錄的 .env 檔案中加入：\nOPENAI_API_KEY=\"sk-your-key-here\"\n\n然後重新啟動 dev server。",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { prompt, mode, bpm, key } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "請提供音樂描述" }, { status: 400 });
    }

    if (mode === "livecode") {
      const code = await generateLiveCode(prompt, bpm ?? 120, key ?? "C");
      return NextResponse.json({ code, prompt });
    }

    const params = await generateMusicParams(prompt);
    return NextResponse.json({ ...params, prompt });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "生成失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}