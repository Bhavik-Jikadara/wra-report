/**
 * src/lib/rasterService.ts — RasterLayerLoader (Context C: Cloud COG)
 *
 * Manages Cloud-Optimised GeoTIFF (COG) raster layers in MapLibre GL JS:
 *   • Terrain DEM  → raster-dem source + map.setTerrain() for 3D elevation
 *   • Wind resource → raster source with viridis-style colour ramp
 *   • Hillshade    → derived from DEM, rendered beneath vector layers
 *
 * COG hosting options:
 *   AWS:   S3 bucket (static website hosting) + CloudFront CDN
 *          URL pattern: https://<distro>.cloudfront.net/cog/dtm-india-30m.tif
 *          Tile pattern (via TiTiler): https://tiles.windfarm.io/cog/tiles/{z}/{x}/{y}
 *                                     ?url=s3://bucket/dtm-india-30m.tif
 *
 *   Azure: Blob Storage (public container) + Azure CDN
 *          URL pattern: https://<account>.blob.core.windows.net/<container>/dtm-india-30m.tif
 *
 * DEM encoding requirements for raster-dem source:
 *   • Mapbox encoding:   R=((elev+10000)*10)>>16, G=((elev+10000)*10)>>8 & 0xff, B=...
 *   • Terrarium encoding: R=floor((elev+32768)/256), G=(elev+32768)%256, B=frac*256
 *   Use rio-cogeo + rio-tiler (Python) or gdal2tiles to pre-process raw DEMs.
 */

import type maplibregl from 'maplibre-gl';
import type { WindRasterConfig, TerrainConfig } from '@/types/gis';

// ─── Source / layer ID constants ──────────────────────────────────────────────

const IDS = {
  terrainSource:      'terrain-dem-source',
  hillshadeLayer:     'terrain-hillshade-layer',
  windRasterSource:   'wind-resource-raster-source',
  windRasterLayer:    'wind-resource-raster-layer',
  windLegendSource:   'wind-resource-legend-source',
} as const;

// ─── Default configs ──────────────────────────────────────────────────────────

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  cogUrl:        'https://cdn.windfarm.io/cog/srtm-india-30m-terrarium.tif',
  encoding:      'terrarium',
  tileSize:      512,
  exaggeration:  1.3,
  showHillshade: true,
};

export const DEFAULT_WIND_RASTER_CONFIG: WindRasterConfig = {
  tilesUrl:        'https://tiles.windfarm.io/cog/tiles/{z}/{x}/{y}.png?url=s3://wf-rasters/niwe-wind-100m.tif&rescale=4,12&colormap_name=RdYlGn',
  minWindSpeedMs:  4,
  maxWindSpeedMs:  12,
  colorRamp:       ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'],
  opacity:         0.65,
  attribution:     '© NIWE Wind Atlas 2023',
};

// ─── RasterLayerLoader class ──────────────────────────────────────────────────

export class RasterLayerLoader {
  private map: maplibregl.Map;
  private _terrainLoaded    = false;
  private _windRasterLoaded = false;

  constructor(map: maplibregl.Map) {
    this.map = map;
  }

  // ── Terrain (raster-dem) ────────────────────────────────────────────────────

  /**
   * Add a DEM raster-dem source and optionally enable 3D terrain + hillshade.
   *
   * MapLibre source config equivalent:
   * ```json
   * { "type": "raster-dem", "url": "...", "tileSize": 512, "encoding": "terrarium" }
   * ```
   *
   * @param config  TerrainConfig (URL, encoding, exaggeration, hillshade flag)
   */
  addTerrain(config: TerrainConfig = DEFAULT_TERRAIN_CONFIG): void {
    if (this.map.getSource(IDS.terrainSource)) return;

    this.map.addSource(IDS.terrainSource, {
      type:     'raster-dem',
      url:      config.cogUrl,
      tileSize: config.tileSize,
      encoding: config.encoding,
    });

    this.map.setTerrain({
      source:        IDS.terrainSource,
      exaggeration:  config.exaggeration,
    });

    if (config.showHillshade) {
      this._addHillshadeLayer();
    }

    this._terrainLoaded = true;
  }

