/**
 * src/config/mapLayerSources.ts — MapLibre source configurations for all 3 storage contexts.
 *
 * Usage:
 *   import { getSourceConfig, LAYER_STYLES } from '@/config/mapLayerSources';
 *   const config = getSourceConfig('windResourceGrid', 'local');
 *   map.addSource(config.maplibreSourceId, config.maplibreSourceOptions);
 *   LAYER_STYLES[config.maplibreSourceId].forEach(layer => map.addLayer(layer));
 *
 * Context A — Local GeoJSON (/public/layers/) — Vite dev server or static hosting
 * Context B — PostGIS REST API (Express + Prisma)
 * Context C — Cloud COG (AWS S3 + CloudFront via TiTiler, or Azure CDN)
 */

import type { GISLayerMetadata, StorageContext } from '@/types/gis';
import type { GISLayerKey } from '@/types/gisLayers';
import { buildTiTilerUrl } from '@/lib/rasterService';
import { GIS_LAYER_REGISTRY } from '@/config/gisLayerRegistry';

// ─── Environment variables ────────────────────────────────────────────────────
// In production, set these via .env / cloud secrets:
//   VITE_API_BASE_URL    = https://api.windfarm.io
//   VITE_TILER_BASE_URL  = https://tiles.windfarm.io
//   VITE_CDN_BASE_URL    = https://d1abc.cloudfront.net

const API_BASE  = import.meta.env.VITE_API_BASE_URL  ?? 'http://localhost:3001';
const TILER_BASE = import.meta.env.VITE_TILER_BASE_URL ?? 'https://tiles.windfarm.io';
const CDN_BASE  = import.meta.env.VITE_CDN_BASE_URL  ?? 'https://d1example.cloudfront.net';

// ─── Context A — Local GeoJSON paths ─────────────────────────────────────────

const LOCAL_PATHS: Partial<Record<GISLayerKey, string>> = {
  districtBoundaries: '/layers/administrative/india-districts-sample.geojson',
  protectedAreas:     '/layers/administrative/india-protected-areas-sample.geojson',
  revenueVillages:    '/layers/administrative/revenue-villages-sample.geojson',
  windResourceGrid:   '/layers/environment/wind-resource-india-sample.geojson',
  forestCover:        '/layers/environment/forest-cover-sample.geojson',
  floodZones:         '/layers/environment/flood-zones-sample.geojson',
  noiseReceptors:     '/layers/socioeconomics/noise-receptors-template.geojson',
  landParcels:        '/layers/socioeconomics/land-parcels-template.geojson',
  populationGrid:     '/layers/socioeconomics/population-grid-sample.geojson',
  powerTransmission:  '/layers/infrastructure/india-grid-sample.geojson',
  gridSubstations:    '/layers/infrastructure/substations-sample.geojson',
  undergroundPipelines: '/layers/infrastructure/pipelines-template.geojson',
};

// ─── Context B — PostGIS REST API endpoints ───────────────────────────────────

const API_ENDPOINTS: Partial<Record<GISLayerKey, string>> = {
  windResourceGrid:   `${API_BASE}/api/layers/environment/windResourceGrid`,
  districtBoundaries: `${API_BASE}/api/layers/administrative/districtBoundaries`,
  protectedAreas:     `${API_BASE}/api/layers/administrative/protectedAreas`,
  revenueVillages:    `${API_BASE}/api/layers/administrative/revenueVillages`,
  forestCover:        `${API_BASE}/api/layers/environment/forestCover`,
  floodZones:         `${API_BASE}/api/layers/environment/floodZones`,
  wildlifeCorridors:  `${API_BASE}/api/layers/environment/wildlifeCorridors`,
  noiseReceptors:     `${API_BASE}/api/layers/socioeconomics/noiseReceptors`,
  shadowFlickerZones: `${API_BASE}/api/layers/socioeconomics/shadowFlickerZones`,
  landParcels:        `${API_BASE}/api/layers/socioeconomics/landParcels`,
  populationGrid:     `${API_BASE}/api/layers/socioeconomics/populationGrid`,
  powerTransmission:  `${API_BASE}/api/layers/infrastructure/powerTransmission`,
  gridSubstations:    `${API_BASE}/api/layers/infrastructure/gridSubstations`,
  undergroundPipelines: `${API_BASE}/api/layers/infrastructure/undergroundPipelines`,
};

// ─── Context C — COG tile URLs ────────────────────────────────────────────────

const COG_TILE_URLS: Partial<Record<GISLayerKey | 'dtm' | 'slopeGrid', string>> = {
  dtm:        buildTiTilerUrl(TILER_BASE, `s3://wf-rasters/srtm-india-30m.tif`,      { colormapName: 'terrain',  rescale: [0, 3000] }),
  slopeGrid:  buildTiTilerUrl(TILER_BASE, `s3://wf-rasters/slope-india-30m.tif`,     { colormapName: 'RdYlGn_r', rescale: [0, 45]   }),
  windResourceGrid: buildTiTilerUrl(TILER_BASE, `s3://wf-rasters/niwe-wind-100m.tif`, { colormapName: 'RdYlGn',   rescale: [4, 12]   }),
};

