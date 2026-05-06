import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { calculateEYA } from '@/lib/eya';
import turbineModelsData from '@/data/turbineModels.json';
import type { TurbineModel } from '@/types';
import { PowerCurveChart } from '@/components/charts/PowerCurveChart';
import { FileText, ShieldAlert, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const turbineModels = turbineModelsData as unknown as TurbineModel[];

export function EYAReportPage() {
  const { turbines, eyaSettings, micrositingSettings, customPowerCurves, projectName } = useProjectStore();

  const turbineModel = useMemo(() => {
    let baseModel = turbineModels.find(m => m.id === micrositingSettings.turbineModelId) || turbineModels[0];
    if (customPowerCurves[baseModel.id]) {
      return { ...baseModel, powerCurve: customPowerCurves[baseModel.id] };
    }
    return baseModel;
  }, [micrositingSettings.turbineModelId, customPowerCurves]);

  const results = useMemo(() => {
    return calculateEYA(turbines, eyaSettings, turbineModel, micrositingSettings.prevailingWindDir, customPowerCurves);
  }, [turbines, eyaSettings, turbineModel, micrositingSettings.prevailingWindDir, customPowerCurves]);

  if (turbines.length === 0 || !results) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center bg-background">
        <h2 className="text-2xl font-bold mb-2">No Turbines Placed</h2>
        <p className="text-muted-foreground">Please return to the map and generate a micrositing layout first.</p>
      </div>
    );
  }

  const { individualReports, summary } = results;

  return (
    <div className="flex-1 overflow-y-auto bg-background print:bg-white p-2 sm:p-4 md:p-8 space-y-6 md:space-y-8">
      {/* 1. Engineering Header Section */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-900 text-white px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          <div>
            <h1 className="text-sm md:text-xl font-bold uppercase tracking-tight">Long-Term Energy Yield Assessment</h1>
            <p className="text-slate-400 text-[10px] md:text-xs mt-0.5 md:mt-1">Professional Micrositing & EYA Report</p>
          </div>
        </div>
        
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 bg-white">
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-4 text-sm border-b pb-2">
              <span className="text-slate-500">Project:</span>
              <span className="font-semibold text-slate-900">{projectName || 'Project Alpha'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold text-slate-900">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Turbine Model:</span>
              <span className="font-semibold text-slate-900">{turbineModel.oem} {turbineModel.model}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Rated Power:</span>
              <span className="font-semibold text-slate-900">{(turbineModel.ratedKW / 1000).toFixed(2)} MW</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Hub Height:</span>
              <span className="font-semibold text-slate-900">{micrositingSettings.hubHeight} m</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm py-2">
              <span className="text-slate-500">Air Density:</span>
              <span className="font-semibold text-slate-900 font-mono">{eyaSettings.airDensity} kg/m³</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-4 text-sm border-b pb-2">
              <span className="text-slate-500">Number of Turbines:</span>
              <span className="font-semibold text-slate-900">{turbines.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Plant Capacity:</span>
              <span className="font-semibold text-slate-900">{(turbines.length * turbineModel.ratedKW / 1000).toFixed(2)} MW</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Avg Wind Speed:</span>
              <span className="font-semibold text-slate-900 font-mono">{eyaSettings.freeWindSpeed} m/s</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-slate-500">Gross Plant Prod:</span>
              <span className="font-semibold text-slate-900 font-mono">{(summary.grossAepMwh / 1000).toFixed(2)} GWh/yr</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border-b py-2">
              <span className="text-emerald-700 font-bold">Net Plant Prod:</span>
              <span className="font-bold text-slate-900 font-mono">{(summary.netAepMwh / 1000).toFixed(2)} GWh/yr</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm py-2">
              <span className="text-primary font-bold">Plant Load Factor:</span>
              <span className="font-bold text-slate-900 font-mono">{summary.plf.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Loss Accounting & P-Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border rounded shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#1e293b] text-white px-4 py-2 font-bold text-xs md:text-sm uppercase text-center">
            Detailed Loss Summary
          </div>
          <div className="flex-1 overflow-x-auto scrollbar-thin">
            <table className="w-full text-[10px] md:text-[11px] border-collapse bg-white min-w-[300px]">
              <thead className="bg-slate-100 border-b-2 border-slate-200">
                <tr>
                  <th className="px-2 md:px-3 py-1.5 text-left border-r text-slate-700">Loss Category</th>
                  <th className="px-2 md:px-3 py-1.5 text-right w-20 md:w-24 text-slate-700">Long-Term (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50 font-bold"><td className="px-3 py-1 border-r text-slate-900">Wake Effect</td><td className="px-3 py-1 text-right text-slate-900">{summary.wakeLoss.toFixed(1)}%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Internal Wake Effect</td><td className="px-3 py-1 text-right text-slate-500">{(summary.wakeLoss * 0.7).toFixed(1)}%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">External Wake Effect</td><td className="px-3 py-1 text-right text-slate-500">{(summary.wakeLoss * 0.3).toFixed(1)}%</td></tr>
                
                <tr className="bg-slate-50 font-bold"><td className="px-3 py-1 border-r text-slate-900">Availability</td><td className="px-3 py-1 text-right text-slate-900">{summary.availabilityLoss.toFixed(1)}%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Turbine Contractual</td><td className="px-3 py-1 text-right text-slate-500">3.0%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">BOP / Grid</td><td className="px-3 py-1 text-right text-slate-500">{(summary.availabilityLoss - 3).toFixed(1)}%</td></tr>
                
                <tr className="bg-slate-50 font-bold"><td className="px-3 py-1 border-r text-slate-900">Electrical</td><td className="px-3 py-1 text-right text-slate-900">3.1%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Efficiency / Consumption</td><td className="px-3 py-1 text-right text-slate-500">3.1%</td></tr>
                
                <tr className="bg-slate-50 font-bold"><td className="px-3 py-1 border-r text-slate-900">Turbine Performance</td><td className="px-3 py-1 text-right text-slate-900">3.0%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Power Curve Adjustment</td><td className="px-3 py-1 text-right text-slate-500">2.0%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Sub-Optimal Performance</td><td className="px-3 py-1 text-right text-slate-500">1.0%</td></tr>
                
                <tr className="bg-slate-50 font-bold"><td className="px-3 py-1 border-r text-slate-900">Environmental</td><td className="px-3 py-1 text-right text-slate-900">{eyaSettings.environmentalLoss.toFixed(1)}%</td></tr>
                <tr><td className="px-6 py-1 border-r text-slate-600">Icing / Blade Degradation</td><td className="px-3 py-1 text-right text-slate-500">{eyaSettings.environmentalLoss.toFixed(1)}%</td></tr>
                
                <tr className="bg-slate-900 text-white font-bold uppercase">
                  <td className="px-3 py-2 border-r">Total Losses</td>
                  <td className="px-3 py-2 text-right">{summary.totalLoss.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded shadow-sm overflow-hidden">
            <div className="bg-[#1e293b] text-white px-4 py-2 font-bold text-xs md:text-sm uppercase text-center">
              Probability of Exceedance (P-Tables)
            </div>
            <div className="p-2 md:p-4 overflow-x-auto">
              <table className="w-full text-[10px] md:text-xs border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-2 md:px-4 py-2 text-left border-r">Probability Level</th>
                    <th className="px-2 md:px-4 py-2 text-right">Energy (GWh/yr)</th>
                    <th className="px-2 md:px-4 py-2 text-right">PLF (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { p: 'P50', energy: summary.p50 / 1000, plf: summary.plf },
                    { p: 'P75', energy: summary.p75 / 1000, plf: summary.plf * (summary.p75 / summary.p50) },
                    { p: 'P90', energy: summary.p90 / 1000, plf: summary.plf * (summary.p90 / summary.p50) },
                    { p: 'P95', energy: (summary.p90 * 0.95) / 1000, plf: summary.plf * (summary.p90 * 0.95 / summary.p50) },
                    { p: 'P99', energy: summary.p99 / 1000, plf: summary.plf * (summary.p99 / summary.p50) },
                  ].map((row, i) => (
                    <tr key={i} className={row.p === 'P50' ? 'bg-emerald-50 font-bold text-emerald-900' : ''}>
                      <td className="px-4 py-2 border-r text-slate-700">{row.p}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{row.energy.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{row.plf.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
            <div className="flex items-center gap-2 mb-3 text-emerald-800 font-bold text-xs md:text-sm">
              <ShieldAlert className="w-4 h-4" /> MNRE Compliance Summary
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[10px] md:text-[11px]">
              <span className="text-emerald-700">Along-wind Spacing (7D):</span>
              <span className="font-bold text-slate-800">{(turbineModel.rotorDiameter * 7).toFixed(0)} m</span>
              <span className="text-emerald-700">Cross-wind Spacing (5D):</span>
              <span className="font-bold text-slate-800">{(turbineModel.rotorDiameter * 5).toFixed(0)} m</span>
              <span className="text-emerald-700">Setback (1.1x Tip):</span>
              <span className="font-bold text-slate-800">{(1.1 * (micrositingSettings.hubHeight + turbineModel.rotorDiameter/2)).toFixed(0)} m</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Power Curve & Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white border rounded shadow-sm overflow-hidden p-6">
        <div className="space-y-4">
          <div className="font-bold text-sm uppercase text-slate-800 border-b pb-2 flex justify-between items-center">
            <span>Power Curve Data Table</span>
            <span className="text-[10px] text-muted-foreground normal-case font-normal">Hub Height: {micrositingSettings.hubHeight}m</span>
          </div>
          <div className="h-[300px] overflow-y-auto border rounded bg-slate-50">
            <table className="w-full text-[10px] text-center border-collapse bg-white">
              <thead className="bg-white border-b sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 border-r w-1/3 text-slate-700">Wind Speed (m/s)</th>
                  <th className="px-2 py-1.5 border-r w-1/3 text-slate-700">Thrust Coeff. (-)</th>
                  <th className="px-2 py-1.5 w-1/3 text-slate-700">Power (kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {turbineModel.powerCurve.slice(0, 30).map(([ws, p], i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 border-r font-mono text-slate-600">{ws.toFixed(1)}</td>
                    <td className="px-2 py-1 border-r font-mono text-slate-500">0.820</td>
                    <td className="px-2 py-1 font-mono font-bold text-slate-900">{p.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="font-bold text-sm uppercase text-slate-800 border-b pb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Performance Visualization
          </div>
          <div className="h-[300px]">
            <PowerCurveChart />
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-slate-800">Per Turbine Summary</h2>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Coordinates System: WGS84 UTM</div>
        </div>
        <div className="overflow-x-auto bg-white scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 border-b font-bold">
                <th className="px-4 py-3">Turbine ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Easting (m)</th>
                <th className="px-4 py-3">Northing (m)</th>
                <th className="px-4 py-3">Lat / Lng</th>
                <th className="px-4 py-3">Dist (RD)</th>
                <th className="px-4 py-3">Required (m)</th>
                <th className="px-4 py-3">Dev (m / %)</th>
                <th className="px-4 py-3 text-right">Net AEP (MWh)</th>
                <th className="px-4 py-3 text-right">Net PLF (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {individualReports.map((t) => (
                <tr key={t.id} className={cn(
                  "hover:bg-slate-50 transition-colors text-xs",
                  t.spacingStatus === 'violation' ? 'bg-red-50' : ''
                )}>
                  <td className="px-4 py-3 font-bold text-slate-900">{t.id}</td>
                  <td className="px-4 py-3">
                    {t.spacingStatus === 'violation' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 uppercase">
                        Violation
                      </span>
                    ) : t.spacingStatus === 'warning' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 uppercase">
                        Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                        Compliant
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 font-medium">{t.easting.toFixed(0)}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 font-medium">{t.northing.toFixed(0)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[10px] leading-tight">
                    {t.lat.toFixed(6)}°<br/>{t.lng.toFixed(6)}°
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 font-bold">
                    {t.nearestNeighborDistanceRD ? `${t.nearestNeighborDistanceRD.toFixed(2)}D` : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {t.requiredDistanceM ? `${t.requiredDistanceM.toFixed(0)}m` : '-'}
                  </td>
                  <td className={cn(
                    "px-4 py-3 font-mono font-bold",
                    t.deviationM && t.deviationM < 0 ? 'text-red-600' : 'text-slate-500'
                  )}>
                    {t.deviationM ? `${t.deviationM.toFixed(0)}m / ${t.deviationPct?.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-right font-bold text-emerald-600">{t.netAep.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-right text-primary font-bold">{t.plf.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
