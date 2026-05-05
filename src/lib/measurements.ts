import { length, area as turfArea, lineString } from '@turf/turf';
import type { Feature } from 'geojson';

export const LENGTH_UNITS = [
  'Centimeters', 'Meters', 'Kilometers', 'Inches', 'Feet', 'Yards', 
  'Miles', 'Nautical Miles', 'Smoots', 'Degrees', 'Arcseconds'
] as const;

export type LengthUnit = typeof LENGTH_UNITS[number];

export const AREA_UNITS = [
  'Sq Centimeters', 'Sq Meters', 'Sq Kilometers', 'Hectares', 'Sq Inches', 
  'Sq Feet', 'Sq Yards', 'Acres', 'Sq Miles', 'Sq Nautical Miles'
] as const;

export type AreaUnit = typeof AREA_UNITS[number];

export function convertLength(meters: number, unit: LengthUnit): number {
  switch (unit) {
    case 'Centimeters': return meters * 100;
    case 'Meters': return meters;
    case 'Kilometers': return meters / 1000;
    case 'Inches': return meters * 39.3701;
    case 'Feet': return meters * 3.28084;
    case 'Yards': return meters * 1.09361;
    case 'Miles': return meters * 0.000621371;
    case 'Nautical Miles': return meters * 0.000539957;
    case 'Smoots': return meters / 1.7018;
    case 'Degrees': return meters / 111320; // Approx equator
    case 'Arcseconds': return (meters / 111320) * 3600;
    default: return meters;
  }
}

export function convertArea(sqMeters: number, unit: AreaUnit): number {
  switch (unit) {
    case 'Sq Centimeters': return sqMeters * 10000;
    case 'Sq Meters': return sqMeters;
    case 'Sq Kilometers': return sqMeters / 1e6;
    case 'Hectares': return sqMeters / 10000;
    case 'Sq Inches': return sqMeters * 1550.0031;
    case 'Sq Feet': return sqMeters * 10.7639;
    case 'Sq Yards': return sqMeters * 1.19599;
    case 'Acres': return sqMeters * 0.000247105;
    case 'Sq Miles': return sqMeters * 3.861e-7;
    case 'Sq Nautical Miles': return sqMeters * 2.9155e-7;
    default: return sqMeters;
  }
}

export function calculateFeatureMeasurements(feature: Feature): { perimeterMeters: number, areaSqMeters: number, radiusMeters: number } {
  let perimeterMeters = 0;
  let areaSqMeters = 0;
  let radiusMeters = 0;

  if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
    perimeterMeters = length(feature, { units: 'kilometers' }) * 1000;
  } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    areaSqMeters = turfArea(feature);
    
    if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0];
      if (coords && coords.length > 1) {
        try {
          perimeterMeters = length(lineString(coords), { units: 'kilometers' }) * 1000;
        } catch(e) {}
      }
    }
  }

  // Handle mapbox-gl-draw-circle specific properties
  if (feature.properties && feature.properties.isCircle) {
    const radiusKm = feature.properties.circleRadius || 0;
    radiusMeters = radiusKm * 1000;
    areaSqMeters = Math.PI * radiusMeters * radiusMeters;
    perimeterMeters = 2 * Math.PI * radiusMeters; // circumference
  }

  return { perimeterMeters, areaSqMeters, radiusMeters };
}
