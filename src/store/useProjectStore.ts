import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeatureCollection } from 'geojson';
import type { EYASettings, MicrositingSettings, TurbinePosition } from '../types';

export type BasemapKey = 'satellite' | 'hybrid' | 'streets' | 'terrain';

export interface PlaceFolder {
  id: string;
  name: string;
  expanded: boolean;
}

export interface SavedPlace {
  id: string;
  name: string;
  folderId?: string;   // defaults to 'general' when undefined
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

// ── Core operational layers ───────────────────────────────────────────────────
type CoreLayerKey =
  | 'boundary'
  | 'turbines'
  | 'externalTurbines'
  | 'exclusionZones'
  | 'water'
  | 'dwellings'
  | 'roads'
  | 'railways'
  | 'ehvLines'
  | 'setbackBuffers';

// ── GIS data-dictionary layers (19 new; 'roads' is shared with CoreLayerKey) ─
type GISLayerKey =
  // Base Data
  | 'dtm'
  | 'landCover'
  | 'slopeGrid'
  | 'imageryMosaic'
  // Infrastructure (roads reuses CoreLayerKey)
  | 'powerTransmission'
  | 'gridSubstations'
  | 'undergroundPipelines'
  // Administrative
  | 'districtBoundaries'
  | 'revenueVillages'
  | 'protectedAreas'
  | 'restrictedAirspace'
  // Environment
  | 'windResourceGrid'
  | 'floodZones'
  | 'wildlifeCorridors'
  | 'forestCover'
  // Socioeconomics
  | 'populationGrid'
  | 'noiseReceptors'
  | 'shadowFlickerZones'
  | 'landParcels';

export type LayerKey = CoreLayerKey | GISLayerKey;

const defaultLayerVisibility: Record<LayerKey, boolean> = {
  // Core operational (default on)
  boundary: true,
  turbines: true,
  externalTurbines: true,
  exclusionZones: true,
  water: true,
  dwellings: true,
  roads: true,
  railways: true,
  ehvLines: true,
  setbackBuffers: true,
  // GIS data-dictionary layers (default off — no data loaded yet)
  dtm: false,
  landCover: false,
  slopeGrid: false,
  imageryMosaic: false,
  powerTransmission: false,
  gridSubstations: false,
  undergroundPipelines: false,
  districtBoundaries: false,
  revenueVillages: false,
  protectedAreas: false,
  restrictedAirspace: false,
  windResourceGrid: false,
  floodZones: false,
  wildlifeCorridors: false,
  forestCover: false,
  populationGrid: false,
  noiseReceptors: false,
  shadowFlickerZones: false,
  landParcels: false,
};

export interface ProjectState {
  projectId: string | null;
  projectName: string;
  projectBoundary: FeatureCollection | null;
  exclusionZones: FeatureCollection | null;
  turbines: TurbinePosition[];
  eyaSettings: EYASettings;
  micrositingSettings: MicrositingSettings;
  customPowerCurves: Record<string, [number, number][]>;

  externalTurbines: TurbinePosition[];
  mapFeatures: FeatureCollection | null;

  selectedTurbineId: string | null;

  /** Which tab placed the current turbines — gates EYA report display for imports */
  turbineSource: 'generated' | 'imported' | null;
  /** True once user explicitly clicks "Generate EYA Report" on the import tab */
  importEyaApproved: boolean;
  /** JSON.stringify of eyaSettings at approval time — used for dirty detection */
  importEyaSettingsKey: string | null;

  basemap: BasemapKey;
  savedPlaces: SavedPlace[];
  placeFolders: PlaceFolder[];

  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setProjectBoundary: (boundary: FeatureCollection | null) => void;
  setExclusionZones: (zones: FeatureCollection | null) => void;
  setExternalTurbines: (turbines: TurbinePosition[]) => void;
  setMapFeatures: (features: FeatureCollection | null) => void;
  setTurbines: (turbines: TurbinePosition[]) => void;
  updateTurbine: (id: string, data: Partial<TurbinePosition>) => void;
  setEYASettings: (settings: Partial<EYASettings>) => void;
  setMicrositingSettings: (settings: Partial<MicrositingSettings>) => void;
  setCustomPowerCurve: (modelId: string, curve: [number, number][]) => void;
  clearCustomPowerCurve: (modelId: string) => void;
  layerVisibility: Record<LayerKey, boolean>;
  setLayerVisibility: (key: LayerKey, visible: boolean) => void;
  setSelectedTurbineId: (id: string | null) => void;
  setTurbineSource: (source: 'generated' | 'imported' | null) => void;
  setImportEyaApproved: (approved: boolean, settingsKey?: string | null) => void;
  setBasemap: (basemap: BasemapKey) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'id'>) => void;
  removeSavedPlace: (id: string) => void;
  addPlaceFolder: (name: string) => void;
  removePlaceFolder: (id: string) => void;
  renamePlaceFolder: (id: string, name: string) => void;
  toggleFolderExpanded: (id: string) => void;
  restoreProject: (snap: {
    projectId: string; projectName: string;
    projectBoundary: import('geojson').FeatureCollection | null;
    exclusionZones: import('geojson').FeatureCollection | null;
    mapFeatures: import('geojson').FeatureCollection | null;
    turbines: TurbinePosition[];
    externalTurbines: TurbinePosition[];
    eyaSettings: EYASettings;
    micrositingSettings: MicrositingSettings;
    customPowerCurves: Record<string, [number, number][]>;
  }) => void;
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
  prevailingWindDir: 270,
};

