import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  createdAt: string;
  updatedAt: string;
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

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  hydrated: boolean;
  createProject: (name: string, bpm?: number, key?: string, scale?: string) => Project;
  getProject: (id: string) => Project | undefined;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  addTrack: (projectId: string, track: Partial<Track>) => Track;
  updateTrack: (projectId: string, trackId: string, data: Partial<Track>) => void;
  deleteTrack: (projectId: string, trackId: string) => void;
  getGenerations: (projectId: string) => GenerationJob[];
  addGeneration: (projectId: string, job: Partial<GenerationJob>) => GenerationJob;
  getPrompts: (projectId: string) => PromptEntry[];
  addPrompt: (projectId: string, entry: Partial<PromptEntry>) => PromptEntry;
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
    }),
    {
      name: "museai-storage",
      onRehydrateStorage: () => () => {
        useProjectStore.setState({ hydrated: true });
      },
    }
  )
);