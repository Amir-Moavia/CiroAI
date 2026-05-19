// ═══════════════════════════════════════════════════════════════
// ⚠️  SYNTHETIC / MOCK DATA — NOT REAL CRISIS SIGNALS  ⚠️
// ═══════════════════════════════════════════════════════════════
//
// This file contains 25+ fabricated crisis signals designed to
// simulate realistic Pakistan urban crisis scenarios for the
// CrisisAI agent pipeline. All locations, timestamps, and
// readings are fictional. Do NOT use for real emergency response.
//
// Categories:
//   1. POWER OUTAGE        (PWR-001 … PWR-005)
//   2. FLOOD / WEATHER     (FLD-001 … FLD-005)
//   3. BRIDGE / ROAD       (RD-001  … RD-005)
//   4. WATER / UTILITY     (UTL-001 … UTL-005)
//   5. MULTI-CRISIS        (MUL-001 … MUL-005)
// ═══════════════════════════════════════════════════════════════

import type { CrisisSignal } from '../types';

// ── Shared base timestamp (simulated incident window) ───────
const BASE_TS = '2026-05-17T14:00:00+05:00';

/** Helper: offset minutes from BASE_TS */
function ts(offsetMinutes: number): string {
  const d = new Date(BASE_TS);
  d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────
// 1. POWER OUTAGE SIGNALS
// ─────────────────────────────────────────────────────────────

export const POWER_OUTAGE_SIGNALS: CrisisSignal[] = [
  {
    id: 'PWR-001',
    source: 'citizen_report',
    text: 'Power outage across Sector F-7 for 2 hours',
    location: {
      coordinate: { latitude: 33.7215, longitude: 73.0580 },
      city: 'Islamabad',
      district: 'F-7',
      province: 'Federal Capital',
      label: 'Sector F-7, Islamabad',
    },
    timestamp: ts(0),
    type: 'power_outage',
    severity: 'medium',
    language: 'EN',
  },
  {
    id: 'PWR-002',
    source: 'citizen_report',
    text: 'Saddar mein transformer phat gaya hai, poora ilaqa andhere mein hai',
    location: {
      coordinate: { latitude: 33.5981, longitude: 73.0478 },
      city: 'Rawalpindi',
      district: 'Saddar',
      province: 'Punjab',
      label: 'Saddar Bazaar, Rawalpindi',
    },
    timestamp: ts(3),
    type: 'power_outage',
    severity: 'high',
    language: 'UR',
    rawPayload: {
      normalizedText: 'Transformer exploded in Saddar area, entire neighbourhood in darkness',
    },
  },
  {
    id: 'PWR-003',
    source: 'twitter',
    text: 'Electricity gone in G-11 since morning, WAPDA not responding. 6 hours and counting! #IslamabadPower',
    location: {
      coordinate: { latitude: 33.6649, longitude: 73.0126 },
      city: 'Islamabad',
      district: 'G-11',
      province: 'Federal Capital',
      label: 'Sector G-11, Islamabad',
    },
    timestamp: ts(-120),
    type: 'power_outage',
    severity: 'high',
    language: 'EN',
  },
  {
    id: 'PWR-004',
    source: 'grid_sensor',
    text: 'Sudden grid failure Zone-3 — load shedding threshold exceeded',
    location: {
      coordinate: { latitude: 33.6920, longitude: 73.0350 },
      city: 'Islamabad',
      district: 'Zone-3',
      province: 'Federal Capital',
      label: 'IESCO Grid Zone-3',
    },
    timestamp: ts(1),
    type: 'power_outage',
    severity: 'critical',
    language: 'EN',
    rawPayload: {
      type: 'SENSOR',
      source: 'GRID_API',
      message: 'Sudden grid failure Zone-3',
      value: -100,
      unit: 'MW',
      normalLoadMW: 340,
      currentLoadMW: 0,
      affectedFeeders: 12,
    },
  },
  {
    id: 'PWR-005',
    source: 'citizen_report',
    text: 'All signal lights off near zero point, accidents happening. Koi traffic warden bhi nahi hai',
    location: {
      coordinate: { latitude: 33.6938, longitude: 73.0652 },
      city: 'Islamabad',
      district: 'Zero Point',
      province: 'Federal Capital',
      label: 'Zero Point Interchange, Islamabad',
    },
    timestamp: ts(8),
    type: 'power_outage',
    severity: 'critical',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'All traffic lights off near Zero Point, accidents occurring. No traffic wardens present.',
    },
  },
];

