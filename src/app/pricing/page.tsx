"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useTier } from "@/hooks/use-tier";

const COMPARISON = {
  headers: ["功能", "Free", "Pro"],
  rows: [
    { feature: "價格", free: "免費", pro: "$19/月" },
    { feature: "生成時長", free: "最長 30 秒", pro: "最長 3 分鐘" },
    { feature: "音樂結構", free: "循環片段（8 小節）", pro: "完整編曲導入/主歌/副歌/橋段/結尾" },
    { feature: "樂器軌數", free: "4 軌", pro: "6 軌" },
    { feature: "鋼琴卷軸編輯", free: "✓", pro: "✓" },
    { feature: "MIDI JSON 匯出", free: "✓", pro: "✓" },
    { feature: "WAV 音檔匯出", free: "—", pro: "✓" },
    { feature: "MP3 匯出", free: "—", pro: "即將推出" },
    { feature: "三種創作模式", free: "✓", pro: "✓" },
    { feature: "AI 生成 MIDI", free: "✓", pro: "✓（更長更完整）" },
    { feature: "本地 LLM 支援", free: "✓", pro: "✓" },
    { feature: "商業使用授權", free: "—", pro: "✓" },
  ],
};

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { tier, redeem } = useTier();
  const isPro = tier === "paid";

  const handleUpgrade = () => {
    const result = redeem("pro");
    if (result.success) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <section className="py-16 px-4 border-b bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">選擇適合你的方案</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Free 方案讓你先體驗 AI 音樂創作的魅力，Pro 方案解鎖完整編曲與音檔匯出。
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Free */}
          <div className="rounded-2xl border border-gray-200 p-8 bg-white">
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <p className="text-gray-500 text-sm mb-4">適合初學者與探索</p>
            <div className="text-4xl font-bold mb-6">$0</div>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start gap-3">✓ 30 秒循環片段</li>
              <li className="flex items-start gap-3">✓ 4 軌樂器</li>
              <li className="flex items-start gap-3">✓ 鋼琴卷軸編輯</li>
              <li className="flex items-start gap-3">✓ MIDI JSON 匯出</li>
              <li className="flex items-start gap-3 text-gray-300">— WAV 匯出</li>
              <li className="flex items-start gap-3 text-gray-300">— 完整編曲結構</li>
            </ul>
            <Link href={session ? "/dashboard" : "/auth/signin"}
              onClick={(e) => { if (!session) { e.preventDefault(); signIn(); } }}
              className="block text-center py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
              免費開始
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-purple-500 p-8 bg-white shadow-xl shadow-purple-100 relative">
            <div className="absolute -top-3 left-6 px-4 py-0.5 rounded-full bg-purple-600 text-white text-xs font-medium">
              最受歡迎
            </div>
            <h2 className="text-xl font-bold mb-1">Pro</h2>
            <p className="text-gray-500 text-sm mb-4">適合認真創作的音樂人</p>
            <div className="text-4xl font-bold mb-6">$19<span className="text-base text-gray-400 font-normal">/月</span></div>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-start gap-3">✓ 最長 3 分鐘</li>
              <li className="flex items-start gap-3">✓ 6 軌樂器</li>
              <li className="flex items-start gap-3">✓ 鋼琴卷軸編輯</li>
              <li className="flex items-start gap-3">✓ MIDI JSON 匯出</li>
              <li className="flex items-start gap-3">✓ WAV 音檔匯出</li>
              <li className="flex items-start gap-3">✓ 完整編曲（前奏/主歌/副歌/橋段）</li>
              <li className="flex items-start gap-3">✓ 商業使用授權</li>
            </ul>
            {isPro ? (
              <Link href="/dashboard"
                className="block text-center py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors">
                ✓ 已升級 Pro
              </Link>
            ) : (
              <button onClick={handleUpgrade}
                className="block w-full text-center py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors">
                立即升級
              </button>
            )}
            <p className="text-xs text-gray-400 text-center mt-2">目前免費體驗，點擊即可升級 Pro</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-12 px-4 border-t bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">完整功能比較</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {COMPARISON.headers.map((h) => (
                    <th key={h} className={`text-left py-3 px-4 font-semibold ${
                      h === "Pro" ? "text-purple-600" : "text-gray-500"
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-white transition-colors">
                    <td className="py-3 px-4 text-gray-700">{row.feature}</td>
                    <td className={`py-3 px-4 ${row.free === "✓" ? "text-green-600" : row.free === "—" ? "text-gray-300" : "text-gray-600"}`}>{row.free}</td>
                    <td className={`py-3 px-4 ${row.pro === "✓" ? "text-green-600" : row.pro === "—" ? "text-gray-300" : "text-purple-600 font-medium"}`}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 border-t bg-gradient-to-br from-purple-600 to-purple-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">開始創作你的第一首歌</h2>
          <p className="text-purple-200 mb-8">Free 方案無需信用卡，立即體驗 AI 音樂創作的無限可能</p>
          <Link href={session ? "/dashboard" : "/auth/signin"}
            onClick={(e) => { if (!session) { e.preventDefault(); signIn(); } }}
            className="inline-block px-8 py-3.5 rounded-xl bg-white text-purple-700 font-medium hover:bg-purple-50 transition-colors text-lg shadow-lg">
            免費開始
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          Museai &mdash; AI 音樂創作平台
        </div>
      </footer>
    </div>
  );
}