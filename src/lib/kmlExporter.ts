import type { TurbinePosition, TurbineModel } from '@/types';
import type { FeatureCollection } from 'geojson';

export function generateKML(turbines: TurbinePosition[], boundary: FeatureCollection | null, turbineModel: TurbineModel): string {
  let placemarks = '';

  // Add boundary if it exists
  if (boundary && boundary.features.length > 0) {
    boundary.features.forEach((feature, idx) => {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0].map(c => `${c[0]},${c[1]},0`).join(' ');
        placemarks += `
        <Placemark>
          <name>Project Boundary ${idx + 1}</name>
          <Style>
            <LineStyle>
              <color>ff00aa00</color>
              <width>2</width>
            </LineStyle>
            <PolyStyle>
              <color>3300aa00</color>
            </PolyStyle>
          </Style>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${coords}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>`;
      }
    });
  }

  // Add Turbines
  turbines.forEach(t => {
    placemarks += `
    <Placemark>
      <name>${t.id}</name>
      <description>
        <![CDATA[
          <b>Model:</b> ${turbineModel.oem} ${turbineModel.model}<br/>
          <b>Status:</b> ${t.spacingStatus}<br/>
          <b>Easting:</b> ${t.easting}<br/>
          <b>Northing:</b> ${t.northing}<br/>
        ]]>
      </description>
      <Point>
        <coordinates>${t.lng},${t.lat},0</coordinates>
      </Point>
    </Placemark>`;
  });

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Wind Farm Layout</name>
    <description>Exported from Micrositing Tool</description>
    ${placemarks}
  </Document>
</kml>`;

  return kml;
}

export function downloadKML(kmlString: string, filename: string = 'layout.kml') {
  const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
