import { parseKmlPointsOrKmz } from './kmlParser';
import { latLngToUTM } from './utmConverter';
import { calculateSpacing } from './spacingValidator';
import type { TurbinePosition, TurbineModel, MicrositingSettings } from '@/types';

export interface ImportResult {
  turbines: TurbinePosition[];
  totalImported: number;
  compliantCount: number;
  warningCount: number;
  violationCount: number;
  warnings: string[];
}

export async function importTurbinesFromFile(
  file: File,
  model: TurbineModel,
  settings: MicrositingSettings
): Promise<ImportResult> {
  const fc = await parseKmlPointsOrKmz(file);

  if (!fc || fc.features.length === 0) {
    throw new Error(
      'No turbine point locations found. Ensure the KML/KMZ contains Point placemarks representing turbine positions.'
    );
  }

  // Build raw turbine list from Point features
  const seen = new Set<string>();
  const rawTurbines: TurbinePosition[] = fc.features.map((f, i) => {
    const [lng, lat] = (f.geometry as any).coordinates as [number, number];
    const rawName = ((f.properties as any)?.name as string | undefined)?.trim();
    let id = rawName || `WTG-${String(i + 1).padStart(2, '0')}`;

    // Deduplicate IDs
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seen.add(id);

    const utm = latLngToUTM(lat, lng);
    return {
      id, lat, lng,
      easting: utm.easting,
      northing: utm.northing,
      utmZone: `${utm.zone}${utm.letter}`,
      nearestNeighborId: '',
      nearestNeighborDistanceM: 0,
      nearestNeighborDistanceRD: 0,
      spacingStatus: 'ok' as const,
    };
  });

  // MNRE spacing validation
  const turbines = calculateSpacing(rawTurbines, model.rotorDiameter, settings.prevailingWindDir);

  const compliantCount  = turbines.filter(t => t.spacingStatus === 'ok').length;
  const warningCount    = turbines.filter(t => t.spacingStatus === 'warning').length;
  const violationCount  = turbines.filter(t => t.spacingStatus === 'violation').length;

  const warnings: string[] = [];
  if (violationCount > 0)
    warnings.push(`${violationCount} turbine${violationCount > 1 ? 's' : ''} violate MNRE spacing (5D/7D)`);
  if (warningCount > 0)
    warnings.push(`${warningCount} turbine${warningCount > 1 ? 's' : ''} are within the 5% warning buffer`);

  return { turbines, totalImported: turbines.length, compliantCount, warningCount, violationCount, warnings };
}
