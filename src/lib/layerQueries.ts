/**
 * src/lib/layerQueries.ts — Typed PostGIS spatial query functions
 *
 * All spatial operations are performed via prisma.$queryRaw with tagged
 * template literals (Prisma's SQL injection-safe parameterised queries).
 *
 * Geography vs Geometry note:
 *   All geom columns are GEOGRAPHY type → distances are in metres (accurate).
 *   Cast to ::geometry only for ST_Within / ST_Contains (topology predicates)
 *   which require GEOMETRY input. ST_DWithin works natively on GEOGRAPHY.
 *
 * ⚠️  Server-side only — import via API routes, never in React components.
 */

import { Sql } from '@prisma/client/runtime/library';
import { prisma } from './db';
import type { FeatureCollection } from 'geojson';

// ─── Result row types ─────────────────────────────────────────────────────────

export interface WindResourceRow {
  id: string;
  meanWindSpeedMs: number;
  windPowerDensityWm2: number;
  hubHeightM: number;
  measurementYear: number;
  dataSource: string;
  weibullK: number;
  weibullC: number;
  confidenceLevel: 'P50' | 'P75' | 'P90';
  metadata: Record<string, unknown>;
  geomGeoJSON: object;           // ST_AsGeoJSON result parsed to object
}

export interface ExclusionZoneRow {
  id: string;
  projectId: string;
  zoneName: string;
  zoneType: string;
  setbackM: number;
  legalBasis: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  geomGeoJSON: object;
}

export interface AdminBoundaryRow {
  id: string;
  name: string;
  adminLevel: number;
  code: string | null;
  parentId: string | null;
  areaKm2: number | null;
  country: string;
  state: string | null;
  metadata: Record<string, unknown>;
  geomGeoJSON: object;
}

export interface SetbackViolation {
  layerTable: string;
  featureId: string;
  featureName: string;
  distanceM: number;
  requiredSetbackM: number;
  isViolation: boolean;
}

// ─── Converters ───────────────────────────────────────────────────────────────

function rowsToFeatureCollection(
  rows: { geomGeoJSON: object; [key: string]: unknown }[]
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(({ geomGeoJSON, ...props }) => ({
      type: 'Feature',
      geometry: geomGeoJSON as GeoJSON.Geometry,
      properties: props,
    })),
  };
}

// ─── 1. Wind Resource Queries ─────────────────────────────────────────────────

/**
 * Fetch all wind resource grid cells whose geometry intersects a project boundary.
 * Optionally filter by minimum wind speed.
 *
 * PostGIS predicate: ST_Intersects(wr.geom::geometry, ST_GeomFromGeoJSON($boundary))
 *
 * @param boundaryGeoJSON  GeoJSON string of the project boundary polygon
 * @param minWindSpeedMs   Minimum wind speed filter (default 0 = all cells)
 */
export async function findWindResourceWithinBoundary(
  boundaryGeoJSON: string,
  minWindSpeedMs = 0
): Promise<FeatureCollection> {
  const rows = await prisma.$queryRaw<WindResourceRow[]>`
    SELECT
      id,
      mean_wind_speed_ms      AS "meanWindSpeedMs",
      wind_power_density_wm2  AS "windPowerDensityWm2",
      hub_height_m            AS "hubHeightM",
      measurement_year        AS "measurementYear",
      data_source             AS "dataSource",
      weibull_k               AS "weibullK",
      weibull_c               AS "weibullC",
      confidence_level        AS "confidenceLevel",
      metadata,
      ST_AsGeoJSON(geom)::json AS "geomGeoJSON"
    FROM layers.wind_resource
    WHERE
      mean_wind_speed_ms >= ${minWindSpeedMs}
      AND ST_Intersects(
        geom::geometry,
        ST_GeomFromGeoJSON(${boundaryGeoJSON}::text)
      )
    ORDER BY mean_wind_speed_ms DESC
  `;
  return rowsToFeatureCollection(rows as any);
}

// ─── 2. Exclusion Zone Queries ────────────────────────────────────────────────

/**
 * Fetch all active exclusion zones for a project, optionally clipped to a bbox.
 *
 * @param projectId  UUID of the project
 * @param bbox       Optional [minLng, minLat, maxLng, maxLat] filter
 */
export async function findExclusionZones(
  projectId: string,
  bbox?: [number, number, number, number]
): Promise<FeatureCollection> {
  const bboxFilter: Sql = bbox
    ? prisma.$queryRaw`AND ST_Intersects(
        geom::geometry,
        ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)
      )`
    : prisma.$queryRaw``;

  const rows = await prisma.$queryRaw<ExclusionZoneRow[]>`
    SELECT
      id,
      project_id    AS "projectId",
      zone_name     AS "zoneName",
      zone_type     AS "zoneType",
      setback_m     AS "setbackM",
      legal_basis   AS "legalBasis",
      is_active     AS "isActive",
      metadata,
      ST_AsGeoJSON(geom)::json AS "geomGeoJSON"
    FROM layers.exclusion_zones
    WHERE project_id = ${projectId}::uuid
      AND is_active = TRUE
      ${bboxFilter}
    ORDER BY zone_type, zone_name
  `;
  return rowsToFeatureCollection(rows as any);
}

