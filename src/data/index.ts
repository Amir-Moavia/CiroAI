// ─────────────────────────────────────────────────────────────
// CrisisAI — Data Layer Barrel Export
// ─────────────────────────────────────────────────────────────

// Mock signals
export {
  ALL_MOCK_SIGNALS,
  POWER_OUTAGE_SIGNALS,
  FLOOD_WEATHER_SIGNALS,
  ROAD_DAMAGE_SIGNALS,
  WATER_UTILITY_SIGNALS,
  MULTI_CRISIS_SIGNALS,
  getSignalsByType,
  getSignalsBySeverity,
  getSignalsInWindow,
} from './mockSignals';

export { FULL_DEMO_SIGNALS, SOCIAL_PRESETS } from './demoScenarios';

// Mock API simulators
export {
  weatherAPI,
  trafficAPI,
  gridAPI,
  utilityAPI,
} from './mockAPIResponses';

// Re-export API response types for convenience
export type {
  WeatherAlert,
  CongestionReport,
  PowerZoneStatus,
  WaterPressureReading,
} from './mockAPIResponses';
