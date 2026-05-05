import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import turbineModelsData from '@/data/turbineModels.json';
import { useProjectStore } from '@/store/useProjectStore';
import type { TurbineModel } from '@/types';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function PowerCurveChart() {
  const { micrositingSettings, customPowerCurves } = useProjectStore();
  
  const model = useMemo(() => {
    let baseModel = turbineModels.find(m => m.id === micrositingSettings.turbineModelId) || turbineModels[0];
    if (customPowerCurves[baseModel.id]) {
      return { ...baseModel, powerCurve: customPowerCurves[baseModel.id] };
    }
    return baseModel;
  }, [micrositingSettings.turbineModelId, customPowerCurves]);

  const data = useMemo(() => {
    return model.powerCurve.map(([speed, power]) => ({
      speed,
      power
    }));
  }, [model]);

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis 
              dataKey="speed" 
              type="number" 
              domain={[0, 26]} 
              tickCount={14} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
              stroke="hsl(var(--border))"
            />
            <YAxis 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: '#1D9E75' }}
              formatter={(value: any) => [`${value} kW`, 'Power']}
              labelFormatter={(label) => `Wind Speed: ${label} m/s`}
            />
            <ReferenceLine x={model.cutInSpeed} stroke="#BA7517" strokeDasharray="3 3" label={{ position: 'top', value: 'Cut-in', fill: '#BA7517', fontSize: 10 }} />
            <ReferenceLine x={model.ratedSpeed} stroke="#1D9E75" strokeDasharray="3 3" label={{ position: 'top', value: 'Rated', fill: '#1D9E75', fontSize: 10 }} />
            <ReferenceLine x={model.cutOutSpeed} stroke="#D85A30" strokeDasharray="3 3" label={{ position: 'top', value: 'Cut-out', fill: '#D85A30', fontSize: 10 }} />
            <Area 
              type="monotone" 
              dataKey="power" 
              stroke="#1D9E75" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPower)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border rounded-md p-3 bg-muted/20">
        <div>
          <span className="text-muted-foreground block mb-0.5">Rated Power</span>
          <span className="font-medium">{(model.ratedKW / 1000).toFixed(1)} MW</span>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Rotor Diameter</span>
          <span className="font-medium">{model.rotorDiameter} m</span>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Cut-in / Rated / Cut-out</span>
          <span className="font-medium">{model.cutInSpeed} / {model.ratedSpeed} / {model.cutOutSpeed} m/s</span>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">IEC Class</span>
          <span className="font-medium">{model.iecClass}</span>
        </div>
      </div>
    </div>
  );
}