/**
 * Check if a proposed turbine point violates any exclusion zone setback.
 *
 * Uses ST_DWithin on GEOGRAPHY columns (distance in metres, accurate).
 *
 * @param projectId  UUID of the project
 * @param lng        Turbine longitude (WGS84)
 * @param lat        Turbine latitude  (WGS84)
 * @returns          Array of violated setback rules (empty = compliant)
 */
export async function checkTurbineSetbackCompliance(
  projectId: string,
  lng: number,
  lat: number
): Promise<SetbackViolation[]> {
  const rows = await prisma.$queryRaw<{
    id: string;
    zone_name: string;
    setback_m: number;
    distance_m: number;
  }[]>`
    SELECT
      id,
      zone_name,
      setback_m,
      ST_Distance(geom, ST_MakePoint(${lng}, ${lat})::geography) AS distance_m
    FROM layers.exclusion_zones
    WHERE project_id = ${projectId}::uuid
      AND is_active = TRUE
      AND ST_DWithin(geom, ST_MakePoint(${lng}, ${lat})::geography, setback_m)
    ORDER BY distance_m
  `;

  return rows.map(r => ({
    layerTable:      'layers.exclusion_zones',
    featureId:       r.id,
    featureName:     r.zone_name,
    distanceM:       Number(r.distance_m),
    requiredSetbackM: Number(r.setback_m),
    isViolation:     Number(r.distance_m) < Number(r.setback_m),
  }));
}

// ─── 3. Administrative Boundary Queries ───────────────────────────────────────

/**
 * Find the administrative boundary containing a point at a given admin level.
 * Common use: determine which district (level=3) a turbine falls in.
 *
 * @param lng        Longitude (WGS84)
 * @param lat        Latitude  (WGS84)
 * @param adminLevel 1=country, 2=state, 3=district, 4=tehsil (default 3)
 */
export async function findAdminBoundaryAt(
  lng: number,
  lat: number,
  adminLevel = 3
): Promise<AdminBoundaryRow | null> {
  const rows = await prisma.$queryRaw<AdminBoundaryRow[]>`
    SELECT
      id,
      name,
      admin_level   AS "adminLevel",
      code,
      parent_id     AS "parentId",
      area_km2      AS "areaKm2",
      country,
      state,
      metadata,
      ST_AsGeoJSON(geom)::json AS "geomGeoJSON"
    FROM layers.admin_boundary
    WHERE admin_level = ${adminLevel}
      AND ST_Contains(
        geom::geometry,
        ST_Point(${lng}, ${lat})::geometry
      )
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Fetch all admin boundaries at a given level that intersect a project boundary.
 * Used to list which districts/states a wind farm spans.
 *
 * @param boundaryGeoJSON  GeoJSON string of the project boundary
 * @param adminLevel       Admin level to fetch (default 3 = district)
 */
export async function findAdminBoundariesWithinProject(
  boundaryGeoJSON: string,
  adminLevel = 3
): Promise<FeatureCollection> {
  const rows = await prisma.$queryRaw<AdminBoundaryRow[]>`
    SELECT
      id,
      name,
      admin_level   AS "adminLevel",
      code,
      parent_id     AS "parentId",
      area_km2      AS "areaKm2",
      country,
      state,
      metadata,
      ST_AsGeoJSON(geom)::json AS "geomGeoJSON"
    FROM layers.admin_boundary
    WHERE admin_level = ${adminLevel}
      AND ST_Intersects(
        geom::geometry,
        ST_GeomFromGeoJSON(${boundaryGeoJSON}::text)
      )
    ORDER BY name
  `;
  return rowsToFeatureCollection(rows as any);
}

// ─── 4. GeoJSON endpoint helper ───────────────────────────────────────────────

/**
 * Generic function for the REST API route /api/layers/:schema/:table.
 * Fetches rows from any layers.* table and returns as GeoJSON FeatureCollection.
 * Restricted to the 'layers' schema to prevent injection.
 *
 * @param table    PostGIS table name (validated against allowlist)
 * @param bbox     Optional bounding box filter
 * @param limit    Max features to return (default 1000)
 */
const ALLOWED_TABLES = new Set([
  'wind_resource',
  'exclusion_zones',
  'admin_boundary',
] as const);

type AllowedTable = 'wind_resource' | 'exclusion_zones' | 'admin_boundary';

export async function fetchLayerAsGeoJSON(
  table: string,
  bbox?: [number, number, number, number],
  limit = 1000
): Promise<FeatureCollection | { error: string }> {
  if (!ALLOWED_TABLES.has(table as AllowedTable)) {
    return { error: `Table '${table}' is not in the allowed layer list.` };
  }

  const bboxSql = bbox
    ? `AND ST_Intersects(geom::geometry, ST_MakeEnvelope(${bbox.join(',')}, 4326))`
    : '';

  // Must use $queryRawUnsafe here because table name is dynamic (but validated above).
  const rows = await prisma.$queryRawUnsafe<{ geomGeoJSON: object; [k: string]: unknown }[]>(`
    SELECT *, ST_AsGeoJSON(geom)::json AS "geomGeoJSON"
    FROM layers.${table}
    WHERE TRUE ${bboxSql}
    LIMIT ${limit}
  `);

  return rowsToFeatureCollection(rows);
}
