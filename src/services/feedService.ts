// ─────────────────────────────────────────────────────────────
// Feed Service — Simulated weather, traffic, power APIs
// ─────────────────────────────────────────────────────────────

import { gridAPI, trafficAPI, weatherAPI } from '../data/mockAPIResponses';
import type { CrisisSignal, Coordinate, CrisisType, Location } from '../types';

export interface SimulatedFeeds {
  weather: string;
  traffic: string;
  power: string;
  rawInputs: Array<Record<string, unknown>>;
}

function zoneFromLocation(loc?: Location): string {
  const label = (loc?.district ?? loc?.label ?? loc?.city ?? 'f-7').toLowerCase();
  if (label.includes('saddar')) return 'saddar';
  if (label.includes('g-11')) return 'g-11';
  if (label.includes('g-9')) return 'g-9';
  if (label.includes('blue')) return 'blue_area';
  if (label.includes('faizabad')) return 'faizabad';
  if (label.includes('gt')) return 'gt-road';
  if (label.includes('dha')) return 'dha-2';
  return 'f-7';
}

function weatherRegion(primaryType?: CrisisType, zone?: string): string {
  if (primaryType === 'heatwave') return 'islamabad_heatwave';
  if (primaryType === 'flood') return zone?.includes('saddar') ? 'lahore_storm' : 'islamabad_flood';
  if (!primaryType) return 'islamabad_flood';
  return 'clear';
}

function trafficZone(primaryType?: CrisisType, zone?: string): string {
  if (primaryType === 'road_damage') return 'gt_road';
  if (primaryType === 'flood') return zone?.includes('g-11') ? 'g11' : 'faizabad';
  return zone?.replace(/-/g, '_') ?? 'f-7';
}

export async function fetchSimulatedFeeds(
  location?: Location,
  primaryType?: CrisisType,
): Promise<SimulatedFeeds> {
  const zone = zoneFromLocation(location);
  const trafficKey = trafficZone(primaryType, zone);

  const [weather, congestion, power] = await Promise.all([
    weatherAPI.getAlert(weatherRegion(primaryType, zone)),
    trafficAPI.getCongestion(trafficKey),
    gridAPI.getZoneStatus(zone),
  ]);

  const weatherText = `${weather.type.toUpperCase()}: ${weather.advisory} (${weather.city})`;
  const trafficText = congestion.incidents > 0
    ? `Traffic ${congestion.level} on ${congestion.affectedRoutes.join(', ') || zone} — ${congestion.incidents} incident(s), delay ${congestion.delayMinutes}min`
    : `Traffic ${congestion.level} on ${congestion.affectedRoutes.join(', ') || zone} — delay ${congestion.delayMinutes}min`;
  const powerText = power.status === 'ONLINE'
    ? `Grid ${zone}: online`
    : `GRID FAILURE ${zone}: ${power.cause ?? 'unknown'} — ${power.affectedFeeders}/${power.totalFeeders} feeders down`;

  const weatherType: CrisisType =
    weather.type === 'flood' ? 'flood'
    : weather.type === 'heatwave' ? 'heatwave'
    : 'infrastructure_failure';

  const allFeeds: Array<Record<string, unknown>> = [
    { source: 'weather_api', text: weatherText, type: weatherType },
    { source: 'traffic_api', text: trafficText, type: 'road_damage' },
    { source: 'utility_api', text: powerText, type: power.status !== 'ONLINE' ? 'power_outage' : 'infrastructure_failure' },
  ];

  const rawInputs = primaryType
    ? allFeeds.filter((f) => {
        const t = f.type as CrisisType;
        if (primaryType === 'flood') return t === 'flood' || t === 'road_damage';
        if (primaryType === 'heatwave') return t === 'heatwave';
        if (primaryType === 'power_outage') return t === 'power_outage' || t === 'infrastructure_failure';
        if (primaryType === 'road_damage') return t === 'road_damage';
        if (primaryType === 'water_crisis') return t === 'power_outage' || t === 'infrastructure_failure';
        return t === primaryType;
      })
    : allFeeds;

  return {
    weather: weatherText,
    traffic: trafficText,
    power: powerText,
    rawInputs: rawInputs.length > 0 ? rawInputs : allFeeds.slice(0, 1),
  };
}

export function feedsToSummary(feeds: SimulatedFeeds): string {
  return `Weather: ${feeds.weather}\nTraffic: ${feeds.traffic}\nPower: ${feeds.power}`;
}

export function makeFeedSignal(
  text: string,
  source: CrisisSignal['source'],
  coordinate: Coordinate,
): Record<string, unknown> {
  return {
    source,
    text,
    location: { coordinate, label: 'Feed zone' },
    timestamp: new Date().toISOString(),
  };
}

/** Build citizen report + matching API feeds for challenge demo scenarios */
export async function buildScenarioInputs(
  citizenText: string,
  primaryType: CrisisType,
): Promise<Array<string | Record<string, unknown>>> {
  const feeds = await fetchSimulatedFeeds(undefined, primaryType);
  return [citizenText, ...feeds.rawInputs];
}
