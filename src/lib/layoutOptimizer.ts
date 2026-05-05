import { buffer, booleanPointInPolygon, distance, point, bbox, transformRotate, bearing } from '@turf/turf';
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Point } from 'geojson';
import type { TurbinePosition, MicrositingSettings, TurbineModel } from '@/types';
import { latLngToUTM } from './utmConverter';
import { calculateSpacing } from './spacingValidator';

export async function optimizeLayout(
  boundary: FeatureCollection,
  exclusionZones: FeatureCollection | null,
  settings: MicrositingSettings,
  turbineModel: TurbineModel
): Promise<{ turbines: TurbinePosition[], warnings: string[] }> {
  const warnings: string[] = [];
  
  if (!boundary.features.length) {
    throw new Error("No boundary provided");
  }

  // 1. Inward Buffer (MNRE Setback Guideline)
  // MNRE Setback = 1.1 * Tip Height (Hub Height + Rotor Diameter / 2)
  const tipHeight = settings.hubHeight + (turbineModel.rotorDiameter / 2);
  const setbackMeters = 1.1 * tipHeight;
  let placementPolygon: Feature<Polygon | MultiPolygon> | null = null;
  
  try {
    // Attempt to inward buffer
    // Turf's buffer with negative values works for simple polygons
    const firstFeature = boundary.features[0] as Feature<Polygon | MultiPolygon>;
    const buffered = buffer(firstFeature, -setbackMeters, { units: 'meters' });
    if (buffered && buffered.geometry) {
      placementPolygon = buffered as Feature<Polygon | MultiPolygon>;
    } else {
      warnings.push("Inward buffer resulted in an empty polygon. The boundary might be too small for the requested setback.");
    }
  } catch (e) {
    warnings.push("Failed to apply boundary setback buffer. Placing up to the edge.");
    placementPolygon = boundary.features[0] as Feature<Polygon | MultiPolygon>;
  }

  if (!placementPolygon) {
    return { turbines: [], warnings };
  }

  // 2. Grid Generation (MNRE Compliant)
  // Grid should be aligned with prevailing wind direction
  // Along-wind step = 7D, Cross-wind step = 5D
  const crosswindMeters = 5 * turbineModel.rotorDiameter;
  const downwindMeters = 7 * turbineModel.rotorDiameter;
  
  const boundingBox = bbox(placementPolygon);
  const [minLng, minLat, maxLng, maxLat] = boundingBox;
  
  // Approximate conversion for grid density calculation
  const latStep = (crosswindMeters / 111320); 
  const lngStep = (downwindMeters / (111320 * Math.cos(minLat * Math.PI / 180)));
  
  const centerPt = point([(minLng + maxLng) / 2, (minLat + maxLat) / 2]);
  
  const candidates: Feature<Point>[] = [];
  
  // Generate a staggered grid
  const padding = 0.1; 
  let rowIndex = 0;
  for (let lat = minLat - padding; lat <= maxLat + padding; lat += latStep) {
    const isEvenRow = rowIndex % 2 === 0;
    const shift = isEvenRow ? 0 : lngStep / 2;
    
    for (let lng = minLng - padding + shift; lng <= maxLng + padding; lng += lngStep) {
      candidates.push(point([lng, lat]));
    }
    rowIndex++;
  }

  // Rotate grid to align with prevailing wind direction
  // Wind comes FROM settings.prevailingWindDir. 
  // We rotate the entire grid so that rows are perpendicular to wind.
  const rotatedCandidates = candidates.map(pt => 
    transformRotate(pt, settings.prevailingWindDir, { pivot: centerPt })
  );

  // 3. Filter valid candidates (inside boundary and NOT in exclusion zones)
  let validCandidates = rotatedCandidates.filter(pt => {
    const inBoundary = booleanPointInPolygon(pt, placementPolygon as Feature<Polygon | MultiPolygon>);
    if (!inBoundary) return false;

    // Check exclusion zones
    if (exclusionZones && exclusionZones.features.length > 0) {
      for (const zone of exclusionZones.features) {
        if (zone.geometry.type === 'Polygon' || zone.geometry.type === 'MultiPolygon') {
          if (booleanPointInPolygon(pt, zone as Feature<Polygon | MultiPolygon>)) {
            return false;
          }
        }
      }
    }

    return true;
  });

  // Sort candidates to fill from center outward (or some other heuristic)
  validCandidates.sort((a, b) => {
    const distA = distance(a, centerPt);
    const distB = distance(b, centerPt);
    return distA - distB;
  });

  // 4. Greedy Placement with Elliptical Spacing Check
  const placedTurbines: TurbinePosition[] = [];
  const D = turbineModel.rotorDiameter;
  const majorAxis = 7 * D;
  const minorAxis = 5 * D;

  for (const candidate of validCandidates) {
    if (placedTurbines.length >= settings.targetCount) break;
    
    let isValid = true;


    for (const placed of placedTurbines) {
      const pPt = point([placed.lng, placed.lat]);
      const distM = distance(candidate, pPt, { units: 'kilometers' }) * 1000;
      
      // Calculate bearing relative to wind direction
      let b = bearing(candidate, pPt);
      if (b < 0) b += 360;
      const angleDiff = (b - settings.prevailingWindDir) * (Math.PI / 180);

      // Required distance at this angle (Ellipse formula)
      const r_required = (majorAxis * minorAxis) / 
        Math.sqrt(Math.pow(minorAxis * Math.cos(angleDiff), 2) + Math.pow(majorAxis * Math.sin(angleDiff), 2));

      if (distM < r_required) {
        isValid = false;
        break;
      }
    }
    
    if (isValid) {
      const lng = candidate.geometry.coordinates[0];
      const lat = candidate.geometry.coordinates[1];
      const utm = latLngToUTM(lat, lng);
      
      placedTurbines.push({
        id: `T${placedTurbines.length + 1}`,
        lat,
        lng,
        easting: utm.easting,
        northing: utm.northing,
        utmZone: `${utm.zone}${utm.letter}`,
        nearestNeighborId: '',
        nearestNeighborDistanceM: 0,
        nearestNeighborDistanceRD: 0,
        spacingStatus: 'ok',
        modelId: turbineModel.id,
        hubHeight: settings.hubHeight
      });
    }
  }

  if (placedTurbines.length < settings.targetCount) {
    warnings.push(`Only ${placedTurbines.length} out of ${settings.targetCount} turbines could be placed with the current spacing settings.`);
  }

  // 5. Final Spacing Validation Calculation
  const validatedTurbines = calculateSpacing(placedTurbines, turbineModel.rotorDiameter, settings.crosswindMultiple);

  return {
    turbines: validatedTurbines,
    warnings
  };
}
