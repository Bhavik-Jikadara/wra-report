-- Migration: 20260516000000_init_gis
-- Creates PostGIS extensions, layers schema, and 3 priority GIS tables.
-- Run via: npx prisma migrate dev --name init_gis
-- Prerequisites: PostgreSQL ≥ 14 with PostGIS ≥ 3.1 extension available.

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Schema ───────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS layers;

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE layers."ConfidenceLevel" AS ENUM ('P50', 'P75', 'P90');

CREATE TYPE layers."ZoneType" AS ENUM (
  'water', 'dwelling', 'protected_area', 'forest', 'military', 'custom'
);

-- ─── 1. wind_resource ─────────────────────────────────────────────────────────
-- Stores modelled wind resource statistics per grid cell.
-- Typical cell resolution: 1 km² (NIWE) to 25 km² (ERA5).
-- Setback rule: turbines only in cells where mean_wind_speed_ms >= 5.0.

CREATE TABLE layers.wind_resource (
  id                     UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  layer_version          INTEGER         NOT NULL DEFAULT 1,

  -- PostGIS geography column: WGS84 geographic coordinates, distance in metres.
  -- Use geography (not geometry) for accurate ST_DWithin results in metres.
  geom                   GEOGRAPHY(MultiPolygon, 4326) NOT NULL,

  mean_wind_speed_ms     DOUBLE PRECISION NOT NULL CHECK (mean_wind_speed_ms >= 0),
  wind_power_density_wm2 DOUBLE PRECISION NOT NULL CHECK (wind_power_density_wm2 >= 0),
  hub_height_m           DOUBLE PRECISION NOT NULL CHECK (hub_height_m > 0),
  measurement_year       INTEGER          NOT NULL CHECK (measurement_year >= 1990),
  data_source            TEXT             NOT NULL,
  weibull_k              DOUBLE PRECISION NOT NULL CHECK (weibull_k > 0),
  weibull_c              DOUBLE PRECISION NOT NULL CHECK (weibull_c > 0),
  confidence_level       layers."ConfidenceLevel" NOT NULL,

  -- JSONB for extended schema-free metadata (roughness class, turbulence intensity, etc.)
  metadata               JSONB            NOT NULL DEFAULT '{}',

  created_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- GiST spatial index on geometry cast (geography GiST supported from PG 14)
CREATE INDEX wind_resource_geom_idx
  ON layers.wind_resource USING GIST ((geom::geometry));

CREATE INDEX wind_resource_wind_speed_idx
  ON layers.wind_resource (mean_wind_speed_ms);

CREATE INDEX wind_resource_metadata_idx
  ON layers.wind_resource USING GIN (metadata);

COMMENT ON TABLE layers.wind_resource IS
  'Modelled wind resource grid. Topology rule: Turbine placement polygon must be fully within cells where mean_wind_speed_ms >= 5.0.';

-- ─── 2. exclusion_zones ───────────────────────────────────────────────────────
-- Project-scoped exclusion polygons. Turbines and access roads must stay
-- outside ST_Buffer(geom::geometry, setback_m) for each active zone.

CREATE TABLE layers.exclusion_zones (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID         NOT NULL,
  geom        GEOGRAPHY(MultiPolygon, 4326) NOT NULL,
  zone_name   TEXT         NOT NULL,
  zone_type   layers."ZoneType" NOT NULL,
  setback_m   DOUBLE PRECISION NOT NULL DEFAULT 500 CHECK (setback_m >= 0),
  legal_basis TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX exclusion_zones_geom_idx
  ON layers.exclusion_zones USING GIST ((geom::geometry));

-- Partial index — most queries filter by active zones
CREATE INDEX exclusion_zones_project_active_idx
  ON layers.exclusion_zones (project_id)
  WHERE is_active = TRUE;

CREATE INDEX exclusion_zones_metadata_idx
  ON layers.exclusion_zones USING GIN (metadata);

COMMENT ON TABLE layers.exclusion_zones IS
  'Project-scoped exclusion zones. Topology rule: Turbine Point Must Not Fall Within ST_Buffer(geom, setback_m).';

-- ─── 3. admin_boundary ────────────────────────────────────────────────────────
-- Administrative hierarchy: Country (1) → State (2) → District (3) → Tehsil (4).
-- Used for revenue zone attribution and project report generation.

CREATE TABLE layers.admin_boundary (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  geom        GEOGRAPHY(MultiPolygon, 4326) NOT NULL,
  name        TEXT         NOT NULL,
  admin_level INTEGER      NOT NULL CHECK (admin_level BETWEEN 1 AND 4),
  code        TEXT,
  parent_id   UUID         REFERENCES layers.admin_boundary(id) ON DELETE RESTRICT,
  area_km2    DOUBLE PRECISION,
  country     TEXT         NOT NULL DEFAULT 'IN',
  state       TEXT,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_boundary_geom_idx
  ON layers.admin_boundary USING GIST ((geom::geometry));

CREATE INDEX admin_boundary_level_idx
  ON layers.admin_boundary (admin_level);

CREATE INDEX admin_boundary_parent_idx
  ON layers.admin_boundary (parent_id)
  WHERE parent_id IS NOT NULL;

-- Enforce that admin_level 1 (country) cannot have a parent
ALTER TABLE layers.admin_boundary
  ADD CONSTRAINT admin_boundary_root_no_parent
    CHECK (admin_level != 1 OR parent_id IS NULL);

COMMENT ON TABLE layers.admin_boundary IS
  'Administrative boundary hierarchy. Topology rule: projectBoundary Must Be Fully Covered By one or more district (admin_level=3) polygons.';

-- ─── Spatial query examples (reference) ──────────────────────────────────────
-- These are run via prisma.$queryRaw in layerQueries.ts

-- 1. Wind resource within project boundary:
--    SELECT id, mean_wind_speed_ms, ST_AsGeoJSON(geom)::json AS geom_json
--    FROM layers.wind_resource
--    WHERE ST_Within(geom::geometry, ST_GeomFromGeoJSON($1));

-- 2. Active exclusion zones within 2 km of a turbine point:
--    SELECT id, zone_name, zone_type, setback_m
--    FROM layers.exclusion_zones
--    WHERE project_id = $1
--      AND is_active = TRUE
--      AND ST_DWithin(geom, ST_MakePoint($2, $3)::geography, 2000);

-- 3. Admin boundary containing a point (district lookup):
--    SELECT id, name, admin_level, state
--    FROM layers.admin_boundary
--    WHERE admin_level = 3
--      AND ST_Contains(geom::geometry, ST_Point($1, $2)::geometry);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION layers.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_wind_resource_updated_at
  BEFORE UPDATE ON layers.wind_resource
  FOR EACH ROW EXECUTE FUNCTION layers.set_updated_at();

CREATE TRIGGER trg_exclusion_zones_updated_at
  BEFORE UPDATE ON layers.exclusion_zones
  FOR EACH ROW EXECUTE FUNCTION layers.set_updated_at();

CREATE TRIGGER trg_admin_boundary_updated_at
  BEFORE UPDATE ON layers.admin_boundary
  FOR EACH ROW EXECUTE FUNCTION layers.set_updated_at();