const COG_DEM_URL = `${CDN_BASE}/cog/srtm-india-30m-terrarium.tif`;

// ─── MapLibre paint styles per layer ─────────────────────────────────────────

type LayerStyle = {
  fillPaint?: Record<string, unknown>;
  linePaint?: Record<string, unknown>;
  circlePaint?: Record<string, unknown>;
  rasterPaint?: Record<string, unknown>;
};

const LAYER_STYLES: Partial<Record<GISLayerKey, LayerStyle>> = {
  windResourceGrid:   { fillPaint:   { 'fill-color': ['interpolate', ['linear'], ['get', 'mean_wind_speed_ms'], 4, '#d73027', 7, '#fee08b', 10, '#1a9850'], 'fill-opacity': 0.55, 'fill-outline-color': 'transparent' } },
  districtBoundaries: { linePaint:   { 'line-color': '#1d4ed8', 'line-width': 1.5, 'line-dasharray': [3, 2] } },
  revenueVillages:    { linePaint:   { 'line-color': '#be185d', 'line-width': 1, 'line-dasharray': [2, 2] } },
  protectedAreas:     { fillPaint:   { 'fill-color': '#991b1b', 'fill-opacity': 0.15 }, linePaint: { 'line-color': '#991b1b', 'line-width': 2 } },
  restrictedAirspace: { fillPaint:   { 'fill-color': '#7e22ce', 'fill-opacity': 0.12 }, linePaint: { 'line-color': '#7e22ce', 'line-width': 1.5, 'line-dasharray': [4, 2] } },
  forestCover:        { fillPaint:   { 'fill-color': '#14532d', 'fill-opacity': 0.35 }, linePaint: { 'line-color': '#14532d', 'line-width': 1 } },
  floodZones:         { fillPaint:   { 'fill-color': '#1e40af', 'fill-opacity': 0.25 }, linePaint: { 'line-color': '#1e40af', 'line-width': 1 } },
  wildlifeCorridors:  { fillPaint:   { 'fill-color': '#166534', 'fill-opacity': 0.20 }, linePaint: { 'line-color': '#166534', 'line-width': 1.5, 'line-dasharray': [5, 3] } },
  populationGrid:     { fillPaint:   { 'fill-color': ['interpolate', ['linear'], ['get', 'pop_density_km2'], 0, '#fef9c3', 200, '#f97316', 800, '#7f1d1d'], 'fill-opacity': 0.45 } },
  noiseReceptors:     { circlePaint: { 'circle-radius': 6, 'circle-color': '#b91c1c', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } },
  shadowFlickerZones: { fillPaint:   { 'fill-color': '#6d28d9', 'fill-opacity': 0.20 }, linePaint: { 'line-color': '#6d28d9', 'line-width': 1 } },
  landParcels:        { fillPaint:   { 'fill-color': '#78350f', 'fill-opacity': 0.15 }, linePaint: { 'line-color': '#78350f', 'line-width': 1 } },
  powerTransmission:  { linePaint:   { 'line-color': '#06b6d4', 'line-width': 2 } },
  gridSubstations:    { circlePaint: { 'circle-radius': 7, 'circle-color': '#059669', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } },
  undergroundPipelines: { linePaint: { 'line-color': '#b45309', 'line-width': 1.5, 'line-dasharray': [6, 2] } },
  dtm:                { rasterPaint: { 'raster-opacity': 0.70, 'raster-resampling': 'linear' } },
  slopeGrid:          { rasterPaint: { 'raster-opacity': 0.60, 'raster-resampling': 'linear' } },
  imageryMosaic:      { rasterPaint: { 'raster-opacity': 1.00 } },
};

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Return a GISLayerMetadata descriptor for a given layer and storage context.
 * This is the single source of truth for:
 *   - Which MapLibre source type to use
 *   - Which URL / path to fetch data from
 *   - Which layers to add for rendering
 *
 * @param layerKey  GISLayerKey from gisLayers.ts
 * @param context   'local' | 'postgis' | 'cloud-cog'
 */