  /**
   * Remove terrain + hillshade and reset map to flat 2D view.
   */
  removeTerrain(): void {
    this.map.setTerrain(null);

    if (this.map.getLayer(IDS.hillshadeLayer)) {
      this.map.removeLayer(IDS.hillshadeLayer);
    }
    if (this.map.getSource(IDS.terrainSource)) {
      this.map.removeSource(IDS.terrainSource);
    }

    this._terrainLoaded = false;
  }

  /**
   * Toggle 3D terrain on/off without removing the source (cheaper than reload).
   */
  setTerrainEnabled(enabled: boolean): void {
    if (!this.map.getSource(IDS.terrainSource)) return;
    this.map.setTerrain(
      enabled
        ? { source: IDS.terrainSource, exaggeration: DEFAULT_TERRAIN_CONFIG.exaggeration }
        : null
    );
  }

  /**
   * Adjust vertical exaggeration in real-time (range 0.5 – 3.0).
   * 1.0 = real-world scale, 1.5 = recommended for Indian terrain, 3.0 = dramatic.
   */
  setTerrainExaggeration(exaggeration: number): void {
    if (!this.map.getSource(IDS.terrainSource)) return;
    this.map.setTerrain({ source: IDS.terrainSource, exaggeration });
  }

  /** Show/hide the hillshade layer without removing the terrain source. */
  setHillshadeVisible(visible: boolean): void {
    if (!this.map.getLayer(IDS.hillshadeLayer)) return;
    this.map.setLayoutProperty(
      IDS.hillshadeLayer,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }

  // ── Wind Resource Raster ────────────────────────────────────────────────────

  /**
   * Add a wind resource raster overlay from a COG tile server.
   *
   * The tile URL should be a TiTiler/rio-tiler endpoint that:
   *   1. Reads the COG from S3 / Blob Storage
   *   2. Rescales the band data to [minWindSpeedMs, maxWindSpeedMs]
   *   3. Applies the requested colormap_name
   *   4. Returns PNG tiles
   *
   * MapLibre source config equivalent:
   * ```json
   * { "type": "raster", "tiles": ["<tilesUrl>"], "tileSize": 256 }
   * ```
   *
   * @param config  WindRasterConfig
   * @param belowLayerId  Insert this layer below a specific MapLibre layer ID
   *                      (defaults to first symbol layer so labels remain on top)
   */
  addWindRaster(
    config: WindRasterConfig = DEFAULT_WIND_RASTER_CONFIG,
    belowLayerId?: string
  ): void {
    if (this.map.getSource(IDS.windRasterSource)) {
      this.updateWindRasterOpacity(config.opacity);
      return;
    }

    this.map.addSource(IDS.windRasterSource, {
      type:        'raster',
      tiles:       [config.tilesUrl],
      tileSize:    256,
      minzoom:     4,
      maxzoom:     12,
      attribution: config.attribution ?? '',
    });

    const insertBefore = belowLayerId ?? this._firstSymbolLayerId();

    this.map.addLayer(
      {
        id:     IDS.windRasterLayer,
        type:   'raster',
        source: IDS.windRasterSource,
        paint: {
          'raster-opacity':     config.opacity,
          'raster-resampling':  'linear',
          'raster-fade-duration': 300,
        },
        layout: { visibility: 'visible' },
      },
      insertBefore
    );

    this._windRasterLoaded = true;
  }

  /** Remove the wind resource raster overlay. */
  removeWindRaster(): void {
    if (this.map.getLayer(IDS.windRasterLayer))  this.map.removeLayer(IDS.windRasterLayer);
    if (this.map.getSource(IDS.windRasterSource)) this.map.removeSource(IDS.windRasterSource);
    this._windRasterLoaded = false;
  }

  /** Adjust wind raster opacity (0–1) without reloading. */
  updateWindRasterOpacity(opacity: number): void {
    if (!this.map.getLayer(IDS.windRasterLayer)) return;
    this.map.setPaintProperty(IDS.windRasterLayer, 'raster-opacity', opacity);
  }

  /** Toggle wind raster visibility. */
  setWindRasterVisible(visible: boolean): void {
    if (!this.map.getLayer(IDS.windRasterLayer)) return;
    this.map.setLayoutProperty(
      IDS.windRasterLayer,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }

  // ── State accessors ─────────────────────────────────────────────────────────

  get isTerrainLoaded():    boolean { return this._terrainLoaded; }
  get isWindRasterLoaded(): boolean { return this._windRasterLoaded; }

  /** Clean up all raster sources and layers — call on component unmount. */
  dispose(): void {
    this.removeWindRaster();
    this.removeTerrain();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _addHillshadeLayer(): void {
    if (this.map.getLayer(IDS.hillshadeLayer)) return;

    const insertBefore = this._firstSymbolLayerId();

    this.map.addLayer(
      {
        id:     IDS.hillshadeLayer,
        type:   'hillshade',
        source: IDS.terrainSource,
        paint: {
          'hillshade-exaggeration':          0.45,
          'hillshade-shadow-color':          '#2d1b0e',
          'hillshade-highlight-color':       '#ffffff',
          'hillshade-accent-color':          '#c8a96e',
          'hillshade-illumination-direction': 315,
          'hillshade-illumination-anchor':    'viewport',
        },
        layout: { visibility: 'visible' },
      },
      insertBefore
    );
  }

  /** Returns the id of the first symbol (label) layer so rasters stay beneath labels. */
  private _firstSymbolLayerId(): string | undefined {
    const layers = this.map.getStyle()?.layers ?? [];
    return layers.find(l => l.type === 'symbol')?.id;
  }
}

// ─── Standalone helpers (no class instance required) ─────────────────────────

/**
 * Build a TiTiler tile URL for a COG stored on S3 or Azure Blob.
 * TiTiler docs: https://developmentseed.org/titiler/
 *
 * @param tilerBase   TiTiler endpoint, e.g. 'https://tiles.windfarm.io'
 * @param cogUrl      Full S3 / blob URL, e.g. 's3://bucket/wind-100m.tif'
 * @param options     Colormap, rescale range, band index, output format
 */
export function buildTiTilerUrl(
  tilerBase: string,
  cogUrl: string,
  options: {
    colormapName?: string;
    rescale?:     [number, number];
    bandIndex?:   number;
    format?:      'png' | 'webp' | 'jpg';
  } = {}
): string {
  const { colormapName = 'RdYlGn', rescale = [4, 12], bandIndex = 1, format = 'png' } = options;
  const params = new URLSearchParams({
    url:             cogUrl,
    colormap_name:   colormapName,
    rescale:         rescale.join(','),
    bidx:            String(bandIndex),
  });
  return `${tilerBase}/cog/tiles/{z}/{x}/{y}.${format}?${params}`;
}

/**
 * Build a MapLibre raster source configuration for Context C (COG).
 * Pass the returned object directly to map.addSource(id, config).
 */
export function buildCOGRasterSourceConfig(
  tilesUrl: string,
  options: {
    tileSize?:   256 | 512;
    minzoom?:    number;
    maxzoom?:    number;
    attribution?: string;
  } = {}
): maplibregl.RasterSourceSpecification {
  return {
    type:        'raster',
    tiles:       [tilesUrl],
    tileSize:    options.tileSize ?? 256,
    minzoom:     options.minzoom  ?? 4,
    maxzoom:     options.maxzoom  ?? 12,
    attribution: options.attribution ?? '',
  };
}

/**
 * Build a MapLibre raster-dem source configuration for Context C (terrain COG).
 * Pass to map.addSource(id, config), then call map.setTerrain({ source: id }).
 */
export function buildTerrainSourceConfig(
  cogUrl: string,
  encoding: 'mapbox' | 'terrarium' = 'terrarium',
  tileSize: 256 | 512 = 512
): maplibregl.RasterDEMSourceSpecification {
  return {
    type:     'raster-dem',
    url:      cogUrl,
    tileSize,
    encoding,
  };
}
