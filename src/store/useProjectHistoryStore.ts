import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeatureCollection } from 'geojson';
import type { EYASettings, MicrositingSettings, TurbinePosition } from '../types';

export interface ProjectSnapshot {
  id: string;
  name: string;
  savedAt: string;           // ISO timestamp
  turbineCount: number;
  capacityMW: number;
  netAepGwh: number | null;
  plfPct: number | null;
  // Full restorable state
  projectBoundary: FeatureCollection | null;
  exclusionZones: FeatureCollection | null;
  mapFeatures: FeatureCollection | null;
  turbines: TurbinePosition[];
  externalTurbines: TurbinePosition[];
  eyaSettings: EYASettings;
  micrositingSettings: MicrositingSettings;
  customPowerCurves: Record<string, [number, number][]>;
}

interface ProjectHistoryState {
  projects: ProjectSnapshot[];
  upsertProject: (snapshot: ProjectSnapshot) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
}

export const useProjectHistoryStore = create<ProjectHistoryState>()(
  persist(
    (set) => ({
      projects: [],
      upsertProject: (snapshot) =>
        set((state) => {
          const idx = state.projects.findIndex(p => p.id === snapshot.id);
          if (idx >= 0) {
            const updated = [...state.projects];
            updated[idx] = snapshot;
            return { projects: updated };
          }
          return { projects: [snapshot, ...state.projects] };
        }),
      deleteProject: (id) =>
        set((state) => ({ projects: state.projects.filter(p => p.id !== id) })),
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map(p => p.id === id ? { ...p, name } : p),
        })),
    }),
    { name: 'wind-farm-projects-v1' }
  )
);
