// ─────────────────────────────────────────────────────────────
// Primary crisis type — avoid API feeds forcing "multi_crisis"
// ─────────────────────────────────────────────────────────────

import type { CrisisSignal, CrisisType } from '../types';

const API_SOURCES = new Set(['weather_api', 'traffic_api', 'utility_api', 'sensor', 'api']);

const CRISIS_KEYWORDS: Partial<Record<CrisisType, RegExp>> = {
  flood: /\b(flood|flooding|barish|pani|water level|flash flood|underpass|gaariyan phans)\b/i,
  power_outage: /\b(power|electricity|bijli|load shedding|transformer|grid|wapda)\b/i,
  road_damage: /\b(road|bridge|pothole|gt road|traffic|highway|crack|accident|crash|collision|blocked|blockage)\b/i,
  water_crisis: /\b(water supply|taps dry|no water|pipeline burst)\b/i,
  heatwave: /\b(heatwave|heat wave|extreme heat|heatstroke|heat stroke|garmi|lu chal|temperature|44c|45c)\b/i,
  fire: /\b(fire|smoke|blaze)\b/i,
  earthquake: /\b(earthquake|tremor|quake)\b/i,
};

export function inferCrisisTypeFromText(text: string): CrisisType {
  const scores: Partial<Record<CrisisType, number>> = {};
  for (const [type, regex] of Object.entries(CRISIS_KEYWORDS) as [CrisisType, RegExp][]) {
    if (regex.test(text)) scores[type] = (scores[type] ?? 0) + 1;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [CrisisType, number][];
  return ranked[0]?.[0] ?? 'unknown';
}

export function isApiSignal(signal: CrisisSignal): boolean {
  return API_SOURCES.has(signal.source);
}

/** Prefer citizen/social signals when picking the headline crisis type */
export function primaryCrisisTypeFromSignals(signals: CrisisSignal[]): CrisisType {
  const human = signals.filter((s) => !isApiSignal(s));
  const pool = human.length > 0 ? human : signals;

  const counts: Partial<Record<CrisisType, number>> = {};
  for (const s of pool) {
    const weight = isApiSignal(s) ? 1 : 3;
    counts[s.type] = (counts[s.type] ?? 0) + weight;
  }

  const ranked = (Object.entries(counts) as [CrisisType, number][]).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'unknown';

  const humanOnlyCounts = human.reduce<Partial<Record<CrisisType, number>>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {});
  const humanTypes = Object.keys(humanOnlyCounts) as CrisisType[];

  if (humanTypes.length >= 2) {
    const sorted = humanTypes.sort((a, b) => (humanOnlyCounts[b] ?? 0) - (humanOnlyCounts[a] ?? 0));
    if ((humanOnlyCounts[sorted[1]] ?? 0) >= 2) return 'multi_crisis';
  }

  return ranked[0][0];
}
