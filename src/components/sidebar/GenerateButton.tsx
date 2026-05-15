import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useProjectHistoryStore } from '@/store/useProjectHistoryStore';
import { optimizeLayout } from '@/lib/layoutOptimizer';
import { calculateEYA } from '@/lib/eya';
import turbineModelsData from '@/data/turbineModels.json';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { TurbineModel } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

interface Shortfall {
  placed: number;
  requested: number;
  model: string;
  rotorDiameter: number;
  hubHeight: number;
  crosswindM: number;
  downwindM: number;
  boundarySetbackM: number;
}

interface GenerateButtonProps {
  onGenerated?: () => void;
}

export function GenerateButton({ onGenerated }: GenerateButtonProps) {
  const { projectBoundary, micrositingSettings, setTurbines } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [shortfall, setShortfall] = useState<Shortfall | null>(null);

  const handleGenerate = async () => {
    if (!projectBoundary) {
      toast.error('Please upload a project boundary first.');
      return;
    }

    const model = turbineModels.find(m => m.id === micrositingSettings.turbineModelId);
    if (!model) {
      toast.error('Selected turbine model not found.');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Analyzing boundary geometry...');

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.loading('Building spacing grid...', { id: loadingToast });

      await new Promise(resolve => setTimeout(resolve, 500));
      toast.loading('Applying exclusion zones & features...', { id: loadingToast });

      const { exclusionZones, externalTurbines, mapFeatures } = useProjectStore.getState();
      const { turbines, warnings } = await optimizeLayout(
        projectBoundary,
        exclusionZones,
        externalTurbines,
        mapFeatures,
        micrositingSettings,
        model
      );

      setTurbines(turbines);

      // Auto-save to project history
      try {
        const s = useProjectStore.getState();
        let pid = s.projectId;
        if (!pid) {
          pid = crypto.randomUUID();
          s.setProjectId(pid);
        }
        const resolvedModel: TurbineModel = s.customPowerCurves[model.id]
          ? { ...model, powerCurve: s.customPowerCurves[model.id] as [number, number][] }
          : model;
        const eya = calculateEYA(turbines, s.eyaSettings, resolvedModel, s.micrositingSettings.prevailingWindDir, s.customPowerCurves);
        useProjectHistoryStore.getState().upsertProject({
          id: pid,
          name: s.projectName,
          savedAt: new Date().toISOString(),
          turbineCount: turbines.length,
          capacityMW: +(turbines.length * model.ratedKW / 1000).toFixed(1),
          netAepGwh: eya ? +(eya.summary.netAepMwh / 1000).toFixed(2) : null,
          plfPct: eya ? +eya.summary.plf50.toFixed(1) : null,
          projectBoundary: s.projectBoundary,
          exclusionZones: s.exclusionZones,
          mapFeatures: s.mapFeatures,
          turbines,
          externalTurbines: s.externalTurbines,
          eyaSettings: s.eyaSettings,
          micrositingSettings: s.micrositingSettings,
          customPowerCurves: s.customPowerCurves,
        });
      } catch (e) {
        logger.warn('Failed to save project to history', e);
      }

      onGenerated?.();

      if (turbines.length < micrositingSettings.targetCount) {
        const D = model.rotorDiameter;
        const HH = micrositingSettings.hubHeight;
        setShortfall({
          placed: turbines.length,
          requested: micrositingSettings.targetCount,
          model: `${model.oem} ${model.model}`,
          rotorDiameter: D,
          hubHeight: HH,
          crosswindM: micrositingSettings.crosswindMultiple * D,
          downwindM: micrositingSettings.downwindMultiple * D,
          boundarySetbackM: HH + 0.5 * D + 5,
        });
        toast.dismiss(loadingToast);
      } else {
        // Show any non-shortfall warnings as toasts
        warnings.forEach(w => toast.warning(w));
        toast.success(`Done — ${turbines.length} turbines placed`, { id: loadingToast });
      }
    } catch (error) {
      logger.error(error);
      toast.error(error instanceof Error ? error.message : 'Optimization failed', { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !projectBoundary}
        className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {isGenerating ? 'Generating Layout...' : 'Generate Micrositing'}
      </button>

      {shortfall && (
        <Dialog open onOpenChange={() => setShortfall(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <DialogTitle className="text-base">Space Constraint — Partial Layout</DialogTitle>
              </div>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  The boundary does not have enough space to fit{' '}
                  <span className="font-semibold text-foreground">{shortfall.requested}</span> turbines
                  while satisfying all MNRE July 2024 constraints.
                </div>
              </DialogDescription>
            </DialogHeader>

            {/* Placed vs Requested counter */}
            <div className="flex items-center justify-center gap-6 py-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{shortfall.placed}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Placed</div>
              </div>
              <div className="text-muted-foreground text-lg">/</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{shortfall.requested}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Requested</div>
              </div>
            </div>

            {/* Active constraint summary */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Active MNRE Constraints — {shortfall.model}
              </p>
              <ul className="space-y-1.5 text-sm">
                <ConstraintRow
                  label="Crosswind spacing"
                  value={`${shortfall.crosswindM.toFixed(0)} m (${micrositingSettings.crosswindMultiple}D)`}
                />
                <ConstraintRow
                  label="Downwind spacing"
                  value={`${shortfall.downwindM.toFixed(0)} m (${micrositingSettings.downwindMultiple}D)`}
                />
                <ConstraintRow
                  label="Boundary setback (HH + 0.5D + 5 m)"
                  value={`${shortfall.boundarySetbackM.toFixed(0)} m`}
                />
                <ConstraintRow label="Dwelling cluster setback" value="500 m (≥15 buildings)" />
                <ConstraintRow label="Waterbody setback" value="500 m" />
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              To fit more turbines: reduce the target count, increase the boundary area, or lower
              crosswind / downwind multiples in Advanced Spacing Configuration.
            </p>

            <DialogFooter>
              <button
                onClick={() => {
                  setShortfall(null);
                  toast.success(`Layout accepted — ${shortfall.placed} turbines placed`);
                }}
                className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-md hover:bg-primary/90 transition-colors text-sm"
              >
                Accept Layout ({shortfall.placed} turbines)
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ConstraintRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground shrink-0">
        {value}
      </span>
    </li>
  );
}
