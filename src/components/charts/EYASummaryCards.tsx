import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { calculateEYA } from '@/lib/eya';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function EYASummaryCards() {
  const { turbines, eyaSettings, micrositingSettings, customPowerCurves } = useProjectStore();

  const results = useMemo(() => {
    let model = turbineModels.find(m => m.id === micrositingSettings.turbineModelId) || turbineModels[0];
    if (customPowerCurves[model.id]) {
      model = { ...model, powerCurve: customPowerCurves[model.id] };
    }
    return calculateEYA(turbines, eyaSettings, model, micrositingSettings.prevailingWindDir);
  }, [turbines, eyaSettings, micrositingSettings, customPowerCurves]);

  if (turbines.length === 0 || !results) {
    return (
      <div className="flex-1 flex items-center justify-center border border-dashed rounded-lg text-sm text-muted-foreground">
        Generate layout to calculate EYA
      </div>
    );
  }

  const { summary } = results;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-3 h-full">
      <div className="bg-card border rounded-md p-3 flex flex-col justify-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Gross AEP</span>
        <span className="text-2xl font-bold font-mono text-emerald-600/80">{(summary.grossAepMwh / 1000).toFixed(2)}</span>
        <span className="text-xs text-muted-foreground mt-1">GWh/year</span>
      </div>

      <div className="bg-card border rounded-md p-3 flex flex-col justify-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Net AEP (P50)</span>
        <span className="text-2xl font-bold font-mono text-emerald-500">{(summary.netAepMwh / 1000).toFixed(2)}</span>
        <span className="text-xs text-muted-foreground mt-1">GWh/year</span>
      </div>

      <div className="bg-card border rounded-md p-3 flex flex-col justify-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Net PLF</span>
        <span className="text-2xl font-bold font-mono text-primary">{summary.plf.toFixed(2)}%</span>
        <span className="text-xs text-muted-foreground mt-1">Plant Load Factor</span>
      </div>

      <div className="bg-card border rounded-md p-3 flex flex-col justify-center space-y-1">
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold">P75</span>
          <span className="font-mono text-xs font-medium truncate">{(summary.p75 / 1000).toFixed(2)} GWh</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold">P90</span>
          <span className="font-mono text-xs font-medium truncate">{(summary.p90 / 1000).toFixed(2)} GWh</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold">P99</span>
          <span className="font-mono text-xs font-medium truncate">{(summary.p99 / 1000).toFixed(2)} GWh</span>
        </div>
      </div>
    </div>
  );
}
