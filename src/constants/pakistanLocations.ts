// Known Pakistan coordinates — used when Google Geocoding API is unavailable

export interface PakistanPlace {
  pattern: RegExp;
  name: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

export const PAKISTAN_PLACES: PakistanPlace[] = [
  { pattern: /\bF[-\s]?6\b/i, name: 'F-6', city: 'Islamabad', province: 'Federal Capital', latitude: 33.7280, longitude: 73.0550 },
  { pattern: /\bF[-\s]?7\b/i, name: 'F-7', city: 'Islamabad', province: 'Federal Capital', latitude: 33.7215, longitude: 73.0580 },
  { pattern: /\bF[-\s]?8\b/i, name: 'F-8', city: 'Islamabad', province: 'Federal Capital', latitude: 33.7100, longitude: 73.0400 },
  { pattern: /\bG[-\s]?9\b/i, name: 'G-9', city: 'Islamabad', province: 'Federal Capital', latitude: 33.6850, longitude: 73.0200 },
  { pattern: /\bG[-\s]?11\b/i, name: 'G-11', city: 'Islamabad', province: 'Federal Capital', latitude: 33.6649, longitude: 73.0126 },
  { pattern: /\bI[-\s]?8\b/i, name: 'I-8', city: 'Islamabad', province: 'Federal Capital', latitude: 33.6648, longitude: 72.9946 },
  { pattern: /\bBlue\s*Area\b/i, name: 'Blue Area', city: 'Islamabad', province: 'Federal Capital', latitude: 33.7100, longitude: 73.0600 },
  { pattern: /\bFaizabad\b/i, name: 'Faizabad', city: 'Islamabad', province: 'Federal Capital', latitude: 33.6660, longitude: 73.0763 },
  { pattern: /\bSaddar\b/i, name: 'Saddar', city: 'Rawalpindi', province: 'Punjab', latitude: 33.5981, longitude: 73.0478 },
  { pattern: /\bGT\s*Road\b/i, name: 'GT Road', city: 'Rawalpindi', province: 'Punjab', latitude: 33.5935, longitude: 73.0715 },
  { pattern: /\bDHA\s*Phase\s*2\b/i, name: 'DHA Phase 2', city: 'Rawalpindi', province: 'Punjab', latitude: 33.5311, longitude: 73.1000 },
  { pattern: /\bDHA\b/i, name: 'DHA', city: 'Rawalpindi', province: 'Punjab', latitude: 33.5311, longitude: 73.1000 },
  { pattern: /\bMurree\s*Road\b/i, name: 'Murree Road', city: 'Rawalpindi', province: 'Punjab', latitude: 33.6281, longitude: 73.0716 },
  { pattern: /\bIslamabad\b/i, name: 'Islamabad', city: 'Islamabad', province: 'Federal Capital', latitude: 33.6844, longitude: 73.0479 },
  { pattern: /\bRawalpindi\b/i, name: 'Rawalpindi', city: 'Rawalpindi', province: 'Punjab', latitude: 33.5651, longitude: 73.0169 },
];

export function lookupPlace(text: string): PakistanPlace | null {
  for (const place of PAKISTAN_PLACES) {
    if (place.pattern.test(text)) return place;
  }
  return null;
}
