// ─────────────────────────────────────────────────────────────
// Flagship hackathon demo — Islamabad infrastructure collapse
// ─────────────────────────────────────────────────────────────

import type { CrisisType } from '../types';

export const FULL_DEMO_SIGNALS: string[] = [
  'Power outage across Sector F-7 for 2 hours — no electricity',
  'Bridge near GT Road cracked after heavy traffic — road unsafe',
  'Internet services down in entire G-11 area',
  'Saddar mein transformer phat gaya hai, poora ilaqa andhere mein hai',
  'Water pipeline burst in DHA Phase 2 — flooding on main road',
  'Signal lights not working at Faizabad intersection',
  'Traffic completely stuck on Murree Road near Zero Point',
  'Multiple transformers failing — IESCO grid alert zone 3',
];

export const SOCIAL_PRESETS: { label: string; text: string }[] = [
  { label: 'F-7 Power', text: 'Power outage across Sector F-7 for 2 hours' },
  { label: 'GT Road Bridge', text: 'Bridge near GT Road cracked after heavy traffic' },
  { label: 'G-11 Internet', text: 'Internet services down in entire G-11 area' },
  { label: 'DHA Water', text: 'Water pipeline burst in DHA Phase 2' },
  { label: 'Urdu Saddar', text: 'Saddar mein transformer phat gaya hai, poora ilaqa andhere mein hai' },
  { label: 'G-10 Flood', text: 'G-10 mein pani bhar gaya hai, gaariyan phans gayi hain' },
];

/** One-tap challenge scenarios with citizen report + API feeds */
export interface ChallengeScenario {
  id: string;
  emoji: string;
  label: string;
  text: string;
  primaryType: CrisisType;
  description: string;
}

export const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  {
    id: 'flood_g10',
    emoji: '🌊',
    label: 'G-10 Flood',
    text: 'G-10 mein pani bhar gaya hai, gaariyan phans gayi hain',
    primaryType: 'flood',
    description: 'Urdu citizen report + rainfall weather + traffic congestion feeds',
  },
  {
    id: 'heatwave',
    emoji: '🌡️',
    label: 'Heatwave',
    text: 'Extreme heat in Blue Area Islamabad — people fainting outdoors, need cooling centres and water',
    primaryType: 'heatwave',
    description: 'Citizen heat report + PMD heatwave alert API',
  },
  {
    id: 'accident',
    emoji: '🚗',
    label: 'Accident / Blockage',
    text: 'Major accident on GT Road near Faizabad — 3 vehicles crashed, road completely blocked, ambulances stuck',
    primaryType: 'road_damage',
    description: 'Citizen accident report + traffic gridlock API spike',
  },
];
