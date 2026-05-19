/**
 * src/types/gis.ts — Runtime storage & metadata types for the GIS layer system.
 *
 * Complements gisLayers.ts (schema/spec types) with deployment-context types:
 *   Context A — Local GeoJSON files under /public/layers/
 *   Context B — PostGIS via Express REST API
 *   Context C — Cloud-Optimised GeoTIFF (COG) on AWS S3 / Azure Blob
 *
 * Usage pattern:
 *   GISLayerSpec   (gisLayers.ts) = authoritative data dictionary (what a layer IS)
 *   GISLayerMetadata (this file)  = runtime descriptor  (where data lives + how to render it)
 */

import type { GISLayerCategory, GISGeometryType } from './gisLayers';

// ─── Deployment contexts ───────────────────────────────────────────────────────

export type StorageContext =
  | 'local'     // Context A: /public/layers/*.geojson, served by Vite dev server
  | 'postgis'   // Context B: PostGIS via Express REST API
  | 'cloud-cog' // Context C: Cloud-Optimised GeoTIFF on S3 / Azure
  | 'runtime';  // generated at runtime (setback buffers, shadow flicker zones)

// ─── MapLibre source configurations ───────────────────────────────────────────

/**
 * Context A — static GeoJSON file in /public/layers/
 * map.addSource(id, { type: 'geojson', data: path })
 */
export interface LocalGeoJSONSource {
  kind: 'local-geojson';
  /** Absolute path from public root, e.g. '/layers/administrative/india-protected-areas-sample.geojson' */
  path: string;
  /** Optional: cluster points for large point datasets */
  cluster?: boolean;
  clusterRadius?: number;
  clusterMaxZoom?: number;
}

/**
 * Context B — PostGIS via REST API (returns GeoJSON FeatureCollection)
 * map.addSource(id, { type: 'geojson', data: endpoint })
 */
export interface PostGISRESTSource {
  kind: 'postgis-rest';
  /** e.g. 'https://api.windfarm.io/api/layers/administrative/districtBoundaries' */
  endpoint: string;
  /** Query params appended to the endpoint (bbox, project_id, zoom, etc.) */
  params?: Record<string, string>;
  /** For live refresh (ST_DWithin queries as user pans the map) */
  dynamic?: boolean;
}

/**
 * Context B (vector tiles) — PostGIS via pg_tileserv / Martin tile server
 * map.addSource(id, { type: 'vector', tiles: [url] })
 */
export interface PostGISVectorTileSource {
  kind: 'postgis-mvt';
  /** Tile URL template, e.g. 'https://tiles.windfarm.io/public.layers_wind_resource/{z}/{x}/{y}.pbf' */
  tilesUrl: string;
  /** Source layer name inside the MVT (usually the PostGIS table name) */
  sourceLayer: string;
  minzoom?: number;
  maxzoom?: number;
}

/**
 * Context C (vector COG) — Cloud-Optimised GeoTIFF served as raster tiles
 * map.addSource(id, { type: 'raster', tiles: [url] })
 */
export interface COGRasterSource {
  kind: 'cog-raster';
  /** CloudFront / tile server URL with {z}/{x}/{y} pattern */
  tilesUrl: string;
  tileSize?: 256 | 512;
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  /** Colormap applied by the tile server (e.g. 'viridis', 'RdYlGn') */
  colormap?: string;
  /** Normalise [min, max] range for the colormap */
  rescale?: [number, number];
}

/**
 * Context C (terrain COG) — Elevation DEM for MapLibre 3D terrain
 * map.addSource(id, { type: 'raster-dem', ... })
 */
export interface COGTerrainSource {
  kind: 'cog-terrain';
  /** COG DEM URL — must be pre-processed into Mapbox or Terrarium encoding */
  url: string;
  tileSize?: 256 | 512;
  encoding: 'mapbox' | 'terrarium' | 'custom';
  /** Vertical exaggeration factor for map.setTerrain() */
  exaggeration?: number;
}

export type GISSourceConfig =
  | LocalGeoJSONSource
  | PostGISRESTSource
  | PostGISVectorTileSource
  | COGRasterSource
  | COGTerrainSource;

// ─── MapLibre layer definition (typed subset of maplibregl.LayerSpecification) ─

export type MapLibreLayerType =
  | 'fill'
  | 'line'
  | 'circle'
  | 'symbol'
  | 'raster'
  | 'hillshade'
  | 'heatmap';

export interface MapLibreLayerDef {
  /** MapLibre layer id, e.g. 'wind-resource-fill' */
  id: string;
  type: MapLibreLayerType;
  paint: Record<string, unknown>;
  layout?: Record<string, unknown>;
  /** GeoJSON / MVT filter expression */
  filter?: unknown[];
  minzoom?: number;
  maxzoom?: number;
  /** For MVT sources: which source-layer to read from */
  sourceLayer?: string;
}

// ─── Core metadata interface ───────────────────────────────────────────────────

export interface GISLayerMetadata {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Matches GISLayerKey from gisLayers.ts and LayerKey in the store */
  id: string;
  /** Human-readable display name */
  name: string;
  category: GISLayerCategory;
  geometryType: GISGeometryType;

