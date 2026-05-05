import type { EYASettings, TurbineModel, TurbinePosition } from '@/types';
import { calculateSpacing } from './spacingValidator';

// Weibull PDF
function weibullPdf(v: number, k: number, A: number): number {
  if (v <= 0) return 0;
  return (k / A) * Math.pow(v / A, k - 1) * Math.exp(-Math.pow(v / A, k));
}

// Gamma function for Weibull A calculation
function gamma(z: number): number {
  const g = 7;
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278224157, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
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

export function calculateEYA(
  turbines: TurbinePosition[],
  settings: EYASettings,
  model: TurbineModel,
  prevailingWindDir: number,
  customPowerCurves?: Record<string, [number, number][]>
) {
  if (turbines.length === 0) return null;

  const powerCurve = customPowerCurves?.[model.id] || model.powerCurve;
  const k = settings.weibullK;
  const A = settings.freeWindSpeed / gamma(1 + 1 / k);
  const densityRatio = settings.airDensity / 1.225;
  
  // Numerical Integration for Gross Energy
  const dv = 0.1;
  let annualEnergyKwh = 0;
  for (let v = 0; v <= 25; v += dv) {
    const p = interpolatePower(v, powerCurve) * densityRatio;
    const prob = weibullPdf(v, k, A);
    annualEnergyKwh += p * prob * dv * 8760;
  }

  const grossAepMwhPerTurbine = annualEnergyKwh / 1000;
  
  // 1. First, calculate all spacing and compliance data for all turbines
  const turbinesWithCompliance = calculateSpacing(turbines, model.rotorDiameter, prevailingWindDir);

  // 2. Calculate individual turbine generation data
  const individualReports = turbinesWithCompliance.map(t => {
    // Simple wake loss model based on distance
    const wakeLossFactor = t.nearestNeighborDistanceRD 
      ? Math.max(0, 1 - (0.1 / (t.nearestNeighborDistanceRD / 7)))
      : 1;

    const turbineGrossAep = grossAepMwhPerTurbine;
    const wakeLoss = (1 - wakeLossFactor) * 100;
    
    // Aggregate other losses (multiplicative)
    const otherLossesFactor = 
      (settings.machineAvailability / 100) *
      (settings.bopAvailability / 100) *
      (settings.gridAvailability / 100) *
      (settings.transmissionEfficiency / 100) *
      (settings.turbinePerformance / 100) *
      (1 - settings.curtailmentLoss / 100) *
      (1 - settings.environmentalLoss / 100);

    const netAepMwh = turbineGrossAep * wakeLossFactor * otherLossesFactor;
    const plf = (netAepMwh / (model.ratedKW * 8.760)) * 100;

    return {
      ...t,
      grossAep: turbineGrossAep,
      netAep: netAepMwh,
      plf,
      wakeLoss,
      totalLoss: (1 - (netAepMwh / turbineGrossAep)) * 100
    };
  });

  // Summary Aggregates
  const totalGrossAepMwh = individualReports.reduce((sum, t) => sum + t.grossAep, 0);
  const totalNetAepMwh = individualReports.reduce((sum, t) => sum + t.netAep, 0);
  const avgPlf = individualReports.reduce((sum, t) => sum + t.plf, 0) / turbines.length;
  const totalWakeLoss = (1 - (individualReports.reduce((sum, t) => sum + t.grossAep * (1 - t.wakeLoss/100), 0) / totalGrossAepMwh)) * 100;

  // Other Losses (Average)
  const availabilityLoss = 100 - (settings.machineAvailability * settings.bopAvailability * settings.gridAvailability / 10000);
  
  return {
    individualReports,
    summary: {
      grossAepMwh: totalGrossAepMwh,
      netAepMwh: totalNetAepMwh,
      plf: avgPlf,
      wakeLoss: totalWakeLoss,
      availabilityLoss,
      totalLoss: (1 - (totalNetAepMwh / totalGrossAepMwh)) * 100,
      p50: totalNetAepMwh,
      p75: totalNetAepMwh * 0.92, // Simplified uncertainty
      p90: totalNetAepMwh * 0.85,
      p99: totalNetAepMwh * 0.75
    }
  };
}
