// Simple UTM converter based on standard formulas
export function latLngToUTM(lat: number, lng: number): { easting: number; northing: number; zone: number; letter: string } {
  const a = 6378137.0; // WGS84 semi-major axis
  const eccSquared = 0.00669438; // WGS84 eccentricity squared
  const k0 = 0.9996;

  let zone = Math.floor((lng + 180) / 6) + 1;
  if (lat >= 56.0 && lat < 64.0 && lng >= 3.0 && lng < 12.0) zone = 32;
  if (lat >= 72.0 && lat < 84.0) {
    if (lng >= 0.0 && lng < 9.0) zone = 31;
    else if (lng >= 9.0 && lng < 21.0) zone = 33;
    else if (lng >= 21.0 && lng < 33.0) zone = 35;
    else if (lng >= 33.0 && lng < 42.0) zone = 37;
  }

  const lngOrigin = (zone - 1) * 6 - 180 + 3;
  const lngOriginRad = lngOrigin * (Math.PI / 180);
  const latRad = lat * (Math.PI / 180);
  const lngRad = lng * (Math.PI / 180);

  const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = (eccSquared / (1 - eccSquared)) * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lngOriginRad);

  const M = a * (
    (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * Math.pow(eccSquared, 3) / 256) * latRad
    - (3 * eccSquared / 8 + 3 * eccSquared * eccSquared / 32 + 45 * Math.pow(eccSquared, 3) / 1024) * Math.sin(2 * latRad)
    + (15 * eccSquared * eccSquared / 256 + 45 * Math.pow(eccSquared, 3) / 1024) * Math.sin(4 * latRad)
    - (35 * Math.pow(eccSquared, 3) / 3072) * Math.sin(6 * latRad)
  );

  let easting = k0 * N * (
    A + (1 - T + C) * Math.pow(A, 3) / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * (eccSquared / (1 - eccSquared))) * Math.pow(A, 5) / 120
  ) + 500000.0;

  let northing = k0 * (
    M + N * Math.tan(latRad) * (
      Math.pow(A, 2) / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * (eccSquared / (1 - eccSquared))) * Math.pow(A, 6) / 720
    )
  );

  if (lat < 0) {
    northing += 10000000.0; // 10,000,000 meter offset for southern hemisphere
  }

  const letters = "CDEFGHJKLMNPQRSTUVWXX";
  let letter = 'Z';
  if (lat >= -80 && lat <= 84) {
    letter = letters[Math.floor((lat + 80) / 8)];
  }

  return { easting: Math.round(easting), northing: Math.round(northing), zone, letter };
}
