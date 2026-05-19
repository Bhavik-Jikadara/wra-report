import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useProjectStore } from '@/store/useProjectStore';
import { bbox, buffer, distance as turfDistance, circle as turfCircle } from '@turf/turf';
import { calculateFeatureMeasurements } from '@/lib/measurements';
import { MapToolbar }      from './MapToolbar';
import { MeasurementPanel } from './MeasurementPanel';
import { RulerPanel }      from './RulerPanel';
import { MapNavControls }  from './MapNavControls';
import { MapStatusBar }    from './MapStatusBar';
import { SidebarPanel }    from './sidebar/SidebarPanel';
import type { RulerMode }  from './RulerPanel';
import type { SavedPlace } from '@/store/useProjectStore';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { logger } from '@/lib/logger';

// ── GIS local-data layer configs ─────────────────────────────────────────────
interface GISLayerConfig {
  url: string;
  geomType: 'polygon' | 'line' | 'point';
  // polygon fields
  fillColor?: string | unknown[];
  lineColor?: string;
  fillOpacity?: number;
  // point / circle fields
  circleColor?: string;
  circleRadius?: number;
  circleStroke?: string;
  // label
  labelField?: string;
  labelMinzoom?: number;
}

const GIS_LOCAL_LAYERS: Partial<Record<string, GISLayerConfig>> = {
  // ── Administrative ─────────────────────────────────────────────────────
  protectedAreas: {
    url: '/layers/administrative/india-protected-areas-sample.geojson',
    geomType: 'polygon',
    fillColor: '#7f1d1d', lineColor: '#dc2626', fillOpacity: 0.22,
    labelField: 'pa_name', labelMinzoom: 7,
  },
  districtBoundaries: {
    url: '/layers/administrative/india-districts-sample.geojson',
    geomType: 'polygon',
    fillColor: 'rgba(29,78,216,0.06)', lineColor: '#3b82f6', fillOpacity: 1,
    labelField: 'district', labelMinzoom: 7,
  },
  revenueVillages: {
    url: '/layers/administrative/india-villages-sample.geojson',
    geomType: 'point',
    circleColor: '#f59e0b', circleRadius: 5, circleStroke: '#ffffff',
    labelField: 'name', labelMinzoom: 9,
  },
  restrictedAirspace: {
    url: '/layers/administrative/india-airspace-sample.geojson',
    geomType: 'polygon',
    fillColor: 'rgba(126,34,206,0.15)', lineColor: '#a855f7', fillOpacity: 1,
    labelField: 'name', labelMinzoom: 8,
  },
  // ── Infrastructure ─────────────────────────────────────────────────────
  powerTransmission: {
    url: '/layers/infrastructure/india-transmission-sample.geojson',
    geomType: 'line',
    lineColor: '#06b6d4',
    labelField: 'name', labelMinzoom: 8,
  },
  gridSubstations: {
    url: '/layers/infrastructure/india-substations-sample.geojson',
    geomType: 'point',
    circleColor: '#fbbf24', circleRadius: 6, circleStroke: '#ffffff',
    labelField: 'name', labelMinzoom: 9,
  },
  // ── Environment ────────────────────────────────────────────────────────
  windResourceGrid: {
    url: '/layers/environment/wind-resource-india-sample.geojson',
    geomType: 'polygon',
    fillColor: ['interpolate', ['linear'], ['get', 'mean_wind_speed_ms'], 5.0, '#93c5fd', 6.5, '#3b82f6', 8.0, '#f97316', 9.5, '#ef4444'],
    lineColor: '#06b6d4', fillOpacity: 0.5,
    labelField: 'region', labelMinzoom: 6,
  },
  floodZones: {
    url: '/layers/environment/india-flood-zones-sample.geojson',
    geomType: 'polygon',
    fillColor: '#1e40af', lineColor: '#3b82f6', fillOpacity: 0.28,
    labelField: 'name', labelMinzoom: 8,
  },
  forestCover: {
    url: '/layers/environment/india-forest-cover-sample.geojson',
    geomType: 'polygon',
    fillColor: '#14532d', lineColor: '#16a34a', fillOpacity: 0.45,
    labelField: 'name', labelMinzoom: 8,
  },
  // ── Socioeconomics ─────────────────────────────────────────────────────
  populationGrid: {
    url: '/layers/socioeconomics/india-population-sample.geojson',
    geomType: 'polygon',
    fillColor: ['interpolate', ['linear'], ['get', 'pop_density_km2'], 100, '#fef9c3', 300, '#fbbf24', 600, '#f97316', 1200, '#dc2626'],
    lineColor: '#78350f', fillOpacity: 0.55,
    labelField: 'region', labelMinzoom: 8,
  },
  noiseReceptors: {
    url: '/layers/socioeconomics/india-noise-receptors-sample.geojson',
    geomType: 'point',
    circleColor: '#ef4444', circleRadius: 6, circleStroke: '#ffffff',
    labelField: 'name', labelMinzoom: 10,
  },
};

