/**
 * osmService.ts — MNRE-Compliant Feature Detection
 *
 * Fetches and classifies all infrastructure features required by the
 * MNRE July 2024 Micrositing Amendment (No. 238/75/2017-Wind):
 *
 *  Feature Type     │ OSM Tags                                  │ Setback
 * ──────────────────┼───────────────────────────────────────────┼──────────────────
 *  Waterbody        │ natural=water, waterway=*, landuse=reservoir│ 500 m
 *  Dwelling cluster │ building=*, landuse=residential (≥15 bldg) │ 500 m
 *  Road (notified)  │ highway=trunk|primary|secondary|motorway  │ HH + 0.5*RD + 5m
 *  Railway          │ railway=rail|subway|tram                  │ HH + 0.5*RD + 5m
 *  EHV line         │ power=line + voltage≥66000                │ HH + 0.5*RD + 5m
 *  Building/inst.   │ building=* (individual)                   │ HH + 0.5*RD + 5m
 */

import type { FeatureCollection, Feature } from 'geojson';
import { bbox } from '@turf/turf';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type FeatureType =
  | 'water'      // 500 m setback
  | 'dwelling'   // 500 m setback (cluster of ≥15 buildings)
  | 'road'       // HH + 0.5×RD + 5 m setback
  | 'railway'    // HH + 0.5×RD + 5 m setback
  | 'ehv_line'   // HH + 0.5×RD + 5 m setback
  | 'building';  // HH + 0.5×RD + 5 m setback (individual, NOC required)

export interface MNREFeatureProperties {
  id: number;
  type: FeatureType;
  /** Human-readable label for legend/tooltip */
  label: string;
  /**
   * Fixed setback in meters, or null for formula-based setbacks.
   * Formula setbacks (road, railway, ehv_line, building) = HH + 0.5*RD + 5
   * and are computed by the optimizer at runtime using the selected turbine model.
   */
  fixedSetbackM: number | null;
  /** Original OSM tags for reference */
  osm_tags?: Record<string, string>;
}

export interface OSMFeatureResult {
  waterbodies: FeatureCollection;
  dwellings: FeatureCollection;
  roads: FeatureCollection;
  railways: FeatureCollection;
  ehvLines: FeatureCollection;
  buildings: FeatureCollection;
  /** Convenience: all features merged into one FeatureCollection for map rendering */
  all: FeatureCollection;
}

// ─── Setback Constants ────────────────────────────────────────────────────────

/** Setbacks with a fixed distance (metres) */
export const FIXED_SETBACKS: Record<string, number> = {
  water: 500,
  dwelling: 500,
};

/**
 * Formula setback: HH + 0.5 * RD + 5  (metres)
 * These feature types use this formula; pass hubHeight and rotorDiameter
 * from the selected turbine model to compute the actual distance.
 */
export function formulaSetbackM(hubHeight: number, rotorDiameter: number): number {
  return hubHeight + 0.5 * rotorDiameter + 5;
}

/** Feature types that use the formula setback (not a fixed distance) */
export const FORMULA_SETBACK_TYPES: FeatureType[] = ['road', 'railway', 'ehv_line', 'building'];

// ─── OSM Query ────────────────────────────────────────────────────────────────