// ─────────────────────────────────────────────────────────────
// 2. FLOOD / WEATHER SIGNALS
// ─────────────────────────────────────────────────────────────

export const FLOOD_WEATHER_SIGNALS: CrisisSignal[] = [
  {
    id: 'FLD-001',
    source: 'citizen_report',
    text: 'Street flooding in I-8, cars stuck, water rising fast. Bachon ko school se nikalna mushkil ho raha hai',
    location: {
      coordinate: { latitude: 33.6648, longitude: 72.9946 },
      city: 'Islamabad',
      district: 'I-8',
      province: 'Federal Capital',
      label: 'Sector I-8, Islamabad',
    },
    timestamp: ts(15),
    type: 'flood',
    severity: 'high',
    language: 'MIXED',
  },
  {
    id: 'FLD-002',
    source: 'citizen_report',
    text: 'Nullah Lai overflowing near Committee Chowk Rawalpindi, 3 streets completely blocked. Rescue 1122 pe call nahi lag rahi',
    location: {
      coordinate: { latitude: 33.5889, longitude: 73.0556 },
      city: 'Rawalpindi',
      district: 'Committee Chowk',
      province: 'Punjab',
      label: 'Nullah Lai, Committee Chowk',
    },
    timestamp: ts(18),
    type: 'flood',
    severity: 'critical',
    language: 'MIXED',
  },
  {
    id: 'FLD-003',
    source: 'weather_api',
    text: 'Heavy rainfall alert — 85mm recorded in 3 hours, flash flood risk elevated',
    location: {
      coordinate: { latitude: 33.6844, longitude: 73.0479 },
      city: 'Islamabad',
      province: 'Federal Capital',
      label: 'Islamabad Metropolitan Area',
    },
    timestamp: ts(10),
    type: 'flood',
    severity: 'high',
    language: 'EN',
    rawPayload: {
      heavyRain: true,
      rainfallMM: 85,
      durationHours: 3,
      region: 'Islamabad',
      floodRisk: 'HIGH',
      windSpeedKPH: 45,
      humidity: 94,
    },
  },
  {
    id: 'FLD-004',
    source: 'twitter',
    text: 'Faizabad underpass completely submerged!! Avoid at all costs. Saw a taxi half underwater. #IslamabadRain #FloodAlert',
    location: {
      coordinate: { latitude: 33.6660, longitude: 73.0763 },
      city: 'Islamabad',
      district: 'Faizabad',
      province: 'Federal Capital',
      label: 'Faizabad Interchange Underpass',
    },
    timestamp: ts(22),
    type: 'flood',
    severity: 'critical',
    language: 'EN',
  },
  {
    id: 'FLD-005',
    source: 'citizen_report',
    text: 'Water logging itna bura hai ke road nazar nahi aa rahi. Bikes gir rahi hain. Blue Area ke saamne, F-6 side',
    location: {
      coordinate: { latitude: 33.7100, longitude: 73.0580 },
      city: 'Islamabad',
      district: 'Blue Area / F-6',
      province: 'Federal Capital',
      label: 'Jinnah Avenue near F-6',
    },
    timestamp: ts(25),
    type: 'flood',
    severity: 'high',
    language: 'UR',
    rawPayload: {
      normalizedText: 'Water logging so severe the road is invisible. Bikes falling. In front of Blue Area, F-6 side.',
    },
  },
];

// ─────────────────────────────────────────────────────────────
// 3. BRIDGE / ROAD DAMAGE SIGNALS
// ─────────────────────────────────────────────────────────────