// ── Basemap source tile URLs ──────────────────────────────────────────────────
// ESRI sources use {z}/{y}/{x}; OSM uses {z}/{x}/{y}
const TILE_URLS = {
  satellite:    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  streets:      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  hybridLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
};

// ── Turbine pin icon helpers ──────────────────────────────────────────────
const createTurbinePin = (fillColor: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 1C7.4 1 2 6.4 2 13C2 21.5 14 35 14 35C14 35 26 21.5 26 13C26 6.4 20.6 1 14 1Z"
      fill="${fillColor}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="2.2" fill="white"/>
    <line x1="14" y1="13" x2="14"  y2="6.5"  stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="14" y1="13" x2="18.6" y2="16.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="14" y1="13" x2="9.4"  y2="16.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const loadTurbineIcons = (m: maplibregl.Map): Promise<void[]> => {
  const configs = [
    { name: 'turbine-ok',        color: '#1D9E75' },
    { name: 'turbine-warning',   color: '#BA7517' },
    { name: 'turbine-violation', color: '#D85A30' },
    { name: 'turbine-external',  color: '#64748b' },
  ];
  return Promise.all(
    configs.map(({ name, color }) =>
      new Promise<void>((resolve) => {
        const img = new Image(28, 36);
        img.onload  = () => { if (!m.hasImage(name)) m.addImage(name, img); resolve(); };
        img.onerror = () => resolve();
        img.src = createTurbinePin(color);
      })
    )
  );
};

// ── Ruler live-preview GeoJSON builder ────────────────────────────────────
type RulerPt = [number, number];
const rPt = (c: RulerPt) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: c }, properties: {} });

function buildRulerPreview(
  mode: RulerMode,
  points: RulerPt[],
  mousePos: RulerPt | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // placed point markers
  points.forEach((p) =>
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'point' } })
  );

  if (mode === 'line') {
    const start = points[0] ?? null;
    const end   = points[1] ?? mousePos;
    if (start && end) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [start, end] },
        properties: { kind: points[1] ? 'segment' : 'rubber' },
      });
    }
  }

  if (mode === 'path') {
    if (points.length >= 2)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: { kind: 'segment' } });
    if (mousePos && points.length >= 1)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [points[points.length - 1], mousePos] }, properties: { kind: 'rubber' } });
  }

  if (mode === 'polygon') {
    if (points.length >= 2)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: { kind: 'segment' } });
    if (mousePos && points.length >= 1)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [points[points.length - 1], mousePos] }, properties: { kind: 'rubber' } });
    if (mousePos && points.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [mousePos, points[0]] }, properties: { kind: 'rubber' } });
      try {
        const ring = [...points, mousePos, points[0]];
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'fill' } });
      } catch (_) {}
    }
  }

  if (mode === 'circle') {
    const center = points[0] ?? null;
    const edge   = points[1] ?? mousePos;
    if (center && edge) {
      try {
        const radKm = turfDistance(rPt(center), rPt(edge), { units: 'kilometers' });
        if (radKm > 0) {
          const circ = turfCircle(center, radKm, { steps: 64 });
          features.push({ ...circ, properties: { kind: 'fill' } });
          features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: circ.geometry.coordinates[0] }, properties: { kind: 'segment' } });
        }
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [center, edge] }, properties: { kind: 'rubber' } });
      } catch (_) {}
    }
  }

  return { type: 'FeatureCollection', features };
}

