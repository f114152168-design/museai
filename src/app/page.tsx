"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";

const TIERS = [
  {
    name: "Free",
    price: "0",
    period: "永久免費",
    desc: "適合探索 AI 音樂創作",
    cta: "開始免費使用",
    href: "/dashboard",
    accent: "gray",
    features: [
      { text: "30 秒循環片段", ok: true },
      { text: "4 軌樂器", ok: true },
      { text: "MIDI JSON 匯出", ok: true },
      { text: "鋼琴卷軸編輯", ok: true },
      { text: "3 種創作模式", ok: true },
      { text: "完整編曲（前奏/主歌/副歌）", ok: false },
      { text: "最長 3 分鐘", ok: false },
      { text: "WAV 音檔匯出", ok: false },
      { text: "MP3 匯出", ok: false },
    ],
  },
  {
    name: "Pro",
    price: "19",
    period: " /月",
    desc: "適合認真創作的音樂人",
    cta: "升級 Pro",
    href: "/pricing",
    accent: "purple",
    popular: true,
    features: [
      { text: "最長 3 分鐘完整編曲", ok: true },
      { text: "6 軌樂器", ok: true },
      { text: "MIDI JSON 匯出", ok: true },
      { text: "鋼琴卷軸編輯", ok: true },
      { text: "3 種創作模式", ok: true },
      { text: "完整編曲（前奏/主歌/副歌）", ok: true },
      { text: "最長 3 分鐘", ok: true },
      { text: "WAV 音檔匯出", ok: true },
      { text: "MP3 匯出（即將推出）", ok: true },
    ],
  },
];

const FAQ = [
  { q: "Free 方案有什麼限制？", a: "Free 方案每次生成最長 30 秒（8 小節循環片段），僅支援 4 軌樂器，無法匯出 WAV 音檔。" },
  { q: "Pro 方案可以生成多長的音樂？", a: "Pro 方案最長可生成 3 分鐘的完整編曲，包含前奏、主歌、副歌、橋段、結尾等完整結構。" },
  { q: "匯出格式有哪些？", a: "Free 方案可匯出 MIDI JSON；Pro 方案可匯出 MIDI JSON 及 WAV 音檔，MP3 即將推出。" },
  { q: "需要音樂理論知識嗎？", a: "完全不需要。用自然語言描述你想要的音樂風格，AI 會自動生成 MIDI 音符。" },
  { q: "可以編輯生成的音樂嗎？", a: "可以。生成的 MIDI 可在鋼琴卷軸中檢視，每個音符的 pitch、時長、力度都可編輯。" },
  { q: "付款方式有哪些？", a: "Pro 方案目前支援信用卡付款（即將上線）。目前可透過 .env 設定自由切換體驗。" },
];

