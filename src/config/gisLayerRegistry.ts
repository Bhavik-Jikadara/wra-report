/**
 * GIS Layer Specification Data Dictionary — Wind Farm Micrositing Tool
 *
 * 20 layers across 5 categories:
 *   1. Base Data       (4 layers)
 *   2. Infrastructure  (4 layers — Road Network reuses existing 'roads' LayerKey)
 *   3. Administrative  (4 layers)
 *   4. Environment     (4 layers)
 *   5. Socioeconomics  (4 layers)
 *
 * Each entry is the authoritative spec for schema design, topology validation,
 * spatial index selection, and MapLibre style configuration.
 *
 * Topology rule notation:
 *   "Subject  Predicate  Object [Threshold]"
 *   e.g. "Raster Extent  Must Fully Cover  projectBoundary polygon"
 */

import type { GISLayerSpec } from '@/types/gisLayers';

// ─────────────────────────────────────────────────────────────────────────────
// 1. BASE DATA
// ─────────────────────────────────────────────────────────────────────────────

const dtm: GISLayerSpec = {
  id: 'dtm',
  name: 'Digital Terrain Model (DTM)',
  shortName: 'DTM',
  category: 'base-data',
  geometryType: 'Raster (COG)',
  attributes: [
    { name: 'source_agency',   type: 'String',  nullable: false },
    { name: 'resolution_m',    type: 'Float',   nullable: false },
    { name: 'vertical_datum',  type: 'String',  nullable: false },
    { name: 'capture_date',    type: 'Date',    nullable: false },
    { name: 'nodata_val',      type: 'Float',   nullable: true  },
    { name: 'min_elev_m',      type: 'Float',   nullable: false },
    { name: 'max_elev_m',      type: 'Float',   nullable: false },
    { name: 'crs_epsg',        type: 'Integer', nullable: false },
    { name: 'is_lidar',        type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'Quadtree',
  targetScaleMin: 10_000,
  targetScaleMax: 50_000,
  topologyRules: [
    'Raster Extent Must Fully Cover projectBoundary polygon',
    'NoData cells Must Not Exist within projectBoundary envelope',
    'min_elev_m Must Be Less Than all Turbine foundation pad elevations',
  ],
  mapColor: '#92400e',
  dataSourceHint: 'SRTM 30 m, CartoSAT-1/2, LiDAR survey (preferred for ≤5 m resolution)',
};

const landCover: GISLayerSpec = {
  id: 'landCover',
  name: 'Land Cover Classification',
  shortName: 'Land Cover',
  category: 'base-data',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'class_code',       type: 'Integer', nullable: false },
    { name: 'class_name',       type: 'String',  nullable: false },
    { name: 'area_ha',          type: 'Float',   nullable: false },
    { name: 'confidence_pct',   type: 'Float',   nullable: false },
    { name: 'source_year',      type: 'Integer', nullable: false },
    { name: 'survey_date',      type: 'Date',    nullable: false },
    { name: 'is_buildable',     type: 'Boolean', nullable: false },
    { name: 'lc_source',        type: 'String',  nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 10_000,
  targetScaleMax: 25_000,
  topologyRules: [
    'Polygons Must Not Overlap within the same class_code',
    'Polygons Must Not Have Gaps within projectBoundary',
    'Non-buildable class polygon Must Not Contain any Turbine Point',
    'Total classified area Must Equal projectBoundary area ± 0.01 ha',
  ],
  mapColor: '#65a30d',
  dataSourceHint: 'ISRO LISS-IV, ESA Sentinel-2, NLSOF Land Use/Land Cover 1:50 000',
};

const slopeGrid: GISLayerSpec = {
  id: 'slopeGrid',
  name: 'Slope Analysis Grid',
  shortName: 'Slope',
  category: 'base-data',
  geometryType: 'Raster (COG)',
  attributes: [
    { name: 'parent_dtm_id',         type: 'UUID',    nullable: false },
    { name: 'slope_unit',            type: 'String',  nullable: false, description: 'degrees or percent' },
    { name: 'max_slope_deg',         type: 'Float',   nullable: false },
    { name: 'exclude_threshold_deg', type: 'Float',   nullable: false },
    { name: 'resolution_m',          type: 'Float',   nullable: false },
    { name: 'compute_date',          type: 'Date',    nullable: false },
  ],
  spatialIndex: 'Quadtree',
  targetScaleMin: 10_000,
  targetScaleMax: 10_000,
  topologyRules: [
    'Raster Extent Must Equal parent DTM Extent',
    'Cells Exceeding exclude_threshold_deg (≥ 15°) Must Not Overlap Turbine Placement Polygon',
    'parent_dtm_id Must Reference a valid and current DTM record',
  ],
  mapColor: '#d97706',
  dataSourceHint: 'Derived from DTM via GDAL gdaldem slope',
};

const imageryMosaic: GISLayerSpec = {
  id: 'imageryMosaic',
  name: 'Satellite / Aerial Imagery Mosaic',
  shortName: 'Imagery',
  category: 'base-data',
  geometryType: 'Raster (COG)',
  attributes: [
    { name: 'provider',              type: 'String',  nullable: false },
    { name: 'resolution_m',         type: 'Float',   nullable: false },
    { name: 'capture_date',         type: 'Date',    nullable: false },
    { name: 'cloud_cover_pct',      type: 'Float',   nullable: false },
    { name: 'band_count',           type: 'Integer', nullable: false },
    { name: 'crs_epsg',             type: 'Integer', nullable: false },
    { name: 'is_current',           type: 'Boolean', nullable: false },
    { name: 'mosaic_seams_present', type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'Quadtree',
  targetScaleMin: 1_000,
  targetScaleMax: 25_000,
  topologyRules: [
    'Raster Must Fully Cover projectBoundary envelope',
    'cloud_cover_pct Must Be Less Than 10% over projectBoundary extent',
    'capture_date Must Be Within 18 months of Site Assessment Date',
  ],
  mapColor: '#0369a1',
  dataSourceHint: 'Google Earth Engine, Planet Labs, ESRI World Imagery, Maxar',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. INFRASTRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

// Note: Road Network reuses the existing 'roads' LayerKey and osmService feature type.
// The spec below is the authoritative schema target for that layer.
const roadNetwork: GISLayerSpec = {
  id: 'roads',
  name: 'Road Network',
  shortName: 'Roads',
  category: 'infrastructure',
  geometryType: 'MultiLineString',
  attributes: [
    { name: 'road_class',       type: 'String',  nullable: false },
    { name: 'surface_type',     type: 'String',  nullable: true  },
    { name: 'width_m',          type: 'Float',   nullable: true  },
    { name: 'max_axle_load_t',  type: 'Float',   nullable: true  },
    { name: 'is_paved',         type: 'Boolean', nullable: false },
    { name: 'ownership',        type: 'String',  nullable: true  },
    { name: 'condition_score',  type: 'Integer', nullable: true, description: '1 (poor) – 5 (excellent)' },
    { name: 'survey_date',      type: 'Date',    nullable: true  },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 5_000,
  targetScaleMax: 25_000,
  topologyRules: [
    'Lines Must Not Self-Intersect',
    'Turbine Access Track endpoint Must Snap to Public Road node (≤ 0.5 m tolerance)',
    'Road centreline Must Not Pass Through exclusionZones polygon',
    'Access road width_m Must Be ≥ 6.0 m within projectBoundary',
  ],
  mapColor: '#a855f7',
  dataSourceHint: 'OSM Overpass API, MoRTH NH/SH alignment shapefiles, field survey',
};

const powerTransmission: GISLayerSpec = {
  id: 'powerTransmission',
  name: 'Power Transmission Lines (EHV/HV)',
  shortName: 'Transmission',
  category: 'infrastructure',
  geometryType: 'MultiLineString',
  attributes: [
    { name: 'voltage_kv',      type: 'Float',   nullable: false },
    { name: 'circuit_count',   type: 'Integer', nullable: false },
    { name: 'owner',           type: 'String',  nullable: false },
    { name: 'line_class',      type: 'String',  nullable: false, description: 'EHV / HV / MV' },
    { name: 'is_operational',  type: 'Boolean', nullable: false },
    { name: 'min_setback_m',   type: 'Float',   nullable: false },
    { name: 'tower_type',      type: 'String',  nullable: true  },
    { name: 'survey_date',     type: 'Date',    nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 10_000,
  targetScaleMax: 50_000,
  topologyRules: [
    'Turbine Point Must Maintain Distance ≥ min_setback_m from Line geometry',
    'min_setback_m Buffer Must Not Overlap Turbine Point',
    'Lines Must Not Cross each other within projectBoundary without a Substation node at intersection',
  ],
  mapColor: '#06b6d4',
  setbackM: 200,
  dataSourceHint: 'PGCIL GIS portal, State TRANSCO, OSM power=line (voltage ≥ 66 kV)',
};

const gridSubstations: GISLayerSpec = {
  id: 'gridSubstations',
  name: 'Electrical Substations & Grid Points',
  shortName: 'Substations',
  category: 'infrastructure',
  geometryType: 'Point',
  attributes: [
    { name: 'sub_name',             type: 'String',  nullable: false },
    { name: 'capacity_mva',         type: 'Float',   nullable: false },
    { name: 'voltage_in_kv',        type: 'Float',   nullable: false },
    { name: 'voltage_out_kv',       type: 'Float',   nullable: false },
    { name: 'owner',                type: 'String',  nullable: false },
    { name: 'is_operational',       type: 'Boolean', nullable: false },
    { name: 'connection_feasible',  type: 'Boolean', nullable: false },
    { name: 'distance_to_project_km', type: 'Float', nullable: false },
    { name: 'survey_date',          type: 'Date',    nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 5_000,
  targetScaleMax: 5_000,
  topologyRules: [
    'Point Must Coincide With at Least One Transmission Line endpoint node',
    '500 m Exclusion Buffer Must Not Overlap Turbine Point',
    'distance_to_project_km Must Be ≤ 50 km from projectBoundary centroid',
  ],
  mapColor: '#059669',
  dataSourceHint: 'State TRANSCO load despatch centres, PGCIL substation GIS',
};

const undergroundPipelines: GISLayerSpec = {
  id: 'undergroundPipelines',
  name: 'Underground Utilities & Pipelines',
  shortName: 'Pipelines',
  category: 'infrastructure',
  geometryType: 'MultiLineString',
  attributes: [
    { name: 'utility_type',   type: 'String',  nullable: false, description: 'gas / oil / water / telecom' },
    { name: 'diameter_mm',    type: 'Float',   nullable: true  },
    { name: 'pressure_bar',   type: 'Float',   nullable: true  },
    { name: 'material',       type: 'String',  nullable: true  },
    { name: 'owner',          type: 'String',  nullable: false },
    { name: 'min_setback_m',  type: 'Float',   nullable: false },
    { name: 'burial_depth_m', type: 'Float',   nullable: true  },
    { name: 'is_active',      type: 'Boolean', nullable: false },
    { name: 'survey_date',    type: 'Date',    nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 5_000,
  targetScaleMax: 10_000,
  topologyRules: [
    'min_setback_m Setback Buffer Must Not Overlap Turbine Point',
    'Pipeline Must Not Intersect Water Body polygon without a Documented Crossing Record',
    'Must Not Pass Through Protected Area polygon',
    'Endpoint Must Terminate at a Known Utility Node or projectBoundary edge',
  ],
  mapColor: '#b45309',
  setbackM: 100,
  dataSourceHint: 'GAIL GIS portal, BPCL / HPCL pipeline maps, District administration records',
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADMINISTRATIVE
// ─────────────────────────────────────────────────────────────────────────────

const districtBoundaries: GISLayerSpec = {
  id: 'districtBoundaries',
  name: 'District / Sub-district Boundaries',
  shortName: 'Districts',
  category: 'administrative',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'district_name',  type: 'String',  nullable: false },
    { name: 'state',          type: 'String',  nullable: false },
    { name: 'census_code',    type: 'Integer', nullable: false },
    { name: 'area_km2',       type: 'Float',   nullable: false },
    { name: 'authority',      type: 'String',  nullable: false },
    { name: 'effective_date', type: 'Date',    nullable: false },
    { name: 'is_current',     type: 'Boolean', nullable: false },
    { name: 'admin_level',    type: 'Integer', nullable: false, description: '3 = district, 4 = tehsil' },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 50_000,
  targetScaleMax: 250_000,
  topologyRules: [
    'Polygons Must Not Overlap at the same admin_level',
    'Boundaries Must Not Have Gaps at state extent',
    'projectBoundary Must Be Fully Covered By one or more District polygons',
    'Shared boundary edges Must Be Topologically Identical between adjacent districts',
  ],
  mapColor: '#1d4ed8',
  dataSourceHint: 'Survey of India District/Tehsil shapefiles, OGRNCMS, Census of India 2011',
};

const revenueVillages: GISLayerSpec = {
  id: 'revenueVillages',
  name: 'Revenue Village / Survey Zones',
  shortName: 'Revenue Zones',
  category: 'administrative',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'village_name',   type: 'String',  nullable: false },
    { name: 'taluka',         type: 'String',  nullable: false },
    { name: 'survey_number',  type: 'String',  nullable: false },
    { name: 'area_ha',        type: 'Float',   nullable: false },
    { name: 'land_type',      type: 'String',  nullable: false, description: 'govt / private / forest / waste' },
    { name: 'ownership',      type: 'String',  nullable: true  },
    { name: 'effective_date', type: 'Date',    nullable: false },
    { name: 'is_disputed',    type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 5_000,
  targetScaleMax: 25_000,
  topologyRules: [
    'Polygons Must Not Overlap',
    'Each Turbine Point Must Fall Within Exactly One is_disputed=false Survey Zone',
    'Zone Boundaries Must Align With Cadastral Parcel Boundaries (≤ 1 m tolerance)',
    'Zones Must Tile Completely within their parent District Boundary polygon',
  ],
  mapColor: '#be185d',
  dataSourceHint: 'State Revenue Department cadastral maps, DILRMP Village Maps',
};

const protectedAreas: GISLayerSpec = {
  id: 'protectedAreas',
  name: 'Protected Areas & Wildlife Sanctuaries',
  shortName: 'Protected Areas',
  category: 'administrative',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'pa_name',                  type: 'String',  nullable: false },
    { name: 'pa_type',                  type: 'String',  nullable: false, description: 'NP / WLS / CR / ES / BR' },
    { name: 'authority',                type: 'String',  nullable: false },
    { name: 'area_km2',                 type: 'Float',   nullable: false },
    { name: 'buffer_km',                type: 'Float',   nullable: false },
    { name: 'gazette_date',             type: 'Date',    nullable: false },
    { name: 'is_ecologically_sensitive', type: 'Boolean', nullable: false },
    { name: 'legal_reference',          type: 'String',  nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 25_000,
  targetScaleMax: 250_000,
  topologyRules: [
    'projectBoundary Must Not Overlap PA Core Zone polygon',
    'Turbine Point Must Maintain Distance ≥ buffer_km from PA Boundary',
    'exclusionZones Must Fully Cover the intersection of PA buffer with projectBoundary',
    'PA polygons of the same pa_type Must Not Overlap',
  ],
  mapColor: '#991b1b',
  dataSourceHint: 'MoEFCC Protected Area Network, WDPA (IUCN/UNEP), State Forest Dept',
};

const restrictedAirspace: GISLayerSpec = {
  id: 'restrictedAirspace',
  name: 'Military / Restricted Airspace Zones',
  shortName: 'Airspace',
  category: 'administrative',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'zone_name',      type: 'String',  nullable: false },
    { name: 'zone_type',      type: 'String',  nullable: false, description: 'P / R / D (Prohibited/Restricted/Danger)' },
    { name: 'authority',      type: 'String',  nullable: false },
    { name: 'height_limit_m', type: 'Float',   nullable: false },
    { name: 'min_setback_m',  type: 'Float',   nullable: false },
    { name: 'gazette_date',   type: 'Date',    nullable: false },
    { name: 'is_active',      type: 'Boolean', nullable: false },
    { name: 'permit_required', type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 50_000,
  targetScaleMax: 250_000,
  topologyRules: [
    'Turbine Point Must Not Fall Within Zone polygon when is_active=true',
    'Turbine tip height Must Not Exceed height_limit_m within 5 km of Zone boundary',
    'min_setback_m Buffer Must Not Overlap Turbine Point',
    'Zone Must Be Sourced from DGCA / AAI official AIP records only',
  ],
  mapColor: '#7e22ce',
  dataSourceHint: 'DGCA AIP India, AAI Aeronautical Information Publication, IAF restricted area charts',
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────────

const windResourceGrid: GISLayerSpec = {
  id: 'windResourceGrid',
  name: 'Wind Resource Grid',
  shortName: 'Wind Resource',
  category: 'environment',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'mean_wind_speed_ms',    type: 'Float',   nullable: false },
    { name: 'wind_power_density_wm2', type: 'Float',  nullable: false },
    { name: 'hub_height_m',          type: 'Float',   nullable: false },
    { name: 'measurement_year',      type: 'Integer', nullable: false },
    { name: 'data_source',           type: 'String',  nullable: false },
    { name: 'weibull_k',             type: 'Float',   nullable: false },
    { name: 'weibull_c',             type: 'Float',   nullable: false },
    { name: 'confidence_level',      type: 'String',  nullable: false, description: 'P50 / P75 / P90' },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 50_000,
  targetScaleMax: 250_000,
  topologyRules: [
    'Grid Must Fully Cover projectBoundary',
    'Grid Cells Must Not Overlap',
    'hub_height_m Must Equal the Turbine layer hub_height_m attribute for candidate turbines',
    'Cells with mean_wind_speed_ms < 5.0 Must Be Flagged in Exclusion Analysis',
  ],
  mapColor: '#0891b2',
  dataSourceHint: 'NIWE wind atlas, ERA5 reanalysis, NREL WIND Toolkit, met mast campaign data',
};

const floodZones: GISLayerSpec = {
  id: 'floodZones',
  name: 'Flood Inundation Zones',
  shortName: 'Flood Zones',
  category: 'environment',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'return_period_yr',   type: 'Integer', nullable: false },
    { name: 'inundation_depth_m', type: 'Float',   nullable: false },
    { name: 'source',             type: 'String',  nullable: false },
    { name: 'survey_date',        type: 'Date',    nullable: false },
    { name: 'is_seasonal',        type: 'Boolean', nullable: false },
    { name: 'risk_class',         type: 'String',  nullable: false, description: 'Low / Medium / High / Very High' },
    { name: 'hydrological_unit_id', type: 'UUID',  nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 10_000,
  targetScaleMax: 50_000,
  topologyRules: [
    'Turbine Foundation Point Must Not Fall Within 100-year Return Period Flood Zone',
    'Flood Zone polygons Must Be Nested by Return Period (2yr ⊂ 25yr ⊂ 100yr)',
    'Access Road subgrade elevation Must Exceed inundation_depth_m for 25-year event',
    'Zones Must Not Cross District Hydrological Unit Boundaries without a documented confluence record',
  ],
  mapColor: '#1e40af',
  dataSourceHint: 'CWC flood hazard maps, NRSC flood inundation atlas, State DRR portals',
};

const wildlifeCorridors: GISLayerSpec = {
  id: 'wildlifeCorridors',
  name: 'Wildlife Corridors & Migratory Flyways',
  shortName: 'Wildlife',
  category: 'environment',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'species_group',    type: 'String',  nullable: false },
    { name: 'corridor_type',    type: 'String',  nullable: false, description: 'terrestrial / aerial / aquatic' },
    { name: 'importance_rank',  type: 'Integer', nullable: false, description: '1 (critical) – 5 (low)' },
    { name: 'width_m',          type: 'Float',   nullable: true  },
    { name: 'authority',        type: 'String',  nullable: false },
    { name: 'assessment_date',  type: 'Date',    nullable: false },
    { name: 'is_seasonal',      type: 'Boolean', nullable: false },
    { name: 'migration_months', type: 'String',  nullable: true, description: 'CSV of months, e.g. "Oct,Nov,Mar"' },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 25_000,
  targetScaleMax: 100_000,
  topologyRules: [
    'Turbine Point Must Not Fall Within Corridor polygon',
    'Turbine Rotor Swept Area polygon Must Not Intersect Aerial Flyway Corridor',
    'Access Road Must Not Sever Corridor polygon without a Wildlife Underpass record',
    'Seasonal corridors Must Have migration_months populated (Must Not Be NULL)',
  ],
  mapColor: '#166534',
  dataSourceHint: 'WII wildlife corridor reports, BirdLife Important Bird Areas, State wildlife board',
};

const forestCover: GISLayerSpec = {
  id: 'forestCover',
  name: 'Forest Cover & Tree Canopy',
  shortName: 'Forest',
  category: 'environment',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'forest_type',          type: 'String',  nullable: false },
    { name: 'canopy_density_pct',   type: 'Float',   nullable: false },
    { name: 'tree_height_m',        type: 'Float',   nullable: true  },
    { name: 'area_ha',              type: 'Float',   nullable: false },
    { name: 'legal_status',         type: 'String',  nullable: false, description: 'Reserved / Protected / Village / Deemed' },
    { name: 'division',             type: 'String',  nullable: false },
    { name: 'survey_date',          type: 'Date',    nullable: false },
    { name: 'clearance_required',   type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 10_000,
  targetScaleMax: 25_000,
  topologyRules: [
    'Turbine Point Must Not Fall Within Reserved / Protected Forest polygon',
    'Dense Forest polygon (canopy_density_pct > 70) Must Not Overlap Turbine Placement Polygon',
    'Access Road Must Not Bisect Reserved Forest polygon without a Forest Clearance record',
    'Forest polygons Must Not Overlap within the same legal_status class',
  ],
  mapColor: '#14532d',
  dataSourceHint: 'FSI State of Forest Report, MoEFCC forest clearance GIS, ISRO forest atlas',
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SOCIOECONOMICS
// ─────────────────────────────────────────────────────────────────────────────

const populationGrid: GISLayerSpec = {
  id: 'populationGrid',
  name: 'Population Density Grid',
  shortName: 'Population',
  category: 'socioeconomics',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'census_year',         type: 'Integer', nullable: false },
    { name: 'pop_count',           type: 'Integer', nullable: false },
    { name: 'pop_density_km2',     type: 'Float',   nullable: false },
    { name: 'household_count',     type: 'Integer', nullable: false },
    { name: 'source',              type: 'String',  nullable: false },
    { name: 'admin_unit_id',       type: 'UUID',    nullable: false },
    { name: 'is_projected',        type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 25_000,
  targetScaleMax: 100_000,
  topologyRules: [
    'Grid Cells Must Not Overlap',
    'Grid Must Fully Cover projectBoundary',
    'High-density cells (pop_density_km2 > 400) Must Not Overlap Turbine Placement Polygon',
    'admin_unit_id Must Reference a valid Revenue Village or District polygon',
  ],
  mapColor: '#c2410c',
  dataSourceHint: 'Census of India 2011 village-level data, WorldPop 100 m grid, GHSL',
};

const noiseReceptors: GISLayerSpec = {
  id: 'noiseReceptors',
  name: 'Noise Receptor Points (Sensitive Receptors)',
  shortName: 'Noise Receptors',
  category: 'socioeconomics',
  geometryType: 'Point',
  attributes: [
    { name: 'receptor_type',         type: 'String',  nullable: false, description: 'residence / school / hospital / worship' },
    { name: 'name',                  type: 'String',  nullable: true  },
    { name: 'nearest_turbine_id',    type: 'UUID',    nullable: true  },
    { name: 'setback_m',             type: 'Float',   nullable: false },
    { name: 'survey_date',           type: 'Date',    nullable: false },
    { name: 'is_occupied',           type: 'Boolean', nullable: false },
    { name: 'ambient_dba',           type: 'Float',   nullable: true  },
    { name: 'predicted_impact_dba',  type: 'Float',   nullable: true  },
    { name: 'is_compliant',          type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 1_000,
  targetScaleMax: 5_000,
  topologyRules: [
    'setback_m Setback Buffer Must Not Contain any Turbine Point',
    'nearest_turbine_id Must Reference a Valid Turbine Feature when populated',
    'Receptor Must Fall Within projectBoundary + 2 km buffer',
    'is_compliant Must Be true for all is_occupied=true receptors before Turbine layer is finalised',
  ],
  mapColor: '#b91c1c',
  setbackM: 500,
  dataSourceHint: 'Field survey, revenue village settlement maps, Google Maps satellite cross-check',
};

const shadowFlickerZones: GISLayerSpec = {
  id: 'shadowFlickerZones',
  name: 'Shadow Flicker Analysis Zones',
  shortName: 'Shadow Flicker',
  category: 'socioeconomics',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'source_turbine_id',  type: 'UUID',    nullable: false },
    { name: 'max_hours_yr',       type: 'Float',   nullable: false },
    { name: 'threshold_hours',    type: 'Float',   nullable: false },
    { name: 'is_exceedance',      type: 'Boolean', nullable: false },
    { name: 'receptor_id',        type: 'UUID',    nullable: true  },
    { name: 'calc_date',          type: 'Date',    nullable: false },
    { name: 'season',             type: 'String',  nullable: true  },
    { name: 'mitigation_required', type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 1_000,
  targetScaleMax: 5_000,
  topologyRules: [
    'Zone Must Reference a Valid Turbine Point via source_turbine_id',
    'Exceedance Zone (is_exceedance=true) Must Coincide With or Contain a Noise Receptor Point',
    'Flicker Zone Must Not Extend Beyond 2 km radius from Source Turbine Point',
    'mitigation_required Must Be true wherever max_hours_yr > threshold_hours',
  ],
  mapColor: '#6d28d9',
  dataSourceHint: 'WindFarmer / WindPRO shadow flicker module, IEC 61400-11 methodology',
};

const landParcels: GISLayerSpec = {
  id: 'landParcels',
  name: 'Land Ownership & Lease Parcels',
  shortName: 'Land Parcels',
  category: 'socioeconomics',
  geometryType: 'MultiPolygon',
  attributes: [
    { name: 'owner_name',        type: 'String',  nullable: false },
    { name: 'land_type',         type: 'String',  nullable: false },
    { name: 'area_ha',           type: 'Float',   nullable: false },
    { name: 'lease_status',      type: 'String',  nullable: false, description: 'active / pending / expired / none' },
    { name: 'lease_start',       type: 'Date',    nullable: true  },
    { name: 'lease_end',         type: 'Date',    nullable: true  },
    { name: 'rent_per_ha_inr',   type: 'Float',   nullable: true  },
    { name: 'is_acquired',       type: 'Boolean', nullable: false },
    { name: 'dispute_flag',      type: 'Boolean', nullable: false },
  ],
  spatialIndex: 'GiST (PostGIS)',
  targetScaleMin: 1_000,
  targetScaleMax: 5_000,
  topologyRules: [
    'Turbine Point Must Fall Within an is_acquired=true or lease_status="active" Parcel',
    'Parcels Must Not Overlap within the same ownership class',
    'Parcel Boundaries Must Align with Revenue Village Survey Zone edges (≤ 1 m tolerance)',
    'lease_end Must Be ≥ Project Decommission Date for all parcels containing a Turbine Point',
  ],
  mapColor: '#78350f',
  dataSourceHint: 'State Revenue Department, DILRMP e-records, field-collected khasra/patwari records',
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry export
// ─────────────────────────────────────────────────────────────────────────────

export const GIS_LAYER_REGISTRY: Record<string, GISLayerSpec> = {
  // Base Data
  dtm,
  landCover,
  slopeGrid,
  imageryMosaic,
  // Infrastructure
  roads: roadNetwork,
  powerTransmission,
  gridSubstations,
  undergroundPipelines,
  // Administrative
  districtBoundaries,
  revenueVillages,
  protectedAreas,
  restrictedAirspace,
  // Environment
  windResourceGrid,
  floodZones,
  wildlifeCorridors,
  forestCover,
  // Socioeconomics
  populationGrid,
  noiseReceptors,
  shadowFlickerZones,
  landParcels,
};

/** Ordered layer IDs by category for UI rendering */
export const GIS_LAYER_ORDER: Record<string, string[]> = {
  'base-data':      ['dtm', 'landCover', 'slopeGrid', 'imageryMosaic'],
  'infrastructure': ['roads', 'powerTransmission', 'gridSubstations', 'undergroundPipelines'],
  'administrative': ['districtBoundaries', 'revenueVillages', 'protectedAreas', 'restrictedAirspace'],
  'environment':    ['windResourceGrid', 'floodZones', 'wildlifeCorridors', 'forestCover'],
  'socioeconomics': ['populationGrid', 'noiseReceptors', 'shadowFlickerZones', 'landParcels'],
};
