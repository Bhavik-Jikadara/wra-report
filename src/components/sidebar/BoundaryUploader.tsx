import { useState, useRef } from 'react';
import { UploadCloud, FileCheck2, X, MapPin, Ruler } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseKmlOrKmz } from '@/lib/kmlParser';
import { toast } from 'sonner';
import { area, centroid } from '@turf/turf';
import { identifyFeaturesFromOSM } from '@/lib/osmService';
import { cn } from '@/lib/utils';

export function BoundaryUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setProjectBoundary, projectBoundary, setMapFeatures, mapFeatures } = useProjectStore();

  const ALLOWED_EXTENSIONS = ['kml', 'kmz'];

  const processFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Only .kml or .kmz files are allowed');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20 MB limit');
      return;
    }
    setIsLoading(true);
    try {
      const featureCollection = await parseKmlOrKmz(file);
      if (featureCollection) {
        setProjectBoundary(featureCollection);
        setFileName(file.name);
        toast.success('Boundary uploaded');

        // Auto-fetch OSM features in background
        const t = toast.loading('Fetching water bodies & dwellings from OSM…');
        try {
          const { waterbodies, dwellings } = await identifyFeaturesFromOSM(featureCollection);
          const existing = mapFeatures?.features ?? [];
          setMapFeatures({
            type: 'FeatureCollection',
            features: [...existing, ...waterbodies.features, ...dwellings.features] as any,
          });
          toast.success(
            `Found ${waterbodies.features.length} water bodies, ${dwellings.features.length} dwellings`,
            { id: t }
          );
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'OSM feature fetch failed — check your internet connection',
            { id: t }
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error processing file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setFileName(null);
    setProjectBoundary(null);
  };

  // Derived stats
  let stats: { area: string; lat: string; lng: string } | null = null;
  if (projectBoundary?.features.length) {
    try {
      const km2 = area(projectBoundary) / 1e6;
      const c = centroid(projectBoundary);
      stats = {
        area: km2.toFixed(2),
        lat: c.geometry.coordinates[1].toFixed(5),
        lng: c.geometry.coordinates[0].toFixed(5),
      };
    } catch { /* ignore */ }
  }

  // ── Uploaded state ──────────────────────────────────────────────────────────
  if (fileName) {
    return (
      <div className="rounded-lg border bg-muted/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
          <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="flex-1 text-xs font-medium truncate text-foreground">{fileName}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
            Valid
          </span>
          <button
            onClick={handleRemove}
            className="p-0.5 hover:bg-muted rounded text-muted-foreground shrink-0"
            title="Remove boundary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-0 divide-x divide-border/40 text-[10px]">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <Ruler className="w-3 h-3 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Area</p>
                <p className="font-mono font-semibold text-foreground">{stats.area} km²</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Centroid</p>
                <p className="font-mono font-semibold text-foreground">{stats.lat}</p>
                <p className="font-mono font-semibold text-foreground">{stats.lng}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Upload state ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
          isLoading && 'pointer-events-none opacity-60'
        )}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className={cn('w-7 h-7', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <div>
          <p className="text-xs font-semibold text-foreground">
            {isLoading ? 'Processing…' : 'Click to upload or drag & drop'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">.KML or .KMZ · max 20 MB</p>
        </div>
        <input
          type="file" className="hidden" ref={fileInputRef}
          accept=".kml,.kmz" onChange={handleSelect}
        />
      </div>

      <div className="flex justify-center">
        <a
          href="/sample_boundary.kml"
          download
          className="text-[10px] text-primary hover:underline font-medium"
          onClick={e => e.stopPropagation()}
        >
          Download sample KML
        </a>
      </div>
    </div>
  );
}
