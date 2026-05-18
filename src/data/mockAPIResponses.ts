// ═══════════════════════════════════════════════════════════════
// ⚠️  SYNTHETIC / MOCK API RESPONSES — NOT REAL DATA  ⚠️
// ═══════════════════════════════════════════════════════════════
//
// Simulates external API responses from Pakistan's infrastructure
// monitoring systems. All readings are fabricated for development
// and testing of the CrisisAI agent pipeline.
//
// APIs simulated:
//   - weatherAPI    → PMD-style flood / heatwave / storm alerts
//   - trafficAPI    → NTRC-style congestion + affected routes
//   - gridAPI       → IESCO/WAPDA-style zone power status
//   - utilityAPI    → CDA/WASA-style water pressure readings
// ═══════════════════════════════════════════════════════════════

// ── Type Definitions ────────────────────────────────────────

export interface WeatherAlert {
  alertId: string;
  type: 'flood' | 'heatwave' | 'storm' | 'smog' | 'clear';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  region: string;
  city: string;
  province: string;
  rainfallMM: number;
  temperatureC: number;
  humidity: number;
  windSpeedKPH: number;
  visibility: 'GOOD' | 'MODERATE' | 'POOR' | 'ZERO';
  floodRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  validFrom: string;
  validUntil: string;
  advisory: string;
  source: string;
}

export interface CongestionReport {
  zone: string;
  city: string;
  level: 'FREE_FLOW' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'GRIDLOCK';
  averageSpeedKPH: number;
  normalSpeedKPH: number;
  delayMinutes: number;
  affectedRoutes: string[];
  incidents: number;
  diversion: string | null;
  timestamp: string;
}

export interface PowerZoneStatus {
  zone: string;
  city: string;
  status: 'ONLINE' | 'PARTIAL' | 'LOAD_SHEDDING' | 'FAILURE';
  loadMW: number;
  capacityMW: number;
  utilizationPercent: number;
  affectedFeeders: number;
  totalFeeders: number;
  outageStarted: string | null;
  estimatedRestoration: string | null;
  cause: string | null;
}

export interface WaterPressureReading {
  zone: string;
  city: string;
  currentPSI: number;
  normalPSI: number;
  dropPercent: number;
  status: 'NORMAL' | 'LOW' | 'CRITICAL' | 'DRY';
  affectedConnections: number;
  suspectedCause: string | null;
  lastUpdated: string;
  tankerDispatched: boolean;
}

// ── Internal data stores (scenarios) ────────────────────────

const WEATHER_SCENARIOS: Record<string, WeatherAlert> = {
  islamabad_flood: {
    alertId: 'PMD-2026-ISB-FLOOD-042',
    type: 'flood',
    severity: 'HIGH',
    region: 'Potohar Plateau',
    city: 'Islamabad',
    province: 'Federal Capital',
    rainfallMM: 85,
    temperatureC: 28,
    humidity: 94,
    windSpeedKPH: 45,
    visibility: 'POOR',
    floodRisk: 'HIGH',
    validFrom: '2026-05-17T11:00:00+05:00',
    validUntil: '2026-05-17T23:00:00+05:00',
    advisory: 'Heavy rainfall expected. Low-lying areas of I-8, G-11, Faizabad at risk. Avoid underpasses.',
    source: 'Pakistan Meteorological Department (PMD)',
  },
  islamabad_heatwave: {
    alertId: 'PMD-2026-ISB-HEAT-011',
    type: 'heatwave',
    severity: 'CRITICAL',
    region: 'Potohar Plateau',
    city: 'Islamabad',
    province: 'Federal Capital',
    rainfallMM: 0,
    temperatureC: 44,
    humidity: 28,
    windSpeedKPH: 6,
    visibility: 'MODERATE',
    floodRisk: 'NONE',
    validFrom: '2026-05-17T06:00:00+05:00',
    validUntil: '2026-05-19T18:00:00+05:00',
    advisory: 'Extreme heatwave. Blue Area, F-7, G-9 heat index critical. Avoid outdoor work 11AM–5PM. Open cooling centres.',
    source: 'Pakistan Meteorological Department (PMD)',
  },
  karachi_heatwave: {
    alertId: 'PMD-2026-KHI-HEAT-019',
    type: 'heatwave',
    severity: 'CRITICAL',
    region: 'Sindh Coast',
    city: 'Karachi',
    province: 'Sindh',
    rainfallMM: 0,
    temperatureC: 47,
    humidity: 22,
    windSpeedKPH: 8,
    visibility: 'MODERATE',
    floodRisk: 'NONE',
    validFrom: '2026-05-17T06:00:00+05:00',
    validUntil: '2026-05-19T18:00:00+05:00',
    advisory: 'Extreme heat advisory. Stay hydrated. Avoid outdoor activity 11AM–4PM. Heat stroke risk critical.',
    source: 'Pakistan Meteorological Department (PMD)',
  },
  lahore_storm: {
    alertId: 'PMD-2026-LHR-STORM-007',
    type: 'storm',
    severity: 'MEDIUM',
    region: 'Central Punjab',
    city: 'Lahore',
    province: 'Punjab',
    rainfallMM: 42,
    temperatureC: 33,
    humidity: 78,
    windSpeedKPH: 72,
    visibility: 'POOR',
    floodRisk: 'MODERATE',
    validFrom: '2026-05-17T15:00:00+05:00',
    validUntil: '2026-05-17T21:00:00+05:00',
    advisory: 'Thunderstorm with gusty winds. Secure loose objects. Power outages likely in Gulberg and Model Town.',
    source: 'Pakistan Meteorological Department (PMD)',
  },
  clear: {
    alertId: 'PMD-2026-CLEAR',
    type: 'clear',
    severity: 'LOW',
    region: 'General',
    city: 'N/A',
    province: 'N/A',
    rainfallMM: 0,
    temperatureC: 30,
    humidity: 45,
    windSpeedKPH: 12,
    visibility: 'GOOD',
    floodRisk: 'NONE',
    validFrom: '2026-05-17T00:00:00+05:00',
    validUntil: '2026-05-17T23:59:59+05:00',
    advisory: 'No significant weather events expected.',
    source: 'Pakistan Meteorological Department (PMD)',
  },
};

