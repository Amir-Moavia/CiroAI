// ─────────────────────────────────────────────────────────────
// Pipeline → Map sync utilities
// ─────────────────────────────────────────────────────────────

import { COLORS, SEVERITY_COLORS } from '../constants/colors';
import type {
  CrisisEvent,
  CrisisSignal,
  MapMarker,
  MapRegion,
  PipelineResult,
  RoutePolyline,
} from '../types';

export function signalsToMarkers(signals: CrisisSignal[]): MapMarker[] {
  const byId = new Map<string, MapMarker>();

  for (const s of signals) {
    const coord = s.location?.coordinate;
    if (!coord || typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
      continue;
    }
    byId.set(s.id, {
      id: s.id,
      coordinate: { latitude: coord.latitude, longitude: coord.longitude },
      type: s.type,
      severity: s.severity,
      label: s.location.label ?? s.location.district ?? s.text.slice(0, 40),
    });
  }

  return Array.from(byId.values());
}

export function crisisEventToMarker(event: CrisisEvent): MapMarker | null {
  const coord = event.location?.coordinate;
  if (!coord) return null;
  return {
    id: `crisis-${event.id}`,
    coordinate: { latitude: coord.latitude, longitude: coord.longitude },
    type: event.detectedType,
    severity: event.severity,
    label: event.location.label ?? event.location.district ?? 'Crisis epicenter',
  };
}

export function mergeMarkers(existing: MapMarker[], incoming: MapMarker[]): MapMarker[] {
  const byId = new Map<string, MapMarker>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values());
}

export function simulationToRoutes(result: PipelineResult): RoutePolyline[] {
  const routes: RoutePolyline[] = [];
  const sim = result.simulation;
  if (!sim) return routes;

  for (const reroute of sim.reroutes) {
    if (reroute.mapMarkers.length >= 2) {
      routes.push({
        id: `ROUTE-${reroute.activatedRoutes[0] ?? 'ALT'}`,
        coordinates: reroute.mapMarkers.map((c) => ({ ...c })),
        color: COLORS.success,
        label: reroute.activatedRoutes.join(', ') || 'Alternate route',
        type: 'alternate',
      });
    }
    for (const blocked of reroute.blockedRoads) {
      if (reroute.mapMarkers.length >= 2) {
        routes.push({
          id: `BLOCK-${blocked.replace(/\s/g, '-')}`,
          coordinates: reroute.mapMarkers.map((c) => ({ ...c })),
          color: SEVERITY_COLORS.critical.primary,
          label: `${blocked} — BLOCKED`,
          type: 'blocked',
        });
      }
    }
  }

  for (const ticket of sim.tickets) {
    if (ticket.coordinatePath.length >= 2) {
      routes.push({
        id: `DISPATCH-${ticket.ticketId}`,
        coordinates: ticket.coordinatePath.map((c) => ({ ...c })),
        color: COLORS.accent,
        label: `${ticket.team} → ${ticket.location}`,
        type: 'dispatch',
      });
    }
  }

  return routes.filter((r) => r.coordinates.length >= 2);
}

export function regionForMarkers(markers: MapMarker[]): MapRegion {
  if (markers.length === 0) {
    return { latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }

  const lats = markers.map((m) => m.coordinate.latitude);
  const lngs = markers.map((m) => m.coordinate.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.8 + 0.02),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.8 + 0.02),
  };
}

export function regionForSignals(signals: CrisisSignal[]): MapRegion {
  return regionForMarkers(signalsToMarkers(signals));
}

export function buildMarkersFromPipeline(result: PipelineResult): MapMarker[] {
  let markers = signalsToMarkers(result.signals);

  if (result.crisisEvent) {
    const epicenter = crisisEventToMarker(result.crisisEvent);
    if (epicenter) {
      markers = mergeMarkers([epicenter], markers);
    }
  }

  return markers;
}

export function syncPipelineToMap(
  result: PipelineResult,
  setMarkers: (m: MapMarker[]) => void,
  setRoutes: (r: RoutePolyline[]) => void,
  setRegion: (r: MapRegion) => void,
  options?: { merge?: boolean; getExistingMarkers?: () => MapMarker[] },
): void {
  const incoming = buildMarkersFromPipeline(result);
  const routes = simulationToRoutes(result);

  const markers = options?.merge && options.getExistingMarkers
    ? mergeMarkers(options.getExistingMarkers(), incoming)
    : incoming;

  setMarkers(markers);
  setRoutes(routes);

  if (markers.length > 0) {
    setRegion(regionForMarkers(markers));
  }

  console.log(`[MapSync] ${markers.length} markers, ${routes.length} routes`);
}
