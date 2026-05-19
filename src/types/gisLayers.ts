// GIS Layer Specification Data Dictionary — Wind Farm Micrositing Tool
// Covers 5 categories × 4 layers = 20 standardised layer definitions.

// ─── Primitive type vocabulary ────────────────────────────────────────────────

export type GISGeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'Raster (COG)';

export type SpatialIndexType =
  | 'GiST (PostGIS)'
  | 'R-Tree (SpatiaLite/GeoPackage)'
  | 'Quadtree';

export type AttributeDataType =
  | 'UUID'
  | 'String'
  | 'Integer'
  | 'Float'
  | 'Boolean'
  | 'Date';

// ─── Attribute field spec ─────────────────────────────────────────────────────

export interface AttributeFieldSpec {
  name: string;
  type: AttributeDataType;
  nullable: boolean;
  description?: string;
}

// ─── Layer categories ─────────────────────────────────────────────────────────

export type GISLayerCategory =
  | 'base-data'
  | 'infrastructure'
  | 'administrative'
  | 'environment'
  | 'socioeconomics';

export const GIS_CATEGORY_LABELS: Record<GISLayerCategory, string> = {
  'base-data':      'Base Data',
  'infrastructure': 'Infrastructure',
  'administrative': 'Administrative',
  'environment':    'Environment',
  'socioeconomics': 'Socioeconomics',
};

// ─── Core layer spec ──────────────────────────────────────────────────────────

export interface GISLayerSpec {
  /** Matches a LayerKey in the store */
  id: string;
  name: string;
  shortName: string;
  category: GISLayerCategory;
  geometryType: GISGeometryType;
  /** UUID primary key is always implied; list only domain-specific fields */
  attributes: AttributeFieldSpec[];
  spatialIndex: SpatialIndexType;
  /** Denominator of the smallest (most detailed) target scale, e.g. 1000 → 1:1,000 */
  targetScaleMin: number;
  /** Denominator of the largest (most overview) target scale, e.g. 50000 → 1:50,000 */
  targetScaleMax: number;
  /** Wind-farm-specific topology predicates */
  topologyRules: string[];
  mapColor: string;
  /** Fixed setback distance in metres, if applicable */
  setbackM?: number;
  dataSourceHint?: string;
}

// ─── Typed key union for all 20 GIS dictionary layers ────────────────────────
// (Separate from the existing LayerKey — merged in the store via type union.)

export type GISLayerKey =
  // Base Data (4)
  | 'dtm'
  | 'landCover'
  | 'slopeGrid'
  | 'imageryMosaic'
  // Infrastructure (3 new; 'roads' reuses existing LayerKey)
  | 'powerTransmission'
  | 'gridSubstations'
  | 'undergroundPipelines'
  // Administrative (4)
  | 'districtBoundaries'
  | 'revenueVillages'
  | 'protectedAreas'
  | 'restrictedAirspace'
  // Environment (4)
  | 'windResourceGrid'
  | 'floodZones'
  | 'wildlifeCorridors'
  | 'forestCover'
  // Socioeconomics (4)
  | 'populationGrid'
  | 'noiseReceptors'
  | 'shadowFlickerZones'
  | 'landParcels';
