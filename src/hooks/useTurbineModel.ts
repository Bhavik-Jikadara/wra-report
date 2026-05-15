import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function useTurbineModel(): TurbineModel {
  const turbineModelId = useProjectStore(s => s.micrositingSettings.turbineModelId);
  const customPowerCurves = useProjectStore(s => s.customPowerCurves);

  return useMemo(() => {
    const base = turbineModels.find(m => m.id === turbineModelId) ?? turbineModels[0];
    return customPowerCurves[base.id]
      ? { ...base, powerCurve: customPowerCurves[base.id] as [number, number][] }
      : base;
  }, [turbineModelId, customPowerCurves]);
}
