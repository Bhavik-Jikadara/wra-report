import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useProjectStore } from '@/store/useProjectStore';
import { useEYAResults } from '@/hooks/useEYAResults';

export function EYAWaterfallChart() {
  const turbines = useProjectStore(s => s.turbines);
  const results = useEYAResults();

  const data = useMemo(() => {
    if (turbines.length === 0 || !results) return [];

    let currentAEP = results.summary.grossAepMwh / 1000;
    const chartData = [];

    // 1. Gross AEP
    chartData.push({
      name: 'Gross AEP',
      value: currentAEP,
      isTotal: true,
      displayValue: currentAEP.toFixed(1)
    });

    // 2. Sequential Losses — all values sourced from the computed lossBreakdown
    const lb = results.summary.lossBreakdown;
    const losses = [
      { name: 'Wake Loss',    pct: lb.wakeTotal },
      { name: 'Availability', pct: lb.availabilityLongTerm },
      { name: 'Electrical',   pct: lb.electricalTotal },
      { name: 'Performance',  pct: lb.turbinePerformanceTotal },
      { name: 'Environmental',pct: lb.environmentalLongTerm },
      { name: 'Curtailment',  pct: lb.curtailmentTotal },
    ];

    losses.forEach(loss => {
      if (loss.pct > 0) {
        const lossAmount = currentAEP * (loss.pct / 100);
        chartData.push({
          name: loss.name,
          value: -lossAmount,
          isTotal: false,
          displayValue: `-${lossAmount.toFixed(1)}`
        });
        currentAEP -= lossAmount;
      }
    });

    // 3. Net AEP (P50)
    chartData.push({
      name: 'Net AEP',
      value: currentAEP,
      isTotal: true,
      displayValue: currentAEP.toFixed(1)
    });

    // Transform data for stacked waterfall
    // ...
    let cumulative = 0;
    const waterfallData = chartData.map((item, index) => {
      if (item.isTotal) {
        cumulative = item.value;
        return {
          name: item.name,
          transparent: 0,
          value: item.value,
          isTotal: true,
          displayValue: item.displayValue,
          color: index === 0 ? '#1D9E75' : '#10b981'
        };
      } else {
        const val = Math.abs(item.value);
        cumulative -= val;
        return {
          name: item.name,
          transparent: cumulative,
          value: val,
          isTotal: false,
          displayValue: item.displayValue,
          color: '#ef4444'
        };
      }
    });

    return waterfallData;
  }, [turbines, results]);

  if (turbines.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col pt-2">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">AEP Waterfall (GWh)</h4>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              interval={0}
              angle={-45}
              textAnchor="end"
              stroke="hsl(var(--border))"
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              stroke="hsl(var(--border))"
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', fontSize: '12px' }}
              formatter={(_value: any, _name: any, item: any) => [item.payload.displayValue, 'GWh']}
            />
            <Bar dataKey="transparent" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
