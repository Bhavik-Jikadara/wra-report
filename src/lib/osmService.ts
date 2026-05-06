import type { FeatureCollection, Feature } from 'geojson';
import { bbox } from '@turf/turf';

export async function identifyFeaturesFromOSM(boundary: FeatureCollection): Promise<{ 
  waterbodies: FeatureCollection, 
  dwellings: FeatureCollection 
}> {
  if (!boundary || boundary.features.length === 0) {
    return {
      waterbodies: { type: 'FeatureCollection', features: [] },
      dwellings: { type: 'FeatureCollection', features: [] }
    };
  }

  const [minLng, minLat, maxLng, maxLat] = bbox(boundary);
  
  // Overpass QL query
  // We look for:
  // 1. Water: natural=water, waterway=riverbank, landuse=reservoir
  // 2. Dwellings: building=*, landuse=residential
  const query = `
    [out:json][timeout:25];
    (
      // Water bodies
      way["natural"="water"](${minLat},${minLng},${maxLat},${maxLng});
      relation["natural"="water"](${minLat},${minLng},${maxLat},${maxLng});
      way["waterway"="riverbank"](${minLat},${minLng},${maxLat},${maxLng});
      
      // Dwellings/Buildings
      way["building"](${minLat},${minLng},${maxLat},${maxLng});
      relation["building"](${minLat},${minLng},${maxLat},${maxLng});
      way["landuse"="residential"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) throw new Error('OSM service unavailable');

    const data = await response.json();
    return processOverpassData(data);
  } catch (error) {
    console.error('Error fetching OSM data:', error);
    return {
      waterbodies: { type: 'FeatureCollection', features: [] },
      dwellings: { type: 'FeatureCollection', features: [] }
    };
  }
}

function processOverpassData(data: any): { waterbodies: FeatureCollection, dwellings: FeatureCollection } {
  const waterFeatures: Feature[] = [];
  const dwellingFeatures: Feature[] = [];

  const nodes = new Map();
  data.elements.filter((e: any) => e.type === 'node').forEach((n: any) => {
    nodes.set(n.id, [n.lon, n.lat]);
  });

  data.elements.filter((e: any) => e.type === 'way').forEach((w: any) => {
    const coordinates = w.nodes.map((id: number) => nodes.get(id)).filter((c: any) => c);
    
    // Simple Polygon conversion (must be closed)
    if (coordinates.length > 3) {
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      const feature: Feature = {
        type: 'Feature',
        properties: { 
          id: w.id,
          type: (w.tags.natural === 'water' || w.tags.waterway === 'riverbank') ? 'water' : 'dwelling',
          osm_tags: w.tags
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      };

      if (feature.properties?.type === 'water') {
        waterFeatures.push(feature);
      } else {
        dwellingFeatures.push(feature);
      }
    }
  });

  return {
    waterbodies: { type: 'FeatureCollection', features: waterFeatures },
    dwellings: { type: 'FeatureCollection', features: dwellingFeatures }
  };
}
