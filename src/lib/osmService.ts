/**
 * osmService.ts — MNRE-Compliant Feature Detection
 *
 * Uses Overpass API with `out geom;` to get geometry directly in the response
 * (handles both ways AND relations — large water bodies in OSM are often relations).
 *
 * Setbacks (MNRE July 2024):
 *   Water bodies        → 500 m (fixed)
 *   Dwelling clusters   → 500 m (fixed, ≥15 buildings or mapped residential area)
 *   Roads / Railway / EHV → HH + 0.5×RD + 5 m (formula)
 */

import type { FeatureCollection, Feature } from 'geojson';
import { bbox } from '@turf/turf';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type FeatureType =
  | 'water'
  | 'dwelling'
  | 'road'
  | 'railway'
  | 'ehv_line'
  | 'building';

export interface MNREFeatureProperties {
  id: number | string;
  type: FeatureType;
  label: string;
  fixedSetbackM: number | null;
  osm_tags?: Record<string, string>;
}

export interface OSMFeatureResult {
  waterbodies: FeatureCollection;
  dwellings: FeatureCollection;
  roads: FeatureCollection;
  railways: FeatureCollection;
  ehvLines: FeatureCollection;
  buildings: FeatureCollection;
  all: FeatureCollection;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FIXED_SETBACKS: Record<string, number> = {
  water: 500,
  dwelling: 500,
};

export function formulaSetbackM(hubHeight: number, rotorDiameter: number): number {
  return hubHeight + 0.5 * rotorDiameter + 5;
}

export const FORMULA_SETBACK_TYPES: FeatureType[] = ['road', 'railway', 'ehv_line', 'building'];

// Try multiple endpoints in case one is rate-limited or slow
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// ─── Query Builder ────────────────────────────────────────────────────────────

function buildOverpassQuery(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  // Expand bbox by ~2 km to catch features near the boundary
  const pad = 0.02;
  const b = `${minLat - pad},${minLng - pad},${maxLat + pad},${maxLng + pad}`;

  return `[out:json][timeout:28];
(
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  way["waterway"="river"](${b});
  way["waterway"="stream"](${b});
  way["waterway"="canal"](${b});
  way["landuse"="reservoir"](${b});
  way["landuse"="basin"](${b});
  way["landuse"="pond"](${b});
  way["natural"="wetland"](${b});
  way["landuse"="residential"](${b});
  relation["landuse"="residential"](${b});
  node["place"~"^(village|hamlet|town|city|suburb|neighbourhood)$"](${b});
  way["place"~"^(village|town|city|suburb)$"](${b});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${b});
  way["ref"~"^(NH|SH)"](${b});
  way["railway"~"^(rail|light_rail|narrow_gauge)$"](${b});
  way["power"="line"]["voltage"~"^(66000|110000|132000|220000|400000|765000)"](${b});
);
out geom;`.trim();
}

// ─── Fetch with Fallback ──────────────────────────────────────────────────────

async function fetchOverpass(query: string): Promise<any> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.elements) return data;
    } catch {
      // try next endpoint
    }
  }
  throw new Error('All Overpass API endpoints failed. Check your internet connection.');
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function identifyFeaturesFromOSM(boundary: FeatureCollection): Promise<OSMFeatureResult> {
  const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

  if (!boundary?.features?.length) {
    return { waterbodies: empty(), dwellings: empty(), roads: empty(), railways: empty(), ehvLines: empty(), buildings: empty(), all: empty() };
  }

  const [minLng, minLat, maxLng, maxLat] = bbox(boundary);
  const query = buildOverpassQuery(minLat, minLng, maxLat, maxLng);
  const data = await fetchOverpass(query);
  return processOverpassData(data);
}

// ─── Data Processor ───────────────────────────────────────────────────────────

