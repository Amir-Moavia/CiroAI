// ─────────────────────────────────────────────────────────────
// CrisisAI — Pakistan Region Data
// ─────────────────────────────────────────────────────────────

import type { Coordinate } from '../types';

export interface Region {
  name: string;
  province: string;
  coordinate: Coordinate;
  population?: number;
}

export const PAKISTAN_REGIONS: Region[] = [
  { name: 'Karachi',     province: 'Sindh',              coordinate: { latitude: 24.8607, longitude: 67.0011 }, population: 16_100_000 },
  { name: 'Lahore',      province: 'Punjab',             coordinate: { latitude: 31.5204, longitude: 74.3587 }, population: 13_000_000 },
  { name: 'Islamabad',   province: 'Federal Capital',    coordinate: { latitude: 33.6844, longitude: 73.0479 }, population: 1_200_000 },
  { name: 'Rawalpindi',  province: 'Punjab',             coordinate: { latitude: 33.5651, longitude: 73.0169 }, population: 3_700_000 },
  { name: 'Faisalabad',  province: 'Punjab',             coordinate: { latitude: 31.4504, longitude: 73.1350 }, population: 3_600_000 },
  { name: 'Multan',      province: 'Punjab',             coordinate: { latitude: 30.1575, longitude: 71.5249 }, population: 2_000_000 },
  { name: 'Peshawar',    province: 'KPK',                coordinate: { latitude: 34.0151, longitude: 71.5249 }, population: 2_300_000 },
  { name: 'Quetta',      province: 'Balochistan',        coordinate: { latitude: 30.1798, longitude: 66.9750 }, population: 1_100_000 },
  { name: 'Hyderabad',   province: 'Sindh',              coordinate: { latitude: 25.3960, longitude: 68.3578 }, population: 1_800_000 },
  { name: 'Sialkot',     province: 'Punjab',             coordinate: { latitude: 32.4945, longitude: 74.5229 }, population: 700_000 },
  { name: 'Sukkur',      province: 'Sindh',              coordinate: { latitude: 27.7052, longitude: 68.8574 }, population: 600_000 },
  { name: 'Abbottabad',  province: 'KPK',                coordinate: { latitude: 34.1688, longitude: 73.2215 }, population: 400_000 },
  { name: 'Gilgit',      province: 'Gilgit-Baltistan',   coordinate: { latitude: 35.8819, longitude: 74.4643 }, population: 80_000 },
  { name: 'Muzaffarabad',province: 'AJK',                coordinate: { latitude: 34.3700, longitude: 73.4711 }, population: 150_000 },
];

export const PROVINCES = [
  'Punjab',
  'Sindh',
  'KPK',
  'Balochistan',
  'Federal Capital',
  'Gilgit-Baltistan',
  'AJK',
] as const;
