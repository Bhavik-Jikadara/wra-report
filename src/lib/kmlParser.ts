import { kml } from '@mapbox/togeojson';
import JSZip from 'jszip';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';

export async function parseKmlPointsOrKmz(file: File): Promise<FeatureCollection | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'kmz') {
    return parseKmz(file, parseKmlPoints);
  } else {
    return parseKmlPoints(await file.text());
  }
}

export async function parseKmlFeaturesOrKmz(file: File): Promise<FeatureCollection | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'kmz') {
    return parseKmz(file, parseKmlFeatures);
  } else {
    return parseKmlFeatures(await file.text());
  }
}

export async function parseKmlOrKmz(file: File): Promise<FeatureCollection | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'kmz') {
    return parseKmz(file, parseKml);
  } else if (extension === 'kml') {
    return parseKml(await file.text());
  } else {
    throw new Error('Unsupported file format. Please upload a .kml or .kmz file.');
  }
}

async function parseKmz(file: File, processor: (kmlText: string) => FeatureCollection | null): Promise<FeatureCollection | null> {
  try {
    const zip = await JSZip.loadAsync(file);
    const kmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.kml'));
    
    if (kmlFiles.length === 0) {
      throw new Error('No KML file found inside the KMZ archive.');
    }
    
    // Read the first KML file found
    const kmlText = await zip.files[kmlFiles[0]].async('text');
    return processor(kmlText);
  } catch (err) {
    console.error('Error extracting KMZ:', err);
    throw new Error('Failed to extract KMZ file. Ensure it is a valid zip archive containing a KML.');
  }
}

export function parseKmlPoints(kmlString: string): FeatureCollection | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlString, 'text/xml');
    const geojson = kml(doc) as FeatureCollection;
    
    const pointFeatures = geojson.features.filter(f => f.geometry?.type === 'Point');
    
    return {
      type: 'FeatureCollection',
      features: pointFeatures
    };
  } catch (err) {
    console.error('Error parsing KML points:', err);
    return null;
  }
}

export function parseKmlFeatures(kmlString: string): FeatureCollection | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlString, 'text/xml');
    return kml(doc) as FeatureCollection;
  } catch (err) {
    console.error('Error parsing KML features:', err);
    return null;
  }
}

function parseKml(kmlString: string): FeatureCollection | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlString, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML in KML file.');
    }
    
    const geojson = kml(doc) as FeatureCollection;
    
    // Filter to keep only Polygon or MultiPolygon features
    const boundaryFeatures = geojson.features.filter(
      (f): f is Feature<Polygon | MultiPolygon> => 
        f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    );
    
    if (boundaryFeatures.length === 0) {
      throw new Error('No polygon geometry found in file. Ensure the KML contains a closed boundary polygon.');
    }
    
    return {
      type: 'FeatureCollection',
      features: boundaryFeatures
    };
  } catch (err) {
    console.error('Error parsing KML:', err);
    throw err instanceof Error ? err : new Error('Failed to parse KML geometry.');
  }
}