function processOverpassData(data: any): OSMFeatureResult {
  const waterFeatures: Feature[] = [];
  const dwellingFeatures: Feature[] = [];
  const roadFeatures: Feature[] = [];
  const railwayFeatures: Feature[] = [];
  const ehvFeatures: Feature[] = [];

  for (const el of data.elements as any[]) {
    const tags: Record<string, string> = el.tags ?? {};

    // ── Node (place=village etc.) ──────────────────────────────────────────
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      if (tags.place && /^(village|hamlet|town|city|suburb|neighbourhood)$/.test(tags.place)) {
        dwellingFeatures.push({
          type: 'Feature',
          properties: makeProps(`n${el.id}`, 'dwelling', `${ucfirst(tags.place)}: ${tags.name ?? 'Settlement'}`, 500, tags),
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
        });
      }
      continue;
    }

    // ── Way ────────────────────────────────────────────────────────────────
    if (el.type === 'way') {
      if (!el.geometry?.length || el.geometry.length < 2) continue;
      const coords: [number, number][] = el.geometry.map((pt: any) => [pt.lon, pt.lat]);

      const isClosed =
        coords.length > 3 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];

      // Water
      if (isWaterTag(tags)) {
        if (isClosed) {
          waterFeatures.push(makePolygon(el.id, 'water', waterLabel(tags), 500, tags, coords));
        } else {
          waterFeatures.push(makeLine(el.id, 'water', waterLabel(tags), 500, tags, coords));
        }
        continue;
      }

      // Residential / settlement area
      if (tags.landuse === 'residential' || tags.place) {
        const ring = isClosed ? coords : [...coords, coords[0]];
        dwellingFeatures.push(makePolygon(el.id, 'dwelling', `Residential Area${tags.name ? ': ' + tags.name : ''}`, 500, tags, ring));
        continue;
      }

      // Roads
      const roadTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
      if (roadTypes.includes(tags.highway ?? '') || /^(NH|SH)/i.test(tags.ref ?? '')) {
        roadFeatures.push(makeLine(el.id, 'road', `Road (${tags.highway ?? tags.ref ?? 'Notified'})`, null, tags, coords));
        continue;
      }

      // Railways
      if (['rail', 'light_rail', 'narrow_gauge'].includes(tags.railway ?? '')) {
        railwayFeatures.push(makeLine(el.id, 'railway', `Railway (${tags.railway})`, null, tags, coords));
        continue;
      }

      // EHV Lines
      if (tags.power === 'line') {
        const voltV = parseInt(tags.voltage ?? '0', 10);
        if (voltV >= 66000) {
          ehvFeatures.push(makeLine(el.id, 'ehv_line', `EHV Line (${voltV / 1000} kV)`, null, tags, coords));
        }
      }
    }

    // ── Relation ────────────────────────────────────────────────────────────
    if (el.type === 'relation') {
      // Build outer polygon from outer members
      const outerRings: [number, number][][] = (el.members ?? [])
        .filter((m: any) => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry?.length >= 2)
        .map((m: any) => m.geometry.map((pt: any) => [pt.lon, pt.lat] as [number, number]));

      if (!outerRings.length) continue;

      // Use the longest outer ring as the representative geometry
      outerRings.sort((a, b) => b.length - a.length);
      const ring = outerRings[0];
      // Close the ring if needed
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      if (ring.length < 4) continue;

      if (isWaterTag(tags)) {
        waterFeatures.push(makePolygon(`r${el.id}`, 'water', waterLabel(tags), 500, tags, ring));
        continue;
      }

      if (tags.landuse === 'residential') {
        dwellingFeatures.push(makePolygon(`r${el.id}`, 'dwelling', `Residential Area${tags.name ? ': ' + tags.name : ''}`, 500, tags, ring));
      }
    }
  }

  const all: Feature[] = [...waterFeatures, ...dwellingFeatures, ...roadFeatures, ...railwayFeatures, ...ehvFeatures];

  return {
    waterbodies: fc(waterFeatures),
    dwellings: fc(dwellingFeatures),
    roads: fc(roadFeatures),
    railways: fc(railwayFeatures),
    ehvLines: fc(ehvFeatures),
    buildings: fc([]),
    all: fc(all),
  };
}

// ─── Tag Helpers ──────────────────────────────────────────────────────────────

function isWaterTag(tags: Record<string, string>): boolean {
  return (
    tags.natural === 'water' ||
    tags.natural === 'wetland' ||
    tags.waterway === 'riverbank' ||
    tags.waterway === 'river' ||
    tags.waterway === 'stream' ||
    tags.waterway === 'canal' ||
    tags.landuse === 'reservoir' ||
    tags.landuse === 'basin' ||
    tags.landuse === 'pond'
  );
}

function waterLabel(tags: Record<string, string>): string {
  if (tags.name) return tags.name;
  if (tags.waterway) return `${ucfirst(tags.waterway)}`;
  if (tags.landuse) return `${ucfirst(tags.landuse)}`;
  return 'Waterbody';
}

function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function makeProps(
  id: number | string,
  type: FeatureType,
  label: string,
  fixedSetbackM: number | null,
  osm_tags: Record<string, string>
): MNREFeatureProperties {
  return { id, type, label, fixedSetbackM, osm_tags };
}

function makePolygon(
  id: number | string,
  type: FeatureType,
  label: string,
  fixedSetbackM: number | null,
  tags: Record<string, string>,
  ring: [number, number][]
): Feature {
  return {
    type: 'Feature',
    properties: makeProps(id, type, label, fixedSetbackM, tags),
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

function makeLine(
  id: number | string,
  type: FeatureType,
  label: string,
  fixedSetbackM: number | null,
  tags: Record<string, string>,
  coords: [number, number][]
): Feature {
  return {
    type: 'Feature',
    properties: makeProps(id, type, label, fixedSetbackM, tags),
    geometry: { type: 'LineString', coordinates: coords },
  };
}