// ─────────────────────────────────────────────────────────────────────────────
export function MapEditor() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map          = useRef<maplibregl.Map | null>(null);
  const [lng]      = useState(78.9629);
  const [lat]      = useState(20.5937);
  const [zoom]     = useState(4);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Google Earth-style HUD state
  const [mapBearing,    setMapBearing]    = useState(0);
  const [mapPitch,      setMapPitch]      = useState(0);
  const [mapZoom,       setMapZoom]       = useState(4);
  const [cursorCoords,  setCursorCoords]  = useState<[number, number] | null>(null);

  const {
    projectBoundary, turbines, exclusionZones, externalTurbines, mapFeatures,
    layerVisibility, selectedTurbineId,
    basemap, addSavedPlace,
  } = useProjectStore();

  // Tracks which GIS layers have been fetched + added to the map already
  const gisLoadedRef = useRef<Set<string>>(new Set());

  // draw
  const drawRef           = useRef<any>(null);
  const [activeDrawMode,  setActiveDrawMode]  = useState('simple_select');
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // ruler
  const [isRulerOpen,  setIsRulerOpen]  = useState(false);
  const [rulerMode,    setRulerMode]    = useState<RulerMode>('line');
  const [rulerPoints,  setRulerPoints]  = useState<RulerPt[]>([]);
  const [mouseMapPos,  setMouseMapPos]  = useState<RulerPt | null>(null);

  // sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // ── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          // ESRI sources: free for dev/eval. Commercial use requires ArcGIS Online licence.
          // OSM tiles: © OpenStreetMap contributors, ODbL.
          sources: {
            'bm-satellite': { type: 'raster', tiles: [TILE_URLS.satellite],    tileSize: 256, attribution: '© Esri' },
            'bm-terrain':   { type: 'raster', tiles: [TILE_URLS.terrain],      tileSize: 256, attribution: '© Esri' },
            'bm-streets':   { type: 'raster', tiles: [TILE_URLS.streets],      tileSize: 256, attribution: '© OpenStreetMap contributors' },
            'bm-labels':    { type: 'raster', tiles: [TILE_URLS.hybridLabels], tileSize: 256, attribution: '© Esri' },
          },
          layers: [
            { id: 'bm-satellite-layer', type: 'raster', source: 'bm-satellite', minzoom: 0, maxzoom: 22 },
            { id: 'bm-terrain-layer',   type: 'raster', source: 'bm-terrain',   minzoom: 0, maxzoom: 22, layout: { visibility: 'none' } },
            { id: 'bm-streets-layer',   type: 'raster', source: 'bm-streets',   minzoom: 0, maxzoom: 22, layout: { visibility: 'none' } },
            { id: 'bm-labels-layer',    type: 'raster', source: 'bm-labels',    minzoom: 0, maxzoom: 22, layout: { visibility: 'none' } },
          ],
        },
        center: [lng, lat],
        zoom,
      });

      // HUD event listeners — always active
      map.current.on('rotate',    () => setMapBearing(map.current?.getBearing() ?? 0));
      map.current.on('pitch',     () => setMapPitch(map.current?.getPitch()     ?? 0));
      map.current.on('zoom',      () => setMapZoom(map.current?.getZoom()       ?? 4));
      map.current.on('mousemove', (e) => setCursorCoords([e.lngLat.lng, e.lngLat.lat]));
      map.current.on('mouseout',  () => setCursorCoords(null));

      // Force resize after the first two animation frames so MapLibre picks up the
      // actual flex-computed container dimensions (flex layout settles after first paint).
      requestAnimationFrame(() => requestAnimationFrame(() => map.current?.resize()));

      map.current.on('style.load', () => {
        // Re-measure the container — by the time style.load fires, layout is settled.
        map.current?.resize();
        if (map.current) loadTurbineIcons(map.current).then(() => setMapLoaded(true));

        import('@mapbox/mapbox-gl-draw').then((MapboxDrawModule) => {
          const MapboxDraw = MapboxDrawModule.default;
          const customDrawStyles = [
            { id: 'gl-draw-polygon-fill-inactive',              type: 'fill',   filter: ['all',['==','active','false'],['==','$type','Polygon'],['!=','mode','static']], paint: { 'fill-color': '#3bb2d0', 'fill-outline-color': '#3bb2d0', 'fill-opacity': 0.1 } },
            { id: 'gl-draw-polygon-fill-active',                type: 'fill',   filter: ['all',['==','active','true'], ['==','$type','Polygon']],                       paint: { 'fill-color': '#fbb03b', 'fill-outline-color': '#fbb03b', 'fill-opacity': 0.1 } },
            { id: 'gl-draw-polygon-stroke-inactive',            type: 'line',   filter: ['all',['==','active','false'],['==','$type','Polygon'],['!=','mode','static']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
            { id: 'gl-draw-polygon-stroke-active',              type: 'line',   filter: ['all',['==','active','true'], ['==','$type','Polygon']],                       layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fbb03b', 'line-width': 2, 'line-dasharray': ['literal',[0.2,2]] } },
            { id: 'gl-draw-line-inactive',                      type: 'line',   filter: ['all',['==','active','false'],['==','$type','LineString'],['!=','mode','static']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
            { id: 'gl-draw-line-active',                        type: 'line',   filter: ['all',['==','$type','LineString'],['==','active','true']],                     layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fbb03b', 'line-dasharray': ['literal',[0.2,2]], 'line-width': 2 } },
            { id: 'gl-draw-polygon-and-line-vertex-stroke-inactive', type: 'circle', filter: ['all',['==','meta','vertex'],['==','$type','Point'],['!=','mode','static']], paint: { 'circle-radius': 5, 'circle-color': '#fff' } },
            { id: 'gl-draw-polygon-and-line-vertex-inactive',   type: 'circle', filter: ['all',['==','meta','vertex'],['==','$type','Point'],['!=','mode','static']], paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
            { id: 'gl-draw-point-point-stroke-inactive',        type: 'circle', filter: ['all',['==','active','false'],['==','$type','Point'],['==','meta','feature'],['!=','mode','static']], paint: { 'circle-radius': 5, 'circle-opacity': 1, 'circle-color': '#fff' } },
            { id: 'gl-draw-point-inactive',                     type: 'circle', filter: ['all',['==','active','false'],['==','$type','Point'],['==','meta','feature'],['!=','mode','static']], paint: { 'circle-radius': 3, 'circle-color': '#3bb2d0' } },
            { id: 'gl-draw-point-stroke-active',                type: 'circle', filter: ['all',['==','$type','Point'],['==','active','true'],['!=','meta','midpoint']], paint: { 'circle-radius': 7, 'circle-color': '#fff' } },
            { id: 'gl-draw-point-active',                       type: 'circle', filter: ['all',['==','$type','Point'],['!=','meta','midpoint'],['==','active','true']], paint: { 'circle-radius': 5, 'circle-color': '#fbb03b' } },
            { id: 'gl-draw-polygon-midpoint',                   type: 'circle', filter: ['all',['==','$type','Point'],['==','meta','midpoint']], paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
          ];
          const draw = new MapboxDraw({ displayControlsDefault: false, userProperties: true, modes: MapboxDraw.modes as any, styles: customDrawStyles });
          drawRef.current = draw;
          map.current?.addControl(draw as any, 'top-left');
          const updateSel = () => {
            const sel = draw.getSelected();
            setSelectedFeature(sel?.features.length > 0 ? sel.features[0] : null);
          };
          map.current?.on('draw.create', updateSel);
          map.current?.on('draw.delete', updateSel);
          map.current?.on('draw.update', updateSel);
          map.current?.on('draw.selectionchange', updateSel);
          map.current?.on('draw.modechange', (e: any) => setActiveDrawMode(e.mode));
        });
      });
    } catch (e) { logger.error('Map init failed', e); }
  }, []);

  // ── Boundary ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    if (projectBoundary) {
      if (!m.getSource('project-boundary-source')) {
        m.addSource('project-boundary-source', { type: 'geojson', data: projectBoundary });
        m.addLayer({ id: 'project-boundary-fill', type: 'fill',   source: 'project-boundary-source', paint: { 'fill-color': '#1D9E75', 'fill-opacity': 0.12 } });
        m.addLayer({ id: 'project-boundary-line', type: 'line',   source: 'project-boundary-source', paint: { 'line-color': '#1D9E75', 'line-width': 2 } });
      } else {
        (m.getSource('project-boundary-source') as maplibregl.GeoJSONSource).setData(projectBoundary);
      }
      try { m.fitBounds(bbox(projectBoundary) as [number,number,number,number], { padding: 50, maxZoom: 16 }); } catch (_) {}
    } else {
      if (m.getSource('project-boundary-source'))
        (m.getSource('project-boundary-source') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      if (drawRef.current) { drawRef.current.deleteAll(); setSelectedFeature(null); }
    }
  }, [projectBoundary, mapLoaded]);

  // ── Turbines (pin icons) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: turbines.map((t) => ({ type: 'Feature', properties: { id: t.id, status: t.spacingStatus }, geometry: { type: 'Point', coordinates: [t.lng, t.lat] } })),
    };
    if (!m.getSource('turbines-source')) {
      m.addSource('turbines-source', { type: 'geojson', data: fc });
      m.addLayer({
        id: 'turbines-points', type: 'symbol', source: 'turbines-source',
        layout: {
          'icon-image': ['match',['get','status'],'violation','turbine-violation','warning','turbine-warning','turbine-ok'] as any,
          'icon-size': 1, 'icon-allow-overlap': true, 'icon-anchor': 'bottom',
          'text-field': ['get', 'id'], 'text-offset': [0, 0.4], 'text-size': 11,
          'text-allow-overlap': false, 'text-optional': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 },
      });
    } else {
      (m.getSource('turbines-source') as maplibregl.GeoJSONSource).setData(fc);
    }
  }, [turbines, mapLoaded]);

  // ── External Turbines ────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: externalTurbines.map((t) => ({ type: 'Feature', properties: { id: t.id }, geometry: { type: 'Point', coordinates: [t.lng, t.lat] } })),
    };
    if (!m.getSource('external-turbines-source')) {
      m.addSource('external-turbines-source', { type: 'geojson', data: fc });
      m.addLayer({ id: 'external-turbines-points', type: 'symbol', source: 'external-turbines-source', layout: { 'icon-image': 'turbine-external', 'icon-size': 0.85, 'icon-allow-overlap': true, 'icon-anchor': 'bottom' } as any, paint: { 'icon-opacity': 0.7 } });
    } else {
      (m.getSource('external-turbines-source') as maplibregl.GeoJSONSource).setData(fc);
    }
  }, [externalTurbines, mapLoaded]);

  // ── Exclusion Zones ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    if (exclusionZones) {
      if (!m.getSource('exclusion-zones-source')) {
        m.addSource('exclusion-zones-source', { type: 'geojson', data: exclusionZones });
        m.addLayer({ id: 'exclusion-zones-fill', type: 'fill', source: 'exclusion-zones-source', paint: { 'fill-color': '#D85A30', 'fill-opacity': 0.15 } });
        m.addLayer({ id: 'exclusion-zones-line', type: 'line', source: 'exclusion-zones-source', paint: { 'line-color': '#D85A30', 'line-width': 2, 'line-dasharray': [2, 2] } });
      } else {
        (m.getSource('exclusion-zones-source') as maplibregl.GeoJSONSource).setData(exclusionZones);
      }
    } else if (m.getSource('exclusion-zones-source')) {
      (m.getSource('exclusion-zones-source') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
    }
  }, [exclusionZones, mapLoaded]);

  // ── Map Features ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    if (mapFeatures) {
      if (!m.getSource('map-features-source')) {
        m.addSource('map-features-source', { type: 'geojson', data: mapFeatures });
        // Polygon fill (water blue, dwelling red)
        m.addLayer({ id: 'map-features-fill', type: 'fill', source: 'map-features-source', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['match',['get','type'],'water','#3b82f6','dwelling','#ef4444','#8b5cf6'], 'fill-opacity': 0.25 } });
        // Polygon + LineString outline
        m.addLayer({ id: 'map-features-line', type: 'line', source: 'map-features-source', filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], paint: { 'line-color': ['match',['get','type'],'water','#3b82f6','dwelling','#ef4444','#8b5cf6'], 'line-width': 1.5 } });
        // Point features (village/settlement nodes)
        m.addLayer({ id: 'map-features-point', type: 'circle', source: 'map-features-source', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': ['match',['get','type'],'dwelling','#ef4444','#8b5cf6'], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.85 } });
        // Point labels
        m.addLayer({ id: 'map-features-label', type: 'symbol', source: 'map-features-source', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 } });
      } else {
        (m.getSource('map-features-source') as maplibregl.GeoJSONSource).setData(mapFeatures);
      }
    } else if (m.getSource('map-features-source')) {
      (m.getSource('map-features-source') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
    }
  }, [mapFeatures, mapLoaded]);

  // ── Setback Buffer Zones ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const bufs: GeoJSON.Feature[] = [];
    mapFeatures?.features.forEach((f) => {
      try {
        const type = (f.properties as any)?.type as string | undefined;
        const km = type === 'dwelling' ? 0.5 : type === 'water' ? 0.5 : null;
        if (!km) return;
        const b = buffer(f as any, km, { units: 'kilometers' });
        if (b) bufs.push({ ...b, properties: { ...(b.properties ?? {}), featureType: type } });
      } catch (_) {}
    });
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: bufs };
    if (!m.getSource('setback-buffer-source')) {
      m.addSource('setback-buffer-source', { type: 'geojson', data: fc });
      m.addLayer({ id: 'setback-buffer-fill', type: 'fill', source: 'setback-buffer-source', paint: { 'fill-color': ['match',['get','featureType'],'dwelling','#ef4444','#3b82f6'], 'fill-opacity': 0.07 } });
      m.addLayer({ id: 'setback-buffer-line', type: 'line', source: 'setback-buffer-source', paint: { 'line-color': ['match',['get','featureType'],'dwelling','#ef4444','#3b82f6'], 'line-width': 1.5, 'line-dasharray': [4, 3] } });
    } else {
      (m.getSource('setback-buffer-source') as maplibregl.GeoJSONSource).setData(fc);
    }
  }, [mapFeatures, mapLoaded]);

  // ── Basemap switching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const BASEMAP_VISIBLE: Record<string, string[]> = {
      satellite: ['bm-satellite-layer'],
      hybrid:    ['bm-satellite-layer', 'bm-labels-layer'],
      streets:   ['bm-streets-layer'],
      terrain:   ['bm-terrain-layer'],
    };
    const ALL = ['bm-satellite-layer', 'bm-terrain-layer', 'bm-streets-layer', 'bm-labels-layer'];
    ALL.forEach(id => { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'none'); });
    (BASEMAP_VISIBLE[basemap] ?? BASEMAP_VISIBLE.satellite).forEach(id => {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'visible');
    });
  }, [basemap, mapLoaded]);

  // ── GIS layer lazy loading ────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    for (const [key, cfg] of Object.entries(GIS_LOCAL_LAYERS)) {
      if (!cfg) continue;
      const visible   = (layerVisibility as Record<string, boolean>)[key] ?? false;
      const sourceId  = `gis-${key}-source`;
      const primaryId = `gis-${key}-primary`;   // fill | line | circle
      const lineId    = `gis-${key}-line`;       // outline for polygons only
      const labelId   = `gis-${key}-label`;

      if (visible && !gisLoadedRef.current.has(key)) {
        const { url, geomType, fillColor, lineColor, fillOpacity, circleColor, circleRadius, circleStroke, labelField, labelMinzoom } = cfg;
        fetch(url)
          .then(r => r.json())
          .then((data: GeoJSON.FeatureCollection) => {
            if (!map.current || m.getSource(sourceId)) return;
            m.addSource(sourceId, { type: 'geojson', data });

            if (geomType === 'polygon') {
              m.addLayer({ id: primaryId, type: 'fill', source: sourceId, paint: { 'fill-color': (fillColor ?? '#888') as maplibregl.ExpressionSpecification, 'fill-opacity': fillOpacity ?? 0.3 } });
              m.addLayer({ id: lineId,    type: 'line', source: sourceId, paint: { 'line-color': lineColor ?? '#fff', 'line-width': 1.5 } });
            } else if (geomType === 'line') {
              m.addLayer({ id: primaryId, type: 'line', source: sourceId, paint: { 'line-color': lineColor ?? '#06b6d4', 'line-width': 2 } });
            } else if (geomType === 'point') {
              m.addLayer({ id: primaryId, type: 'circle', source: sourceId, paint: { 'circle-color': circleColor ?? '#f59e0b', 'circle-radius': circleRadius ?? 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': circleStroke ?? '#fff' } });
            }

            if (labelField) {
              m.addLayer({
                id: labelId, type: 'symbol', source: sourceId,
                minzoom: labelMinzoom ?? 7,
                layout: { 'text-field': ['get', labelField] as maplibregl.ExpressionSpecification, 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
                paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 },
              });
            }
            gisLoadedRef.current.add(key);
          })
          .catch(e => logger.error(`GIS layer load failed: ${key}`, e));

      } else if (m.getLayer(primaryId)) {
        const v = visible ? 'visible' : 'none';
        m.setLayoutProperty(primaryId, 'visibility', v);
        if (m.getLayer(lineId))  m.setLayoutProperty(lineId,  'visibility', v);
        if (m.getLayer(labelId)) m.setLayoutProperty(labelId, 'visibility', v);
      }
    }
  }, [layerVisibility, mapLoaded]);

  // ── Container resize observer (handles sidebar collapse / window resize) ──
  useEffect(() => {
    if (!mapContainer.current) return;
    const ro = new ResizeObserver(() => { map.current?.resize(); });
    ro.observe(mapContainer.current);
    return () => ro.disconnect();
  }, []);

  // ── Ruler: mouse + click capture ─────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const canvas = m.getCanvas();

    if (!isRulerOpen) {
      canvas.style.cursor = '';
      return;
    }
    canvas.style.cursor = 'crosshair';

    const onMove  = (e: maplibregl.MapMouseEvent) => setMouseMapPos([e.lngLat.lng, e.lngLat.lat]);
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const pt: RulerPt = [e.lngLat.lng, e.lngLat.lat];
      setRulerPoints((prev) => {
        if (rulerMode === 'line')   return prev.length < 2  ? [...prev, pt] : [prev[0], pt];
        if (rulerMode === 'circle') return prev.length === 0 ? [pt] : [prev[0], pt];
        return [...prev, pt];
      });
    };

    m.on('mousemove', onMove);
    m.on('click',     onClick);
    return () => {
      m.off('mousemove', onMove);
      m.off('click',     onClick);
      canvas.style.cursor = '';
    };
  }, [mapLoaded, isRulerOpen, rulerMode]);

  // ── Ruler: live preview layer ─────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const preview = isRulerOpen
      ? buildRulerPreview(rulerMode, rulerPoints, mouseMapPos)
      : ({ type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection);

    if (!m.getSource('ruler-preview')) {
      m.addSource('ruler-preview', { type: 'geojson', data: preview });
      // fill for polygon / circle
      m.addLayer({ id: 'ruler-fill',    type: 'fill',   source: 'ruler-preview', filter: ['==', ['get', 'kind'], 'fill'],    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 } });
      // solid placed segments + circle ring
      m.addLayer({ id: 'ruler-segment', type: 'line',   source: 'ruler-preview', filter: ['==', ['get', 'kind'], 'segment'], paint: { 'line-color': '#3b82f6', 'line-width': 2 } });
      // rubber-band dashed
      m.addLayer({
        id: 'ruler-rubber', type: 'line', source: 'ruler-preview', filter: ['==', ['get', 'kind'], 'rubber'],
        paint: { 'line-color': '#f59e0b', 'line-width': 1.5, 'line-dasharray': [4, 3] },
      });
      // point markers
      m.addLayer({ id: 'ruler-points', type: 'circle', source: 'ruler-preview', filter: ['==', ['get', 'kind'], 'point'], paint: { 'circle-radius': 5, 'circle-color': '#3b82f6', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    } else {
      (m.getSource('ruler-preview') as maplibregl.GeoJSONSource).setData(preview);
    }
  }, [mapLoaded, isRulerOpen, rulerMode, rulerPoints, mouseMapPos]);

  // ── Draw handlers ─────────────────────────────────────────────────────────
  const handleSetMode = (mode: string) => {
    if (isRulerOpen) handleRulerClose(); // close ruler when draw tool selected
    if (drawRef.current) { drawRef.current.changeMode(mode); setActiveDrawMode(mode); }
  };

  const handleClearDrawing = () => { if (drawRef.current) { drawRef.current.deleteAll(); setSelectedFeature(null); } };

  const handleSetBoundary  = (f: any) => { const { setProjectBoundary } = useProjectStore.getState(); setProjectBoundary({ type: 'FeatureCollection', features: [f] }); handleClearDrawing(); import('sonner').then((m) => m.toast.success('Project boundary updated')); };
  const handleSetExclusion = (f: any) => { const { exclusionZones, setExclusionZones } = useProjectStore.getState(); setExclusionZones({ type: 'FeatureCollection', features: [...(exclusionZones?.features ?? []), f] }); handleClearDrawing(); import('sonner').then((m) => m.toast.success('Exclusion zone added')); };
  const handleSetFeature   = (f: any, type: string) => { const { mapFeatures, setMapFeatures } = useProjectStore.getState(); setMapFeatures({ type: 'FeatureCollection', features: [...(mapFeatures?.features ?? []), { ...f, properties: { ...f.properties, type } }] }); handleClearDrawing(); import('sonner').then((m) => m.toast.success(`${type[0].toUpperCase() + type.slice(1)} feature added`)); };

  // ── Ruler handlers ────────────────────────────────────────────────────────
  const handleOpenRuler  = (mode: RulerMode) => {
    if (isRulerOpen && rulerMode === mode) { setIsRulerOpen(false); setRulerPoints([]); return; }
    setRulerMode(mode);
    setRulerPoints([]);
    setIsRulerOpen(true);
  };
  const handleRulerClose = () => { setIsRulerOpen(false); setRulerPoints([]); };
  const handleRulerModeChange = (mode: RulerMode) => { setRulerMode(mode); setRulerPoints([]); };
  const handleRulerClear      = () => setRulerPoints([]);

  // ── My Places helpers ─────────────────────────────────────────────────────
  const handleSavePlace = (name: string, folderId: string = 'general') => {
    if (!map.current) return;
    const c = map.current.getCenter();
    addSavedPlace({
      name, folderId,
      center:  [c.lng, c.lat],
      zoom:    map.current.getZoom(),
      bearing: map.current.getBearing(),
      pitch:   map.current.getPitch(),
    });
  };

  const handleQuickSavePlace = () => {
    if (!map.current) return;
    const c = map.current.getCenter();
    const name = `View ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    addSavedPlace({ name, folderId: 'general', center: [c.lng, c.lat], zoom: map.current.getZoom(), bearing: map.current.getBearing(), pitch: map.current.getPitch() });
    import('sonner').then(m => m.toast.success(`Saved "${name}" to My Places`));
  };

  const handleFlyToPlace = (place: SavedPlace) => {
    if (!map.current) return;
    map.current.flyTo({ center: place.center, zoom: place.zoom, bearing: place.bearing, pitch: place.pitch, speed: 1.5, essential: true });
  };

  // ── Nav controls helpers ──────────────────────────────────────────────────
  const handleFlyToCoords = (lng: number, lat: number, z = 12) => {
    map.current?.flyTo({ center: [lng, lat], zoom: z, speed: 1.5, essential: true });
  };

  const handleZoomIn = () => {
    if (!map.current) return;
    map.current.zoomIn({ duration: 250 });
  };
  const handleZoomOut = () => {
    if (!map.current) return;
    map.current.zoomOut({ duration: 250 });
  };
  const handleResetNorth = () => {
    map.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 });
  };
  const handleFlyToProject = () => {
    if (!map.current || !projectBoundary) return;
    try {
      map.current.fitBounds(
        bbox(projectBoundary) as [number, number, number, number],
        { padding: 60, maxZoom: 16, duration: 800 },
      );
    } catch (_) {}
  };

  // ── Fly to selected turbine ───────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedTurbineId) return;
    const turbine = turbines.find(t => t.id === selectedTurbineId);
    if (turbine) {
      map.current.flyTo({ center: [turbine.lng, turbine.lat], zoom: 15, speed: 1.2, essential: true });
    }
    useProjectStore.getState().setSelectedTurbineId(null);
  }, [selectedTurbineId, turbines, mapLoaded]);

  // ── Layer visibility sync → MapLibre ──────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const vis = (on: boolean) => on ? 'visible' : 'none';

    // Boundary
    if (m.getLayer('project-boundary-fill')) m.setLayoutProperty('project-boundary-fill', 'visibility', vis(layerVisibility.boundary));
    if (m.getLayer('project-boundary-line')) m.setLayoutProperty('project-boundary-line', 'visibility', vis(layerVisibility.boundary));

    // Turbines
    if (m.getLayer('turbines-points')) m.setLayoutProperty('turbines-points', 'visibility', vis(layerVisibility.turbines));

    // External turbines
    if (m.getLayer('external-turbines-points')) m.setLayoutProperty('external-turbines-points', 'visibility', vis(layerVisibility.externalTurbines));

    // Exclusion zones
    if (m.getLayer('exclusion-zones-fill')) m.setLayoutProperty('exclusion-zones-fill', 'visibility', vis(layerVisibility.exclusionZones));
    if (m.getLayer('exclusion-zones-line')) m.setLayoutProperty('exclusion-zones-line', 'visibility', vis(layerVisibility.exclusionZones));

    // Map features — filter by which types are toggled on
    const visibleTypes: string[] = [];
    if (layerVisibility.water)     visibleTypes.push('water');
    if (layerVisibility.dwellings) visibleTypes.push('dwelling');
    if (layerVisibility.roads)     visibleTypes.push('road');
    if (layerVisibility.railways)  visibleTypes.push('railway');
    if (layerVisibility.ehvLines)  visibleTypes.push('ehv_line');

    const typeFilter: any = visibleTypes.length > 0
      ? ['in', ['get', 'type'], ['literal', visibleTypes]]
      : ['==', ['literal', false], ['literal', true]]; // never match → hides all

    if (m.getLayer('map-features-fill'))
      m.setFilter('map-features-fill',  ['all', ['==', ['geometry-type'], 'Polygon'], typeFilter]);
    if (m.getLayer('map-features-line'))
      m.setFilter('map-features-line',  ['all', ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], typeFilter]);
    if (m.getLayer('map-features-point'))
      m.setFilter('map-features-point', ['all', ['==', ['geometry-type'], 'Point'], typeFilter]);
    if (m.getLayer('map-features-label'))
      m.setFilter('map-features-label', ['all', ['==', ['geometry-type'], 'Point'], typeFilter]);

    // Setback buffers
    if (m.getLayer('setback-buffer-fill')) m.setLayoutProperty('setback-buffer-fill', 'visibility', vis(layerVisibility.setbackBuffers));
    if (m.getLayer('setback-buffer-line')) m.setLayoutProperty('setback-buffer-line', 'visibility', vis(layerVisibility.setbackBuffers));
  }, [layerVisibility, mapLoaded]);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0d1117]">

      {/* ── Google Earth-style top toolbar ── */}
      <MapToolbar
        activeMode={activeDrawMode}
        onSetMode={handleSetMode}
        isRulerOpen={isRulerOpen}
        rulerMode={rulerMode}
        onOpenRuler={handleOpenRuler}
        onSavePlace={handleQuickSavePlace}
        onFlyToProject={handleFlyToProject}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
      />

      {/* ── Main area: sidebar + map ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Google Earth-style left sidebar ── */}
        <SidebarPanel
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          onFlyToCoords={handleFlyToCoords}
          onFlyToPlace={handleFlyToPlace}
          onSavePlace={handleSavePlace}
        />

        {/* ── Map area ── */}
        <div className="flex-1 relative min-w-0 min-h-0">
          {/* MapLibre canvas */}
          <div ref={mapContainer} className="w-full h-full" />

          {/* Ruler panel */}
          {isRulerOpen && (
            <RulerPanel
              mode={rulerMode}
              points={rulerPoints}
              mousePos={mouseMapPos}
              onModeChange={handleRulerModeChange}
              onClear={handleRulerClear}
              onClose={handleRulerClose}
            />
          )}

          {/* Measurement panel */}
          {selectedFeature && !isRulerOpen && (
            <MeasurementPanelWrapper
              feature={selectedFeature}
              onClear={handleClearDrawing}
              onSetBoundary={() => handleSetBoundary(selectedFeature)}
              onSetExclusion={() => handleSetExclusion(selectedFeature)}
              onSetFeature={(type) => handleSetFeature(selectedFeature, type)}
            />
          )}

          {/* Navigation controls — top-right of map */}
          <MapNavControls
            bearing={mapBearing}
            pitch={mapPitch}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetNorth={handleResetNorth}
            onFlyToProject={handleFlyToProject}
          />

          {/* Status bar — bottom of map */}
          <MapStatusBar
            cursorCoords={cursorCoords}
            zoom={mapZoom}
            bearing={mapBearing}
            pitch={mapPitch}
          />
        </div>
      </div>
    </div>
  );
}

// ── MeasurementPanelWrapper ───────────────────────────────────────────────────
function MeasurementPanelWrapper({ feature, onClear, onSetBoundary, onSetExclusion, onSetFeature }: {
  feature: any; onClear: () => void; onSetBoundary: () => void; onSetExclusion: () => void; onSetFeature: (t: string) => void;
}) {
  const { perimeterMeters, areaSqMeters, radiusMeters } = calculateFeatureMeasurements(feature);
  return (
    <MeasurementPanel
      perimeterMeters={perimeterMeters} areaSqMeters={areaSqMeters} radiusMeters={radiusMeters}
      featureType={feature.geometry.type}
      onClear={onClear} onSetBoundary={onSetBoundary} onSetExclusion={onSetExclusion} onSetFeature={onSetFeature}
    />
  );
}