export function getLayerMetadata(
  layerKey: GISLayerKey,
  context: StorageContext = 'local'
): GISLayerMetadata | null {
  const spec = GIS_LAYER_REGISTRY[layerKey];
  if (!spec) return null;

  const sourceId = `${layerKey}-source`;
  const style    = LAYER_STYLES[layerKey] ?? {};

  // Build MapLibre layer definitions from the style
  const maplibreLayers: GISLayerMetadata['maplibreLayers'] = [];

  if (style.fillPaint) {
    maplibreLayers.push({
      id:    `${layerKey}-fill`,
      type:  'fill',
      paint: style.fillPaint,
    });
  }
  if (style.linePaint) {
    maplibreLayers.push({
      id:    `${layerKey}-line`,
      type:  'line',
      paint: style.linePaint,
    });
  }
  if (style.circlePaint) {
    maplibreLayers.push({
      id:    `${layerKey}-circle`,
      type:  'circle',
      paint: style.circlePaint,
    });
  }
  if (style.rasterPaint) {
    maplibreLayers.push({
      id:    `${layerKey}-raster`,
      type:  'raster',
      paint: style.rasterPaint,
    });
  }

  // Context A — Local GeoJSON
  if (context === 'local') {
    const path = LOCAL_PATHS[layerKey];
    if (!path) return null;
    return {
      id:               layerKey,
      name:             spec.name,
      category:         spec.category,
      geometryType:     spec.geometryType,
      storageContext:   'local',
      sourceConfig:     { kind: 'local-geojson', path },
      localPath:        path,
      crs:              'EPSG:4326',
      maplibreSourceId: sourceId,
      maplibreLayers,
      defaultVisible:   false,
      setbackM:         spec.setbackM,
      isQueryable:      false,
      dataSource:       spec.dataSourceHint,
    };
  }

  // Context B — PostGIS REST API
  if (context === 'postgis') {
    const endpoint = API_ENDPOINTS[layerKey];
    if (!endpoint) return null;
    return {
      id:               layerKey,
      name:             spec.name,
      category:         spec.category,
      geometryType:     spec.geometryType,
      storageContext:   'postgis',
      sourceConfig:     { kind: 'postgis-rest', endpoint },
      apiEndpoint:      endpoint,
      postgisTable:     `layers.${layerKey.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
      crs:              'EPSG:4326',
      maplibreSourceId: sourceId,
      maplibreLayers,
      defaultVisible:   false,
      setbackM:         spec.setbackM,
      isQueryable:      true,
      dataSource:       spec.dataSourceHint,
    };
  }

  // Context C — Cloud COG (rasters only)
  if (context === 'cloud-cog') {
    if (layerKey === 'dtm' || layerKey === 'slopeGrid') {
      const tilesUrl = COG_TILE_URLS[layerKey]!;
      return {
        id:               layerKey,
        name:             spec.name,
        category:         spec.category,
        geometryType:     spec.geometryType,
        storageContext:   'cloud-cog',
        sourceConfig:     { kind: 'cog-raster', tilesUrl, tileSize: 256, minzoom: 4, maxzoom: 12 },
        cogUrl:           CDN_BASE + (layerKey === 'dtm' ? '/cog/srtm-india-30m.tif' : '/cog/slope-india-30m.tif'),
        tilerUrl:         TILER_BASE,
        crs:              'EPSG:4326',
        maplibreSourceId: sourceId,
        maplibreLayers,
        defaultVisible:   false,
        isQueryable:      false,
        attribution:      'SRTM / CGIAR CSI',
        dataSource:       spec.dataSourceHint,
      };
    }
    if (layerKey === 'windResourceGrid') {
      const tilesUrl = COG_TILE_URLS['windResourceGrid']!;
      return {
        id:               layerKey,
        name:             spec.name,
        category:         spec.category,
        geometryType:     spec.geometryType,
        storageContext:   'cloud-cog',
        sourceConfig:     { kind: 'cog-raster', tilesUrl, tileSize: 256, minzoom: 4, maxzoom: 12 },
        cogUrl:           `s3://wf-rasters/niwe-wind-100m.tif`,
        tilerUrl:         TILER_BASE,
        crs:              'EPSG:4326',
        maplibreSourceId: sourceId,
        maplibreLayers,
        defaultVisible:   false,
        isQueryable:      false,
        attribution:      '© NIWE Wind Atlas 2023',
        dataSource:       spec.dataSourceHint,
      };
    }
    return null; // non-raster layers don't have COG context
  }

  return null;
}

// ─── Terrain COG descriptor (special — not a GISLayerKey) ────────────────────

/**
 * Returns the MapLibre source config for the terrain DEM (raster-dem type).
 * Use with RasterLayerLoader.addTerrain() for 3D elevation.
 */
export function getTerrainSourceConfig(): {
  sourceId: string;
  maplibreOptions: {
    type: 'raster-dem';
    url: string;
    tileSize: number;
    encoding: 'terrarium';
  };
} {
  return {
    sourceId: 'terrain-dem-source',
    maplibreOptions: {
      type:     'raster-dem',
      url:      COG_DEM_URL,
      tileSize: 512,
      encoding: 'terrarium',
    },
  };
}

// ─── Batch helper ─────────────────────────────────────────────────────────────

/**
 * Resolve metadata for multiple layers in one call.
 * Silently skips layers that don't have a config in the given context.
 */
export function getLayerMetadataBatch(
  keys: GISLayerKey[],
  context: StorageContext
): GISLayerMetadata[] {
  return keys.flatMap(k => {
    const m = getLayerMetadata(k, context);
    return m ? [m] : [];
  });
}
