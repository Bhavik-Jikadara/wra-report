import type { EYASettings, TurbineModel, TurbinePosition } from '@/types';
import { calculateSpacing } from './spacingValidator';

// ── Math helpers ──────────────────────────────────────────────────────────────

function weibullPdf(v: number, k: number, A: number): number {
  if (v <= 0) return 0;
  return (k / A) * Math.pow(v / A, k - 1) * Math.exp(-Math.pow(v / A, k));
}

function gamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278224157,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function interpolatePower(v: number, powerCurve: [number, number][]): number {
  if (v <= powerCurve[0][0]) return powerCurve[0][1];
  if (v >= powerCurve[powerCurve.length - 1][0]) return powerCurve[powerCurve.length - 1][1];
  for (let i = 0; i < powerCurve.length - 1; i++) {
    const [v1, p1] = powerCurve[i];
    const [v2, p2] = powerCurve[i + 1];
    if (v >= v1 && v <= v2) return p1 + ((v - v1) / (v2 - v1)) * (p2 - p1);
  }
  return 0;
}

function interpolateThrust(v: number, thrustCurve: [number, number][]): number {
  if (!thrustCurve || thrustCurve.length === 0) return 0;
  if (v < thrustCurve[0][0]) return 0;
  if (v >= thrustCurve[thrustCurve.length - 1][0]) return thrustCurve[thrustCurve.length - 1][1];
  for (let i = 0; i < thrustCurve.length - 1; i++) {
    const [v1, ct1] = thrustCurve[i];
    const [v2, ct2] = thrustCurve[i + 1];
    if (v >= v1 && v <= v2) return ct1 + ((v - v1) / (v2 - v1)) * (ct2 - ct1);
  }
  return 0;
}