function buildOverpassQuery(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): string {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `
[out:json][timeout:60];
(
  // ── Water bodies ──────────────────────────────────────────────────
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["waterway"="riverbank"](${bbox});
  way["waterway"="river"](${bbox});
  way["waterway"="stream"](${bbox});
  way["waterway"="canal"](${bbox});
  way["landuse"="reservoir"](${bbox});
  way["landuse"="basin"](${bbox});

  // ── Individual buildings & residential land ────────────────────────
  way["building"](${bbox});
  relation["building"](${bbox});
  way["landuse"="residential"](${bbox});

  // ── Notified / Government roads (MNRE: state & central notified) ───
  way["highway"="motorway"](${bbox});
  way["highway"="trunk"](${bbox});
  way["highway"="primary"](${bbox});
  way["highway"="secondary"](${bbox});
  way["highway"="tertiary"](${bbox});
  // National/State Highway refs
  way["ref"~"^(NH|SH)"](${bbox});

  // ── Railway tracks ────────────────────────────────────────────────
  way["railway"="rail"](${bbox});
  way["railway"="subway"](${bbox});
  way["railway"="tram"](${bbox});
  way["railway"="light_rail"](${bbox});
  way["railway"="narrow_gauge"](${bbox});

  // ── EHV Power lines (≥66 kV counts as Extra High Voltage in India) ─
  way["power"="line"]["voltage"~"^(66000|110000|132000|220000|400000|765000)"](${bbox});
  // Lines without explicit voltage but tagged as EHV/HT
  way["power"="line"]["cables"](${bbox});
);
out body;
>;
out skel qt;
`.trim();
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function identifyFeaturesFromOSM(
  boundary: FeatureCollection
): Promise<OSMFeatureResult> {
  const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

  if (!boundary?.features?.length) {
    return {
      waterbodies: empty(), dwellings: empty(), roads: empty(),
      railways: empty(), ehvLines: empty(), buildings: empty(), all: empty(),
    };
  }

  const [minLng, minLat, maxLng, maxLat] = bbox(boundary);
  const query = buildOverpassQuery(minLat, minLng, maxLat, maxLng);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);

    const data = await response.json();
    return processOverpassData(data);
  } catch (error) {
    console.error('[osmService] Error fetching OSM data:', error);
    return {
      waterbodies: empty(), dwellings: empty(), roads: empty(),
      railways: empty(), ehvLines: empty(), buildings: empty(), all: empty(),
    };
  }
}

// ─── Data Processor ───────────────────────────────────────────────────────────

/**
 * MNRE clustering rule: ≥15 inhabited buildings within proximity = dwelling cluster.
 * We group buildings that are within 200 m of each other.
 */
const DWELLING_CLUSTER_MIN_SIZE = 15;

function processOverpassData(data: any): OSMFeatureResult {
  const waterFeatures: Feature[] = [];
  const buildingFeatures: Feature[] = [];
  const residentialFeatures: Feature[] = [];
  const roadFeatures: Feature[] = [];
  const railwayFeatures: Feature[] = [];
  const ehvFeatures: Feature[] = [];

  // Build node lookup
  const nodes = new Map<number, [number, number]>();
  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
  }

  for (const el of data.elements) {
    if (el.type !== 'way') continue;

    const tags: Record<string, string> = el.tags ?? {};
    const coords: [number, number][] = (el.nodes as number[])
      .map((id) => nodes.get(id))
      .filter((c): c is [number, number] => c !== undefined);

    if (coords.length < 2) continue;

    const isClosedWay = coords.length > 3 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];

    const ringCoords = isClosedWay ? coords : [...coords, coords[0]];

    // ── Water ────────────────────────────────────────────────────────
    const isWater =
      tags.natural === 'water' ||
      tags.waterway === 'riverbank' ||
      tags.waterway === 'river' ||
      tags.waterway === 'stream' ||
      tags.waterway === 'canal' ||
      tags.landuse === 'reservoir' ||
      tags.landuse === 'basin';

    if (isWater) {
      if (isClosedWay && ringCoords.length >= 4) {
        waterFeatures.push(makePolygon(el.id, 'water', 'Waterbody', 500, tags, ringCoords));
      } else {
        // Linear waterway — buffer handled by optimizer using fixed 500m setback
        waterFeatures.push(makeLine(el.id, 'water', 'Waterway', 500, tags, coords));
      }
      continue;
    }

    // ── Residential land use ─────────────────────────────────────────
    if (tags.landuse === 'residential') {
      residentialFeatures.push(makePolygon(el.id, 'dwelling', 'Residential Area', 500, tags, ringCoords));
      continue;
    }

    // ── Individual buildings ─────────────────────────────────────────
    if (tags.building && isClosedWay && ringCoords.length >= 4) {
      buildingFeatures.push(makePolygon(el.id, 'building', `Building (${tags.building})`, null, tags, ringCoords));
      continue;
    }

    // ── Roads ────────────────────────────────────────────────────────
    const roadTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
    const isNotifiedRoad = roadTypes.includes(tags.highway ?? '') ||
      /^(NH|SH)/i.test(tags.ref ?? '');

    if (isNotifiedRoad) {
      roadFeatures.push(makeLine(el.id, 'road', `Road (${tags.highway ?? tags.ref})`, null, tags, coords));
      continue;
    }

    // ── Railways ─────────────────────────────────────────────────────
    const railTypes = ['rail', 'subway', 'tram', 'light_rail', 'narrow_gauge'];
    if (railTypes.includes(tags.railway ?? '')) {
      railwayFeatures.push(makeLine(el.id, 'railway', `Railway (${tags.railway})`, null, tags, coords));
      continue;
    }

    // ── EHV Power Lines ───────────────────────────────────────────────
    if (tags.power === 'line') {
      const voltageKV = parseInt(tags.voltage ?? '0', 10) / 1000;
      // India EHV threshold: ≥66 kV
      if (voltageKV >= 66 || tags.cables) {
        const label = voltageKV >= 66 ? `EHV Line (${voltageKV} kV)` : 'Power Line';
        ehvFeatures.push(makeLine(el.id, 'ehv_line', label, null, tags, coords));
      }
    }
  }

  // ── Apply MNRE cluster-of-dwellings rule ─────────────────────────────────
  // Group individual buildings into clusters; only clusters ≥15 buildings → 500 m setback
  const dwellingClusters = clusterBuildings(buildingFeatures, DWELLING_CLUSTER_MIN_SIZE);

  // Merge residential areas + dwelling clusters
  const allDwellings: Feature[] = [...residentialFeatures, ...dwellingClusters];

  const all: Feature[] = [
    ...waterFeatures,
    ...allDwellings,
    ...roadFeatures,
    ...railwayFeatures,
    ...ehvFeatures,
    // Individual buildings not in a cluster still need HH+0.5RD+5 setback
    ...buildingFeatures,
  ];

  return {
    waterbodies: fc(waterFeatures),
    dwellings: fc(allDwellings),
    roads: fc(roadFeatures),
    railways: fc(railwayFeatures),
    ehvLines: fc(ehvFeatures),
    buildings: fc(buildingFeatures),
    all: fc(all),
  };
}

