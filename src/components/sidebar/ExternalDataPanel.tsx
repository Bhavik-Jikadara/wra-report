import { useState, useRef } from 'react';
import { Wind, Layers, X, Loader2, Search, Droplets, Home } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseKmlPointsOrKmz, parseKmlFeaturesOrKmz } from '@/lib/kmlParser';
import { toast } from 'sonner';
import { latLngToUTM } from '@/lib/utmConverter';
import { identifyFeaturesFromOSM } from '@/lib/osmService';
import type { TurbinePosition } from '@/types';
import { cn } from '@/lib/utils';

// ── Mini upload zone ──────────────────────────────────────────────────────────

function MiniUpload({
  label, icon, onFile, active,
}: {
  label: string; icon: React.ReactNode; onFile: (f: File) => void; active: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'flex-1 rounded-lg border-2 border-dashed p-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors text-center min-h-[72px] justify-center',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
        active && 'border-emerald-400 bg-emerald-50/40'
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => ref.current?.click()}
    >
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', active ? 'bg-emerald-100' : 'bg-muted')}>
        {icon}
      </div>
      <p className="text-[10px] font-medium text-foreground leading-tight">{label}</p>
      <p className="text-[9px] text-muted-foreground">KML / KMZ</p>
      <input type="file" className="hidden" ref={ref} accept=".kml,.kmz"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }}
      />
    </div>
  );
}

// ── Feature type breakdown ────────────────────────────────────────────────────

function FeatureSummary({ mapFeatures, onClear }: {
  mapFeatures: { features: any[] } | null;
  onClear: () => void;
}) {
  if (!mapFeatures || mapFeatures.features.length === 0) return null;

  const waterCount = mapFeatures.features.filter(f => f.properties?.type === 'water').length;
  const dwellingCount = mapFeatures.features.filter(f => f.properties?.type === 'dwelling').length;
  const otherCount = mapFeatures.features.length - waterCount - dwellingCount;

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 flex items-center gap-2">
      <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1">
        {waterCount > 0 && (
          <div className="flex items-center gap-1">
            <Droplets className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] text-muted-foreground">{waterCount} water</span>
          </div>
        )}
        {dwellingCount > 0 && (
          <div className="flex items-center gap-1">
            <Home className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-muted-foreground">{dwellingCount} dwellings</span>
          </div>
        )}
        {otherCount > 0 && (
          <span className="text-[10px] text-muted-foreground">+{otherCount} other</span>
        )}
      </div>
      <button onClick={onClear} className="p-0.5 hover:bg-muted rounded text-muted-foreground shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ExternalDataPanel() {
  const {
    setExternalTurbines, externalTurbines,
    setMapFeatures, mapFeatures,
    projectBoundary,
  } = useProjectStore();
  const [isIdentifying, setIsIdentifying] = useState(false);

  const processWTG = async (file: File) => {
    try {
      const fc = await parseKmlPointsOrKmz(file);
      if (fc) {
        const positions: TurbinePosition[] = fc.features.map((f, i) => {
          const [lng, lat] = (f.geometry as any).coordinates;
          const utm = latLngToUTM(lat, lng);
          return {
            id: `EXT-${i + 1}`, lat, lng,
            easting: utm.easting, northing: utm.northing,
            utmZone: `${utm.zone}${utm.letter}`,
            nearestNeighborId: '', nearestNeighborDistanceM: 0,
            nearestNeighborDistanceRD: 0, spacingStatus: 'ok',
          };
        });
        setExternalTurbines(positions);
        toast.success(`${positions.length} external WTGs imported`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing WTG file');
    }
  };

  const processFeatures = async (file: File) => {
    try {
      const fc = await parseKmlFeaturesOrKmz(file);
      if (fc) { setMapFeatures(fc); toast.success('Features imported'); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing features file');
    }
  };

  const handleAutoIdentify = async () => {
    if (!projectBoundary) { toast.error('Upload a boundary first'); return; }
    setIsIdentifying(true);
    const t = toast.loading('Querying OSM for water bodies & dwellings…');
    try {
      const { waterbodies, dwellings } = await identifyFeaturesFromOSM(projectBoundary);
      const existing = mapFeatures?.features ?? [];
      setMapFeatures({
        type: 'FeatureCollection',
        features: [...existing, ...waterbodies.features, ...dwellings.features] as any,
      });
      toast.success(
        `${waterbodies.features.length} water bodies · ${dwellings.features.length} dwellings`,
        { id: t }
      );
    } catch {
      toast.error('OSM query failed', { id: t });
    } finally {
      setIsIdentifying(false);
    }
  };

  return (
    <div className="space-y-3">

      {/* Upload zones side by side */}
      <div className="flex gap-2">
        {externalTurbines.length === 0 ? (
          <MiniUpload
            label="External WTGs" icon={<Wind className="w-3.5 h-3.5 text-primary" />}
            onFile={processWTG} active={false}
          />
        ) : (
          <div className="flex-1 rounded-lg border bg-muted/20 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{externalTurbines.length} WTGs</span>
            </div>
            <button onClick={() => setExternalTurbines([])} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {(!mapFeatures || mapFeatures.features.length === 0) ? (
          <MiniUpload
            label="Map Features" icon={<Layers className="w-3.5 h-3.5 text-amber-500" />}
            onFile={processFeatures} active={false}
          />
        ) : (
          <div className="flex-1 rounded-lg border bg-emerald-50/40 border-emerald-300/60 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-foreground">{mapFeatures.features.length} features</span>
            </div>
            <button onClick={() => setMapFeatures(null)} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Feature breakdown when features are loaded */}
      <FeatureSummary mapFeatures={mapFeatures} onClear={() => setMapFeatures(null)} />

      {/* Auto-identify button */}
      <button
        onClick={handleAutoIdentify}
        disabled={isIdentifying || !projectBoundary}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold transition-colors',
          'bg-background hover:bg-muted border-border disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isIdentifying
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying OSM…</>
          : <><Search className="w-3.5 h-3.5" /> Auto-identify Water & Dwellings</>
        }
      </button>

      {/* MNRE setback reminder */}
      <div className="text-[9px] text-muted-foreground leading-relaxed">
        Water bodies → 500 m setback · Dwelling clusters (≥15 buildings) → 500 m setback
      </div>

    </div>
  );
}
