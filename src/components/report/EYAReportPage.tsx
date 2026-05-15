import { useProjectStore } from '@/store/useProjectStore';
import { generateCurveTable } from '@/lib/eya';
import { useEYAResults } from '@/hooks/useEYAResults';
import { useTurbineModel } from '@/hooks/useTurbineModel';
import { EYAPowerCurveChart } from '@/components/charts/EYAPowerCurveChart';
import { EYAWaterfallChart } from '@/components/charts/EYAWaterfallChart';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Shared primitive UI ───────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#bdd7ee] text-[#1f3864] font-bold text-center py-1.5 px-3 text-xs uppercase tracking-wide border border-[#9dc3e6]">
      {title}
    </div>
  );
}

function SubHeader({ title, cols = 2 }: { title: string; cols?: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="bg-[#dce6f1] text-[#1f3864] font-bold text-xs px-3 py-1 border border-[#9dc3e6]"
      >
        {title}
      </td>
    </tr>
  );
}

function TotalRow({ label, v1, v2 }: { label: string; v1: string; v2: string }) {
  return (
    <tr className="font-bold bg-[#dce6f1]">
      <td className="px-3 py-1 border border-[#9dc3e6] text-xs">{label}</td>
      <td className="px-3 py-1 border border-[#9dc3e6] text-xs text-right font-mono">{v1}</td>
      <td className="px-3 py-1 border border-[#9dc3e6] text-xs text-right font-mono">{v2}</td>
    </tr>
  );
}

function LossRow({ label, v1, v2, indent = false }: { label: string; v1: string; v2: string; indent?: boolean }) {
  return (
    <tr className="even:bg-[#f7fafd]">
      <td className={cn('border border-[#9dc3e6] text-xs py-0.5', indent ? 'pl-6 pr-3' : 'px-3')}>
        {label}
      </td>
      <td className="px-3 py-0.5 border border-[#9dc3e6] text-xs text-right font-mono">{v1}</td>
      <td className="px-3 py-0.5 border border-[#9dc3e6] text-xs text-right font-mono">{v2}</td>
    </tr>
  );
}

const fmt1 = (n: number) => n.toFixed(1);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtGWh = (mwh: number) => (mwh / 1000).toFixed(1);
const fmtMWh = (mwh: number) => Math.round(mwh).toLocaleString();

// ── Main page ─────────────────────────────────────────────────────────────────

