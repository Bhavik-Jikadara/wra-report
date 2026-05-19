import { useState } from 'react';
import {
  Layers, Eye, EyeOff, ChevronDown, ChevronUp,
  MapPin, Droplets, Home, Route, Train, Zap,
  Wind, Shield, TriangleAlert, CircleCheck, CircleX,
  Mountain, Satellite, TrendingUp, Building2, Pipette,
  Globe, Flag, TreePine, AlertOctagon, Gauge,
  Waves, Bird, Trees, Users, Volume2, Sun, FileText,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { LayerKey } from '@/store/useProjectStore';
import { GIS_CATEGORY_LABELS } from '@/types/gisLayers';
import { cn } from '@/lib/utils';

// ── Small helpers ─────────────────────────────────────────────────────────────

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('w-2.5 h-2.5 rounded-full shrink-0', className)}
      style={{ background: color }}
    />
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="text-[8px] font-bold uppercase tracking-widest text-white/35 pt-1 pb-0.5 px-1">
      {label}
    </p>
  );
}

interface RowProps {
  layerKey: LayerKey;
  label: string;
  color: string;
  icon: React.ReactNode;
  count?: number;
  disabled?: boolean;
  hasData?: boolean;
  children?: React.ReactNode;
}

function LayerRow({ layerKey, label, color, icon, count, disabled = false, hasData = true, children }: RowProps) {
  const visible = useProjectStore(s => s.layerVisibility[layerKey]);
  const setLayerVisibility = useProjectStore(s => s.setLayerVisibility);

  const isDisabled = disabled || !hasData;

  return (
    <div className={cn('space-y-0.5', isDisabled && 'opacity-35 pointer-events-none')}>
      <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5 transition-colors group">
        <Dot color={hasData ? color : '#4b5563'} />
        <span className="mr-0.5 text-white/50 shrink-0">{icon}</span>
        <span className="flex-1 text-[11px] text-white/80 leading-tight truncate">{label}</span>
        {!hasData && (
          <span className="text-[8px] font-mono text-white/25 shrink-0 border border-white/15 rounded px-0.5">
            no data
          </span>
        )}
        {hasData && count !== undefined && count > 0 && (
          <span className="text-[9px] font-mono text-white/40 shrink-0">{count}</span>
        )}
        {hasData && (
          <button
            onClick={() => setLayerVisibility(layerKey, !visible)}
            title={visible ? 'Hide layer' : 'Show layer'}
            className={cn(
              'shrink-0 rounded p-0.5 transition-colors',
              visible
                ? 'text-white/60 hover:text-white'
                : 'text-white/20 hover:text-white/50'
            )}
          >
            {visible
              ? <Eye className="w-3.5 h-3.5" />
              : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Collapsible GIS category group ───────────────────────────────────────────

interface GISGroupProps {
  label: string;
  children: React.ReactNode;
}

function GISGroup({ label, children }: GISGroupProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-white/5 transition-colors"
      >
        <p className="flex-1 text-left text-[8px] font-bold uppercase tracking-widest text-white/35">
          {label}
        </p>
        {open
          ? <ChevronUp   className="w-2.5 h-2.5 text-white/25 shrink-0" />
          : <ChevronDown className="w-2.5 h-2.5 text-white/25 shrink-0" />}
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LayersPanel() {
  const [collapsed, setCollapsed] = useState(false);

  const turbines        = useProjectStore(s => s.turbines);
  const externalTurbines = useProjectStore(s => s.externalTurbines);
  const projectBoundary = useProjectStore(s => s.projectBoundary);
  const exclusionZones  = useProjectStore(s => s.exclusionZones);
  const mapFeatures     = useProjectStore(s => s.mapFeatures);

  // Don't show unless there's something to show
  const hasContent = projectBoundary || turbines.length > 0 || (mapFeatures?.features.length ?? 0) > 0;
  if (!hasContent) return null;

  // Turbine status breakdown
  const okCount        = turbines.filter(t => t.spacingStatus === 'ok').length;
  const warnCount      = turbines.filter(t => t.spacingStatus === 'warning').length;
  const violationCount = turbines.filter(t => t.spacingStatus === 'violation').length;

  // Feature counts by type
  const features = mapFeatures?.features ?? [];
  const count = (type: string) => features.filter(f => (f.properties as any)?.type === type).length;
  const waterCount    = count('water');
  const dwellingCount = count('dwelling');
  const roadCount     = count('road');
  const railwayCount  = count('railway');
  const ehvCount      = count('ehv_line');

  const exclusionCount = exclusionZones?.features.length ?? 0;
  const constraintTotal = waterCount + dwellingCount + roadCount + railwayCount + ehvCount;
  const hasConstraints  = constraintTotal > 0;
  const hasExternal     = externalTurbines.length > 0;

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[210px] select-none">
      <div className="bg-black/75 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <span className="flex-1 text-left text-[11px] font-bold text-white/90 tracking-wide">
            Map Layers
          </span>
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            : <ChevronUp   className="w-3.5 h-3.5 text-white/40" />}
        </button>

        {/* ── Body ── */}
        {!collapsed && (
          <div className="px-2 pb-2 space-y-0.5 border-t border-white/10 pt-1.5">

            {/* ── Placement ── */}
            <GroupLabel label="Placement" />

            {projectBoundary && (
              <LayerRow layerKey="boundary" label="Project Boundary" color="#1D9E75"
                icon={<MapPin className="w-3 h-3" />} count={1}
              />
            )}

            {turbines.length > 0 && (
              <LayerRow layerKey="turbines" label="Turbines" color="#1D9E75"
                icon={<Wind className="w-3 h-3" />} count={turbines.length}
              >
                {/* Status breakdown row */}
                <div className="flex items-center gap-2.5 pl-7 pb-0.5">
                  {okCount > 0 && (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                      <CircleCheck className="w-2.5 h-2.5" />{okCount}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="flex items-center gap-1 text-[9px] text-amber-400">
                      <TriangleAlert className="w-2.5 h-2.5" />{warnCount}
                    </span>
                  )}
                  {violationCount > 0 && (
                    <span className="flex items-center gap-1 text-[9px] text-red-400">
                      <CircleX className="w-2.5 h-2.5" />{violationCount}
                    </span>
                  )}
                </div>
              </LayerRow>
            )}

            {exclusionCount > 0 && (
              <LayerRow layerKey="exclusionZones" label="Exclusion Zones" color="#D85A30"
                icon={<Shield className="w-3 h-3" />} count={exclusionCount}
              />
            )}

            {/* ── OSM Constraints ── */}
            {hasConstraints && (
              <>
                <GroupLabel label="OSM Constraints" />

                {waterCount > 0 && (
                  <LayerRow layerKey="water" label="Water Bodies" color="#3b82f6"
                    icon={<Droplets className="w-3 h-3" />} count={waterCount}
                  />
                )}
                {dwellingCount > 0 && (
                  <LayerRow layerKey="dwellings" label="Dwellings" color="#ef4444"
                    icon={<Home className="w-3 h-3" />} count={dwellingCount}
                  />
                )}
                {roadCount > 0 && (
                  <LayerRow layerKey="roads" label="Roads" color="#a855f7"
                    icon={<Route className="w-3 h-3" />} count={roadCount}
                  />
                )}
                {railwayCount > 0 && (
                  <LayerRow layerKey="railways" label="Railways" color="#f59e0b"
                    icon={<Train className="w-3 h-3" />} count={railwayCount}
                  />
                )}
                {ehvCount > 0 && (
                  <LayerRow layerKey="ehvLines" label="EHV Lines" color="#06b6d4"
                    icon={<Zap className="w-3 h-3" />} count={ehvCount}
                  />
                )}

                {/* Setback buffers — always show when there are constraints */}
                <LayerRow layerKey="setbackBuffers" label="Setback Buffers" color="#8b5cf6"
                  icon={<Shield className="w-3 h-3" />}
                />
              </>
            )}

            {/* ── External ── */}
            {hasExternal && (
              <>
                <GroupLabel label="External" />
                <LayerRow layerKey="externalTurbines" label="External WTGs" color="#64748b"
                  icon={<Wind className="w-3 h-3" />} count={externalTurbines.length}
                />
              </>
            )}

            {/* ── GIS Data Dictionary layers ── */}
            <div className="mt-1 pt-1 border-t border-white/10 space-y-0.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/35 px-1 pt-0.5 pb-0.5">
                GIS Layers
              </p>

              {/* 1 · Base Data — no local data files */}
              <GISGroup label={GIS_CATEGORY_LABELS['base-data']}>
                <LayerRow layerKey="dtm"           label="Digital Terrain Model" color="#92400e" icon={<Mountain   className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="landCover"     label="Land Cover"            color="#65a30d" icon={<Layers     className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="slopeGrid"     label="Slope Grid"            color="#d97706" icon={<TrendingUp className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="imageryMosaic" label="Imagery Mosaic"        color="#0369a1" icon={<Satellite  className="w-3 h-3" />} hasData={false} />
              </GISGroup>

              {/* 2 · Infrastructure — no local data files */}
              <GISGroup label={GIS_CATEGORY_LABELS['infrastructure']}>
                <LayerRow layerKey="roads"                label="Road Network"       color="#a855f7" icon={<Route     className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="powerTransmission"    label="Transmission Lines" color="#06b6d4" icon={<Zap       className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="gridSubstations"      label="Grid Substations"   color="#059669" icon={<Building2 className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="undergroundPipelines" label="Pipelines"          color="#b45309" icon={<Pipette   className="w-3 h-3" />} hasData={false} />
              </GISGroup>

              {/* 3 · Administrative — protectedAreas has sample data */}
              <GISGroup label={GIS_CATEGORY_LABELS['administrative']}>
                <LayerRow layerKey="districtBoundaries" label="Districts"        color="#1d4ed8" icon={<Globe        className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="revenueVillages"    label="Revenue Villages" color="#be185d" icon={<Flag         className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="protectedAreas"     label="Protected Areas"  color="#991b1b" icon={<TreePine     className="w-3 h-3" />} hasData={true} />
                <LayerRow layerKey="restrictedAirspace" label="Airspace Zones"   color="#7e22ce" icon={<AlertOctagon className="w-3 h-3" />} hasData={false} />
              </GISGroup>

              {/* 4 · Environment — windResourceGrid has sample data */}
              <GISGroup label={GIS_CATEGORY_LABELS['environment']}>
                <LayerRow layerKey="windResourceGrid"  label="Wind Resource Grid" color="#0891b2" icon={<Gauge className="w-3 h-3" />} hasData={true} />
                <LayerRow layerKey="floodZones"        label="Flood Zones"        color="#1e40af" icon={<Waves className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="wildlifeCorridors" label="Wildlife Corridors" color="#166534" icon={<Bird  className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="forestCover"       label="Forest Cover"       color="#14532d" icon={<Trees className="w-3 h-3" />} hasData={false} />
              </GISGroup>

              {/* 5 · Socioeconomics — no local data files */}
              <GISGroup label={GIS_CATEGORY_LABELS['socioeconomics']}>
                <LayerRow layerKey="populationGrid"     label="Population Density" color="#c2410c" icon={<Users    className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="noiseReceptors"     label="Noise Receptors"    color="#b91c1c" icon={<Volume2  className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="shadowFlickerZones" label="Shadow Flicker"     color="#6d28d9" icon={<Sun      className="w-3 h-3" />} hasData={false} />
                <LayerRow layerKey="landParcels"        label="Land Parcels"       color="#78350f" icon={<FileText className="w-3 h-3" />} hasData={false} />
              </GISGroup>
            </div>

            {/* ── Status legend strip ── */}
            {turbines.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 px-1">
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/35 mb-0.5">Turbine Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-3.5 rounded-b-full shrink-0" style={{ background: '#1D9E75' }} />
                  <span className="text-[10px] text-white/60">Compliant (MNRE)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-3.5 rounded-b-full shrink-0" style={{ background: '#BA7517' }} />
                  <span className="text-[10px] text-white/60">Spacing Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-3.5 rounded-b-full shrink-0" style={{ background: '#D85A30' }} />
                  <span className="text-[10px] text-white/60">Spacing Violation</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
