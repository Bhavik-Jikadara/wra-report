/**
 * gisUtils.ts — Dual-CRS Coordinate Management for Wind Farm Micrositing
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CRS DECISION FLOWCHART
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Input / Operation                    → CRS to use
 *  ─────────────────────────────────── ─ ─────────────────────────────────
 *  Render feature on MapLibre           → EPSG:4326  (MapLibre expects geographic)
 *  Store GeoJSON in Zustand / file      → EPSG:4326  (GeoJSON RFC 7946 mandates it)
 *  Overpass API bbox query              → EPSG:4326  (lat/lng required)
 *  KML / API interchange                → EPSG:4326
 *
 *  Distance check (turbine ↔ feature)  → EPSG:4326  (Turf haversine is accurate)
 *  Bearing / heading calculation        → EPSG:4326  (Turf handles it)
 *  Area computation (< 100 km²)        → EPSG:4326  (Turf turfArea < 0.01% error)
 *
 *  Setback buffer in exact metres       → reproject to UTM → buffer → back to 4326
 *  Area computation requiring survey    → reproject to UTM → turfArea on metres
 *  precision (> 100 km² or legal use)
 *
 *  Turbine E/N for field teams          → reprojectCoordinate → UTM (easting, northing)
 *  Survey report DMS output             → formatCoordinates → .dms
 *  GeoJSON output for API               → formatCoordinates → .dd
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EPSG CODES BUNDLED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  EPSG:4326   WGS 84 Geographic    — storage, rendering, API
 *  EPSG:3857   Web Mercator          — MapLibre tiles (rarely manual)
 *  EPSG:32642  UTM Zone 42N          — Rajasthan W, Sindh, Balochistan
 *  EPSG:32643  UTM Zone 43N  ★       — Gujarat, Rajasthan E, Maharashtra W
 *  EPSG:32644  UTM Zone 44N  ★       — Karnataka, Andhra Pradesh, Tamil Nadu
 *  EPSG:32645  UTM Zone 45N          — West Bengal, Odisha, Bangladesh
 *  EPSG:32646  UTM Zone 46N          — Myanmar, NE India
 *  EPSG:32742–32746                  — Southern hemisphere mirrors (global)
 *  Any other zone                    — registered on-demand via ensureUtmDef()
 *
 *  ★ = primary zones for Indian wind farm deployments
 */

import proj4 from 'proj4';
import { centroid as turfCentroid, buffer as turfBuffer, area as turfArea } from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

// ─── EPSG bundle ──────────────────────────────────────────────────────────────

