import { useState } from 'react';
import {
  ChevronRight, ChevronDown,
  MapPin, Wind, Shield, Droplets, Home, Route, Train, Zap,
  Mountain, Layers, TrendingUp, Satellite,
  Building2, Pipette, Globe, Flag, TreePine, AlertOctagon,
  Gauge, Waves, Bird, Trees, Users, Volume2, Sun, FileText,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { LayerKey } from '@/store/useProjectStore';
import type { BasemapKey } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

// ── Basemap thumbnails ────────────────────────────────────────────────────────
const BASEMAPS: { key: BasemapKey; label: string; bg: string; accent: string }[] = [
  { key: 'satellite', label: 'Satellite', bg: '#0d2137', accent: '#1e4a7a' },
  { key: 'hybrid',    label: 'Hybrid',    bg: '#0d2137', accent: '#ffffff' },
  { key: 'streets',   label: 'Streets',   bg: '#e8e4dc', accent: '#c9b99a' },
  { key: 'terrain',   label: 'Terrain',   bg: '#7aad6c', accent: '#a8d4a0' },
];

function BasemapRow() {
  const basemap    = useProjectStore(s => s.basemap);
  const setBasemap = useProjectStore(s => s.setBasemap);
  return (
    <div className="px-2 py-2 border-t border-white/8">
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1.5 px-1">Basemap</p>
      <div className="grid grid-cols-4 gap-1">
        {BASEMAPS.map(b => (
          <button
            key={b.key}
            onClick={() => setBasemap(b.key)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg p-0.5 transition-all',
              basemap === b.key ? 'ring-1 ring-emerald-400' : 'hover:bg-white/8',
            )}
          >
            <div
              className="w-full h-6 rounded overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${b.bg}, ${b.accent})` }}
            />
            <span className={cn('text-[8px] leading-none', basemap === b.key ? 'text-emerald-300' : 'text-white/40')}>
              {b.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Single layer row ──────────────────────────────────────────────────────────
type DataState = 'ready' | 'raster' | 'none';

interface RowProps {
  layerKey:  LayerKey;
  label:     string;
  color:     string;
  icon:      React.ReactNode;
  count?:    number;
  dataState?: DataState;
}

function LayerRow({ layerKey, label, color, icon, count, dataState = 'ready' }: RowProps) {
  const visible = useProjectStore(s => s.layerVisibility[layerKey]);
  const setVis  = useProjectStore(s => s.setLayerVisibility);
  const hasData = dataState === 'ready';

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-[3px] px-1.5 rounded hover:bg-white/6 transition-colors group',
        !hasData && 'opacity-40',
      )}
    >
      {/* Colour swatch */}
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: hasData ? color : '#374151' }} />
      <span className="text-white/40 shrink-0">{icon}</span>
      <span className="flex-1 text-[11px] text-white/78 truncate leading-tight">{label}</span>

      {dataState === 'none' && (
        <span className="text-[8px] text-white/22 font-mono border border-white/12 rounded px-0.5 shrink-0">
          no data
        </span>
      )}
      {dataState === 'raster' && (
        <span className="text-[8px] text-amber-400/50 font-mono border border-amber-400/20 rounded px-0.5 shrink-0">
          raster
        </span>
      )}
      {hasData && count !== undefined && count > 0 && (
        <span className="text-[9px] font-mono text-white/30 shrink-0">{count}</span>
      )}

      {/* Checkbox-style toggle */}
      {hasData && (
        <button
          onClick={() => setVis(layerKey, !visible)}
          className={cn(
            'w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-all',
            visible
              ? 'bg-emerald-500 border-emerald-400'
              : 'bg-transparent border-white/25 hover:border-white/50',
          )}
        >
          {visible && <span className="w-1.5 h-1.5 rounded-sm bg-white block" />}
        </button>
      )}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ label, children, defaultOpen = true }: {
  label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 transition-colors"
      >
        {open
          ? <ChevronDown  className="w-3 h-3 text-white/30 shrink-0" />
          : <ChevronRight className="w-3 h-3 text-white/30 shrink-0" />}
        <span className="flex-1 text-left text-[9px] font-bold uppercase tracking-widest text-white/38">
          {label}
        </span>
      </button>
      {open && <div className="pl-2 space-y-0">{children}</div>}
    </div>
  );
}

// ── Sub-section (GIS categories) ─────────────────────────────────────────────
function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1 px-1 py-0.5 hover:bg-white/5 transition-colors"
      >
        {open
          ? <ChevronDown  className="w-2.5 h-2.5 text-white/22 shrink-0" />
          : <ChevronRight className="w-2.5 h-2.5 text-white/22 shrink-0" />}
        <span className="flex-1 text-left text-[9px] font-semibold uppercase tracking-wider text-white/30">
          {label}
        </span>
      </button>
      {open && <div className="pl-2 space-y-0">{children}</div>}
    </div>
  );
}

