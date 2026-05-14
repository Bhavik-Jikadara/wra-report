import { useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import turbineModelsData from '@/data/turbineModels.json';
import { useProjectStore } from '@/store/useProjectStore';
import { generateCurveTable } from '@/lib/eya';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function EYAPowerCurveChart() {
  const { micrositingSettings, customPowerCurves } = useProjectStore();

  const model = useMemo(() => {
    const base = turbineModels.find(m => m.id === micrositingSettings.turbineModelId) ?? turbineModels[0];
    return customPowerCurves[base.id]
      ? { ...base, powerCurve: customPowerCurves[base.id] as [number, number][] }
      : base;
  }, [micrositingSettings.turbineModelId, customPowerCurves]);

  const data = useMemo(() => generateCurveTable(model), [model]);

  const maxPower = model.ratedKW + 500;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="ws"
          type="number"
          domain={[0, 18]}
          tickCount={10}
          label={{ value: 'Wind Speed (m/s)', position: 'insideBottom', offset: -4, fontSize: 10, fill: '#64748b' }}
          tick={{ fontSize: 10, fill: '#64748b' }}
          stroke="#cbd5e1"
        />
        {/* Left Y — electrical power */}
        <YAxis
          yAxisId="power"
          orientation="left"
          domain={[0, maxPower]}
          tickCount={8}
          tickFormatter={(v) => `${v}`}
          label={{ value: 'Electrical Power (kW)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 10, fill: '#1e293b' }}
          tick={{ fontSize: 10, fill: '#64748b' }}
          stroke="#cbd5e1"
        />
        {/* Right Y — thrust coefficient */}
        <YAxis
          yAxisId="thrust"
          orientation="right"
          domain={[0, 1.0]}
          tickCount={6}
          tickFormatter={(v) => v.toFixed(3)}
          label={{ value: 'Thrust Coefficient (-)', angle: 90, position: 'insideRight', offset: 14, fontSize: 10, fill: '#1e293b' }}
          tick={{ fontSize: 10, fill: '#64748b' }}
          stroke="#cbd5e1"
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderColor: '#cbd5e1' }}
          formatter={(value, name) => {
            const v = typeof value === 'number' ? value : Number(value);
            return name === 'power' ? [`${v} kW`, 'Electrical Power'] : [v.toFixed(3), 'Thrust Coeff.'];
          }}
          labelFormatter={(label) => `Wind Speed: ${label} m/s`}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          formatter={(val) => val === 'power' ? 'Electrical power (kW)' : 'Thrust coefficient (-)'}
        />
        <ReferenceLine
          yAxisId="power"
          x={model.cutInSpeed}
          stroke="#f59e0b"
          strokeDasharray="4 3"
          label={{ value: 'Cut-in', position: 'top', fontSize: 9, fill: '#f59e0b' }}
        />
        <ReferenceLine
          yAxisId="power"
          x={model.ratedSpeed}
          stroke="#10b981"
          strokeDasharray="4 3"
          label={{ value: 'Rated', position: 'top', fontSize: 9, fill: '#10b981' }}
        />
        <Line
          yAxisId="power"
          type="monotone"
          dataKey="power"
          stroke="#1e293b"
          strokeWidth={2}
          dot={false}
          name="power"
        />
        <Line
          yAxisId="thrust"
          type="monotone"
          dataKey="ct"
          stroke="#ef4444"
          strokeWidth={1.5}
          dot={false}
          name="thrust"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
