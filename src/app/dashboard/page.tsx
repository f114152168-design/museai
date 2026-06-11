"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useProjectStore } from "@/lib/store";

export default function Dashboard() {
  const { data: session } = useSession();
  const projects = useProjectStore((s) => s.projects);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">我的專案</h1>
          <p className="text-gray-500 text-sm mt-1">
            {session?.user ? `${session.user.name ?? session.user.email}，歡迎回來` : "歡迎使用 Museai"}
          </p>
        </div>
        <Link
          href="/project/new"
          className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
        >
          新增專案
        </Link>
      </div>

      {projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="p-5 rounded-xl border bg-white hover:border-purple-300 transition-all hover:shadow-sm"
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