export default function Home() {
  const { data: session } = useSession();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-50 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            AI 驅動的音樂創作平台
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            用 AI 創作
            <br />
            屬於你的音樂
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            輸入文字描述，AI 即時生成 MIDI 樂譜。
            鋼琴卷軸編輯、三種創作模式、一鍵匯出音檔。
            <br />
            不需要樂理知識，就能創作出專業水準的電子音樂。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={session ? "/dashboard" : "/auth/signin"}
              className="px-8 py-3.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors text-lg shadow-lg shadow-purple-200">
              免費開始創作
            </Link>
            <Link href="#pricing"
              className="px-8 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-lg">
              查看方案
            </Link>
          </div>
          <div className="mt-12 text-sm text-gray-400 flex items-center justify-center gap-6">
            <span>✓ 無需信用卡</span>
            <span>✓ 免費方案可用</span>
            <span>✓ 立即生成</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 border-t bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">三步驟創作音樂</h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">從靈感到成品，只需要三個步驟</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "描述音樂", desc: "用自然語言描述你想要的音樂風格、節奏、情緒", color: "purple" },
              { step: "02", title: "AI 生成 MIDI", desc: "AI 理解你的描述，即時生成 MIDI 音符與編曲結構", color: "cyan" },
              { step: "03", title: "編輯與匯出", desc: "在鋼琴卷軸中調整細節，或一鍵匯出 MIDI / WAV", color: "green" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`w-14 h-14 rounded-2xl bg-${item.color}-100 flex items-center justify-center mx-auto mb-4 text-${item.color}-600 font-bold text-lg`}>
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="py-20 px-4 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">三種創作模式，滿足不同 workflow</h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">無論你習慣用文字、圖形介面還是程式碼，Museai 都支援</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "聊天模式", desc: "用自然語言與 AI 對話，描述想要的音樂風格、節奏和情緒，即時生成 MIDI。適合快速發想與迭代。", icon: "💬", color: "purple" },
              { title: "時間軸模式", desc: "類似 DAW 的多軌編輯器。拖放排列段落、調整音量聲相、疊加效果器。適合精細編曲。", icon: "🎛️", color: "cyan" },
              { title: "即時編程模式", desc: "用 JavaScript 編寫演算法音樂，內建 MIDI API。AI 可幫你生成程式碼。適合技術型創作者。", icon: "⌨️", color: "green" },
            ].map((mode) => (
              <div key={mode.title} className="p-6 rounded-xl border bg-white hover:border-purple-200 hover:shadow-sm transition-all">
                <div className="text-3xl mb-4">{mode.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{mode.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-t bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">為什麼選擇 Museai？</h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">不只生成音樂，更讓你掌控每一個音符</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "MIDI 編輯", desc: "生成的音樂不是不可修改的音檔，而是可逐一編輯的 MIDI 音符", icon: "🎹" },
              { title: "多種模式", desc: "聊天、時間軸、即時編程 — 三種模式滿足不同創作習慣", icon: "🔄" },
              { title: "多格式匯出", desc: "MIDI JSON / WAV，自由選擇編輯或直接使用", icon: "📦" },
              { title: "AI 輔助", desc: "OpenAI 驅動，也可接本地 LLM，完整掌控生成品質", icon: "🤖" },
            ].map((feat) => (
              <div key={feat.title} className="p-5 rounded-xl border bg-gray-50">
                <div className="text-2xl mb-3">{feat.icon}</div>
                <h3 className="font-semibold mb-1 text-sm">{feat.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 border-t bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">簡單透明的價格</h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">免費體驗，升級解鎖完整功能</p>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`rounded-2xl border-2 p-8 bg-white relative ${
                tier.popular ? "border-purple-500 shadow-xl shadow-purple-100" : "border-gray-200"
              }`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-purple-600 text-white text-xs font-medium">
                    最受歡迎
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                  <p className="text-gray-500 text-sm">{tier.desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-gray-400">{tier.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      <span className={f.ok ? "text-green-500 mt-0.5" : "text-gray-300 mt-0.5"}>
                        {f.ok ? "✓" : "—"}
                      </span>
                      <span className={f.ok ? "text-gray-700" : "text-gray-400"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href}
                  onClick={(e) => {
                    if (!session && tier.name === "Free") {
                      e.preventDefault();
                      signIn();
                    }
                  }}
                  className={`block text-center py-3 rounded-xl font-medium transition-colors ${
                    tier.popular
                      ? "bg-purple-600 text-white hover:bg-purple-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">常見問題</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="border rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left font-medium hover:bg-gray-50 transition-colors">
                  {item.q}
                  <span className={`text-gray-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-500 text-sm">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t bg-gradient-to-br from-purple-600 to-purple-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">準備好創作了嗎？</h2>
          <p className="text-purple-200 mb-8 max-w-md mx-auto">免費開始，無需信用卡。升級 Pro 解鎖無限創作。</p>
          <Link href={session ? "/dashboard" : "/auth/signin"}
            className="inline-block px-8 py-3.5 rounded-xl bg-white text-purple-700 font-medium hover:bg-purple-50 transition-colors text-lg shadow-lg">
            免費開始創作
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">M</div>
            <span className="font-semibold text-sm">Museai</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="#pricing" className="hover:text-gray-600">方案</Link>
            <Link href="/dashboard" className="hover:text-gray-600">開始使用</Link>
            <span>© 2026 Museai</span>
          </div>
        </div>
      </footer>
    </div>
  );
}