import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MidiData } from "./midi";

export type TrackType = "AUDIO" | "MIDI" | "CODE";

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  audioUrl?: string;
  waveformData?: string;
  duration?: number;
  midiData?: string;
  code?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  bpm: number;
  timeSignature: string;
  key: string;
  scale: string;
  isPublic: boolean;
  tracks: Track[];
  commits: VersionCommit[];
  createdAt: string;
  updatedAt: string;
}

export interface VersionCommit {
  id: string;
  parentId: string | null;
  timestamp: string;
  prompt: string;
  midi: MidiData;
  message: string;
  type: "generate" | "edit" | "export";
}

export interface GenerationJob {
  id: string;
  prompt: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  resultUrl?: string;
  error?: string;
  createdAt: string;
}

export interface PromptEntry {
  id: string;
  prompt: string;
  mode: "CHAT" | "TIMELINE" | "LIVE_CODING";
  response?: Record<string, unknown>;
  createdAt: string;
}

let _idCounter = 0;
function generateId(): string {
  _idCounter++;
  return `${Date.now().toString(36)}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function summarizeCommit(tracks: number, notes: number, bpm: number): string {
  return `${tracks} 軌 · ${notes} 個音符 · ${bpm} BPM`;
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  hydrated: boolean;
  createProject: (name: string, bpm?: number, key?: string, scale?: string) => Project;
  getProject: (id: string) => Project | undefined;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  clearStore: () => void;
  setCurrentProject: (id: string | null) => void;
  addTrack: (projectId: string, track: Partial<Track>) => Track;
  updateTrack: (projectId: string, trackId: string, data: Partial<Track>) => void;
  deleteTrack: (projectId: string, trackId: string) => void;
  getGenerations: (projectId: string) => GenerationJob[];
  addGeneration: (projectId: string, job: Partial<GenerationJob>) => GenerationJob;
  getPrompts: (projectId: string) => PromptEntry[];
  addPrompt: (projectId: string, entry: Partial<PromptEntry>) => PromptEntry;
  addCommit: (projectId: string, commit: Omit<VersionCommit, "id" | "parentId" | "timestamp" | "message">) => VersionCommit;
  getCommits: (projectId: string) => VersionCommit[];
  restoreCommit: (projectId: string, commitId: string) => VersionCommit;
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "demo-1",
    name: "Deep House Demo",
    bpm: 120,
    timeSignature: "4/4",
    key: "C",
    scale: "minor",
    isPublic: false,
    tracks: [],
    commits: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: DEFAULT_PROJECTS,
      currentProjectId: null,
      hydrated: false,

      createProject: (name, bpm = 120, key = "C", scale = "major") => {
        const project: Project = {
          id: generateId(),
          name,
          bpm,
          timeSignature: "4/4",
          key,
          scale,
          isPublic: false,
          tracks: [],
          commits: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },

      getProject: (id) => {
        return get().projects.find((p) => p.id === id);
      },

      updateProject: (id, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
      },

      setCurrentProject: (id) => set({ currentProjectId: id }),

      addTrack: (projectId, trackData) => {
        const track: Track = {
          id: generateId(),
          name: `Track ${(get().getProject(projectId)?.tracks.length ?? 0) + 1}`,
          type: "AUDIO",
          order: 0,
          volume: 1,
          pan: 0,
          muted: false,
          soloed: false,
          createdAt: new Date().toISOString(),
          ...trackData,
        };
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, tracks: [...p.tracks, track], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        return track;
      },

      updateTrack: (projectId, trackId, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, ...data } : t)),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      deleteTrack: (projectId, trackId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tracks: p.tracks.filter((t) => t.id !== trackId),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      getGenerations: () => [],
      addGeneration: () => ({
        id: generateId(),
        prompt: "",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      }),

      getPrompts: () => [],
      addPrompt: () => ({
        id: generateId(),
        prompt: "",
        mode: "CHAT",
        createdAt: new Date().toISOString(),
      }),

      clearStore: () => {
    set({ projects: DEFAULT_PROJECTS, currentProjectId: null });
    try { localStorage.removeItem("museai-storage"); } catch {}
    try { localStorage.removeItem("museai_tier"); } catch {}
    try { localStorage.removeItem("museai_promo_redeemed"); } catch {}
  },

  addCommit: (projectId, data) => {
        const project = get().getProject(projectId);
        const parentId = project?.commits.length
          ? project.commits[project.commits.length - 1].id
          : null;
        const totalNotes = data.midi.tracks.reduce((s, t) => s + t.notes.length, 0);
        const commit: VersionCommit = {
          id: generateId(),
          parentId,
          timestamp: new Date().toISOString(),
          message: summarizeCommit(data.midi.tracks.length, totalNotes, data.midi.bpm),
          ...data,
        };
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, commits: [...p.commits, commit], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        return commit;
      },

      getCommits: (projectId) => {
        return get().getProject(projectId)?.commits ?? [];
      },

      restoreCommit: (projectId, commitId) => {
        const project = get().getProject(projectId);
        const commit = project?.commits.find((c) => c.id === commitId);
        if (!project || !commit) throw new Error("Commit not found");

        const restoredTracks = commit.midi.tracks.map((t) => ({
          id: generateId(),
          name: t.name,
          type: "MIDI" as const,
          order: t.channel,
          volume: 1,
          pan: 0,
          muted: false,
          soloed: false,
          duration: commit.midi.totalBeats * (60 / commit.midi.bpm),
          midiData: JSON.stringify(commit.midi),
          createdAt: new Date().toISOString(),
        }));

        const totalNotes = commit.midi.tracks.reduce((s, t) => s + t.notes.length, 0);
        const restoreCommit: VersionCommit = {
          id: generateId(),
          parentId: commitId,
          timestamp: new Date().toISOString(),
          prompt: `回朔到 commit ${commitId.slice(0, 6)}: ${commit.prompt}`,
          midi: commit.midi,
          message: `↩ 回朔 · ${summarizeCommit(commit.midi.tracks.length, totalNotes, commit.midi.bpm)}`,
          type: "edit",
        };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tracks: restoredTracks,
                  commits: [...p.commits, restoreCommit],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));

        return restoreCommit;
      },
    }),
    {
      name: "museai-storage",
      version: 1,
      migrate: (persisted) => {
        const raw = persisted as any;
        if (!raw || !Array.isArray(raw?.projects)) return { projects: DEFAULT_PROJECTS };
        return {
          projects: raw.projects.filter((p: any) => p && typeof p.id === "string"),
          currentProjectId: typeof raw.currentProjectId === "string" ? raw.currentProjectId : null,
        };
      },
      onRehydrateStorage: () => () => {
        useProjectStore.setState({ hydrated: true });
      },
    }
  )
);