// ── Main layers tree ──────────────────────────────────────────────────────────
export function LayersTree() {
  const turbines         = useProjectStore(s => s.turbines);
  const externalTurbines = useProjectStore(s => s.externalTurbines);
  const projectBoundary  = useProjectStore(s => s.projectBoundary);
  const exclusionZones   = useProjectStore(s => s.exclusionZones);
  const mapFeatures      = useProjectStore(s => s.mapFeatures);

  const features     = mapFeatures?.features ?? [];
  const count = (type: string) => features.filter(f => (f.properties as Record<string, unknown>)?.type === type).length;

  const waterCount    = count('water');
  const dwellingCount = count('dwelling');
  const roadCount     = count('road');
  const railwayCount  = count('railway');
  const ehvCount      = count('ehv_line');
  const excCount      = exclusionZones?.features.length ?? 0;

  const hasCore = !!(projectBoundary || turbines.length || (mapFeatures?.features.length ?? 0));

  return (
    <div className="select-none flex-1 overflow-y-auto">
      {/* Section header */}
      <div className="flex items-center px-2 py-1.5 sticky top-0 bg-[#111827] z-10">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Layers</span>
      </div>

      {/* Placement */}
      {hasCore && (
        <Section label="Placement">
          {projectBoundary && (
            <LayerRow layerKey="boundary"        label="Project Boundary" color="#1D9E75" icon={<MapPin className="w-3 h-3" />} count={1} />
          )}
          {turbines.length > 0 && (
            <LayerRow layerKey="turbines"        label="Wind Turbines"    color="#1D9E75" icon={<Wind   className="w-3 h-3" />} count={turbines.length} />
          )}
          {excCount > 0 && (
            <LayerRow layerKey="exclusionZones"  label="Exclusion Zones"  color="#D85A30" icon={<Shield className="w-3 h-3" />} count={excCount} />
          )}
          {externalTurbines.length > 0 && (
            <LayerRow layerKey="externalTurbines" label="External WTGs"   color="#64748b" icon={<Wind   className="w-3 h-3" />} count={externalTurbines.length} />
          )}
        </Section>
      )}

      {/* Constraints */}
      {(waterCount + dwellingCount + roadCount + railwayCount + ehvCount) > 0 && (
        <Section label="OSM Constraints">
          {waterCount    > 0 && <LayerRow layerKey="water"     label="Water Bodies"   color="#3b82f6" icon={<Droplets className="w-3 h-3" />} count={waterCount} />}
          {dwellingCount > 0 && <LayerRow layerKey="dwellings" label="Dwellings"      color="#ef4444" icon={<Home     className="w-3 h-3" />} count={dwellingCount} />}
          {roadCount     > 0 && <LayerRow layerKey="roads"     label="Roads"          color="#a855f7" icon={<Route    className="w-3 h-3" />} count={roadCount} />}
          {railwayCount  > 0 && <LayerRow layerKey="railways"  label="Railways"       color="#f59e0b" icon={<Train    className="w-3 h-3" />} count={railwayCount} />}
          {ehvCount      > 0 && <LayerRow layerKey="ehvLines"  label="EHV Lines"      color="#06b6d4" icon={<Zap      className="w-3 h-3" />} count={ehvCount} />}
          <LayerRow layerKey="setbackBuffers" label="Setback Buffers"  color="#8b5cf6" icon={<Shield className="w-3 h-3" />} />
        </Section>
      )}

      {/* GIS Layers */}
      <Section label="GIS Layers" defaultOpen={true}>

        <SubSection label="Base Data">
          <LayerRow layerKey="dtm"           label="Digital Terrain Model" color="#92400e" icon={<Mountain   className="w-3 h-3" />} dataState="raster" />
          <LayerRow layerKey="landCover"     label="Land Cover"            color="#65a30d" icon={<Layers     className="w-3 h-3" />} dataState="raster" />
          <LayerRow layerKey="slopeGrid"     label="Slope Grid"            color="#d97706" icon={<TrendingUp className="w-3 h-3" />} dataState="raster" />
          <LayerRow layerKey="imageryMosaic" label="Imagery Mosaic"        color="#0369a1" icon={<Satellite  className="w-3 h-3" />} dataState="raster" />
        </SubSection>

        <SubSection label="Infrastructure">
          <LayerRow layerKey="roads"                label="Road Network"       color="#a855f7" icon={<Route     className="w-3 h-3" />} dataState="none" />
          <LayerRow layerKey="powerTransmission"    label="Transmission Lines" color="#06b6d4" icon={<Zap       className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="gridSubstations"      label="Grid Substations"   color="#fbbf24" icon={<Building2 className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="undergroundPipelines" label="Pipelines"          color="#b45309" icon={<Pipette   className="w-3 h-3" />} dataState="none" />
        </SubSection>

        <SubSection label="Administrative">
          <LayerRow layerKey="districtBoundaries" label="Districts"        color="#3b82f6" icon={<Globe        className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="revenueVillages"    label="Revenue Villages" color="#f59e0b" icon={<Flag         className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="protectedAreas"     label="Protected Areas"  color="#991b1b" icon={<TreePine     className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="restrictedAirspace" label="Airspace Zones"   color="#a855f7" icon={<AlertOctagon className="w-3 h-3" />} dataState="ready" />
        </SubSection>

        <SubSection label="Environment">
          <LayerRow layerKey="windResourceGrid"  label="Wind Resource Grid" color="#0891b2" icon={<Gauge className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="floodZones"        label="Flood Zones"        color="#1e40af" icon={<Waves className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="wildlifeCorridors" label="Wildlife Corridors" color="#166534" icon={<Bird  className="w-3 h-3" />} dataState="none" />
          <LayerRow layerKey="forestCover"       label="Forest Cover"       color="#14532d" icon={<Trees className="w-3 h-3" />} dataState="ready" />
        </SubSection>

        <SubSection label="Socioeconomics">
          <LayerRow layerKey="populationGrid"     label="Population Density" color="#f97316" icon={<Users    className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="noiseReceptors"     label="Noise Receptors"    color="#ef4444" icon={<Volume2  className="w-3 h-3" />} dataState="ready" />
          <LayerRow layerKey="shadowFlickerZones" label="Shadow Flicker"     color="#6d28d9" icon={<Sun      className="w-3 h-3" />} dataState="none" />
          <LayerRow layerKey="landParcels"        label="Land Parcels"       color="#78350f" icon={<FileText className="w-3 h-3" />} dataState="none" />
        </SubSection>
      </Section>

      {/* Basemap picker at bottom of layers */}
      <BasemapRow />
    </div>
  );
}
