// ─────────────────────────────────────────────────────────────
// CrisisAI — App Configuration
// ─────────────────────────────────────────────────────────────

import { parseApiKeys } from '../utils/apiKeyPool';

export const APP_CONFIG = {
  name: 'CrisisAI',
  version: '1.0.0',
  /** Set in .env as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY — used for Geocoding/Directions REST calls */
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  /** Comma-separated in EXPO_PUBLIC_GEMINI_API_KEYS (or single EXPO_PUBLIC_GEMINI_API_KEY) */
  geminiApiKeys: parseApiKeys(
    process.env.EXPO_PUBLIC_GEMINI_API_KEYS,
    process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  ),
  /** Comma-separated Groq keys — primary LLM when Gemini quota is hit */
  groqApiKeys: parseApiKeys(process.env.EXPO_PUBLIC_GROQ_API_KEYS),
  /** @deprecated use geminiApiKeys[0] */
  geminiApiKey: parseApiKeys(
    process.env.EXPO_PUBLIC_GEMINI_API_KEYS,
    process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  )[0] ?? '',
  useRemoteBackend: false, // Switch to true to route pipeline runs to a real FastAPI server
  apiBaseUrl: 'http://localhost:8000/api/v1',
  mapDefaultRegion: {
    latitude: 30.3753,
    longitude: 69.3451,
    latitudeDelta: 8,
    longitudeDelta: 8,
  },
  refreshIntervalMs: 15_000,
  maxSignalsPerEvent: 50,
  agentTimeoutMs: 30_000,
} as const;
