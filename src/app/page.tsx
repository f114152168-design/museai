import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-sm mb-8">
            AI 驅動的電子音樂創作平台
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            用 AI 創作電子音樂
            <br />
            <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
              無限可能
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            用自然語言描述你的想法、用 MIDI 編排、或用程式碼即時編曲。
            Museai 將你的靈感化為音樂。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors text-lg"
            >
              開始創作
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-3 rounded-xl border text-gray-600 font-medium hover:bg-gray-50 transition-colors text-lg"
            >
              了解功能
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 border-t">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">三種創作模式</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "聊天生成",
                desc: "用自然語言描述你想要的音樂。Museai 的 AI 會解讀你的提示並即時生成音檔。",
                icon: "💬",
              },
              {
                title: "時間軸編排",
                desc: "在類似 DAW 的介面中排列音軌、調整音量、聲相與效果器。",
                icon: "🎛️",
              },
              {
                title: "即時編程",
                desc: "用程式碼創作演算法音樂。即時回饋，適合喜歡探索的音樂人。",
                icon: "⌨️",
              },
            ].map((mode) => (
              <div
                key={mode.title}
                className="p-6 rounded-xl border bg-white hover:border-purple-300 transition-colors"
              >
                <div className="text-3xl mb-4">{mode.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{mode.title}</h3>
                <p className="text-gray-500">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          Museai &mdash; AI 音樂創作平台
        </div>
      </footer>
    </div>
  );
}