// ─── MNRE Cluster-of-Dwellings Logic ─────────────────────────────────────────

/**
 * Groups individual building polygons into spatial clusters.
 * Any cluster with ≥ minSize buildings is tagged as type='dwelling'
 * with a 500 m setback. Smaller clusters are returned as type='building'.
 *
 * Clustering algorithm: simple union-find on centroid proximity (200 m threshold).
 */
function clusterBuildings(buildings: Feature[], minSize: number): Feature[] {
  if (!buildings.length) return [];

  // Compute centroids
  const centroids: [number, number][] = buildings.map((b) => {
    const geom = b.geometry as any;
    if (geom.type === 'Polygon') {
      const ring: [number, number][] = geom.coordinates[0];
      const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      return [lng, lat];
    }
    return [0, 0];
  });

  // Union-Find
  const parent = centroids.map((_, i) => i);
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(a: number, b: number) {
    parent[find(a)] = find(b);
  }

  const CLUSTER_THRESHOLD_DEG = 200 / 111320; // ~200 m in degrees (approximate)

  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const dx = centroids[i][0] - centroids[j][0];
      const dy = centroids[i][1] - centroids[j][1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CLUSTER_THRESHOLD_DEG) union(i, j);
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const clusterFeatures: Feature[] = [];

  for (const [, indices] of groups) {
    const isCluster = indices.length >= minSize;

    if (isCluster) {
      // Emit a representative centroid-based point cluster feature
      // The optimizer will buffer this by 500 m
      const lngs = indices.map((i) => centroids[i][0]);
      const lats = indices.map((i) => centroids[i][1]);
      const cLng = lngs.reduce((s, v) => s + v, 0) / lngs.length;
      const cLat = lats.reduce((s, v) => s + v, 0) / lats.length;

      // Emit each building in the cluster tagged as 'dwelling'
      for (const i of indices) {
        const b = buildings[i];
        clusterFeatures.push({
          ...b,
          properties: {
            ...(b.properties ?? {}),
            type: 'dwelling' as FeatureType,
            label: `Dwelling Cluster (${indices.length} buildings)`,
            fixedSetbackM: 500,
            clusterSize: indices.length,
            clusterCenterLng: cLng,
            clusterCenterLat: cLat,
          },
        });
      }
    } else {
      // Individual buildings → formula setback (HH + 0.5RD + 5)
      for (const i of indices) {
        clusterFeatures.push(buildings[i]);
      }
    }
  }

  return clusterFeatures;
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function makeProps(
  id: number,
  type: FeatureType,
  label: string,
  fixedSetbackM: number | null,
  osm_tags: Record<string, string>
): MNREFeatureProperties {
  return { id, type, label, fixedSetbackM, osm_tags };
}

function makePolygon(
  id: number,
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
  id: number,
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