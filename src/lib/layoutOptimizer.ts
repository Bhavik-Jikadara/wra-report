/**
 * PATCH for layoutOptimizer.ts
 *
 * Replace the existing "Inward Buffer" and "Prepare Exclusion Zones" sections
 * with the corrected MNRE-compliant logic below.
 *
 * Changes:
 *  1. Boundary setback formula: HH + 0.5*RD + 5m  (MNRE Para V.iii)
 *     was: 1.1 * (HH + RD/2)
 *
 *  2. Feature setbacks now correctly differentiated:
 *     - water   → 500 m (fixed)
 *     - dwelling → 500 m (fixed, cluster ≥15 buildings)
 *     - road, railway, ehv_line, building → HH + 0.5*RD + 5m (formula)
 *
 *  3. LineString features (roads, railways, EHV lines) are now buffered,
 *     not skipped (previous code only handled Polygon/MultiPolygon).
 *
 *  4. External turbine spacing uses larger-of-two RD (MNRE Para V.ii).
 */

import { buffer, booleanPointInPolygon, distance, point, bbox, transformRotate, bearing } from '@turf/turf';
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Point } from 'geojson';
import type { TurbinePosition, MicrositingSettings, TurbineModel } from '@/types';
import { latLngToUTM } from './utmConverter';
import { calculateSpacing } from './spacingValidator';
import { formulaSetbackM, FORMULA_SETBACK_TYPES } from './osmService';

