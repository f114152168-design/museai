"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectStore } from "@/lib/store";

export default function NewProject() {
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);

  const [name, setName] = useState("");
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState("C");
  const [scale, setScale] = useState("major");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const project = createProject(name.trim(), bpm, key, scale);
    router.push(`/project/${project.id}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">新增專案</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">專案名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="我的新作品"
              className="w-full px-3 py-2 rounded-lg border text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">BPM</label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min={60}
                max={200}
                className="w-full px-3 py-2 rounded-lg border text-gray-900 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">調性</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-gray-900 bg-white focus:outline-none focus:border-purple-500"
              >
                {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">音階</label>
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-gray-900 bg-white focus:outline-none focus:border-purple-500"
              >
                <option value="major">大調</option>
                <option value="minor">小調</option>
                <option value="dorian">多利安</option>
                <option value="phrygian">弗里吉安</option>
                <option value="lydian">利底安</option>
                <option value="mixolydian">混合利底安</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
          >
            建立專案
          </button>
        </form>
      </div>
    </div>
  );
}