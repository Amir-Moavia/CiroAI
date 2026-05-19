// ─────────────────────────────────────────────────────────────
// CrisisAI — Map Store (Zustand)
// ─────────────────────────────────────────────────────────────
// Manages map markers, route polylines, camera region, and
// selection state.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type {
  MapMarker,
  MapRegion,
  RoutePolyline,
  Severity,
  LogEntry,
  CrisisEvent,
} from '../types';

// ── Default map region: Islamabad centre ────────────────────

const ISLAMABAD_REGION: MapRegion = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// ── Types ───────────────────────────────────────────────────

interface MapState {
  markers: MapMarker[];
  routes: RoutePolyline[];
  region: MapRegion;
  selectedMarker: MapMarker | null;
  sideEffectLog: LogEntry[];

  // Actions
  addMarker: (marker: MapMarker) => void;
  removeMarker: (id: string) => void;
  updateMarkerSeverity: (id: string, severity: Severity) => void;
  setMarkers: (markers: MapMarker[]) => void;
  addRoute: (route: RoutePolyline) => void;
  removeRoute: (id: string) => void;
  setRoutes: (routes: RoutePolyline[]) => void;
  setRegion: (region: MapRegion) => void;
  setSelectedMarker: (marker: MapMarker | null) => void;
  focusOnCrisis: (crisisId: string) => void;
  clearMap: () => void;
  syncWithCrisis: (crisisEvents: CrisisEvent[]) => void;
}

// ── Helper ──────────────────────────────────────────────────

function makeLog(msg: string): LogEntry {
  return {
    timestamp: new Date().toLocaleTimeString('en-PK', { hour12: false }),
    level: 'INFO',
    agent: 'MapStore',
    message: msg,
  };
}

// ── Store ───────────────────────────────────────────────────

export const useMapStore = create<MapState>((set, get) => ({
  markers: [],
  routes: [],
  region: ISLAMABAD_REGION,
  selectedMarker: null,
  sideEffectLog: [],

  addMarker: (marker) => {
    set((s) => ({
      markers: [...s.markers, marker],
      sideEffectLog: [...s.sideEffectLog, makeLog(`Marker added: ${marker.label} (${marker.severity})`)],
    }));
  },

  removeMarker: (id) => {
    set((s) => ({
      markers: s.markers.filter((m) => m.id !== id),
      sideEffectLog: [...s.sideEffectLog, makeLog(`Marker removed: ${id}`)],
    }));
  },

  updateMarkerSeverity: (id, severity) => {
    set((s) => ({
      markers: s.markers.map((m) =>
        m.id === id ? { ...m, severity } : m
      ),
      sideEffectLog: [...s.sideEffectLog, makeLog(`Marker ${id} severity → ${severity}`)],
    }));
  },

  setMarkers: (markers) => {
    set((s) => ({
      markers,
      sideEffectLog: [...s.sideEffectLog, makeLog(`${markers.length} markers set`)],
    }));
  },

  addRoute: (route) => {
    set((s) => ({
      routes: [...s.routes, route],
      sideEffectLog: [...s.sideEffectLog, makeLog(`Route added: ${route.label} (${route.type})`)],
    }));
  },

  removeRoute: (id) => {
    set((s) => ({
      routes: s.routes.filter((r) => r.id !== id),
      sideEffectLog: [...s.sideEffectLog, makeLog(`Route removed: ${id}`)],
    }));
  },

  setRoutes: (routes) => {
    set((s) => ({
      routes,
      sideEffectLog: [...s.sideEffectLog, makeLog(`${routes.length} routes set`)],
    }));
  },

  setRegion: (region) => {
    set({ region });
  },

  setSelectedMarker: (marker) => {
    set({ selectedMarker: marker });
  },

  focusOnCrisis: (crisisId) => {
    const marker = get().markers.find((m) => m.id === crisisId);
    if (marker) {
      set({
        selectedMarker: marker,
        region: {
          latitude: marker.coordinate.latitude,
          longitude: marker.coordinate.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
      });
      set((s) => ({
        sideEffectLog: [...s.sideEffectLog, makeLog(`Focused on crisis: ${marker.label}`)],
      }));
    }
  },

  clearMap: () => {
    set({
      markers: [],
      routes: [],
      region: ISLAMABAD_REGION,
      selectedMarker: null,
      sideEffectLog: [makeLog('Map cleared')],
    });
  },

  syncWithCrisis: (crisisEvents) => {
    const markers = crisisEvents.map((crisis) => ({
      id: crisis.id,
      coordinate: {
        latitude: crisis.location.coordinate?.latitude ?? (crisis.location as any).latitude,
        longitude: crisis.location.coordinate?.longitude ?? (crisis.location as any).longitude,
      },
      severity: crisis.severity,
      type: crisis.detectedType,
      label: crisis.location.label ?? (crisis.location as any).name ?? 'Crisis Location',
      confidence: crisis.confidence,
    }));
    set({ markers });
  },
}));
