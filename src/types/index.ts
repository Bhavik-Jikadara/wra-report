export interface TurbineModel {
  id: string;
  oem: string;
  model: string;
  ratedKW: number;
  rotorDiameter: number;
  hubHeights: number[];
  cutInSpeed: number;
  ratedSpeed: number;
  cutOutSpeed: number;
  iecClass: string;
  powerCurve: [number, number][];
  thrustCurve: [number, number][];
}

export interface TurbinePosition {
  id: string;
  lat: number;
  lng: number;
  easting: number;
  northing: number;
  utmZone: string;
  nearestNeighborId: string;
  nearestNeighborDistanceM: number;
  nearestNeighborDistanceRD: number;
  requiredDistanceM?: number;
  deviationM?: number;
  deviationPct?: number;
  violationType?: string;
  spacingStatus: 'ok' | 'warning' | 'violation';
  modelId?: string;
  hubHeight?: number;
}

export interface EYASettings {
  freeWindSpeed: number;
  weibullK: number;
  airDensity: number;
  projectLifetime: number;
  wakeLoss: number;
  machineAvailability: number;
  bopAvailability: number;
  gridAvailability: number;
  transmissionEfficiency: number;
  turbinePerformance: number;
  curtailmentLoss: number;
  environmentalLoss: number;
  totalUncertainty: number;
}

export interface MicrositingSettings {
  targetCount: number;
  turbineModelId: string;
  hubHeight: number;
  crosswindMultiple: number;
  downwindMultiple: number;
  boundarySetback: number;
  prevailingWindDir: number;
}
