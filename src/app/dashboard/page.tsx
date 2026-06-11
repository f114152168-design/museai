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
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {session?.user ? `Welcome, ${session.user.name ?? session.user.email}` : "Welcome to Museai"}
          </p>
        </div>
        <Link
          href="/project/new"
          className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
        >
          New Project
        </Link>
      </div>

      {projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="p-5 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-purple-500/30 transition-all hover:bg-gray-900"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold truncate">{project.name}</h3>
                {project.tracks.length > 0 && (
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {project.tracks.length} track{project.tracks.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{project.bpm} BPM</span>
                <span>{project.key} {project.scale}</span>
                <span>{project.timeSignature}</span>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                Updated {new Date(project.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎵</div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-gray-400 mb-6">Create your first project to start making music</p>
          <Link
            href="/project/new"
            className="px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
          >
            Create Project
          </Link>
        </div>
      )}
    </div>
  );
}