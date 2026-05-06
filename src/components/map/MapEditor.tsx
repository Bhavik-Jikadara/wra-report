import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useProjectStore } from '@/store/useProjectStore';
import { bbox } from '@turf/turf';
import { CompliancePanel } from './CompliancePanel';
import { calculateFeatureMeasurements } from '@/lib/measurements';
import { DrawToolbar } from './DrawToolbar';
import { MeasurementPanel } from './MeasurementPanel';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

export function MapEditor() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [lng] = useState(78.9629); // Center of India
  const [lat] = useState(20.5937);
  const [zoom] = useState(4);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { projectBoundary, turbines, exclusionZones, externalTurbines, mapFeatures } = useProjectStore();

  // MapboxDraw instance
  const drawRef = useRef<any>(null);
  const [activeDrawMode, setActiveDrawMode] = useState('simple_select');
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (!mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'satellite': {
              type: 'raster',
              tiles: [
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
              ],
              tileSize: 256,
              attribution: 'Google Maps'
            }
          },
          layers: [
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite',
              minzoom: 0,
              maxzoom: 22
            }
          ]
        },
        center: [lng, lat],
        zoom: zoom,
      });

      map.current.on('style.load', () => {
        setMapLoaded(true);

        // Initialize MapboxDraw
        import('@mapbox/mapbox-gl-draw').then((MapboxDrawModule) => {
          const MapboxDraw = MapboxDrawModule.default;
          
          const customDrawStyles = [
            {
              'id': 'gl-draw-polygon-fill-inactive',
              'type': 'fill',
              'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
              'paint': { 'fill-color': '#3bb2d0', 'fill-outline-color': '#3bb2d0', 'fill-opacity': 0.1 }
            },
            {
              'id': 'gl-draw-polygon-fill-active',
              'type': 'fill',
              'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
              'paint': { 'fill-color': '#fbb03b', 'fill-outline-color': '#fbb03b', 'fill-opacity': 0.1 }
            },
            {
              'id': 'gl-draw-polygon-stroke-inactive',
              'type': 'line',
              'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
              'layout': { 'line-cap': 'round', 'line-join': 'round' },
              'paint': { 'line-color': '#3bb2d0', 'line-width': 2 }
            },
            {
              'id': 'gl-draw-polygon-stroke-active',
              'type': 'line',
              'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
              'layout': { 'line-cap': 'round', 'line-join': 'round' },
              'paint': { 'line-color': '#fbb03b', 'line-width': 2, 'line-dasharray': ['literal', [0.2, 2]] }
            },
            {
              'id': 'gl-draw-line-inactive',
              'type': 'line',
              'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
              'layout': { 'line-cap': 'round', 'line-join': 'round' },
              'paint': { 'line-color': '#3bb2d0', 'line-width': 2 }
            },
            {
              'id': 'gl-draw-line-active',
              'type': 'line',
              'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
              'layout': { 'line-cap': 'round', 'line-join': 'round' },
              'paint': { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 }
            },
            {
              'id': 'gl-draw-polygon-and-line-vertex-stroke-inactive',
              'type': 'circle',
              'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
              'paint': { 'circle-radius': 5, 'circle-color': '#fff' }
            },
            {
              'id': 'gl-draw-polygon-and-line-vertex-inactive',
              'type': 'circle',
              'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
              'paint': { 'circle-radius': 3, 'circle-color': '#fbb03b' }
            },
            {
              'id': 'gl-draw-point-point-stroke-inactive',
              'type': 'circle',
              'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
              'paint': { 'circle-radius': 5, 'circle-opacity': 1, 'circle-color': '#fff' }
            },
            {
              'id': 'gl-draw-point-inactive',
              'type': 'circle',
              'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
              'paint': { 'circle-radius': 3, 'circle-color': '#3bb2d0' }
            },
            {
              'id': 'gl-draw-point-stroke-active',
              'type': 'circle',
              'filter': ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['!=', 'meta', 'midpoint']],
              'paint': { 'circle-radius': 7, 'circle-color': '#fff' }
            },
            {
              'id': 'gl-draw-point-active',
              'type': 'circle',
              'filter': ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint'], ['==', 'active', 'true']],
              'paint': { 'circle-radius': 5, 'circle-color': '#fbb03b' }
            },
            {
              'id': 'gl-draw-polygon-midpoint',
              'type': 'circle',
              'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
              'paint': { 'circle-radius': 3, 'circle-color': '#fbb03b' }
            }
          ];

          const draw = new MapboxDraw({
            displayControlsDefault: false,
            userProperties: true,
            modes: MapboxDraw.modes as any,
            styles: customDrawStyles
          });

          drawRef.current = draw;
          map.current?.addControl(draw as any, 'top-left');

          const updateMeasurements = () => {
            const selected = draw.getSelected();
            if (selected && selected.features.length > 0) {
              setSelectedFeature(selected.features[0]);
            } else {
              setSelectedFeature(null);
            }
          };

          map.current?.on('draw.create', updateMeasurements);
          map.current?.on('draw.delete', updateMeasurements);
          map.current?.on('draw.update', updateMeasurements);
          map.current?.on('draw.selectionchange', updateMeasurements);
          map.current?.on('draw.modechange', (e: any) => setActiveDrawMode(e.mode));
        });
      });

    } catch (e) {
      console.error('Failed to initialize map', e);
    }
  }, []);

  // Effect to handle Boundary Rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    const sourceId = 'project-boundary-source';
    const layerIdFill = 'project-boundary-fill';
    const layerIdLine = 'project-boundary-line';

    if (projectBoundary) {
      if (!m.getSource(sourceId)) {
        m.addSource(sourceId, {
          type: 'geojson',
          data: projectBoundary
        });

        m.addLayer({
          id: layerIdFill,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#1D9E75',
            'fill-opacity': 0.12
          }
        });

        m.addLayer({
          id: layerIdLine,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#1D9E75',
            'line-width': 2
          }
        });
      } else {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(projectBoundary);
      }

      // Auto-zoom to boundary
      try {
        const bounds = bbox(projectBoundary) as [number, number, number, number];
        m.fitBounds(bounds, { padding: 50, maxZoom: 16 });
      } catch (e) {
        console.error('Error fitting bounds:', e);
      }
    } else {
      if (m.getSource(sourceId)) {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
      // Clear drawings as well on project reset
      if (drawRef.current) {
        drawRef.current.deleteAll();
        setSelectedFeature(null);
      }
    }
  }, [projectBoundary, mapLoaded]);

  // Effect to handle Turbines Rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    const sourceId = 'turbines-source';
    const layerIdPoints = 'turbines-points';
    const layerIdLabels = 'turbines-labels';

    const turbineGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: turbines.map(t => ({
        type: 'Feature',
        properties: {
          id: t.id,
          status: t.spacingStatus
        },
        geometry: {
          type: 'Point',
          coordinates: [t.lng, t.lat]
        }
      }))
    };

    if (!m.getSource(sourceId)) {
      m.addSource(sourceId, {
        type: 'geojson',
        data: turbineGeoJson
      });

      m.addLayer({
        id: layerIdPoints,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'status'],
            'violation', '#D85A30',
            'warning', '#BA7517',
            /* default */ '#1D9E75'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      
      m.addLayer({
        id: layerIdLabels,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'id'],
          'text-offset': [0, 1.5],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1
        }
      });
    } else {
      (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(turbineGeoJson);
    }
  }, [turbines, mapLoaded]);

  // Effect to handle External Turbines Rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    const sourceId = 'external-turbines-source';
    const layerIdPoints = 'external-turbines-points';

    const externalGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: externalTurbines.map(t => ({
        type: 'Feature',
        properties: { id: t.id },
        geometry: {
          type: 'Point',
          coordinates: [t.lng, t.lat]
        }
      }))
    };

    if (!m.getSource(sourceId)) {
      m.addSource(sourceId, {
        type: 'geojson',
        data: externalGeoJson
      });

      m.addLayer({
        id: layerIdPoints,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': '#64748b', // Slate 500 for external
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.7
        }
      });
    } else {
      (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(externalGeoJson);
    }
  }, [externalTurbines, mapLoaded]);

  const handleSetMode = (mode: string) => {
    if (drawRef.current) {
      if (mode === 'draw_circle') {
        drawRef.current.changeMode('draw_circle', { initialRadiusInKm: 0.5 });
      } else {
        drawRef.current.changeMode(mode);
      }
      setActiveDrawMode(mode);
    }
  };

  const handleClearDrawing = () => {
    if (drawRef.current) {
      drawRef.current.deleteAll();
      setSelectedFeature(null);
    }
  };

  const handleSetBoundary = (feature: any) => {
    const { setProjectBoundary } = useProjectStore.getState();
    setProjectBoundary({
      type: 'FeatureCollection',
      features: [feature]
    });
    handleClearDrawing();
    import('sonner').then(m => m.toast.success('Project boundary updated'));
  };

  const handleSetExclusion = (feature: any) => {
    const { exclusionZones, setExclusionZones } = useProjectStore.getState();
    const currentZones = exclusionZones ? [...exclusionZones.features] : [];
    
    setExclusionZones({
      type: 'FeatureCollection',
      features: [...currentZones, feature]
    });
    handleClearDrawing();
    import('sonner').then(m => m.toast.success('Exclusion zone added'));
  };

  const handleSetFeature = (feature: any, type: string) => {
    const { mapFeatures, setMapFeatures } = useProjectStore.getState();
    const currentFeatures = mapFeatures ? [...mapFeatures.features] : [];
    
    setMapFeatures({
      type: 'FeatureCollection',
      features: [...currentFeatures, { ...feature, properties: { ...feature.properties, type } }]
    });
    handleClearDrawing();
    import('sonner').then(m => m.toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} feature added`));
  };

  // Effect to handle Exclusion Zones Rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    const sourceId = 'exclusion-zones-source';
    const layerIdFill = 'exclusion-zones-fill';
    const layerIdLine = 'exclusion-zones-line';

    if (exclusionZones) {
      if (!m.getSource(sourceId)) {
        m.addSource(sourceId, {
          type: 'geojson',
          data: exclusionZones
        });

        m.addLayer({
          id: layerIdFill,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#D85A30',
            'fill-opacity': 0.15
          }
        });

        m.addLayer({
          id: layerIdLine,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#D85A30',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      } else {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(exclusionZones);
      }
    } else {
      if (m.getSource(sourceId)) {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [exclusionZones, mapLoaded]);

  // Effect to handle Map Features Rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    const sourceId = 'map-features-source';
    const layerIdFill = 'map-features-fill';
    const layerIdLine = 'map-features-line';

    if (mapFeatures) {
      if (!m.getSource(sourceId)) {
        m.addSource(sourceId, {
          type: 'geojson',
          data: mapFeatures
        });

        m.addLayer({
          id: layerIdFill,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': [
              'match',
              ['get', 'type'],
              'water', '#3b82f6', // Blue
              'dwelling', '#ef4444', // Red
              /* default */ '#8b5cf6' // Violet
            ],
            'fill-opacity': 0.2
          }
        });

        m.addLayer({
          id: layerIdLine,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'match',
              ['get', 'type'],
              'water', '#3b82f6',
              'dwelling', '#ef4444',
              /* default */ '#8b5cf6'
            ],
            'line-width': 1.5
          }
        });
      } else {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(mapFeatures);
      }
    } else {
      if (m.getSource(sourceId)) {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [mapFeatures, mapLoaded]);

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-900">
      <div ref={mapContainer} className="w-full h-full" />
      <DrawToolbar 
        activeMode={activeDrawMode} 
        onSetMode={handleSetMode} 
      />
      {selectedFeature && (
        <MeasurementPanelWrapper 
          feature={selectedFeature} 
          onClear={handleClearDrawing} 
          onSetBoundary={() => handleSetBoundary(selectedFeature)}
          onSetExclusion={() => handleSetExclusion(selectedFeature)}
          onSetFeature={(type) => handleSetFeature(selectedFeature, type)}
        />
      )}
      <CompliancePanel />
    </div>
  );
}

function MeasurementPanelWrapper({ 
  feature, 
  onClear,
  onSetBoundary,
  onSetExclusion,
  onSetFeature
}: { 
  feature: any, 
  onClear: () => void,
  onSetBoundary: () => void,
  onSetExclusion: () => void,
  onSetFeature: (type: string) => void
}) {
  const { perimeterMeters, areaSqMeters, radiusMeters } = calculateFeatureMeasurements(feature);
  
  return (
    <MeasurementPanel 
      perimeterMeters={perimeterMeters}
      areaSqMeters={areaSqMeters}
      radiusMeters={radiusMeters}
      featureType={feature.geometry.type}
      onClear={onClear}
      onSetBoundary={onSetBoundary}
      onSetExclusion={onSetExclusion}
      onSetFeature={onSetFeature}
    />
  );
}
