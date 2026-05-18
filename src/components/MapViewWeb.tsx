// ─────────────────────────────────────────────────────────────
// Web map — renders markers/routes from explicit props (reliable)
// ─────────────────────────────────────────────────────────────

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';

type Coord = { latitude: number; longitude: number };
export type WebRegion = Coord & { latitudeDelta: number; longitudeDelta: number };

export type WebMapMarker = {
  id: string;
  coordinate: Coord;
  label?: string;
  pinColor?: string;
  onPress?: () => void;
};

export type WebMapRoute = {
  id: string;
  coordinates: Coord[];
  strokeColor?: string;
};

const DEFAULT_REGION: WebRegion = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function regionFromCoords(coords: Coord[]): WebRegion {
  if (coords.length === 0) return DEFAULT_REGION;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.6 + 0.02),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.6 + 0.02),
  };
}

function project(
  coord: Coord,
  region: WebRegion,
  width: number,
  height: number,
): { x: number; y: number } {
  const latSpan = region.latitudeDelta / 2;
  const lngSpan = region.longitudeDelta / 2;
  const x = ((coord.longitude - (region.longitude - lngSpan)) / (lngSpan * 2)) * width;
  const y = ((region.latitude + latSpan - coord.latitude) / (latSpan * 2)) * height;
  return { x: Math.max(8, Math.min(width - 8, x)), y: Math.max(8, Math.min(height - 8, y)) };
}

export type MapViewWebHandle = {
  animateToRegion: (region: WebRegion, duration?: number) => void;
  fitToCoordinates: (
    coordinates: Coord[],
    options?: { edgePadding?: Record<string, number>; animated?: boolean },
  ) => void;
};

type MapViewWebProps = {
  mapMarkers?: WebMapMarker[];
  mapRoutes?: WebMapRoute[];
  style?: object;
  onMapReady?: () => void;
  onPress?: () => void;
  children?: React.ReactNode;
};

const MapViewWeb = forwardRef<MapViewWebHandle, MapViewWebProps>(function MapViewWeb(
  { mapMarkers = [], mapRoutes = [], style, onMapReady, onPress },
  ref,
) {
  const [viewRegion, setViewRegion] = useState<WebRegion>(DEFAULT_REGION);
  const [layout, setLayout] = useState({ width: 320, height: 480 });

  const markerKey = mapMarkers.map((m) => `${m.id}@${m.coordinate.latitude},${m.coordinate.longitude}`).join('|');
  const routeKey = mapRoutes.map((r) => `${r.id}:${r.coordinates.length}`).join('|');

  const markers = useMemo(() => mapMarkers, [markerKey, mapMarkers]);
  const polylines = useMemo(() => mapRoutes, [routeKey, mapRoutes]);

  useImperativeHandle(ref, () => ({
    animateToRegion(region: WebRegion) {
      setViewRegion(region);
    },
    fitToCoordinates(coordinates: Coord[]) {
      if (coordinates.length > 0) {
        setViewRegion(regionFromCoords(coordinates));
      }
    },
  }));

  useEffect(() => {
    const coords = [
      ...markers.map((m) => m.coordinate),
      ...polylines.flatMap((p) => p.coordinates),
    ];
    if (coords.length > 0) {
      setViewRegion(regionFromCoords(coords));
    }
  }, [markerKey, routeKey, markers, polylines]);

  useEffect(() => {
    onMapReady?.();
  }, [onMapReady]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  return (
    <Pressable style={[styles.root, style]} onLayout={onLayout} onPress={onPress}>
      <View style={styles.grid} pointerEvents="none" />

      {polylines.map((line) =>
        line.coordinates.slice(0, -1).map((from, i) => {
          const to = line.coordinates[i + 1];
          const a = project(from, viewRegion, layout.width, layout.height);
          const b = project(to, viewRegion, layout.width, layout.height);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={`${line.id}-${i}`}
              pointerEvents="none"
              style={[
                styles.routeSegment,
                {
                  left: a.x,
                  top: a.y,
                  width: Math.max(length, 1),
                  backgroundColor: line.strokeColor ?? '#4CAF50',
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        }),
      )}

      {markers.map((m) => {
        const { x, y } = project(m.coordinate, viewRegion, layout.width, layout.height);
        return (
          <Pressable
            key={m.id}
            style={[styles.marker, { left: x - 10, top: y - 10, backgroundColor: m.pinColor ?? '#FF5252' }]}
            onPress={(e) => {
              e.stopPropagation?.();
              m.onPress?.();
            }}
          >
            <View style={styles.markerInner} />
          </Pressable>
        );
      })}

      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeTitle}>Web crisis map (live)</Text>
        <Text style={styles.badgeSub}>
          {markers.length} markers · {polylines.length} routes
        </Text>
        <Text style={styles.badgeSub}>
          {viewRegion.latitude.toFixed(3)}°N, {viewRegion.longitude.toFixed(3)}°E · Δ{viewRegion.latitudeDelta.toFixed(3)}
        </Text>
      </View>

      {markers.length > 0 && (
        <View style={styles.legend} pointerEvents="none">
          {markers.slice(0, 4).map((m) => (
            <Text key={m.id} style={styles.legendItem} numberOfLines={1}>
              ● {m.label ?? m.id}
            </Text>
          ))}
          {markers.length > 4 && (
            <Text style={styles.legendItem}>+{markers.length - 4} more</Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

export function Marker(_props: Record<string, unknown>) {
  return null;
}
Marker.displayName = 'Marker';

export function Polyline(_props: Record<string, unknown>) {
  return null;
}
Polyline.displayName = 'Polyline';

export const PROVIDER_GOOGLE = 'google';

export default MapViewWeb;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a2332', overflow: 'hidden' },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.15, backgroundColor: '#2d3a4f' },
  routeSegment: { position: 'absolute', height: 3, transformOrigin: 'left center' },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  markerInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' },
  badge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeTitle: { color: '#E0E0E0', fontSize: 12, fontWeight: '700' },
  badgeSub: { color: '#9E9E9E', fontSize: 10, marginTop: 2 },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 8,
    borderRadius: 8,
  },
  legendItem: { color: '#ccc', fontSize: 10, marginBottom: 2 },
});