  // ── Storage location ──────────────────────────────────────────────────────
  storageContext: StorageContext;
  sourceConfig: GISSourceConfig;
  /** Context A: absolute path from /public root, e.g. '/layers/administrative/...' */
  localPath?: string;

  // ── PostGIS-specific (Context B) ─────────────────────────────────────────
  /** Fully-qualified table name, e.g. 'layers.wind_resource' */
  postgisTable?: string;
  /** REST endpoint for CRUD operations */
  apiEndpoint?: string;
  /** MVT tile server endpoint pattern */
  mvtEndpoint?: string;

  // ── Cloud raster-specific (Context C) ─────────────────────────────────────
  /** S3 / Azure Blob URL for the COG file */
  cogUrl?: string;
  /** TiTiler / titiler endpoint for dynamic COG tile serving */
  tilerUrl?: string;
  /** Band index within a multi-band COG (1-indexed) */
  bandIndex?: number;

  // ── Geographic metadata ───────────────────────────────────────────────────
  /** Storage CRS — always EPSG:4326 per GeoJSON RFC 7946 */
  crs: 'EPSG:4326';
  /** [minLng, minLat, maxLng, maxLat] — used for fitBounds() */
  bounds?: [number, number, number, number];
  /** File size hint for progressive loading UX (bytes) */
  estimatedSizeBytes?: number;

  // ── Data provenance ───────────────────────────────────────────────────────
  lastUpdated?: string;   // ISO 8601 date string
  attribution?: string;
  dataSource?: string;    // e.g. 'NIWE Wind Atlas 2023'
  licenseUrl?: string;

  // ── MapLibre rendering ────────────────────────────────────────────────────
  /** MapLibre source id registered via map.addSource() */
  maplibreSourceId: string;
  /** Ordered list of layers to add via map.addLayer() */
  maplibreLayers: MapLibreLayerDef[];
  /** Default layer visibility on load */
  defaultVisible?: boolean;

  // ── Wind-farm analysis ────────────────────────────────────────────────────
  /** Fixed setback from this feature type (metres) */
  setbackM?: number;
  /** Whether ST_Within / ST_DWithin queries are supported for this layer */
  isQueryable: boolean;

  // ── Runtime state (not persisted) ─────────────────────────────────────────
  isLoaded?: boolean;
  isLoading?: boolean;
  loadError?: string | null;
}

// ─── Layer manifest (index.json schema) ───────────────────────────────────────

export interface LayerManifestEntry {
  id: string;
  name: string;
  category: GISLayerCategory;
  gisLayerKey: string;
  format: 'geojson' | 'gpkg' | 'cog' | 'mvt';
  path: string;             // relative to /public/layers/
  description: string;
  featureCount?: number;
  bounds?: [number, number, number, number];
  attribution: string;
  crs: 'EPSG:4326';
  lastUpdated: string;
  productionReplacement?: string; // hint for the data source to use in production
}

export interface LayerManifest {
  version: string;
  generated: string;       // ISO date
  defaultContext: StorageContext;
  layers: LayerManifestEntry[];
}

// ─── PostGIS API response shapes ─────────────────────────────────────────────

export interface PostGISLayerResponse {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
  metadata: {
    total: number;
    page: number;
    pageSize: number;
    bbox?: [number, number, number, number];
    queryTimeMs: number;
  };
}

export interface PostGISSetbackCheckRequest {
  point: [number, number];    // [lng, lat] in EPSG:4326
  distanceM: number;          // setback distance in metres
  layerIds?: string[];        // which layers to check; defaults to all
}

export interface PostGISSetbackCheckResult {
  layerId: string;
  layerName: string;
  withinSetback: boolean;
  nearestFeatureDistanceM: number | null;
  nearestFeatureId: string | null;
  requiredSetbackM: number;
}

// ─── Raster metadata (Context C) ─────────────────────────────────────────────

export interface COGMetadata {
  url: string;
  width: number;
  height: number;
  bandCount: number;
  crs: string;
  bounds: [number, number, number, number];
  resolution: [number, number];  // [x, y] in degrees
  noDataValue: number | null;
  statistics: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
}

export interface WindRasterConfig {
  /** COG URL or tile server URL */
  tilesUrl: string;
  /** Minimum displayable wind speed (m/s) */
  minWindSpeedMs: number;
  /** Maximum displayable wind speed (m/s) */
  maxWindSpeedMs: number;
  /** Hex colours for the gradient (low → high wind speed) */
  colorRamp: string[];
  /** Opacity for the raster overlay (0–1) */
  opacity: number;
  /** Attribution text */
  attribution?: string;
}

export interface TerrainConfig {
  /** COG URL for the elevation DEM (must be in Mapbox/Terrarium encoding) */
  cogUrl: string;
  encoding: 'mapbox' | 'terrarium';
  tileSize: 256 | 512;
  /** Vertical exaggeration for 3D terrain (1 = real scale, 1.5 = recommended) */
  exaggeration: number;
  /** Show hillshade layer beneath vector layers */
  showHillshade: boolean;
}
