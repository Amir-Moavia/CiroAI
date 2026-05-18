// ─────────────────────────────────────────────────────────────
// Enrich ingested signals with geocoding
// ─────────────────────────────────────────────────────────────

import type { CrisisSignal } from '../types';

const DEFAULT_COORD = { latitude: 33.6844, longitude: 73.0479 };

export async function enrichSignalsWithGeocoding(signals: CrisisSignal[]): Promise<CrisisSignal[]> {
  const enriched: CrisisSignal[] = [];

  for (const signal of signals) {
    const coord = signal.location.coordinate;
    const label = signal.location.label ?? '';
    const isDefault =
      label.includes('(default)') ||
      label.includes('(inferred)') ||
      label === 'UNKNOWN' ||
      (Math.abs(coord.latitude - DEFAULT_COORD.latitude) < 0.0001 &&
        Math.abs(coord.longitude - DEFAULT_COORD.longitude) < 0.0001);

    if (isDefault) {
      const { geocodeFromSignalText } = await import('../services/geocodingService');
      const geo = await geocodeFromSignalText(signal.text);
      enriched.push({
        ...signal,
        location: {
          ...signal.location,
          coordinate: geo?.coordinate ?? coord,
          label: geo?.label ?? extractLabel(signal.text) ?? label,
          city: signal.location.city ?? 'Islamabad',
        },
      });
    } else {
      enriched.push(signal);
    }
  }

  return enriched;
}

function extractLabel(text: string): string | undefined {
  const m = text.match(/\b(f-\d+|g-\d+|saddar|gt\s*road|dha[^,]*|sector\s*[a-z]-?\d+)/i);
  return m ? m[0] : undefined;
}