export const ROAD_DAMAGE_SIGNALS: CrisisSignal[] = [
  {
    id: 'RD-001',
    source: 'citizen_report',
    text: 'Bridge near GT Road cracked after heavy traffic, police not there yet. Log dono taraf se guzar rahe hain',
    location: {
      coordinate: { latitude: 33.5935, longitude: 73.0715 },
      city: 'Rawalpindi',
      district: 'GT Road',
      province: 'Punjab',
      label: 'GT Road Overpass, Rawalpindi',
    },
    timestamp: ts(5),
    type: 'road_damage',
    severity: 'critical',
    language: 'MIXED',
  },
  {
    id: 'RD-002',
    source: 'traffic_api',
    text: 'Severe congestion spike detected on GT Road — possible structural incident',
    location: {
      coordinate: { latitude: 33.5940, longitude: 73.0700 },
      city: 'Rawalpindi',
      district: 'GT Road',
      province: 'Punjab',
      label: 'GT Road Corridor',
    },
    timestamp: ts(6),
    type: 'road_damage',
    severity: 'high',
    language: 'EN',
    rawPayload: {
      congestionSpike: true,
      location: 'GT Road',
      severity: 'HIGH',
      averageSpeedKPH: 4,
      normalSpeedKPH: 35,
      delayMinutes: 47,
      affectedRoutes: ['GT Road', 'Pirwadhai Road', 'Murree Road Link'],
    },
  },
  {
    id: 'RD-003',
    source: 'citizen_report',
    text: 'Pothole the size of a truck on Murree Road caused 2 accidents already. Ambulance aa rahi hai. CDA kahan hai?',
    location: {
      coordinate: { latitude: 33.6281, longitude: 73.0716 },
      city: 'Rawalpindi',
      district: 'Murree Road',
      province: 'Punjab',
      label: 'Murree Road near Shamsabad',
    },
    timestamp: ts(12),
    type: 'road_damage',
    severity: 'high',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'Pothole the size of a truck on Murree Road has caused 2 accidents. Ambulance en route. Where is CDA?',
      accidentsReported: 2,
    },
  },
  {
    id: 'RD-004',
    source: 'sensor',
    text: 'Bridge GTB-04 stress level CRITICAL — 94% of failure threshold',
    location: {
      coordinate: { latitude: 33.5928, longitude: 73.0720 },
      city: 'Rawalpindi',
      district: 'GT Road',
      province: 'Punjab',
      label: 'GT Road Bridge GTB-04',
    },
    timestamp: ts(7),
    type: 'road_damage',
    severity: 'critical',
    language: 'EN',
    rawPayload: {
      bridgeId: 'GTB-04',
      stressLevel: 94,
      threshold: 80,
      unit: 'percent',
      lastInspection: '2025-11-02',
      recommendation: 'IMMEDIATE_CLOSURE',
      vibrationHz: 12.4,
      deflectionMM: 34,
    },
  },
  {
    id: 'RD-005',
    source: 'news',
    text: 'Margalla Road blocked by landslide after overnight rain, no alternate route shown on Google Maps. Traffic diverted through Trail-5',
    location: {
      coordinate: { latitude: 33.7480, longitude: 73.0601 },
      city: 'Islamabad',
      district: 'Margalla Hills',
      province: 'Federal Capital',
      label: 'Margalla Road, Islamabad',
    },
    timestamp: ts(30),
    type: 'road_damage',
    severity: 'high',
    language: 'EN',
  },
];

// ─────────────────────────────────────────────────────────────
// 4. WATER / UTILITY SIGNALS
// ─────────────────────────────────────────────────────────────