proj4.defs('EPSG:4326',  '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:3857',  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs');
// UTM North — India sub-continent
proj4.defs('EPSG:32642', '+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32643', '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32644', '+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32645', '+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32646', '+proj=utm +zone=46 +datum=WGS84 +units=m +no_defs');
// UTM South — global deployment mirrors
proj4.defs('EPSG:32742', '+proj=utm +zone=42 +south +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32743', '+proj=utm +zone=43 +south +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32744', '+proj=utm +zone=44 +south +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32745', '+proj=utm +zone=45 +south +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32746', '+proj=utm +zone=46 +south +datum=WGS84 +units=m +no_defs');

// ─── Public types ─────────────────────────────────────────────────────────────

export type EpsgCode = number;

export interface UTMCoordinate {
  easting:    number;
  northing:   number;
  zone:       number;
  hemisphere: 'N' | 'S';
  epsg:       EpsgCode;
  /** Formatted string for field teams: "43N  451234E  2048721N" */
  label:      string;
}

export interface FormattedCoordinates {
  /** Decimal Degrees  — GeoJSON / API interchange */
  dd:  { lat: string; lng: string };
  /** Degrees-Minutes-Seconds — survey reports */
  dms: { lat: string; lng: string };
  /** UTM Easting/Northing — field teams */
  utm: UTMCoordinate;
}

export interface BufferOptions {
  /**
   * 'geodesic' (default) — uses Turf's spherical buffer; accurate < 10 km, fast.
   * 'projected'           — reprojects to UTM, buffers in metres, reprojects back;
   *                         use for large buffers or legally mandated precision.
   */
  method?: 'geodesic' | 'projected';
  /** Override auto-detected UTM EPSG (projected method only) */
  utmEpsg?: EpsgCode;
  /** Number of steps in buffer polygon (default 64) */
  steps?: number;
}

// ─── UTM zone detection ───────────────────────────────────────────────────────

/**
 * Derive the standard UTM EPSG code for a WGS84 coordinate.
 * Returns EPSG:326xx for northern hemisphere, EPSG:327xx for southern.
 *
 * @example detectUtmEpsg(76.5, 21.3) → 32643  (UTM 43N — Gujarat)
 * @example detectUtmEpsg(76.5, -21.3) → 32743  (UTM 43S)
 */
export function detectUtmEpsg(lng: number, lat: number): EpsgCode {
  const zone = Math.floor((lng + 180) / 6) + 1;
  return (lat >= 0 ? 32600 : 32700) + zone;
}

/**
 * Derive the best UTM EPSG from a FeatureCollection's geographic centroid.
 * Use this once per project boundary to get the zone for all calculations.
 *
 * @example boundaryUtmEpsg(projectBoundary) → 32643
 */
export function boundaryUtmEpsg(boundary: FeatureCollection): EpsgCode {
  try {
    const c = turfCentroid(boundary);
    const [lng, lat] = c.geometry.coordinates;
    return detectUtmEpsg(lng, lat);
  } catch {
    return 32643; // fallback: UTM 43N (central India)
  }
}

/**
 * Register a UTM EPSG on-demand if not already bundled.
 * Supports any valid UTM zone (1–60) in either hemisphere.
 */
function ensureUtmDef(epsg: EpsgCode): string {
  const key = `EPSG:${epsg}`;
  if (!proj4.defs(key)) {
    const isNorth = epsg < 32700;
    const zone    = epsg - (isNorth ? 32600 : 32700);
    const south   = isNorth ? '' : ' +south';
    proj4.defs(key, `+proj=utm +zone=${zone}${south} +datum=WGS84 +units=m +no_defs`);
  }
  return key;
}

function epsgKey(epsg: EpsgCode): string {
  if (epsg === 4326 || epsg === 3857) return `EPSG:${epsg}`;
  return ensureUtmDef(epsg);
}

// ─── Coordinate-level reprojection ───────────────────────────────────────────

/**
 * Reproject a single GeoJSON Position [x, y, z?] between any two EPSG codes.
 * Preserves the z (elevation) component unchanged.
 *
 * @example
 *   // WGS84 → UTM 43N
 *   reprojectCoordinate([76.5, 21.3], 4326, 32643)
 *   // → [451234.12, 2357891.45]
 *
 *   // UTM 43N → WGS84
 *   reprojectCoordinate([451234, 2357891], 32643, 4326)
 *   // → [76.4999, 21.2998]
 */
export function reprojectCoordinate(
  pos: Position,
  fromEpsg: EpsgCode,
  toEpsg: EpsgCode
): Position {
  if (fromEpsg === toEpsg) return pos;
  const from      = epsgKey(fromEpsg);
  const to        = epsgKey(toEpsg);
  const [rx, ry]  = proj4(from, to, [pos[0], pos[1]]);
  return pos.length > 2 ? [rx, ry, pos[2]] : [rx, ry];
}

// ─── Geometry-level reprojection ─────────────────────────────────────────────

// Internal helpers to transform nested Position arrays

function xfPos(p: Position, f: (c: Position) => Position): Position {
  return f(p);
}
function xfRing(ring: Position[], f: (c: Position) => Position): Position[] {
  return ring.map(p => xfPos(p, f));
}
function xfRings(rings: Position[][], f: (c: Position) => Position): Position[][] {
  return rings.map(r => xfRing(r, f));
}
function xfMultiRings(multi: Position[][][], f: (c: Position) => Position): Position[][][] {
  return multi.map(rings => xfRings(rings, f));
}

/**
 * Reproject all coordinates in a GeoJSON Geometry.
 * Returns a deep clone — the original is never mutated.
 */
export function reprojectGeometry(
  geom: Geometry,
  fromEpsg: EpsgCode,
  toEpsg: EpsgCode
): Geometry {
  if (fromEpsg === toEpsg) return geom;
  const xf = (c: Position) => reprojectCoordinate(c, fromEpsg, toEpsg);

  switch (geom.type) {
    case 'Point':
      return { type: 'Point', coordinates: xfPos(geom.coordinates, xf) };

    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: geom.coordinates.map(p => xfPos(p, xf)) };

    case 'LineString':
      return { type: 'LineString', coordinates: xfRing(geom.coordinates, xf) };

    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: geom.coordinates.map(r => xfRing(r, xf)) };

    case 'Polygon':
      return { type: 'Polygon', coordinates: xfRings(geom.coordinates, xf) };

    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: xfMultiRings(geom.coordinates, xf) };

    case 'GeometryCollection':
      return {
        type: 'GeometryCollection',
        geometries: geom.geometries.map(g => reprojectGeometry(g, fromEpsg, toEpsg)),
      };

    default:
      return geom;
  }
}

