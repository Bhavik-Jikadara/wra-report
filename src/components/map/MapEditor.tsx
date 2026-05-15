import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useProjectStore } from '@/store/useProjectStore';
import { bbox, buffer, distance as turfDistance, circle as turfCircle } from '@turf/turf';
import { calculateFeatureMeasurements } from '@/lib/measurements';
import { DrawToolbar } from './DrawToolbar';
import { MeasurementPanel } from './MeasurementPanel';
import { RulerPanel } from './RulerPanel';
import { LayersPanel } from './LayersPanel';
import type { RulerMode } from './RulerPanel';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { logger } from '@/lib/logger';

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

  const {
    projectBoundary, turbines, exclusionZones, externalTurbines, mapFeatures,
    layerVisibility, selectedTurbineId,
  } = useProjectStore();

  // draw
  const drawRef           = useRef<any>(null);
  const [activeDrawMode,  setActiveDrawMode]  = useState('simple_select');
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // ruler
  const [isRulerOpen,  setIsRulerOpen]  = useState(false);
  const [rulerMode,    setRulerMode]    = useState<RulerMode>('line');
  const [rulerPoints,  setRulerPoints]  = useState<RulerPt[]>([]);
  const [mouseMapPos,  setMouseMapPos]  = useState<RulerPt | null>(null);

  // ── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              // ESRI World Imagery — free for development & evaluation use.
              // For commercial production, obtain an ArcGIS Online / Esri licence.
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            },
          },
          layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 }],
        },
        center: [lng, lat],
        zoom,
      });

      map.current.on('style.load', () => {
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
    <div className="absolute inset-0 w-full h-full bg-slate-900">
      <div ref={mapContainer} className="w-full h-full" />

      <DrawToolbar
        activeMode={activeDrawMode}
        onSetMode={handleSetMode}
        isRulerOpen={isRulerOpen}
        rulerMode={rulerMode}
        onOpenRuler={handleOpenRuler}
      />

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

      {selectedFeature && !isRulerOpen && (
        <MeasurementPanelWrapper
          feature={selectedFeature}
          onClear={handleClearDrawing}
          onSetBoundary={() => handleSetBoundary(selectedFeature)}
          onSetExclusion={() => handleSetExclusion(selectedFeature)}
          onSetFeature={(type) => handleSetFeature(selectedFeature, type)}
        />
      )}

      <LayersPanel />
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