export const WATER_UTILITY_SIGNALS: CrisisSignal[] = [
  {
    id: 'UTL-001',
    source: 'citizen_report',
    text: 'Water pipeline burst in DHA Phase 2, road flooded with clean water. Cars slipping, visibility poor',
    location: {
      coordinate: { latitude: 33.5311, longitude: 73.1000 },
      city: 'Rawalpindi',
      district: 'DHA Phase 2',
      province: 'Punjab',
      label: 'DHA Phase 2, Rawalpindi',
    },
    timestamp: ts(40),
    type: 'water_crisis',
    severity: 'high',
    language: 'EN',
  },
  {
    id: 'UTL-002',
    source: 'twitter',
    text: 'No water supply in E-7 since 3 days!! Tanker mafia charging Rs 5000 per tanker. CDA helpline busy. Koi sunne wala nahi #WaterCrisis',
    location: {
      coordinate: { latitude: 33.7300, longitude: 73.0500 },
      city: 'Islamabad',
      district: 'E-7',
      province: 'Federal Capital',
      label: 'Sector E-7, Islamabad',
    },
    timestamp: ts(-4320), // 3 days ago
    type: 'water_crisis',
    severity: 'medium',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'No water supply in E-7 for 3 days. Tanker mafia charging Rs 5000 per tanker. CDA helpline busy. Nobody listening.',
      daysSinceOutage: 3,
    },
  },
  {
    id: 'UTL-003',
    source: 'utility_api',
    text: 'Water pressure drop 78% in DHA-2 zone — possible main line rupture',
    location: {
      coordinate: { latitude: 33.5320, longitude: 73.0980 },
      city: 'Rawalpindi',
      district: 'DHA Phase 2',
      province: 'Punjab',
      label: 'CDA Water Zone DHA-2',
    },
    timestamp: ts(38),
    type: 'water_crisis',
    severity: 'high',
    language: 'EN',
    rawPayload: {
      waterPressureDrop: true,
      zone: 'DHA-2',
      dropPercent: 78,
      normalPressurePSI: 55,
      currentPressurePSI: 12,
      suspectedCause: 'MAIN_LINE_RUPTURE',
      affectedConnections: 2400,
    },
  },
  {
    id: 'UTL-004',
    source: 'citizen_report',
    text: 'Sewage overflow outside children\'s hospital G-9. Badboo se saans lena mushkil hai. Bachon ko khatrah hai',
    location: {
      coordinate: { latitude: 33.6850, longitude: 73.0200 },
      city: 'Islamabad',
      district: 'G-9',
      province: 'Federal Capital',
      label: 'Children\'s Hospital, G-9 Islamabad',
    },
    timestamp: ts(50),
    type: 'water_crisis',
    severity: 'critical',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'Sewage overflow outside children\'s hospital G-9. Smell makes breathing difficult. Children at risk.',
      healthHazard: true,
      nearHospital: true,
    },
  },
  {
    id: 'UTL-005',
    source: 'twitter',
    text: 'Internet services completely down in entire Blue Area Islamabad. Banks, ATMs, offices all affected. PTCL silent #InternetDown',
    location: {
      coordinate: { latitude: 33.7100, longitude: 73.0600 },
      city: 'Islamabad',
      district: 'Blue Area',
      province: 'Federal Capital',
      label: 'Blue Area, Jinnah Avenue',
    },
    timestamp: ts(55),
    type: 'infrastructure_failure',
    severity: 'medium',
    language: 'EN',
  },
];

// ─────────────────────────────────────────────────────────────
// 5. MULTI-CRISIS SIGNALS
// ─────────────────────────────────────────────────────────────

const MULTI_CRISIS_TS = ts(60); // all within the same window

