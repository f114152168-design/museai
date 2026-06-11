import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-8">
            AI-Powered Music Creation Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Create Electronic Music
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Without Limits
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Describe your vision in natural language, arrange with MIDI,
            or live code in real time. Museai turns your ideas into music.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors text-lg"
            >
              Start Creating
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-3 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800 transition-colors text-lg"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Three Ways to Create</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Chat",
                desc: "Describe your track in natural language. Museai's AI interprets your prompt and generates music instantly.",
                icon: "💬",
              },
              {
                title: "Timeline",
                desc: "Arrange audio clips, adjust volumes, pan, and effects in a familiar DAW-like interface.",
                icon: "🎛️",
              },
              {
                title: "Live Code",
                desc: "Write algorithmic compositions with code. Real-time feedback for the adventurous producer.",
                icon: "⌨️",
              },
            ].map((mode) => (
              <div
                key={mode.title}
                className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-purple-500/30 transition-colors"
              >
                <div className="text-3xl mb-4">{mode.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{mode.title}</h3>
                <p className="text-gray-400">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          Museai &mdash; AI Music Creation Platform
        </div>
      </footer>
    </div>
  );
}