const initialState = {
  projectId: null,
  projectName: 'New Wind Farm Project',
  projectBoundary: null,
  exclusionZones: null,
  turbines: [],
  externalTurbines: [],
  mapFeatures: null,
  eyaSettings: defaultEYASettings,
  micrositingSettings: defaultMicrositingSettings,
  customPowerCurves: {},
  layerVisibility: defaultLayerVisibility,
  selectedTurbineId: null,
  turbineSource: null as 'generated' | 'imported' | null,
  importEyaApproved: false,
  importEyaSettingsKey: null as string | null,
  basemap: 'satellite' as BasemapKey,
  savedPlaces: [] as SavedPlace[],
  placeFolders: [{ id: 'general', name: 'General', expanded: true }] as PlaceFolder[],
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,
      setProjectId: (id) => set({ projectId: id }),
      setProjectName: (name) => set({ projectName: name }),
      setProjectBoundary: (boundary) => set({ projectBoundary: boundary }),
      setExclusionZones: (zones) => set({ exclusionZones: zones }),
      setExternalTurbines: (turbines) => set({ externalTurbines: turbines }),
      setMapFeatures: (features) => set({ mapFeatures: features }),
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
      setLayerVisibility: (key, visible) =>
        set((state) => ({ layerVisibility: { ...state.layerVisibility, [key]: visible } })),
      setSelectedTurbineId: (id) => set({ selectedTurbineId: id }),
      setTurbineSource: (source) => set({ turbineSource: source }),
      setImportEyaApproved: (approved, settingsKey = null) =>
        set({ importEyaApproved: approved, importEyaSettingsKey: settingsKey }),
      setBasemap: (basemap) => set({ basemap }),
      addSavedPlace: (place) =>
        set((state) => ({
          savedPlaces: [...state.savedPlaces, { ...place, id: crypto.randomUUID() }],
        })),
      removeSavedPlace: (id) =>
        set((state) => ({ savedPlaces: state.savedPlaces.filter((p) => p.id !== id) })),
      addPlaceFolder: (name) =>
        set((state) => ({
          placeFolders: [...state.placeFolders, { id: crypto.randomUUID(), name, expanded: true }],
        })),
      removePlaceFolder: (id) =>
        set((state) => ({
          placeFolders: state.placeFolders.filter((f) => f.id !== id),
          savedPlaces:  state.savedPlaces.filter((p) => (p.folderId ?? 'general') !== id),
        })),
      renamePlaceFolder: (id, name) =>
        set((state) => ({
          placeFolders: state.placeFolders.map((f) => f.id === id ? { ...f, name } : f),
        })),
      toggleFolderExpanded: (id) =>
        set((state) => ({
          placeFolders: state.placeFolders.map((f) => f.id === id ? { ...f, expanded: !f.expanded } : f),
        })),
      restoreProject: (snap) => set({
        projectId: snap.projectId,
        projectName: snap.projectName,
        projectBoundary: snap.projectBoundary,
        exclusionZones: snap.exclusionZones,
        mapFeatures: snap.mapFeatures,
        turbines: snap.turbines,
        externalTurbines: snap.externalTurbines,
        eyaSettings: snap.eyaSettings,
        micrositingSettings: snap.micrositingSettings,
        customPowerCurves: snap.customPowerCurves,
        selectedTurbineId: null,
        layerVisibility: defaultLayerVisibility,
        turbineSource: 'generated',
        importEyaApproved: true,
        importEyaSettingsKey: null,
      }),
      resetProject: () => set(initialState),
    }),
    {
      name: 'wind-farm-storage-v2',
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectBoundary: state.projectBoundary,
        exclusionZones: state.exclusionZones,
        mapFeatures: state.mapFeatures,
        turbines: state.turbines,
        externalTurbines: state.externalTurbines,
        eyaSettings: state.eyaSettings,
        micrositingSettings: state.micrositingSettings,
        customPowerCurves: state.customPowerCurves,
        layerVisibility: state.layerVisibility,
        turbineSource: state.turbineSource,
        importEyaApproved: state.importEyaApproved,
        importEyaSettingsKey: state.importEyaSettingsKey,
        basemap: state.basemap,
        savedPlaces: state.savedPlaces,
        placeFolders: state.placeFolders,
      }),
    }
  )
);
