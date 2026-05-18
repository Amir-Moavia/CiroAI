// ─────────────────────────────────────────────────────────────
// Naive keyword heuristic — for baseline / comparison demos only
// ─────────────────────────────────────────────────────────────

import type { CrisisSignal } from '../types';
import { isApiSignal } from './primaryCrisisType';

export interface NaiveHeuristicMatch {
  matchedRule: string;
  category: string;
  matchedIn: 'citizen' | 'api' | 'mixed';
}

const PATTERNS: Array<{ regex: RegExp; rule: string; category: string }> = [
  { regex: /\b(power|electricity|bijli|transformer|grid|blackout|wapda|load\s*shedding)\b/i, rule: 'power / electricity', category: 'POWER OUTAGE' },
  { regex: /\b(flood|flooding|barish|submerge|underpass|flash\s*flood)\b/i, rule: 'flood / water', category: 'FLOOD' },
  { regex: /\b(road|bridge|pothole|landslide|accident|crash|collision|blockage)\b/i, rule: 'road / accident', category: 'ROAD DAMAGE' },
  { regex: /\b(fire|aag|blaze|smoke)\b/i, rule: 'fire', category: 'FIRE' },
  { regex: /\b(water\s*supply|taps\s*dry|pipeline\s*burst|sewage|tanker)\b/i, rule: 'water supply', category: 'WATER CRISIS' },
  { regex: /\b(heatwave|heat\s*wave|heatstroke|extreme\s*heat|garmi)\b/i, rule: 'heatwave', category: 'HEATWAVE' },
];

/** Words that must never be shown as the "matched keyword" (weather API noise, etc.) */
const NOT_KEYWORDS = new Set([
  'clear', 'normal', 'online', 'weather', 'advisory', 'expected', 'significant',
  'events', 'traffic', 'congestion', 'delay', 'minutes', 'islamabad', 'pakistan',
  'status', 'operational', 'moderate', 'heavy', 'light', 'free', 'flow', 'gridlock',
]);

export function naiveHeuristicFromSignals(signals: CrisisSignal[]): NaiveHeuristicMatch {
  const human = signals.filter((s) => !isApiSignal(s));
  const api = signals.filter((s) => isApiSignal(s));
  const pools: Array<{ text: string; kind: 'citizen' | 'api' }> = [
    ...human.map((s) => ({ text: s.text, kind: 'citizen' as const })),
    ...api.map((s) => ({ text: s.text, kind: 'api' as const })),
  ];

  for (const { text, kind } of pools) {
    for (const p of PATTERNS) {
      if (p.regex.test(text)) {
        return {
          matchedRule: p.rule,
          category: p.category,
          matchedIn: kind === 'citizen' ? 'citizen' : 'api',
        };
      }
    }
  }

  return { matchedRule: 'no crisis keyword', category: 'UNKNOWN', matchedIn: human.length ? 'citizen' : 'api' };
}

/** @deprecated — do not use first long token; kept for tests */
export function pickMisleadingKeyword(signals: CrisisSignal[]): string | null {
  const first = signals[0]?.text ?? '';
  const token = first.split(/\s+/).find((w) => {
    const bare = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return bare.length > 4 && !NOT_KEYWORDS.has(bare);
  });
  return token?.replace(/[^a-zA-Z]/g, '') ?? null;
}
