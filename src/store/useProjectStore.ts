import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeatureCollection } from 'geojson';
import type { EYASettings, MicrositingSettings, TurbinePosition } from '../types';

export interface ProjectState {
  projectId: string | null;
  projectName: string;
  projectBoundary: FeatureCollection | null;
  exclusionZones: FeatureCollection | null;
  turbines: TurbinePosition[];
  eyaSettings: EYASettings;
  micrositingSettings: MicrositingSettings;
  customPowerCurves: Record<string, [number, number][]>;

  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setProjectBoundary: (boundary: FeatureCollection) => void;
  setExclusionZones: (zones: FeatureCollection | null) => void;
  setTurbines: (turbines: TurbinePosition[]) => void;
  updateTurbine: (id: string, data: Partial<TurbinePosition>) => void;
  setEYASettings: (settings: Partial<EYASettings>) => void;
  setMicrositingSettings: (settings: Partial<MicrositingSettings>) => void;
  setCustomPowerCurve: (modelId: string, curve: [number, number][]) => void;
  clearCustomPowerCurve: (modelId: string) => void;
  resetProject: () => void;
}

const defaultEYASettings: EYASettings = {
  freeWindSpeed: 6.5,
  weibullK: 2.0,
  airDensity: 1.17,
  projectLifetime: 25,
  wakeLoss: 8.0,
  machineAvailability: 97.0,
  bopAvailability: 99.5,
  gridAvailability: 98.0,
  transmissionEfficiency: 95.0,
  turbinePerformance: 96.8,
  curtailmentLoss: 0.0,
  environmentalLoss: 0.3,
  totalUncertainty: 11.5,
};

const defaultMicrositingSettings: MicrositingSettings = {
  targetCount: 10,
  turbineModelId: 'envision-en156-33mw',
  hubHeight: 140,
  crosswindMultiple: 5.0,
  downwindMultiple: 7.0,
  boundarySetback: 1.0,
  prevailingWindDir: 270,
};

const initialState = {
  projectId: null,
  projectName: 'New Wind Farm Project',
  projectBoundary: null,
  exclusionZones: null,
  turbines: [],
  eyaSettings: defaultEYASettings,
  micrositingSettings: defaultMicrositingSettings,
  customPowerCurves: {},
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,
      setProjectId: (id) => set({ projectId: id }),
      setProjectName: (name) => set({ projectName: name }),
      setProjectBoundary: (boundary) => set({ projectBoundary: boundary }),
      setExclusionZones: (zones) => set({ exclusionZones: zones }),
      setTurbines: (turbines) => set({ turbines }),
      updateTurbine: (id, data) =>
        set((state) => ({
          turbines: state.turbines.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),
      setEYASettings: (settings) =>
        set((state) => ({
          eyaSettings: { ...state.eyaSettings, ...settings },
        })),
      setMicrositingSettings: (settings) =>
        set((state) => ({
          micrositingSettings: { ...state.micrositingSettings, ...settings },
        })),
      setCustomPowerCurve: (modelId, curve) =>
        set((state) => ({
          customPowerCurves: { ...state.customPowerCurves, [modelId]: curve },
        })),
      clearCustomPowerCurve: (modelId) =>
        set((state) => {
          const newCurves = { ...state.customPowerCurves };
          delete newCurves[modelId];
          return { customPowerCurves: newCurves };
        }),
      resetProject: () => set(initialState),
    }),
    {
      name: 'wind-farm-storage-v2',
    }
  )
);
