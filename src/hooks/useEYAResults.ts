import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { calculateEYA } from '@/lib/eya';
import { useTurbineModel } from './useTurbineModel';
import type { EYASummary, EYATurbineReport } from '@/lib/eya';

export interface EYAResults {
  individualReports: EYATurbineReport[];
  summary: EYASummary;
}

export function useEYAResults(): EYAResults | null {
  const turbines = useProjectStore(s => s.turbines);
  const eyaSettings = useProjectStore(s => s.eyaSettings);
  const prevailingWindDir = useProjectStore(s => s.micrositingSettings.prevailingWindDir);
  const customPowerCurves = useProjectStore(s => s.customPowerCurves);
  const model = useTurbineModel();

  return useMemo(
    () => calculateEYA(turbines, eyaSettings, model, prevailingWindDir, customPowerCurves),
    [turbines, eyaSettings, model, prevailingWindDir, customPowerCurves]
  );
}