export function EYAReportPage() {
  const { turbines, eyaSettings, micrositingSettings, projectName, turbineSource, importEyaApproved } = useProjectStore();
  const turbineModel = useTurbineModel();
  const results = useEYAResults();

  const curveTable = generateCurveTable(turbineModel);

  if (turbines.length === 0 || !results) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center bg-background gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">No Turbines Placed Yet</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Return to the map view, upload a project boundary, configure your turbine settings,
            and click <strong>Generate Micrositing</strong> to create a layout.
          </p>
        </div>
      </div>
    );
  }

  if (turbineSource === 'imported' && !importEyaApproved) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center bg-background gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">EYA Not Generated Yet</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Turbines have been imported. Adjust your <strong>EYA Parameters</strong> in the sidebar,
            then click <strong>Generate EYA Report</strong> to compute and view the results.
          </p>
        </div>
      </div>
    );
  }

  const { individualReports, summary } = results;
  const lb = summary.lossBreakdown;
  const reportDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
  });

  // Uncertainty table GWh scale factor
  const netGwh = summary.netAepMwh / 1000;
  const scaleGWh = (pct: number) => (netGwh * pct / 100).toFixed(1);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f4f8] print:bg-white p-3 md:p-6 space-y-6 font-sans text-[#1f3864]">

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — Long-Term Energy (project header + loss overview)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm">
        <SectionHeader title="Long-Term Energy" />

        {/* Project info + logo */}
        <div className="flex gap-0">
          {/* Left: project info table */}
          <table className="flex-1 border-collapse text-xs">
            <tbody>
              {[
                ['Project:', projectName || 'Wind Farm Project'],
                ['Date:', reportDate],
                ['Comments:', 'Client Layout with the effect of Surrounding Turbine'],
                ['Turbine Manufacturer/Model:', `${turbineModel.oem} ${turbineModel.model}`],
                ['Turbine Rated Power:', `${(turbineModel.ratedKW / 1000).toFixed(2)}`, 'MW'],
                ['Hub Height:', `${micrositingSettings.hubHeight}`, 'm'],
                ['Number of Turbines:', `${turbines.length}`],
                ['Plant Capacity:', `${Math.round(summary.totalInstalledMW)}`, 'MW'],
                ['Site Air Density:', `${eyaSettings.airDensity}`, 'kg/m³'],
              ].map(([label, val, unit], i) => (
                <tr key={i} className="border-b border-[#dce6f1]">
                  <td className="text-right pr-3 py-1 font-semibold text-[#4472c4] w-52 pl-3">{label}</td>
                  <td className="pl-2 py-1 font-bold text-[#1f3864]">{val}</td>
                  {unit && <td className="pl-1 py-1 text-[#4472c4] font-semibold">{unit}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Right: logo placeholder */}
          <div className="w-48 border-l border-[#9dc3e6] flex flex-col items-center justify-center p-4 bg-[#f7fbff]">
            <div className="w-16 h-16 rounded-full border-2 border-[#4472c4] flex items-center justify-center mb-2">
              <span className="text-2xl font-black text-[#4472c4]">EYA</span>
            </div>
            <div className="text-xs text-[#4472c4] font-bold text-center">
              Energy Yield Assessment<br />
              <span className="font-bold text-center">Long-Term Report</span>
            </div>
          </div>
        </div>

        {/* Loss Accounting + Overall Wind Plant Summary */}
        <div className="flex gap-0 border-t border-[#9dc3e6]">
          {/* Loss Accounting */}
          <div className="flex-1 border-r border-[#9dc3e6]">
            <div className="bg-[#dce6f1] text-[#1f3864] font-bold text-xs px-3 py-1 border-b border-[#9dc3e6]">
              Loss Accounting
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {[
                  ['Wake Effect', lb.wakeTotal],
                  ['Availability', lb.availabilityLongTerm],
                  ['Electrical', lb.electricalTotal],
                  ['Turbine Performance', lb.turbinePerformanceTotal],
                  ['Environmental', lb.environmentalLongTerm],
                  ['Curtailments', lb.curtailmentTotal],
                ].map(([label, val], i) => (
                  <tr key={i} className="border-b border-[#dce6f1]">
                    <td className="px-3 py-0.5">{label}</td>
                    <td className="px-3 py-0.5 text-right font-mono font-semibold">{fmtPct(val as number)}</td>
                  </tr>
                ))}
                <tr className="border-b border-[#9dc3e6] bg-[#dce6f1] font-bold">
                  <td className="px-3 py-1">Average Total Loss</td>
                  <td className="px-3 py-1 text-right font-mono">{fmtPct(lb.totalLongTerm)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Overall Wind Plant Summary */}
          <div className="flex-1">
            <div className="bg-[#dce6f1] text-[#1f3864] font-bold text-xs px-3 py-1 border-b border-[#9dc3e6]">
              Overall Wind Plant Summary
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {[
                  ['Average Free Wind Speed (m/s)', fmt1(summary.avgWindSpeed)],
                  ['Gross Plant Production (MWh/yr)', fmtMWh(summary.grossAepMwh)],
                  ['Net Plant Production (MWh/yr)', fmtMWh(summary.netAepMwh)],
                  ['Plant Load Factor', fmtPct(summary.plf50)],
                ].map(([label, val], i) => (
                  <tr key={i} className="border-b border-[#dce6f1]">
                    <td className="px-3 py-0.5 font-semibold">{label}</td>
                    <td className="px-3 py-0.5 text-right font-mono font-bold">{val}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="px-3 py-1 text-[10px] text-[#4472c4] italic">
                    * PLF is calculated based on the rated power of {turbineModel.ratedKW.toLocaleString()} KW,
                    though peak power may be {Math.round(turbineModel.ratedKW * 1.05).toLocaleString()} KW.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1b — AEP Waterfall
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm">
        <SectionHeader title="AEP Waterfall — Gross to Net" />
        <div className="flex gap-0">
          {/* Waterfall chart */}
          <div className="flex-1 p-4" style={{ height: 320 }}>
            <EYAWaterfallChart />
          </div>

          {/* Gross → Net summary table */}
          <div className="w-52 border-l border-[#9dc3e6] flex flex-col">
            <div className="bg-[#dce6f1] text-[#1f3864] font-bold text-xs px-3 py-1 border-b border-[#9dc3e6]">
              Energy Steps
            </div>
            <table className="w-full text-xs border-collapse flex-1">
              <tbody>
                {[
                  { label: 'Gross AEP', val: (summary.grossAepMwh / 1000).toFixed(1), unit: 'GWh/yr', bold: true, color: '#1D9E75' },
                  { label: 'Wake Loss',    val: `-${fmtPct(lb.wakeTotal)}`,             unit: '', bold: false, color: '#ef4444' },
                  { label: 'Availability',val: `-${fmtPct(lb.availabilityLongTerm)}`,  unit: '', bold: false, color: '#ef4444' },
                  { label: 'Electrical',  val: `-${fmtPct(lb.electricalTotal)}`,       unit: '', bold: false, color: '#ef4444' },
                  { label: 'Performance', val: `-${fmtPct(lb.turbinePerformanceTotal)}`,unit:'', bold: false, color: '#ef4444' },
                  { label: 'Environmental',val:`-${fmtPct(lb.environmentalLongTerm)}`, unit: '', bold: false, color: '#ef4444' },
                  { label: 'Curtailment', val: `-${fmtPct(lb.curtailmentTotal)}`,      unit: '', bold: false, color: '#ef4444' },
                  { label: 'Net AEP (P50)', val: (summary.netAepMwh / 1000).toFixed(1), unit: 'GWh/yr', bold: true, color: '#10b981' },
                ].map(({ label, val, unit, bold, color }, i) => (
                  <tr key={i} className={cn('border-b border-[#dce6f1]', bold && 'bg-[#f0f7f4] font-bold')}>
                    <td className="px-2 py-1 text-[10px] text-[#1f3864]">{label}</td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]" style={{ color }}>
                      {val}{unit && <span className="text-[#4472c4] font-normal ml-1 text-[9px]">{unit}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — Per Turbine Summary
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm overflow-hidden">
        <SectionHeader title="Per Turbine Summary" />
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#bdd7ee] text-[#1f3864]">
                {[
                  'Turbine\nID', 'Mast\nAssociation',
                  'Easting (m)', 'Northing (m)',
                  'Free\nSpeed (m/s)', 'Gross\nMWh/yr',
                  'Array\nEff. (%)', 'Array\nLoss (%)',
                  'Total\nLoss (%)', 'Net\nMWh/yr',
                  'Turbine\nRank', 'Plant Load\nFactor (%)',
                  'Total TI\nat 15m/s (%)', 'Base Elev.\n(m)',
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-1.5 border border-[#9dc3e6] font-bold whitespace-pre-line text-center leading-tight"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {individualReports.map((t, i) => (
                <tr
                  key={t.id}
                  className={cn(
                    'border-b border-[#dce6f1] text-center',
                    i % 2 === 0 ? 'bg-white' : 'bg-[#f7fafd]',
                    t.spacingStatus === 'violation' && 'bg-red-50'
                  )}
                >
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-bold text-left">{t.id}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1]">{t.mastAssociation}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{Math.round(t.easting)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{Math.round(t.northing)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmt1(t.freeWindSpeed)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmtMWh(t.grossAep)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmt1(t.arrayEff)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmt1(t.arrayLoss)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmt1(t.totalLoss)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono font-bold text-[#1f6b3a]">{fmtMWh(t.netAep)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{t.rank}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{fmt1(t.plf)}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{t.totalTI}</td>
                  <td className="px-2 py-0.5 border border-[#dce6f1] font-mono">{t.baseElevation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — Power Curve
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm">
        <SectionHeader title="Power Curve" />

        {/* Turbine specs block */}
        <div className="grid grid-cols-2 gap-0 border-b border-[#9dc3e6]">
          <table className="text-xs border-collapse">
            <tbody>
              {[
                ['Turbine Manufacturer/Model:', `${turbineModel.oem} ${turbineModel.model}`],
                ['Capacity:', `${(turbineModel.ratedKW / 1000).toFixed(2)} MW`],
                ['Rotor Diameter:', `${turbineModel.rotorDiameter} m`],
                ['IEC Class:', turbineModel.iecClass],
                ['Site Air Density:', `${eyaSettings.airDensity} kg/m²`],
                ['Range of Turbine Air Densities:', `${(eyaSettings.airDensity - 0.002).toFixed(3)} – ${(eyaSettings.airDensity + 0.001).toFixed(3)} kg/m²`],
                ['Mean Turbine Base Elevation:', '15 m'],
                ['Range of Turbine Base Elevations:', '8 – 28 m'],
                ['Power Curve Version:', 'IEC 61400-12-1 Ed.2 (2022)'],
              ].map(([k, v], i) => (
                <tr key={i} className="border-b border-[#dce6f1]">
                  <td className="text-right pr-3 py-0.5 font-semibold text-[#4472c4] pl-3 w-64">{k}</td>
                  <td className="pl-2 py-0.5 font-bold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data table + dual chart */}
        <div className="flex gap-0">
          {/* Data table */}
          <div className="w-72 border-r border-[#9dc3e6] overflow-y-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-[#bdd7ee]">
                <tr>
                  <th className="px-2 py-1.5 border border-[#9dc3e6] text-center font-bold">Hub height<br />wind speed (m/s)</th>
                  <th className="px-2 py-1.5 border border-[#9dc3e6] text-center font-bold">Thrust<br />coefficient (-)</th>
                  <th className="px-2 py-1.5 border border-[#9dc3e6] text-center font-bold">Electrical<br />power (kW)</th>
                </tr>
              </thead>
              <tbody>
                {curveTable.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f7fafd]'}>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{row.ws.toFixed(1)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{row.ct.toFixed(3)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{row.power}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dual-axis chart */}
          <div className="flex-1 p-4" style={{ height: 380 }}>
            <EYAPowerCurveChart />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — Loss Summary (First Year vs Long-Term)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm">
        <SectionHeader title="Loss Summary" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-[#bdd7ee] text-[#1f3864]">
                <th className="px-3 py-1.5 border border-[#9dc3e6] text-left w-72" />
                <th className="px-3 py-1.5 border border-[#9dc3e6] text-right font-bold">First Year</th>
                <th className="px-3 py-1.5 border border-[#9dc3e6] text-right font-bold">Long-Term</th>
              </tr>
            </thead>
            <tbody>
              {/* Wake Effect */}
              <SubHeader title="Wake Effect" />
              <LossRow label="Internal Wake Effect of the Project" v1={fmtPct(lb.wakeInternal)} v2={fmtPct(lb.wakeInternal)} indent />
              <LossRow label="Wake Effect of Existing or Planned Projects" v1={fmtPct(lb.wakeExternal)} v2={fmtPct(lb.wakeExternal)} indent />
              <TotalRow label="Wake Effect Total" v1={fmtPct(lb.wakeTotal)} v2={fmtPct(lb.wakeTotal)} />

              {/* Availability */}
              <SubHeader title="Availability" />
              <LossRow label="Availability of Turbines (Contractual)" v1={fmtPct(lb.turbineContractual)} v2={fmtPct(lb.turbineContractual)} indent />
              <LossRow label="Availability of Turbines (Non-Contractual)" v1={fmtPct(lb.turbineNonContractual)} v2={fmtPct(lb.turbineNonContractual)} indent />
              <LossRow label="Energy-to-Downtime Adjustment" v1={fmtPct(lb.energyToDowntime)} v2={fmtPct(lb.energyToDowntime)} indent />
              <LossRow label="Availability of Collection & Substation" v1={fmtPct(lb.collectionSubstation)} v2={fmtPct(lb.collectionSubstation)} indent />
              <LossRow label="Availability of Utility Grid" v1={fmtPct(lb.utilityGrid)} v2={fmtPct(lb.utilityGrid)} indent />
              <LossRow label="Plant Re-start after Grid outages" v1={fmtPct(lb.plantRestart)} v2={fmtPct(lb.plantRestart)} indent />
              <LossRow label="First-Year Plant Availability" v1={fmtPct(lb.firstYearAvailability)} v2="0.0%" indent />
              <TotalRow label="Availability Total" v1={fmtPct(lb.availabilityFirstYear)} v2={fmtPct(lb.availabilityLongTerm)} />

              {/* Electrical */}
              <SubHeader title="Electrical" />
              <LossRow label="Electrical Efficiency" v1={fmtPct(lb.electricalEfficiency)} v2={fmtPct(lb.electricalEfficiency)} indent />
              <LossRow label="Power Consumption of Extreme Weather Package" v1={fmtPct(lb.extremeWeatherPkg)} v2={fmtPct(lb.extremeWeatherPkg)} indent />
              <TotalRow label="Electrical Total" v1={fmtPct(lb.electricalTotal)} v2={fmtPct(lb.electricalTotal)} />

              {/* Turbine Performance */}
              <SubHeader title="Turbine Performance" />
              <LossRow label="Sub-Optimal Performance" v1={fmtPct(lb.subOptimal)} v2={fmtPct(lb.subOptimal)} indent />
              <LossRow label="Power Curve Adjustment" v1={fmtPct(lb.powerCurveAdj)} v2={fmtPct(lb.powerCurveAdj)} indent />
              <LossRow label="High Wind Control Hysteresis" v1={fmtPct(lb.highWindHysteresis)} v2={fmtPct(lb.highWindHysteresis)} indent />
              <LossRow label="Inclined Flow" v1={fmtPct(lb.inclinedFlow)} v2={fmtPct(lb.inclinedFlow)} indent />
              <TotalRow label="Turbine Performance Total" v1={fmtPct(lb.turbinePerformanceTotal)} v2={fmtPct(lb.turbinePerformanceTotal)} />

              {/* Environmental */}
              <SubHeader title="Environmental" />
              <LossRow label="Icing" v1={fmtPct(lb.icing)} v2={fmtPct(lb.icing)} indent />
              <LossRow label="Blade Degradation" v1={fmtPct(lb.bladeDegFirstYear)} v2={fmtPct(lb.bladeDegLongTerm)} indent />
              <LossRow label="Low/High Temperature Shutdown" v1={fmtPct(lb.lowHighTemp)} v2={fmtPct(lb.lowHighTemp)} indent />
              <LossRow label="Site Access" v1={fmtPct(lb.siteAccess)} v2={fmtPct(lb.siteAccess)} indent />
              <LossRow label="Lightning" v1={fmtPct(lb.lightning)} v2={fmtPct(lb.lightning)} indent />
              <TotalRow label="Environmental Total" v1={fmtPct(lb.environmentalFirstYear)} v2={fmtPct(lb.environmentalLongTerm)} />

              {/* Curtailments */}
              <SubHeader title="Curtailments" />
              <LossRow label="Directional Curtailment" v1="0.0%" v2="0.0%" indent />
              <LossRow label="PPA Curtailment" v1="0.0%" v2="0.0%" indent />
              <LossRow label="Environmental Curtailment" v1={fmtPct(lb.environmentalCurt)} v2={fmtPct(lb.environmentalCurt)} indent />
              <TotalRow label="Curtailment Total" v1={fmtPct(lb.curtailmentTotal)} v2={fmtPct(lb.curtailmentTotal)} />

              {/* Grand total */}
              <tr className="bg-[#1f3864] text-white font-bold">
                <td className="px-3 py-1.5 border border-[#9dc3e6] text-xs">Total Losses</td>
                <td className="px-3 py-1.5 border border-[#9dc3e6] text-xs text-right font-mono">{fmtPct(lb.totalFirstYear)}</td>
                <td className="px-3 py-1.5 border border-[#9dc3e6] text-xs text-right font-mono">{fmtPct(lb.totalLongTerm)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — P-Tables: Uncertainty + Confidence Levels
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#9dc3e6] shadow-sm">
        <SectionHeader title="P-Tables" />

        {/* Wind Speed and Energy Production Uncertainty Summary */}
        <div className="border-b border-[#9dc3e6]">
          <div className="bg-[#dce6f1] text-[#1f3864] text-xs px-3 py-1 font-bold border-b border-[#9dc3e6]">
            Wind Speed and Energy Production Uncertainty Summary (Evaluation Period [Years 2–25])
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-[#bdd7ee]">
                  <th className="px-3 py-1.5 border border-[#9dc3e6] text-left font-bold w-64">Uncertainty Source</th>
                  <th className="px-2 py-1.5 border border-[#9dc3e6] text-center font-bold" colSpan={2}>Wind Speed</th>
                  <th className="px-2 py-1.5 border border-[#9dc3e6] text-center font-bold" colSpan={2}>Energy Equivalent</th>
                </tr>
                <tr className="bg-[#dce6f1] text-[10px]">
                  <th className="px-3 py-1 border border-[#9dc3e6]" />
                  <th className="px-2 py-1 border border-[#9dc3e6] text-center">%</th>
                  <th className="px-2 py-1 border border-[#9dc3e6] text-center">m/s</th>
                  <th className="px-2 py-1 border border-[#9dc3e6] text-center">%</th>
                  <th className="px-2 py-1 border border-[#9dc3e6] text-center">GWh/yr</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#f0f4f8]">
                  <td colSpan={5} className="px-3 py-0.5 font-bold border border-[#dce6f1] text-[#1f3864]">Wind Resource</td>
                </tr>
                {[
                  { src: 'Site Documentation and Verification', wsPct: 0.7, wsMs: 0.05, ePct: 1.3 },
                  { src: 'Wind Speed Measurements', wsPct: 1.6, wsMs: 0.11, ePct: 3.0 },
                  { src: 'Long-Term Average Speed', wsPct: 1.4, wsMs: 0.10, ePct: 2.6 },
                  { src: 'Evaluation Period Wind Resource', wsPct: 2.1, wsMs: 0.15, ePct: 3.8 },
                  { src: 'Wind Shear', wsPct: 0.2, wsMs: 0.02, ePct: 0.5 },
                  { src: 'Wind Flow Modeling', wsPct: 4.5, wsMs: 0.32, ePct: 8.3 },
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f7fafd]'}>
                    <td className="px-3 py-0.5 border border-[#dce6f1] pl-6">{r.src}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{r.wsPct.toFixed(1)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{r.wsMs.toFixed(2)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{r.ePct.toFixed(1)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{scaleGWh(r.ePct)}</td>
                  </tr>
                ))}
                <tr className="bg-[#dce6f1] font-bold">
                  <td className="px-3 py-1 border border-[#9dc3e6]">Total Wind Resource Uncertainty</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">5.4</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">0.39</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">10.1</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">{scaleGWh(10.1)}</td>
                </tr>

                <tr className="bg-[#f0f4f8]">
                  <td colSpan={5} className="px-3 py-0.5 font-bold border border-[#dce6f1] text-[#1f3864]">Performance</td>
                </tr>
                {[
                  { src: 'Wind Speed Frequency Distribution', ePct: 1.4 },
                  { src: 'Total Plant Losses', ePct: 4.1 },
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f7fafd]'}>
                    <td className="px-3 py-0.5 border border-[#dce6f1] pl-6">{r.src}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center">—</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center">—</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{r.ePct.toFixed(1)}</td>
                    <td className="px-2 py-0.5 border border-[#dce6f1] text-center font-mono">{scaleGWh(r.ePct)}</td>
                  </tr>
                ))}
                <tr className="bg-[#dce6f1] font-bold">
                  <td className="px-3 py-1 border border-[#9dc3e6]">Total Energy Uncertainty</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center">—</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center">—</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">{fmt1(eyaSettings.totalUncertainty)}</td>
                  <td className="px-2 py-1 border border-[#9dc3e6] text-center font-mono">{scaleGWh(eyaSettings.totalUncertainty)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Estimated Energy Production at 5 Confidence Levels */}
        <div>
          <div className="bg-[#dce6f1] text-[#1f3864] text-xs px-3 py-1 font-bold border-b border-[#9dc3e6]">
            Estimated Energy Production and Plant Load Factor at Five Confidence Levels
            (Evaluation Period [Years 2–25]) and First Year
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-[#bdd7ee] text-[#1f3864]">
                  <th className="px-3 py-2 border border-[#9dc3e6] font-bold w-44">Probability of<br />Exceedance</th>
                  <th className="px-3 py-2 border border-[#9dc3e6] font-bold text-center">Eval. Period Avg<br />Energy Prod. (GWh)</th>
                  <th className="px-3 py-2 border border-[#9dc3e6] font-bold text-center">Eval. Period Avg<br />Plant Load Factor (%)</th>
                  <th className="px-3 py-2 border border-[#9dc3e6] font-bold text-center">First Year<br />Energy Prod. (GWh)</th>
                  <th className="px-3 py-2 border border-[#9dc3e6] font-bold text-center">First Year<br />Plant Load Factor (%)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'P50', mwh: summary.p50, plf: summary.plf50, fyMwh: summary.p50fy, fyPlf: summary.plfFy50 },
                  { label: 'P75', mwh: summary.p75, plf: summary.plf75, fyMwh: summary.p75fy, fyPlf: summary.plfFy75 },
                  { label: 'P90', mwh: summary.p90, plf: summary.plf90, fyMwh: summary.p90fy, fyPlf: summary.plfFy90 },
                  { label: 'P95', mwh: summary.p95, plf: summary.plf95, fyMwh: summary.p95fy, fyPlf: summary.plfFy95 },
                  { label: 'P99', mwh: summary.p99, plf: summary.plf99, fyMwh: summary.p99fy, fyPlf: summary.plfFy99 },
                ].map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      'border-b border-[#dce6f1]',
                      i % 2 === 0 ? 'bg-white' : 'bg-[#f7fafd]',
                      row.label === 'P50' && 'font-bold bg-[#e2efda]'
                    )}
                  >
                    <td className="px-3 py-1.5 border border-[#dce6f1] text-center font-bold">{row.label}</td>
                    <td className="px-3 py-1.5 border border-[#dce6f1] text-center font-mono">{fmtGWh(row.mwh)}</td>
                    <td className="px-3 py-1.5 border border-[#dce6f1] text-center font-mono">{fmt1(row.plf)}</td>
                    <td className="px-3 py-1.5 border border-[#dce6f1] text-center font-mono">{fmtGWh(row.fyMwh)}</td>
                    <td className="px-3 py-1.5 border border-[#dce6f1] text-center font-mono">{fmt1(row.fyPlf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Methodology note */}
          <div className="px-4 py-3 text-[10px] text-[#4472c4] border-t border-[#dce6f1] bg-[#f7fbff]">
            <strong>Methodology:</strong> Probability of exceedance values are derived using the standard normal distribution:
            P<sub>x</sub> = P<sub>50</sub> × (1 − z × σ), where σ = {fmt1(eyaSettings.totalUncertainty)}%
            total energy uncertainty (1σ) and z is the standard normal deviate for the selected confidence level
            (P75: 0.674, P90: 1.282, P95: 1.645, P99: 2.326). Wind resource uncertainty is derived from
            Vortex mesoscale virtual met mast data correlated with long-term reanalysis.
          </div>
        </div>
      </div>

    </div>
  );
}