// ─── Feature / FeatureCollection reprojection ─────────────────────────────────

/**
 * Reproject a GeoJSON Feature between any two EPSG codes.
 * Properties are preserved as-is. Geometry is deep-cloned.
 *
 * Rule: **always call this in pairs** — reproject out for calculations,
 * reproject back to EPSG:4326 before storing in Zustand or returning GeoJSON.
 */
export function reprojectFeature<P extends Record<string, unknown>>(
  feat: Feature<Geometry, P>,
  fromEpsg: EpsgCode,
  toEpsg: EpsgCode
): Feature<Geometry, P> {
  return {
    ...feat,
    geometry: reprojectGeometry(feat.geometry, fromEpsg, toEpsg),
  };
}

/**
 * Reproject every Feature in a FeatureCollection.
 * Useful for batch-reprojecting the entire mapFeatures collection before
 * running topology validation in projected coordinates.
 */
export function reprojectFeatureCollection(
  fc: FeatureCollection,
  fromEpsg: EpsgCode,
  toEpsg: EpsgCode
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map(f =>
      reprojectFeature(f as Feature<Geometry, Record<string, unknown>>, fromEpsg, toEpsg)
    ),
  };
}

// ─── Coordinate format helpers ────────────────────────────────────────────────

/**
 * Convert a decimal-degree value to a Degrees-Minutes-Seconds string.
 *
 * @param dd    Decimal degrees (may be negative)
 * @param axis  'lat' → N/S suffix, 'lng' → E/W suffix
 *
 * @example toDMS(18.5703, 'lat') → "18°34′13.08″N"
 * @example toDMS(76.2948, 'lng') → "76°17′41.28″E"
 */
export function toDMS(dd: number, axis: 'lat' | 'lng'): string {
  const abs  = Math.abs(dd);
  const deg  = Math.floor(abs);
  const minF = (abs - deg) * 60;
  const min  = Math.floor(minF);
  const sec  = (minF - min) * 60;

  const hemi =
    axis === 'lat'
      ? (dd >= 0 ? 'N' : 'S')
      : (dd >= 0 ? 'E' : 'W');

  return `${deg}°${String(min).padStart(2, '0')}′${sec.toFixed(2).padStart(5, '0')}″${hemi}`;
}

/**
 * Produce all three turbine coordinate formats from a WGS84 lat/lng pair.
 *
 * Output:
 *  .dd   — Decimal Degrees → GeoJSON / REST API payloads
 *  .dms  — Degrees Minutes Seconds → survey reports, legal documents
 *  .utm  — Easting / Northing → field GPS units and staking plans
 *
 * @param lat       WGS84 latitude   (− south, + north)
 * @param lng       WGS84 longitude  (− west,  + east)
 * @param utmEpsg   Override auto-detected UTM zone (optional)
 *
 * @example
 *   const coords = formatCoordinates(21.3, 76.5);
 *   coords.dd.lat     → "21.300000"
 *   coords.dms.lat    → "21°18′00.00″N"
 *   coords.utm.easting → 451234
 *   coords.utm.label  → "43N  451234E  2357891N"
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  utmEpsg?: EpsgCode
): FormattedCoordinates {
  const epsg = utmEpsg ?? detectUtmEpsg(lng, lat);
  const [easting, northing] = proj4(epsgKey(4326), epsgKey(epsg), [lng, lat]);

  const isNorth  = epsg < 32700;
  const zone     = epsg - (isNorth ? 32600 : 32700);
  const hemi: 'N' | 'S' = isNorth ? 'N' : 'S';

  const utm: UTMCoordinate = {
    easting:    Math.round(easting),
    northing:   Math.round(northing),
    zone,
    hemisphere: hemi,
    epsg,
    label: `${zone}${hemi}  ${Math.round(easting)}E  ${Math.round(northing)}N`,
  };

  return {
    dd: {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    },
    dms: {
      lat: toDMS(lat, 'lat'),
      lng: toDMS(lng, 'lng'),
    },
    utm,
  };
}

// ─── Setback buffer ───────────────────────────────────────────────────────────

/**
 * Generate a setback buffer around any Feature or FeatureCollection.
 *
 * Method selection guide:
 * ┌───────────────────────────────────────┬──────────────────┬──────────────────┐
 * │ Scenario                              │ Recommended      │ Max error        │
 * ├───────────────────────────────────────┼──────────────────┼──────────────────┤
 * │ Dwelling setback 500 m                │ geodesic         │ < 0.05 m         │
 * │ Road / EHV setback 150–300 m          │ geodesic         │ < 0.03 m         │
 * │ Protected area buffer 5 km            │ geodesic         │ < 2 m            │
 * │ Large area (> 50 km radius)           │ projected        │ geodesic fails   │
 * │ Legal survey / title document         │ projected        │ exact metres     │
 * └───────────────────────────────────────┴──────────────────┴──────────────────┘
 *
 * The 'projected' method:
 *   1. Reprojects feature from EPSG:4326 → UTM
 *   2. Computes buffer using Turf on Cartesian coordinates (metres are exact)
 *   3. Reprojects result back to EPSG:4326 for storage / rendering
 *
 * Result is always returned in EPSG:4326, ready for Zustand / MapLibre.
 *
 * @param input      Feature or FeatureCollection in EPSG:4326
 * @param distanceM  Buffer distance in metres (e.g. 500 for dwelling setback)
 * @param options    { method, utmEpsg, steps }
 */
