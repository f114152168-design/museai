"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/lib/store";
import { useTier } from "@/hooks/use-tier";

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const clearStore = useProjectStore((s) => s.clearStore);
  const { isFree } = useTier();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete === id) {
      deleteProject(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  const handleClearAll = () => {
    clearStore();
    setShowReset(false);
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {isFree && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <div>
              <p className="text-sm font-medium text-gray-800">你正在使用 Free 方案</p>
              <p className="text-xs text-gray-500">升級 Pro 解鎖完整編曲（最長 3 分鐘）與 WAV 匯出</p>
            </div>
          </div>
          <Link href="/pricing" className="shrink-0 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors">
            升級 Pro
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">我的專案</h1>
          <p className="text-gray-500 text-sm mt-1">
            {session?.user ? `${session.user.name ?? session.user.email}，歡迎回來` : "歡迎使用 Museai"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReset(!showReset)}
            className="px-3 py-2 rounded-lg border text-xs text-gray-500 hover:bg-gray-50 transition-colors">
            重置資料
          </button>
          <Link href="/project/new"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors">
            新增專案
          </Link>
        </div>
      </div>

      {showReset && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">清除所有資料</p>
            <p className="text-xs text-red-600">將刪除所有專案、版本紀錄，並清除 localStorage 快取（若頁面持續異常可試此操作）</p>
          </div>
          <button onClick={handleClearAll}
            className="shrink-0 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">
            確認清除
          </button>
        </div>
      )}

      {projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <Link
                href={`/project/${project.id}`}
                className="block p-5 rounded-xl border bg-white hover:border-purple-300 transition-all hover:shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold truncate">{project.name}</h3>
                  {project.tracks.length > 0 && (
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {project.tracks.length} 軌
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{project.bpm} BPM</span>
                  <span>{project.key} {project.scale}</span>
                  <span>{project.timeSignature}</span>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  更新於 {new Date(project.updatedAt).toLocaleDateString("zh-TW")}
                </div>
              </Link>
              <button onClick={(e) => handleDelete(project.id, e)}
                className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  confirmDelete === project.id
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500"
                }`}>
                {confirmDelete === project.id ? "確認刪除" : "刪除"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎵</div>
          <h2 className="text-xl font-semibold mb-2">還沒有專案</h2>
          <p className="text-gray-500 mb-6">建立你的第一個專案，開始創作音樂</p>
          <Link
            href="/project/new"
            className="px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
          >
            建立專案
          </Link>
        </div>
      )}
    </div>
  );
}