// Produces indicative placeholder values for TI and base elevation.
// These are NOT derived from real met-mast or LiDAR data.
// They are deterministic (same seed → same value) to avoid re-render jitter,
// but carry no physical meaning. Label them clearly in any exported report.
function seededValue(seed: number, min: number, max: number): number {
  const x = Math.abs(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
  return min + (x - Math.floor(x)) * (max - min);
}

// Z-scores for probability of exceedance (one-sided normal)
const Z: Record<string, number> = {
  p50: 0,
  p75: 0.6745,
  p90: 1.2816,
  p95: 1.6449,
  p99: 2.3263,
};

// ── Public types ──────────────────────────────────────────────────────────────

export interface EYALossBreakdown {
  wakeInternal: number; wakeExternal: number; wakeTotal: number;
  turbineContractual: number; turbineNonContractual: number;
  energyToDowntime: number; collectionSubstation: number;
  utilityGrid: number; plantRestart: number; firstYearAvailability: number;
  availabilityFirstYear: number; availabilityLongTerm: number;
  electricalEfficiency: number; extremeWeatherPkg: number; electricalTotal: number;
  subOptimal: number; powerCurveAdj: number; highWindHysteresis: number;
  inclinedFlow: number; turbinePerformanceTotal: number;
  icing: number; bladeDegFirstYear: number; bladeDegLongTerm: number;
  lowHighTemp: number; siteAccess: number; lightning: number;
  environmentalFirstYear: number; environmentalLongTerm: number;
  directional: number; ppa: number; environmentalCurt: number; curtailmentTotal: number;
  totalFirstYear: number; totalLongTerm: number;
}

export interface EYATurbineReport extends TurbinePosition {
  grossAep: number;
  netAep: number;
  plf: number;
  wakeLoss: number;
  arrayLoss: number;
  arrayEff: number;
  totalLoss: number;
  rank: number;
  freeWindSpeed: number;
  totalTI: number;
  baseElevation: number;
  mastAssociation: string;
}

export interface EYASummary {
  grossAepMwh: number;
  netAepMwh: number;
  firstYearNetAepMwh: number;
  plf: number;
  avgWindSpeed: number;
  wakeLoss: number;
  availabilityLoss: number;
  totalLoss: number;
  // Long-term P-values (MWh)
  p50: number; p75: number; p90: number; p95: number; p99: number;
  // First-year P-values (MWh)
  p50fy: number; p75fy: number; p90fy: number; p95fy: number; p99fy: number;
  // Long-term PLF at each P-value
  plf50: number; plf75: number; plf90: number; plf95: number; plf99: number;
  // First-year PLF at each P-value
  plfFy50: number; plfFy75: number; plfFy90: number; plfFy95: number; plfFy99: number;
  lossBreakdown: EYALossBreakdown;
  totalInstalledMW: number;
}

// ── generateCurveTable (used by power curve page) ─────────────────────────────

export function generateCurveTable(
  model: TurbineModel
): { ws: number; ct: number; power: number }[] {
  const rows: { ws: number; ct: number; power: number }[] = [];
  for (let ws = 0; ws <= 18.01; ws = Math.round((ws + 0.5) * 100) / 100) {
    rows.push({
      ws,
      ct: ws < model.cutInSpeed ? 0 : +interpolateThrust(ws, model.thrustCurve).toFixed(3),
      power: Math.round(interpolatePower(ws, model.powerCurve)),
    });
  }
  return rows;
}

// ── Internal: derive categorised loss breakdown from EYA settings ─────────────

function deriveLossBreakdown(settings: EYASettings, wakeTotal: number): EYALossBreakdown {
  const wakeInternal = +(wakeTotal * 0.64).toFixed(1);
  const wakeExternal = +(wakeTotal - wakeInternal).toFixed(1);

  const turbineContractual = +(100 - settings.machineAvailability).toFixed(1);
  const utilityGrid = +(100 - settings.gridAvailability).toFixed(1);
  const collectionSubstation = +(100 - settings.bopAvailability).toFixed(1);
  const turbineNonContractual = 1.3;
  const energyToDowntime = 0.9;
  const plantRestart = 0.2;
  const firstYearAvailability = 4.0;
  const availabilityLongTerm = +(
    turbineContractual + turbineNonContractual + energyToDowntime +
    collectionSubstation + utilityGrid + plantRestart
  ).toFixed(1);
  const availabilityFirstYear = +(availabilityLongTerm + firstYearAvailability).toFixed(1);

  const electricalEfficiency = +(100 - settings.transmissionEfficiency - 0.1).toFixed(1);
  const extremeWeatherPkg = 0.1;
  const electricalTotal = +(electricalEfficiency + extremeWeatherPkg).toFixed(1);

  const subOptimal = 1.0;
  const highWindHysteresis = 0.2;
  const inclinedFlow = 0.0;
  const powerCurveAdj = +Math.max(
    0,
    (100 - settings.turbinePerformance) - subOptimal - highWindHysteresis - inclinedFlow
  ).toFixed(1);
  const turbinePerformanceTotal = +(subOptimal + powerCurveAdj + highWindHysteresis + inclinedFlow).toFixed(1);

  const icing = 0.0;
  const bladeDegFirstYear = 0.7;
  const bladeDegLongTerm = +Math.max(0.7, settings.environmentalLoss - 0.1).toFixed(1);
  const lowHighTemp = 0.0;
  const siteAccess = 0.0;
  const lightning = 0.1;
  const environmentalFirstYear = +(icing + bladeDegFirstYear + lowHighTemp + siteAccess + lightning).toFixed(1);
  const environmentalLongTerm = +(icing + bladeDegLongTerm + lowHighTemp + siteAccess + lightning).toFixed(1);

  const directional = 0.0;
  const ppa = 0.0;
  const environmentalCurt = +settings.curtailmentLoss.toFixed(1);
  const curtailmentTotal = +(directional + ppa + environmentalCurt).toFixed(1);

  const totalLongTerm = +(
    wakeTotal + availabilityLongTerm + electricalTotal +
    turbinePerformanceTotal + environmentalLongTerm + curtailmentTotal
  ).toFixed(1);
  const totalFirstYear = +(
    wakeTotal + availabilityFirstYear + electricalTotal +
    turbinePerformanceTotal + environmentalFirstYear + curtailmentTotal
  ).toFixed(1);

  return {
    wakeInternal, wakeExternal, wakeTotal: +wakeTotal.toFixed(1),
    turbineContractual, turbineNonContractual, energyToDowntime,
    collectionSubstation, utilityGrid, plantRestart, firstYearAvailability,
    availabilityFirstYear, availabilityLongTerm,
    electricalEfficiency, extremeWeatherPkg, electricalTotal,
    subOptimal, powerCurveAdj, highWindHysteresis, inclinedFlow, turbinePerformanceTotal,
    icing, bladeDegFirstYear, bladeDegLongTerm, lowHighTemp, siteAccess, lightning,
    environmentalFirstYear, environmentalLongTerm,
    directional, ppa, environmentalCurt, curtailmentTotal,
    totalFirstYear, totalLongTerm,
  };
}

// ── Main EYA calculation ──────────────────────────────────────────────────────

export function calculateEYA(
  turbines: TurbinePosition[],
  settings: EYASettings,
  model: TurbineModel,
  prevailingWindDir: number,
  customPowerCurves?: Record<string, [number, number][]>
): { individualReports: EYATurbineReport[]; summary: EYASummary } | null {
  if (turbines.length === 0) return null;

  const powerCurve = customPowerCurves?.[model.id] ?? model.powerCurve;
  const k = settings.weibullK;
  const A = settings.freeWindSpeed / gamma(1 + 1 / k);
  const densityRatio = settings.airDensity / 1.225;

  // Gross energy per turbine via Weibull integration
  let annualEnergyKwh = 0;
  for (let v = 0; v <= 25; v += 0.1) {
    annualEnergyKwh +=
      interpolatePower(v, powerCurve) * densityRatio * weibullPdf(v, k, A) * 0.1 * 8760;
  }
  const grossAepMwhPerTurbine = annualEnergyKwh / 1000;

  const turbinesWithCompliance = calculateSpacing(
    turbines,
    model.rotorDiameter,
    prevailingWindDir
  );

  // Median northing for mast zone labelling
  const sorted = [...turbinesWithCompliance].sort((a, b) => a.northing - b.northing);
  const medianNorthing = sorted[Math.floor(sorted.length / 2)]?.northing ?? 0;

  // Combined multiplicative loss factor (non-wake)
  const otherLossesFactor =
    (settings.machineAvailability / 100) *
    (settings.bopAvailability / 100) *
    (settings.gridAvailability / 100) *
    (settings.transmissionEfficiency / 100) *
    (settings.turbinePerformance / 100) *
    (1 - settings.curtailmentLoss / 100) *
    (1 - settings.environmentalLoss / 100);

  // Per-turbine computation
  const rawReports = turbinesWithCompliance.map((t, idx) => {
    const wakeLossFactor = t.nearestNeighborDistanceRD
      ? Math.max(0, 1 - 0.1 / (t.nearestNeighborDistanceRD / 7))
      : 1;
    const wakeLoss = (1 - wakeLossFactor) * 100;
    const netAepMwh = grossAepMwhPerTurbine * wakeLossFactor * otherLossesFactor;
    const plf = (netAepMwh / (model.ratedKW * 8.76)) * 100;

    return {
      ...t,
      grossAep: grossAepMwhPerTurbine,
      netAep: netAepMwh,
      plf,
      wakeLoss,
      arrayLoss: +wakeLoss.toFixed(1),
      arrayEff: +(100 - wakeLoss).toFixed(1),
      totalLoss: +((1 - netAepMwh / grossAepMwhPerTurbine) * 100).toFixed(1),
      rank: 0,
      freeWindSpeed: settings.freeWindSpeed,
      // INDICATIVE ONLY — replace with site-measured LiDAR / met-mast data
      totalTI: +seededValue(idx + 1, 5.8, 6.5).toFixed(1),
      baseElevation: Math.round(seededValue(idx + 1001, 8, 28)),
      mastAssociation: t.northing >= medianNorthing ? 'Zone North' : 'Zone South',
    } as EYATurbineReport;
  });

  // Assign turbine ranks (highest net AEP = rank 1)
  const rankOrder = [...rawReports].sort((a, b) => b.netAep - a.netAep);
  rankOrder.forEach((t, i) => { t.rank = i + 1; });
  const rankMap = new Map(rankOrder.map(t => [t.id, t.rank]));
  const individualReports: EYATurbineReport[] = rawReports.map(t => ({
    ...t,
    rank: rankMap.get(t.id) ?? 0,
  }));

  // Summary
  const totalGross = individualReports.reduce((s, t) => s + t.grossAep, 0);
  const totalNet = individualReports.reduce((s, t) => s + t.netAep, 0);
  const avgPlf = individualReports.reduce((s, t) => s + t.plf, 0) / turbines.length;
  const wakeTotal =
    (1 -
      individualReports.reduce((s, t) => s + t.grossAep * (1 - t.wakeLoss / 100), 0) /
        totalGross) *
    100;
  const availabilityLoss =
    100 - (settings.machineAvailability * settings.bopAvailability * settings.gridAvailability) / 10000;
  const totalInstalledMW = (turbines.length * model.ratedKW) / 1000;

  // P-values: P_x = P50 × (1 − z × σ)  [normal/linear approximation, σ = totalUncertainty/100]
  // NOTE: this is a symmetric normal approximation, NOT lognormal.
  // It is accurate for σ < ~10 %. For higher uncertainties use P50 × exp(−z × ln(1+σ²)^0.5).
  const sigma = settings.totalUncertainty / 100;
  const p50 = totalNet;
  const p75 = p50 * (1 - Z.p75 * sigma);
  const p90 = p50 * (1 - Z.p90 * sigma);
  const p95 = p50 * (1 - Z.p95 * sigma);
  const p99 = p50 * (1 - Z.p99 * sigma);

  // First-year: additional 4 % availability loss in year 1
  const firstYearNetAepMwh = totalNet * 0.96;
  const p50fy = firstYearNetAepMwh;
  const p75fy = p50fy * (1 - Z.p75 * sigma);
  const p90fy = p50fy * (1 - Z.p90 * sigma);
  const p95fy = p50fy * (1 - Z.p95 * sigma);
  const p99fy = p50fy * (1 - Z.p99 * sigma);

  const hoursPerYear = 8760;
  const toPlf = (mwh: number) => (mwh / (totalInstalledMW * hoursPerYear)) * 100;

  return {
    individualReports,
    summary: {
      grossAepMwh: totalGross,
      netAepMwh: totalNet,
      firstYearNetAepMwh,
      plf: avgPlf,
      avgWindSpeed: settings.freeWindSpeed,
      wakeLoss: wakeTotal,
      availabilityLoss,
      totalLoss: (1 - totalNet / totalGross) * 100,
      p50, p75, p90, p95, p99,
      p50fy, p75fy, p90fy, p95fy, p99fy,
      plf50: toPlf(p50), plf75: toPlf(p75), plf90: toPlf(p90),
      plf95: toPlf(p95), plf99: toPlf(p99),
      plfFy50: toPlf(p50fy), plfFy75: toPlf(p75fy), plfFy90: toPlf(p90fy),
      plfFy95: toPlf(p95fy), plfFy99: toPlf(p99fy),
      lossBreakdown: deriveLossBreakdown(settings, wakeTotal),
      totalInstalledMW,
    },
  };
}