export const MULTI_CRISIS_SIGNALS: CrisisSignal[] = [
  {
    id: 'MUL-001',
    source: 'citizen_report',
    text: 'Power out, streets flooded, traffic jammed — G-11 markaz is a disaster zone right now. No rescue in sight',
    location: {
      coordinate: { latitude: 33.6649, longitude: 73.0126 },
      city: 'Islamabad',
      district: 'G-11',
      province: 'Federal Capital',
      label: 'G-11 Markaz, Islamabad',
    },
    timestamp: MULTI_CRISIS_TS,
    type: 'multi_crisis',
    severity: 'critical',
    language: 'EN',
    rawPayload: {
      crisisTypes: ['power_outage', 'flood', 'road_damage'],
      overlapping: true,
    },
  },
  {
    id: 'MUL-002',
    source: 'citizen_report',
    text: 'Transformer exploded in waterlogged area near I-8 chowk, fire risk high! Bijli ke taaron mein paani lag raha hai',
    location: {
      coordinate: { latitude: 33.6640, longitude: 72.9960 },
      city: 'Islamabad',
      district: 'I-8',
      province: 'Federal Capital',
      label: 'I-8 Chowk, Islamabad',
    },
    timestamp: ts(62),
    type: 'multi_crisis',
    severity: 'critical',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'Transformer exploded in waterlogged area near I-8 intersection. Fire risk high! Water touching electric wires.',
      crisisTypes: ['power_outage', 'flood', 'fire'],
      electrocutionRisk: true,
    },
  },
  {
    id: 'MUL-003',
    source: 'citizen_report',
    text: 'No power, no water, roads blocked — F-6 completely isolated. Hum ghar se bahar nahi nikal sakte. Rescue 1122 phone nahi utha raha',
    location: {
      coordinate: { latitude: 33.7280, longitude: 73.0550 },
      city: 'Islamabad',
      district: 'F-6',
      province: 'Federal Capital',
      label: 'Sector F-6, Islamabad',
    },
    timestamp: ts(65),
    type: 'multi_crisis',
    severity: 'critical',
    language: 'MIXED',
    rawPayload: {
      normalizedText: 'No power, no water, roads blocked — F-6 completely isolated. We cannot leave our homes. Rescue 1122 not answering.',
      crisisTypes: ['power_outage', 'water_crisis', 'road_damage'],
      populationTrapped: true,
    },
  },
  {
    id: 'MUL-004',
    source: 'sensor',
    text: 'CORRELATED ALERT — Grid failure + water pressure drop + traffic congestion spike in Sector G-11 within 4-minute window',
    location: {
      coordinate: { latitude: 33.6655, longitude: 73.0130 },
      city: 'Islamabad',
      district: 'G-11',
      province: 'Federal Capital',
      label: 'Sensor Cluster G-11',
    },
    timestamp: MULTI_CRISIS_TS,
    type: 'multi_crisis',
    severity: 'critical',
    language: 'EN',
    rawPayload: {
      correlatedAlerts: [
        { sensor: 'GRID_API', zone: 'G-11', status: 'FAILURE', timestampOffset: 0 },
        { sensor: 'WATER_API', zone: 'G-11', pressureDrop: 65, timestampOffset: 120 },
        { sensor: 'TRAFFIC_API', zone: 'G-11', congestion: 'GRIDLOCK', timestampOffset: 240 },
      ],
      windowSeconds: 240,
      correlationConfidence: 0.92,
    },
  },
  {
    id: 'MUL-005',
    source: 'citizen_cluster',
    text: 'CLUSTER ALERT — 47 citizen reports received within 10 minutes from G-11 sector. Topics: power, flooding, road blockage, water',
    location: {
      coordinate: { latitude: 33.6649, longitude: 73.0126 },
      city: 'Islamabad',
      district: 'G-11',
      province: 'Federal Capital',
      label: 'G-11 Sector (citizen cluster)',
    },
    timestamp: ts(64),
    type: 'multi_crisis',
    severity: 'critical',
    language: 'EN',
    rawPayload: {
      reportCount: 47,
      windowMinutes: 10,
      topicBreakdown: {
        power_outage: 18,
        flood: 14,
        road_damage: 9,
        water_crisis: 6,
      },
      uniqueLocations: 12,
      sentimentScore: -0.87,
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Combined export — all 25 signals
// ─────────────────────────────────────────────────────────────

export const ALL_MOCK_SIGNALS: CrisisSignal[] = [
  ...POWER_OUTAGE_SIGNALS,
  ...FLOOD_WEATHER_SIGNALS,
  ...ROAD_DAMAGE_SIGNALS,
  ...WATER_UTILITY_SIGNALS,
  ...MULTI_CRISIS_SIGNALS,
];

/** Get signals filtered by crisis type */
export function getSignalsByType(type: CrisisSignal['type']): CrisisSignal[] {
  return ALL_MOCK_SIGNALS.filter((s) => s.type === type);
}

/** Get signals filtered by severity */
export function getSignalsBySeverity(severity: CrisisSignal['severity']): CrisisSignal[] {
  return ALL_MOCK_SIGNALS.filter((s) => s.severity === severity);
}

/** Get signals within a time window (offset minutes from base) */
export function getSignalsInWindow(startOffset: number, endOffset: number): CrisisSignal[] {
  const start = new Date(ts(startOffset)).getTime();
  const end = new Date(ts(endOffset)).getTime();
  return ALL_MOCK_SIGNALS.filter((s) => {
    const t = new Date(s.timestamp).getTime();
    return t >= start && t <= end;
  });
}

/** Generate fresh signals for dynamic demo */
export function generateFreshSignals(): CrisisSignal[] {
  const count = Math.floor(Math.random() * 4) + 5; // 5 to 8
  const shuffled = [...ALL_MOCK_SIGNALS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);
  
  const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
  
  return selected.map((sig) => {
    // Randomize timestamp to current time +/- some minutes
    const date = new Date();
    date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 60)); // within last hour
    
    // Randomize severity slightly
    let sevIdx = severities.indexOf(sig.severity as any);
    if (sevIdx >= 0) {
      const rand = Math.random();
      if (rand < 0.2 && sevIdx > 0) sevIdx--; // 20% chance to decrease
      else if (rand > 0.8 && sevIdx < 3) sevIdx++; // 20% chance to increase
    }
    const newSeverity = severities[sevIdx] ?? sig.severity;
    
    return {
      ...sig,
      id: `${sig.id}-${Math.random().toString(36).substring(2, 7)}`, // unique ID
      timestamp: date.toISOString(),
      severity: newSeverity,
    };
  });
}