const CONGESTION_DATA: Record<string, CongestionReport> = {
  gt_road: {
    zone: 'GT Road Corridor',
    city: 'Rawalpindi',
    level: 'GRIDLOCK',
    averageSpeedKPH: 4,
    normalSpeedKPH: 35,
    delayMinutes: 47,
    affectedRoutes: ['GT Road', 'Pirwadhai Road', 'Murree Road Link', 'Saddar Bazaar Road'],
    incidents: 3,
    diversion: 'Use IJP Road → Islamabad Expressway → Rawat Bypass',
    timestamp: '2026-05-17T14:06:00+05:00',
  },
  faizabad: {
    zone: 'Faizabad Interchange',
    city: 'Islamabad',
    level: 'HEAVY',
    averageSpeedKPH: 8,
    normalSpeedKPH: 50,
    delayMinutes: 32,
    affectedRoutes: ['Murree Road', 'Islamabad Expressway', 'IJP Road On-ramp'],
    incidents: 1,
    diversion: 'Use Margalla Road or 7th Avenue',
    timestamp: '2026-05-17T14:22:00+05:00',
  },
  blue_area: {
    zone: 'Blue Area / Jinnah Avenue',
    city: 'Islamabad',
    level: 'MODERATE',
    averageSpeedKPH: 18,
    normalSpeedKPH: 40,
    delayMinutes: 15,
    affectedRoutes: ['Jinnah Avenue', 'Atatürk Avenue', 'Constitution Avenue'],
    incidents: 0,
    diversion: null,
    timestamp: '2026-05-17T14:55:00+05:00',
  },
  g11: {
    zone: 'G-11 Sector',
    city: 'Islamabad',
    level: 'GRIDLOCK',
    averageSpeedKPH: 2,
    normalSpeedKPH: 30,
    delayMinutes: 55,
    affectedRoutes: ['G-11 Main Road', 'Khayaban-e-Iqbal', 'Service Road G-10/G-11'],
    incidents: 5,
    diversion: 'Sector completely impassable. Avoid entirely.',
    timestamp: '2026-05-17T15:00:00+05:00',
  },
};