export async function optimizeLayout(
  boundary: FeatureCollection,
  exclusionZones: FeatureCollection | null,
  externalTurbines: TurbinePosition[],
  mapFeatures: FeatureCollection | null,
  settings: MicrositingSettings,
  turbineModel: TurbineModel
): Promise<{ turbines: TurbinePosition[]; warnings: string[] }> {
  const warnings: string[] = [];

  if (!boundary.features.length) {
    throw new Error('No boundary provided');
  }

  // ── 1. Inward Buffer — MNRE Setback ────────────────────────────────────────
  // MNRE July 2024 Para V.iii: HH + 0.5*RD + 5 m from project boundary edge
  const mnreSetbackM = formulaSetbackM(settings.hubHeight, turbineModel.rotorDiameter);

  let placementPolygon: Feature<Polygon | MultiPolygon> | null = null;
  try {
    const firstFeature = boundary.features[0] as Feature<Polygon | MultiPolygon>;
    const buffered = buffer(firstFeature, -mnreSetbackM, { units: 'meters' });
    if (buffered?.geometry) {
      placementPolygon = buffered as Feature<Polygon | MultiPolygon>;
    } else {
      warnings.push(
        `Inward buffer (${mnreSetbackM.toFixed(0)} m) resulted in an empty polygon. ` +
        `The boundary may be too small for the selected turbine model.`
      );
    }
  } catch {
    warnings.push('Failed to apply boundary setback buffer. Placing up to the boundary edge.');
    placementPolygon = boundary.features[0] as Feature<Polygon | MultiPolygon>;
  }

  if (!placementPolygon) return { turbines: [], warnings };

  // ── 2. Grid Generation — MNRE Compliant ────────────────────────────────────
  // Cross-wind: 5D, Along-wind: 7D, aligned with prevailing wind direction
  const crosswindM = settings.crosswindMultiple * turbineModel.rotorDiameter;   // default 5D
  const downwindM = settings.downwindMultiple * turbineModel.rotorDiameter;   // default 7D

  const boundingBox = bbox(placementPolygon);
  const [minLng, minLat, maxLng, maxLat] = boundingBox;

  const latStep = crosswindM / 111320;
  const lngStep = downwindM / (111320 * Math.cos(minLat * (Math.PI / 180)));

  const centerPt = point([(minLng + maxLng) / 2, (minLat + maxLat) / 2]);
  const candidates: Feature<Point>[] = [];
  const padding = 0.1;
  let rowIndex = 0;

  for (let lat = minLat - padding; lat <= maxLat + padding; lat += latStep) {
    const shift = rowIndex % 2 === 0 ? 0 : lngStep / 2;
    for (let lng = minLng - padding + shift; lng <= maxLng + padding; lng += lngStep) {
      candidates.push(point([lng, lat]));
    }
    rowIndex++;
  }

  const rotatedCandidates = candidates.map((pt) =>
    transformRotate(pt, settings.prevailingWindDir, { pivot: centerPt })
  );

  // ── 2.5 Prepare Exclusion Zones — MNRE Setbacks Per Feature Type ───────────
  const allExclusions: Feature<Polygon | MultiPolygon>[] = [];

  // Manual exclusion zones (always treated as hard exclusions, no buffer added)
  if (exclusionZones) {
    allExclusions.push(
      ...(exclusionZones.features.filter(
        (f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      ) as Feature<Polygon | MultiPolygon>[])
    );
  }

  if (mapFeatures) {
    for (const feature of mapFeatures.features) {
      const type = (feature.properties?.type as string) ?? 'other';

      let setbackM: number;

      if (type === 'water' || type === 'dwelling') {
        // Fixed MNRE setback
        setbackM = 500;
      } else if (FORMULA_SETBACK_TYPES.includes(type as any)) {
        // Formula-based: HH + 0.5*RD + 5
        setbackM = mnreSetbackM;
      } else {
        // Unknown / other features — apply conservative 50 m buffer
        setbackM = 50;
      }

      try {
        const geomType = feature.geometry.type;

        if (
          geomType === 'Polygon' ||
          geomType === 'MultiPolygon' ||
          geomType === 'LineString' ||
          geomType === 'MultiLineString'
        ) {
          const buffered = buffer(feature as any, setbackM, { units: 'meters' });
          if (buffered) allExclusions.push(buffered as Feature<Polygon | MultiPolygon>);
        }
        // Point features (individual nodes) — buffer into polygon
        else if (geomType === 'Point') {
          const buffered = buffer(feature as any, setbackM, { units: 'meters' });
          if (buffered) allExclusions.push(buffered as Feature<Polygon | MultiPolygon>);
        }
      } catch (e) {
        console.error('[layoutOptimizer] Error buffering feature:', type, e);
      }
    }
  }

  // ── 3. Filter Valid Candidates ─────────────────────────────────────────────
  let validCandidates = rotatedCandidates.filter((pt) => {
    if (!booleanPointInPolygon(pt, placementPolygon as Feature<Polygon | MultiPolygon>)) {
      return false;
    }
    for (const zone of allExclusions) {
      if (booleanPointInPolygon(pt, zone)) return false;
    }
    return true;
  });

  validCandidates = validCandidates.sort(() => Math.random() - 0.5);

  // ── 4. Greedy Placement — MNRE Spacing + External Developer Rule ───────────
  const placedTurbines: TurbinePosition[] = [];
  const D = turbineModel.rotorDiameter;
  const majorAxis = settings.downwindMultiple * D; // 7D along-wind
  const minorAxis = settings.crosswindMultiple * D; // 5D cross-wind

  for (const candidate of validCandidates) {
    if (placedTurbines.length >= settings.targetCount) break;
    let isValid = true;

    const cPt = point([candidate.geometry.coordinates[0], candidate.geometry.coordinates[1]]);

    // Check internal turbine spacing (same developer)
    for (const placed of placedTurbines) {
      const pPt = point([placed.lng, placed.lat]);
      const distM = distance(cPt, pPt, { units: 'kilometers' }) * 1000;
      let b = bearing(cPt, pPt);
      if (b < 0) b += 360;
      const angleDiff = (b - settings.prevailingWindDir) * (Math.PI / 180);
      const r_req =
        (majorAxis * minorAxis) /
        Math.sqrt(
          Math.pow(minorAxis * Math.cos(angleDiff), 2) +
          Math.pow(majorAxis * Math.sin(angleDiff), 2)
        );
      if (distM < r_req) { isValid = false; break; }
    }

    if (!isValid) continue;

    // Check external turbine spacing (MNRE: use LARGER of the two rotor diameters)
    for (const ext of externalTurbines) {
      const extRD = ext.rotorDiameter ?? D; // fallback to own RD if ext RD unknown
      const largerD = Math.max(D, extRD);
      const extMajor = settings.downwindMultiple * largerD;
      const extMinor = settings.crosswindMultiple * largerD;

      const pPt = point([ext.lng, ext.lat]);
      const distM = distance(cPt, pPt, { units: 'kilometers' }) * 1000;
      let b = bearing(cPt, pPt);
      if (b < 0) b += 360;
      const angleDiff = (b - settings.prevailingWindDir) * (Math.PI / 180);
      const r_req =
        (extMajor * extMinor) /
        Math.sqrt(
          Math.pow(extMinor * Math.cos(angleDiff), 2) +
          Math.pow(extMajor * Math.sin(angleDiff), 2)
        );
      if (distM < r_req) { isValid = false; break; }
    }

    if (isValid) {
      const [lng, lat] = candidate.geometry.coordinates as [number, number];
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
        hubHeight: settings.hubHeight,
        rotorDiameter: turbineModel.rotorDiameter,
      });
    }
  }

  if (placedTurbines.length < settings.targetCount) {
    warnings.push(
      `Only ${placedTurbines.length} of ${settings.targetCount} turbines could be placed ` +
      `while satisfying all MNRE setback and spacing constraints.`
    );
  }

  // ── 5. Final Spacing Validation ────────────────────────────────────────────
  const validatedTurbines = calculateSpacing(
    placedTurbines,
    turbineModel.rotorDiameter,
    settings.prevailingWindDir
  );

  return { turbines: validatedTurbines, warnings };
}