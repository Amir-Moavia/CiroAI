// ─────────────────────────────────────────────────────────────
// Geocoding — static Pakistan lookup + Google Geocoding REST API
// ─────────────────────────────────────────────────────────────

import { APP_CONFIG } from '../constants/config';
import { lookupPlace } from '../constants/pakistanLocations';
import type { Coordinate } from '../types';

const ISLAMABAD_FALLBACK: Coordinate = { latitude: 33.6844, longitude: 73.0479 };

export type GeocodeSource = 'static' | 'google' | 'fallback';

export interface GeocodeResult {
  coordinate: Coordinate;
  label?: string;
  source: GeocodeSource;
}

export function extractLocationQuery(text: string): string | null {
  const place = lookupPlace(text);
  if (place) return `${place.name}, ${place.city}`;
  const m = text.match(/\b(f-\d+|g-\d+|saddar|gt\s*road|dha[^,]*|sector\s*[a-z]-?\d+)/i);
  return m ? `${m[0]}, Islamabad` : null;
}

/** Offline lookup — always works for known Pakistan places */
export function geocodeStatic(text: string): GeocodeResult | null {
  const place = lookupPlace(text);
  if (!place) return null;
  return {
    coordinate: { latitude: place.latitude, longitude: place.longitude },
    label: `${place.name}, ${place.city}`,
    source: 'static',
  };
}

export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const staticResult = geocodeStatic(query);
  if (staticResult) return staticResult;

  const key = APP_CONFIG.googleMapsApiKey;
  if (!key || key.startsWith('AQ.')) {
    return null;
  }

  const q = query.toLowerCase().includes('pakistan') ? query : `${query}, Pakistan`;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      console.warn('[Geocoding] Google API:', data.status, data.error_message ?? '');
      return null;
    }
    const { lat, lng } = data.results[0].geometry.location;
    return {
      coordinate: { latitude: lat, longitude: lng },
      label: data.results[0].formatted_address,
      source: 'google',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeFromSignalText(text: string): Promise<GeocodeResult | null> {
  const query = extractLocationQuery(text);
  if (!query) return geocodeStatic(text);
  return geocodeLocation(query);
}

export async function geocodeWithFallback(text: string, current?: Coordinate): Promise<Coordinate> {
  if (
    current &&
    (Math.abs(current.latitude - ISLAMABAD_FALLBACK.latitude) > 0.001 ||
      Math.abs(current.longitude - ISLAMABAD_FALLBACK.longitude) > 0.001)
  ) {
    return current;
  }
  const result = await geocodeFromSignalText(text);
  return result?.coordinate ?? ISLAMABAD_FALLBACK;
}

/** Test whether Google Maps Geocoding accepts the configured key */
export async function testGoogleMapsApiKey(): Promise<{
  ok: boolean;
  status: string;
  message: string;
}> {
  const key = APP_CONFIG.googleMapsApiKey;
  if (!key) {
    return { ok: false, status: 'MISSING', message: 'No EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env' };
  }
  if (key.startsWith('AQ.')) {
    return {
      ok: false,
      status: 'INVALID_FORMAT',
      message: 'This key format is not valid for Geocoding REST. Create an API key starting with AIza… in Google Cloud Console and enable Geocoding API + Maps SDK.',
    };
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=Islamabad,Pakistan&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
      return { ok: true, status: 'OK', message: 'Google Geocoding API is working.' };
    }
    return {
      ok: false,
      status: data.status,
      message: data.error_message ?? `Geocoding returned ${data.status}`,
    };
  } catch (e) {
    return { ok: false, status: 'NETWORK_ERROR', message: (e as Error).message };
  }
}