const POWER_DATA: Record<string, PowerZoneStatus> = {
  'zone-3': {
    zone: 'Zone-3',
    city: 'Islamabad',
    status: 'FAILURE',
    loadMW: 0,
    capacityMW: 340,
    utilizationPercent: 0,
    affectedFeeders: 12,
    totalFeeders: 18,
    outageStarted: '2026-05-17T14:01:00+05:00',
    estimatedRestoration: null,
    cause: 'Grid cascade failure following transformer overload',
  },
  'f-7': {
    zone: 'F-7',
    city: 'Islamabad',
    status: 'FAILURE',
    loadMW: 0,
    capacityMW: 120,
    utilizationPercent: 0,
    affectedFeeders: 6,
    totalFeeders: 8,
    outageStarted: '2026-05-17T12:00:00+05:00',
    estimatedRestoration: '2026-05-17T16:00:00+05:00',
    cause: 'Feeder tripping due to overload',
  },
  'g-11': {
    zone: 'G-11',
    city: 'Islamabad',
    status: 'FAILURE',
    loadMW: 0,
    capacityMW: 85,
    utilizationPercent: 0,
    affectedFeeders: 4,
    totalFeeders: 5,
    outageStarted: '2026-05-17T14:00:00+05:00',
    estimatedRestoration: null,
    cause: 'Waterlogged transformer station — safety shutdown',
  },
  saddar: {
    zone: 'Saddar',
    city: 'Rawalpindi',
    status: 'FAILURE',
    loadMW: 0,
    capacityMW: 200,
    utilizationPercent: 0,
    affectedFeeders: 9,
    totalFeeders: 14,
    outageStarted: '2026-05-17T14:03:00+05:00',
    estimatedRestoration: '2026-05-17T18:00:00+05:00',
    cause: 'Transformer explosion at Saddar grid station',
  },
  'i-8': {
    zone: 'I-8',
    city: 'Islamabad',
    status: 'PARTIAL',
    loadMW: 30,
    capacityMW: 95,
    utilizationPercent: 31.6,
    affectedFeeders: 3,
    totalFeeders: 6,
    outageStarted: '2026-05-17T14:15:00+05:00',
    estimatedRestoration: '2026-05-17T17:00:00+05:00',
    cause: 'Flood-related short circuit on 3 feeders',
  },
  online_default: {
    zone: 'Unknown',
    city: 'N/A',
    status: 'ONLINE',
    loadMW: 280,
    capacityMW: 340,
    utilizationPercent: 82.4,
    affectedFeeders: 0,
    totalFeeders: 18,
    outageStarted: null,
    estimatedRestoration: null,
    cause: null,
  },
};

const WATER_DATA: Record<string, WaterPressureReading> = {
  'dha-2': {
    zone: 'DHA-2',
    city: 'Rawalpindi',
    currentPSI: 12,
    normalPSI: 55,
    dropPercent: 78,
    status: 'CRITICAL',
    affectedConnections: 2400,
    suspectedCause: 'Main pipeline rupture on DHA Phase 2 boulevard',
    lastUpdated: '2026-05-17T14:38:00+05:00',
    tankerDispatched: true,
  },
  'e-7': {
    zone: 'E-7',
    city: 'Islamabad',
    currentPSI: 3,
    normalPSI: 50,
    dropPercent: 94,
    status: 'DRY',
    affectedConnections: 1800,
    suspectedCause: 'CDA pump station offline — motor failure',
    lastUpdated: '2026-05-14T09:00:00+05:00',
    tankerDispatched: false,
  },
  'g-9': {
    zone: 'G-9',
    city: 'Islamabad',
    currentPSI: 20,
    normalPSI: 48,
    dropPercent: 58,
    status: 'LOW',
    affectedConnections: 3200,
    suspectedCause: 'Sewage line cross-contamination — supply diverted',
    lastUpdated: '2026-05-17T14:50:00+05:00',
    tankerDispatched: true,
  },
  'g-11': {
    zone: 'G-11',
    city: 'Islamabad',
    currentPSI: 8,
    normalPSI: 52,
    dropPercent: 84.6,
    status: 'CRITICAL',
    affectedConnections: 2900,
    suspectedCause: 'Power outage to pump station — cascading failure',
    lastUpdated: '2026-05-17T15:00:00+05:00',
    tankerDispatched: false,
  },
  normal: {
    zone: 'Unknown',
    city: 'N/A',
    currentPSI: 50,
    normalPSI: 52,
    dropPercent: 3.8,
    status: 'NORMAL',
    affectedConnections: 0,
    suspectedCause: null,
    lastUpdated: '2026-05-17T15:00:00+05:00',
    tankerDispatched: false,
  },
};

// ── Simulated delay helper ──────────────────────────────────

function simulateLatency(minMs = 100, maxMs = 600): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API SIMULATORS
// ═══════════════════════════════════════════════════════════════

/**
 * weatherAPI — Pakistan Meteorological Department style alerts
 */
