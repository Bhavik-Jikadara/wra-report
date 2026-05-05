import { distance, point, bearing } from '@turf/turf';
import type { TurbinePosition } from '@/types';

export function calculateSpacing(
  turbines: TurbinePosition[],
  rotorDiameter: number,
  prevailingWindDir: number = 270
): TurbinePosition[] {
  if (turbines.length <= 1) return turbines;

  const updatedTurbines = [...turbines];
  const D = rotorDiameter;
  const majorAxis = 7 * D; // Along-wind
  const minorAxis = 5 * D; // Cross-wind

  for (let i = 0; i < updatedTurbines.length; i++) {
    let minRatio = Infinity;
    let nearestId = '';
    let actualDistM = 0;
    let requiredDistM = 0;

    const pt1 = point([updatedTurbines[i].lng, updatedTurbines[i].lat]);

    for (let j = 0; j < updatedTurbines.length; j++) {
      if (i === j) continue;
      
      const pt2 = point([updatedTurbines[j].lng, updatedTurbines[j].lat]);
      const distM = distance(pt1, pt2, { units: 'kilometers' }) * 1000;
      
      // Calculate bearing from pt1 to pt2 (-180 to 180)
      let b = bearing(pt1, pt2);
      if (b < 0) b += 360;

      // Angle difference from prevailing wind
      const angleDiff = (b - prevailingWindDir) * (Math.PI / 180);

      const a = majorAxis;
      const b_minor = minorAxis;
      const r_required = (a * b_minor) / Math.sqrt(Math.pow(b_minor * Math.cos(angleDiff), 2) + Math.pow(a * Math.sin(angleDiff), 2));

      const ratio = distM / r_required;

      if (ratio < minRatio) {
        minRatio = ratio;
        nearestId = updatedTurbines[j].id;
        actualDistM = distM;
        requiredDistM = r_required;
      }
    }

    const distRD = actualDistM / rotorDiameter;
    const deviationM = actualDistM - requiredDistM;
    const deviationPct = (deviationM / requiredDistM) * 100;
    
    // Determine if violation is more "Along-wind" or "Cross-wind"
    // Get bearing to nearest
    const ptNearest = point([updatedTurbines.find(t => t.id === nearestId)?.lng || 0, updatedTurbines.find(t => t.id === nearestId)?.lat || 0]);
    let bToNearest = bearing(pt1, ptNearest);
    if (bToNearest < 0) bToNearest += 360;
    const absAngleDiff = Math.abs(bToNearest - prevailingWindDir) % 180;
    const violationDir = (absAngleDiff < 45 || absAngleDiff > 135) ? 'Along-wind' : 'Cross-wind';

    let status: 'ok' | 'warning' | 'violation' = 'ok';
    if (minRatio < 1.0) {
      status = 'violation';
    } else if (minRatio < 1.05) { // Within 5% buffer
      status = 'warning';
    }

    updatedTurbines[i] = {
      ...updatedTurbines[i],
      nearestNeighborId: nearestId,
      nearestNeighborDistanceM: actualDistM,
      nearestNeighborDistanceRD: distRD,
      requiredDistanceM: requiredDistM,
      deviationM: deviationM,
      deviationPct: deviationPct,
      violationType: status !== 'ok' ? `${violationDir} (${status === 'violation' ? '5D/7D' : 'Buffer'})` : undefined,
      spacingStatus: status
    };
  }

  return updatedTurbines;
}
