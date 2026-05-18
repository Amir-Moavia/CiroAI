// ─────────────────────────────────────────────────────────────
// CrisisAI — Edge Case / Robustness Scenarios
// ─────────────────────────────────────────────────────────────
// Each scenario demonstrates observable failure handling.
// ─────────────────────────────────────────────────────────────

export interface EdgeScenario {
  id: string;
  label: string;
  emoji: string;
  tag: string;
  description: string;
  inputs: string[];
  expectedBehavior: string[];
}

export const EDGE_SCENARIOS: EdgeScenario[] = [
  {
    id: 'missing_location',
    label: 'Missing Location Data',
    emoji: '📍',
    tag: 'SCENARIO A',
    description: 'Signal has no extractable location — system must infer from nearby signals',
    inputs: [
      'transformer blast somewhere in the city, very bad',
      'Power outage across Sector F-7 for 2 hours',
      'Electricity gone in F-7 since morning, WAPDA not responding',
      'All signal lights off near F-7, accidents happening',
    ],
    expectedBehavior: [
      '⚠ EDGE CASE: No location in signal #1. Input Agent tags as LOCATION_UNKNOWN',
      '🔍 Detection Agent: searches nearby signals → infers F-7 from 3 matches',
      '📊 Confidence reduced: 94% → 60% due to unconfirmed location',
      '📋 User shown: "Location unconfirmed — showing probable area based on signal cluster"',
    ],
  },
  {
    id: 'contradiction',
    label: 'Contradictory Signals',
    emoji: '⚔️',
    tag: 'SCENARIO B',
    description: 'API says power normal but 15 citizens report outage — who to trust?',
    inputs: [
      'GRID_API reports: Power status NORMAL in Zone-3. All feeders operational.',
      'No power in F-7 since 3 hours! Complete darkness!',
      'Bijli nahi hai F-7 mein! Transformer phat gaya!',
      'F-7 markaz all shops closed due to power failure',
      'Traffic lights off in F-7, very dangerous',
      'Hospital backup generator running in F-7, main power gone',
      'WAPDA meter shows zero in our area F-7',
      'Children studying by candle light in F-7, power gone 4 hours',
      'F-7/1 completely dark, elderly neighbour needs oxygen machine',
      'Power outage F-7 sector, UPS also drained now',
      'Street lights all off in F-7, mugging reported',
      'Transformer in F-7/2 making sparking sounds before failure',
      'AC repair shop F-7 says transformer exploded at 2pm',
      'F-7/4 residents protesting on road due to no electricity',
      'Even mobile towers down in F-7 due to power, no signal',
      'F-7 school sent children home early due to no power or fans',
    ],
    expectedBehavior: [
      '⚠ CONTRADICTION: GRID_API reports NORMAL power. 15 citizen signals report OUTAGE',
      '🔍 Detection Agent: flags API data as potentially STALE',
      '📊 Analysis: weighs 15 crowd signals (weight 0.85) over 1 API signal (weight 0.15)',
      '✅ Crisis CONFIRMED despite API contradiction. API flagged for recalibration',
    ],
  },
  {
    id: 'resource_unavailable',
    label: 'Resource Unavailable',
    emoji: '🚫',
    tag: 'SCENARIO C',
    description: 'Primary repair team busy — system must activate fallback from another zone',
    inputs: [
      'Power outage across Sector F-7 for 2 hours',
      'Sudden grid failure Zone-3 — load shedding threshold exceeded',
      'All signal lights off near zero point, accidents happening',
      'Saddar mein transformer phat gaya hai, poora ilaqa andhere mein hai',
      'Electricity gone in G-11 since morning, WAPDA not responding',
    ],
    expectedBehavior: [
      '✅ Pipeline runs normally through Agents 1-4',
      '⚠ FALLBACK: Primary repair team Zone-3 UNAVAILABLE (busy at another site)',
      '🔄 Simulation Agent: activates backup team from Zone-4',
      '⏱ ETA adjusted: 12 mins → 20 mins (+8 mins for backup team travel)',
      '📋 Log: "Backup team dispatched. Zone-4 → F-7. Adjusted ETA: 20 mins"',
    ],
  },
  {
    id: 'resource_conflict',
    label: 'Multi-Crisis Resource Conflict',
    emoji: '⚖️',
    tag: 'SCENARIO D',
    description: 'Two crises compete for one team — system must prioritise hospital over residential',
    inputs: [
      'Power out in F-6, hospital backup generator failing!',
      'Patients on ventilators at risk! F-6 hospital emergency!',
      'Hospital oxygen supply depends on electricity, critical!',
      'Power also out in G-11 residential area, 3 hours now',
      'G-11 markaz shops all closed, residents frustrated',
    ],
    expectedBehavior: [
      '📊 Two crisis zones detected: F-6 (hospital) and G-11 (residential)',
      '⚠ RESOURCE CONFLICT: Only 1 repair team available for 2 crises',
      '⚖️ Planning Agent: F-6 hospital = CRITICAL (life safety), G-11 = HIGH (residential)',
      '✅ Decision: Dispatch team to F-6 hospital FIRST. G-11 gets second team ETA +15 mins',
      '📋 Trade-off logged and explained to operators',
    ],
  },
  {
    id: 'low_signal',
    label: 'Insufficient Signal Quality',
    emoji: '📉',
    tag: 'SCENARIO E',
    description: 'Only 1 vague signal, no confirmation — system must NOT generate false alarm',
    inputs: [
      'I think something might be wrong with electricity somewhere nearby maybe',
    ],
    expectedBehavior: [
      '📥 Input Agent: signal ingested but flagged LOW confidence',
      '🔍 Detection Agent: only 1 signal, no cluster, no sensor confirmation',
      '❌ Cross-correlation: FAILED — insufficient data',
      '🚫 NO crisis alert generated (prevents false alarm)',
      '📋 Status: UNCONFIRMED — "Monitoring for additional reports"',
    ],
  },
];