export const weatherAPI = {
  /**
   * Get active weather alert for a region.
   * @param region  Key like 'islamabad_flood', 'karachi_heatwave', 'lahore_storm'
   */
  async getAlert(region = 'islamabad_flood'): Promise<WeatherAlert> {
    await simulateLatency();
    const key = region.toLowerCase().replace(/\s+/g, '_');
    return WEATHER_SCENARIOS[key] ?? WEATHER_SCENARIOS.clear;
  },

  /** List all active alerts across Pakistan */
  async listActiveAlerts(): Promise<WeatherAlert[]> {
    await simulateLatency(200, 800);
    return Object.values(WEATHER_SCENARIOS).filter((a) => a.type !== 'clear');
  },
};

/**
 * trafficAPI — National Transport Research Centre style data
 */
export const trafficAPI = {
  /**
   * Get congestion report for a specific zone.
   * @param zone  Key like 'gt_road', 'faizabad', 'blue_area', 'g11'
   */
  async getCongestion(zone: string): Promise<CongestionReport> {
    await simulateLatency();
    const key = zone.toLowerCase().replace(/[\s-]+/g, '_');
    const report = CONGESTION_DATA[key];

    if (report) return report;

    // Default: free-flowing traffic
    return {
      zone,
      city: 'Unknown',
      level: 'FREE_FLOW',
      averageSpeedKPH: 40,
      normalSpeedKPH: 40,
      delayMinutes: 0,
      affectedRoutes: [],
      incidents: 0,
      diversion: null,
      timestamp: new Date().toISOString(),
    };
  },

  /** List all zones with congestion ≥ HEAVY */
  async getCongestedZones(): Promise<CongestionReport[]> {
    await simulateLatency(200, 800);
    return Object.values(CONGESTION_DATA).filter(
      (r) => r.level === 'HEAVY' || r.level === 'GRIDLOCK'
    );
  },
};

/**
 * gridAPI — IESCO / WAPDA style power grid monitoring
 */
export const gridAPI = {
  /**
   * Get power status for a specific zone.
   * @param zone  Key like 'zone-3', 'f-7', 'g-11', 'saddar', 'i-8'
   */
  async getZoneStatus(zone: string): Promise<PowerZoneStatus> {
    await simulateLatency();
    const key = zone.toLowerCase().replace(/\s+/g, '-');
    return POWER_DATA[key] ?? POWER_DATA.online_default;
  },

  /** List all zones currently in FAILURE or PARTIAL state */
  async getOutageZones(): Promise<PowerZoneStatus[]> {
    await simulateLatency(200, 800);
    return Object.values(POWER_DATA).filter(
      (z) => z.status === 'FAILURE' || z.status === 'PARTIAL'
    );
  },

  /** Calculate total affected population estimate */
  async getAffectedEstimate(): Promise<{ totalFeedersDown: number; estimatedPopulation: number }> {
    await simulateLatency();
    const outages = Object.values(POWER_DATA).filter((z) => z.status !== 'ONLINE');
    const feeders = outages.reduce((sum, z) => sum + z.affectedFeeders, 0);
    return {
      totalFeedersDown: feeders,
      estimatedPopulation: feeders * 8500, // ~8500 people per feeder
    };
  },
};

/**
 * utilityAPI — CDA / WASA style water pressure monitoring
 */
export const utilityAPI = {
  /**
   * Get water pressure reading for a specific zone.
   * @param zone  Key like 'dha-2', 'e-7', 'g-9', 'g-11'
   */
  async getWaterPressure(zone: string): Promise<WaterPressureReading> {
    await simulateLatency();
    const key = zone.toLowerCase().replace(/\s+/g, '-');
    return WATER_DATA[key] ?? WATER_DATA.normal;
  },

  /** List all zones with water status ≤ LOW */
  async getCriticalZones(): Promise<WaterPressureReading[]> {
    await simulateLatency(200, 800);
    return Object.values(WATER_DATA).filter(
      (z) => z.status === 'LOW' || z.status === 'CRITICAL' || z.status === 'DRY'
    );
  },

  /** Get aggregate water system health */
  async getSystemHealth(): Promise<{
    totalZones: number;
    normalZones: number;
    criticalZones: number;
    totalAffectedConnections: number;
  }> {
    await simulateLatency();
    const zones = Object.values(WATER_DATA).filter((z) => z.zone !== 'Unknown');
    const critical = zones.filter(
      (z) => z.status === 'LOW' || z.status === 'CRITICAL' || z.status === 'DRY'
    );
    return {
      totalZones: zones.length,
      normalZones: zones.length - critical.length,
      criticalZones: critical.length,
      totalAffectedConnections: critical.reduce((sum, z) => sum + z.affectedConnections, 0),
    };
  },
};
