import { useState, useRef } from 'react';
import {
  Upload, Wind, CircleCheck, TriangleAlert, CircleX,
  X, Loader2, FileUp, Info,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { importTurbinesFromFile, type ImportResult } from '@/lib/layoutImporter';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

// ── ComplianceBadge ───────────────────────────────────────────────────────────

function ComplianceBadge({ count, type }: { count: number; type: 'ok' | 'warning' | 'violation' }) {
  if (count === 0) return null;
  const cfg = {
    ok:        { icon: CircleCheck,   cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', label: 'OK' },
    warning:   { icon: TriangleAlert, cls: 'text-amber-600  bg-amber-50  dark:bg-amber-950/30',    label: 'Warn' },
    violation: { icon: CircleX,       cls: 'text-red-600    bg-red-50    dark:bg-red-950/30',       label: 'Fail' },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-center gap-1 rounded px-1.5 py-0.5', cfg.cls)}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold">{count}</span>
      <span className="text-[9px] font-medium">{cfg.label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LayoutImporter() {
  const { setTurbines, setTurbineSource, setImportEyaApproved } = useProjectStore();
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [fileName,  setFileName]  = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isImportActive = result !== null;

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['kml', 'kmz'].includes(ext)) {
      toast.error('Only .kml or .kmz files are supported');
      return;
    }

    setLoading(true);
    setFileName(file.name);

    try {
      const s = useProjectStore.getState();
      const model = turbineModels.find(m => m.id === s.micrositingSettings.turbineModelId) ?? turbineModels[0];
      const imported = await importTurbinesFromFile(file, model, s.micrositingSettings);

      setTurbines(imported.turbines);
      setTurbineSource('imported');
      setImportEyaApproved(false, null);
      setResult(imported);

      // Warn about spacing issues
      imported.warnings.forEach(w => toast.warning(w));

      if (imported.warnings.length === 0) {
        toast.success(`${imported.totalImported} turbines imported — configure EYA settings and click Generate`);
      } else {
        toast.success(`${imported.totalImported} turbines imported — review warnings then generate EYA`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import turbine layout');
      setResult(null);
      setFileName('');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setFileName('');
    setTurbines([]);
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-5">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Parsing & validating turbine locations…</p>
      </div>
    );
  }

  if (isImportActive && result) {
    return (
      <div className="space-y-2">
        {/* Result header */}
        <div className="rounded-lg border bg-card px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileUp className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-semibold text-foreground truncate">{fileName}</span>
            </div>
            <button
              onClick={handleClear}
              title="Remove imported layout"
              className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground">
              {result.totalImported} turbines
            </span>
            <span className="text-[9px] text-border">·</span>
            <ComplianceBadge count={result.compliantCount}  type="ok" />
            <ComplianceBadge count={result.warningCount}    type="warning" />
            <ComplianceBadge count={result.violationCount}  type="violation" />
          </div>

          {/* Spacing warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {result.violationCount === 0 && result.warningCount === 0 && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CircleCheck className="w-3 h-3" />
              All turbines meet MNRE spacing requirements
            </p>
          )}
        </div>

        {/* Re-import link */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full text-[10px] text-primary hover:underline py-0.5"
        >
          Replace with a different file
        </button>
        <input
          type="file" className="hidden" ref={fileRef}
          accept=".kml,.kmz"
          onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = ''; } }}
        />
      </div>
    );
  }

  // ── Upload drop zone ──────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors text-center',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Upload Turbine Layout</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            KML or KMZ file with Point placemarks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <Wind className="w-3 h-3" />
          <span>Each placemark = one turbine location</span>
        </div>
        <input
          type="file" className="hidden" ref={fileRef}
          accept=".kml,.kmz"
          onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = ''; } }}
        />
      </div>

      {/* Info note */}
      <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground leading-relaxed">
        <Info className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
        <span>
          Placemark names become turbine IDs. MNRE spacing (5D crosswind, 7D downwind) is validated
          automatically. EYA runs on the imported layout using your turbine model &amp; wind settings.
        </span>
      </div>
    </div>
  );
}