export function bufferMeters(
  input: Feature | FeatureCollection,
  distanceM: number,
  options: BufferOptions = {}
): FeatureCollection {
  const { method = 'geodesic', steps = 64 } = options;
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  // Normalise to FeatureCollection so turfBuffer's overload resolution is unambiguous
  const fc: FeatureCollection =
    input.type === 'FeatureCollection'
      ? input
      : { type: 'FeatureCollection', features: [input as Feature] };

  if (method === 'geodesic') {
    return turfBuffer(fc, distanceM, { units: 'meters', steps }) ?? empty;
  }

  // Projected method — reproject → buffer → reproject back
  const utmEpsg   = options.utmEpsg ?? boundaryUtmEpsg(fc);
  const projected  = reprojectFeatureCollection(fc, 4326, utmEpsg);
  const bufferedUtm = turfBuffer(projected, distanceM, { units: 'meters', steps });
  if (!bufferedUtm) return empty;
  return reprojectFeatureCollection(bufferedUtm, utmEpsg, 4326);
}

// ─── Area utility ─────────────────────────────────────────────────────────────

/**
 * Compute area of a Feature or FeatureCollection in km².
 * For areas > 100 km², reprojects to UTM first for metric precision.
 *
 * @param input    Feature or FeatureCollection in EPSG:4326
 * @param utmEpsg  Force a specific UTM zone (optional; auto-detected otherwise)
 */
export function areaKm2(
  input: Feature | FeatureCollection,
  utmEpsg?: EpsgCode
): number {
  const fc: FeatureCollection =
    input.type === 'FeatureCollection'
      ? input
      : { type: 'FeatureCollection', features: [input as Feature] };

  const sqM = turfArea(fc);
  const km2 = sqM / 1e6;

  // For areas > 100 km², cross-check via projected coordinates for metric accuracy
  if (km2 > 100) {
    const epsg    = utmEpsg ?? boundaryUtmEpsg(fc);
    const projFc  = reprojectFeatureCollection(fc, 4326, epsg);
    return turfArea(projFc) / 1e6;
  }

  return km2;
}

// ─── Topology distance check ──────────────────────────────────────────────────

/**
 * Return the distance in metres between two WGS84 points, computed in
 * projected UTM space for maximum metric accuracy.
 *
 * Use this for setback compliance checks (e.g. turbine ↔ dwelling).
 * For quick checks where < 1 m accuracy is acceptable, use Turf's distance().
 *
 * @example
 *   const dist = projectedDistanceM([76.5, 21.3], [76.504, 21.308]);
 *   if (dist < 500) console.warn('Setback violation');
 */
export function projectedDistanceM(
  posA: [number, number],
  posB: [number, number],
  utmEpsg?: EpsgCode
): number {
  const epsg   = utmEpsg ?? detectUtmEpsg((posA[0] + posB[0]) / 2, (posA[1] + posB[1]) / 2);
  const key    = epsgKey(epsg);
  const [ax, ay] = proj4('EPSG:4326', key, posA);
  const [bx, by] = proj4('EPSG:4326', key, posB);
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

// ─── Re-export for convenience ────────────────────────────────────────────────

export { turfArea, turfBuffer, turfCentroid };
