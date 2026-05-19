// ─────────────────────────────────────────────────────────────
// MapScreen — Live interactive crisis map for CrisisAI
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import type RNMapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

const MapModule = Platform.OS === 'web'
  ? require('../components/MapViewWeb')
  : require('react-native-maps');

const MapView = MapModule.default;
const Marker = MapModule.Marker;
const Polyline = MapModule.Polyline;
const PROVIDER_GOOGLE = MapModule.PROVIDER_GOOGLE;
const UrlTile = MapModule.UrlTile;
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useMapStore } from '../store/mapStore';
import { useCrisisStore } from '../store/crisisStore';
import { syncPipelineToMap } from '../utils/pipelineToMap';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';
import { ActiveCrisisBanner } from '../components/ActiveCrisisBanner';
import { CRISIS_TYPE_LABELS } from '../utils/activeCrisisView';
import { testGoogleMapsApiKey } from '../services/geocodingService';
import type { MapMarker as CrisisMarker, Severity, CrisisType, RoutePolyline as CrisisRoute } from '../types';
import { ALL_MOCK_SIGNALS } from '../data/mockSignals';

// ── Constants ───────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = 340;

const ISLAMABAD_REGION: Region = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SEVERITY_PIN_COLORS: Record<Severity, string> = {
  critical: SEVERITY_COLORS.critical.primary,
  high: SEVERITY_COLORS.high.primary,
  medium: SEVERITY_COLORS.medium.primary,
  low: SEVERITY_COLORS.low.primary,
  info: SEVERITY_COLORS.info.primary,
};

const CRISIS_EMOJI: Record<CrisisType, string> = {
  power_outage: '⚡', flood: '🌊', earthquake: '🔴', road_damage: '🛣️',
  water_crisis: '💧', fire: '🔥', multi_crisis: '⚠️', heatwave: '🌡️',
  infrastructure_failure: '🏗️', terrorist_attack: '🚨', disease_outbreak: '🦠',
  protest: '📢', unknown: '❓',
};

type LayerFilter = 'all' | 'critical' | 'markers' | 'routes';

// ═══════════════════════════════════════════════════════════════
// MapScreen Component
// ═══════════════════════════════════════════════════════════════

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Store — selective subscriptions so marker updates always re-render
  const markers = useMapStore((s) => s.markers);
  const routes = useMapStore((s) => s.routes);
  const region = useMapStore((s) => s.region);
  const selectedMarker = useMapStore((s) => s.selectedMarker);
  const setMarkers = useMapStore((s) => s.setMarkers);
  const setRoutes = useMapStore((s) => s.setRoutes);
  const setRegion = useMapStore((s) => s.setRegion);
  const setSelectedMarker = useMapStore((s) => s.setSelectedMarker);
  const clearMap = useMapStore((s) => s.clearMap);

  const pipelineStatus = useCrisisStore((s) => s.pipelineStatus);
  const currentPipeline = useCrisisStore((s) => s.currentPipeline);
  const activeView = useActiveCrisisView();

  // Local state
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [mapsStatus, setMapsStatus] = useState<string | null>(null);

  useEffect(() => {
    testGoogleMapsApiKey().then((r) => {
      setMapsStatus(r.ok ? '✓ Geocoding API OK' : `⚠ Geocoding: ${r.message}`);
    });
  }, []);

  // Re-sync map whenever pipeline completes (e.g. ran from Home tab first)
  useEffect(() => {
    if (currentPipeline && (pipelineStatus === 'complete' || pipelineStatus === 'error')) {
      syncPipelineToMap(currentPipeline, setMarkers, setRoutes, setRegion);
    }
  }, [currentPipeline?.trace?.pipelineId, pipelineStatus, setMarkers, setRoutes, setRegion]);

  // ── Derived data ──────────────────────────────────────

  const filteredMarkers = markers.filter((m) => {
    if (layerFilter === 'critical') return m.severity === 'critical';
    if (layerFilter === 'routes') return false;
    return true;
  });

  const showRoutes = layerFilter === 'all' || layerFilter === 'routes';

  const markerSheetStats = selectedMarker && (() => {
    if (activeView && (selectedMarker.id.startsWith('crisis-') || selectedMarker.type === activeView.crisisType)) {
      const typeSignals = currentPipeline?.signals.filter((s) => s.type === selectedMarker.type).length ?? 0;
      return {
        detection: activeView.detectionConfidencePercent,
        severity: activeView.severityScore,
        signals: selectedMarker.id.startsWith('crisis-') ? activeView.signalCount : Math.max(1, typeSignals),
      };
    }
    const sev = currentPipeline?.severity?.score ?? activeView?.severityScore ?? 50;
    const det = activeView?.detectionConfidencePercent ?? Math.round((currentPipeline?.crisisEvent?.confidence ?? 0.5) * 100);
    return { detection: det, severity: sev, signals: currentPipeline?.signals.some((s) => s.id === selectedMarker.id) ? 1 : 0 };
  })();

  // ── Bottom sheet animation ────────────────────────────

  const openSheet = useCallback(() => {
    setSheetVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSheetVisible(false);
      setSelectedMarker(null);
    });
  }, [sheetAnim, setSelectedMarker]);

  // ── Marker press handler ──────────────────────────────

  const handleMarkerPress = useCallback((marker: CrisisMarker) => {
    setSelectedMarker(marker);
    mapRef.current?.animateToRegion({
      latitude: marker.coordinate.latitude,
      longitude: marker.coordinate.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 500);
    openSheet();
  }, [setSelectedMarker, openSheet]);

  // ── Demo mode: inject crisis scenario ─────────────────

  const runDemoScenario = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    clearMap();

    // Inject mock signals one-by-one with delay
    const demoSignals = ALL_MOCK_SIGNALS.slice(0, 10);
    const newMarkers: CrisisMarker[] = [];

    for (let i = 0; i < demoSignals.length; i++) {
      const sig = demoSignals[i];
      const marker: CrisisMarker = {
        id: sig.id,
        coordinate: sig.location.coordinate,
        type: sig.type,
        severity: sig.severity,
        label: sig.location.label ?? sig.location.district ?? 'Unknown',
      };
      newMarkers.push(marker);
      setMarkers([...newMarkers]);

      // Animate to latest marker
      mapRef.current?.animateToRegion({
        latitude: sig.location.coordinate.latitude,
        longitude: sig.location.coordinate.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 400);

      // Wait between markers
      await new Promise((r) => setTimeout(r, 600));
    }

    // Add sample routes
    const sampleRoutes: CrisisRoute[] = [
      {
        id: 'ROUTE-BLOCKED-1',
        coordinates: [
          { latitude: 33.5935, longitude: 73.0715 },
          { latitude: 33.5940, longitude: 73.0700 },
          { latitude: 33.5928, longitude: 73.0720 },
        ],
        color: SEVERITY_COLORS.critical.primary,
        label: 'GT Road — BLOCKED',
        type: 'blocked',
      },
      {
        id: 'ROUTE-ALT-1',
        coordinates: [
          { latitude: 33.6600, longitude: 73.0400 },
          { latitude: 33.6450, longitude: 73.0600 },
          { latitude: 33.6300, longitude: 73.0800 },
        ],
        color: COLORS.success,
        label: 'Kashmir Highway (alternate)',
        type: 'alternate',
      },
      {
        id: 'ROUTE-DISPATCH-1',
        coordinates: [
          { latitude: 33.6950, longitude: 73.0400 },
          { latitude: 33.6880, longitude: 73.0420 },
          { latitude: 33.7215, longitude: 73.0580 },
        ],
        color: COLORS.accent,
        label: 'Repair team route',
        type: 'dispatch',
      },
    ];
    setRoutes(sampleRoutes);
    setRegion({
      latitude: 33.6844,
      longitude: 73.0479,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    });

    setDemoRunning(false);
  }, [demoRunning, clearMap, setMarkers, setRoutes, setRegion]);

  // ── Fit camera when markers/routes change (not only count) ──

  const markerSignature = markers.map((m) => `${m.id}:${m.coordinate.latitude}`).join('|');

  const fitMapToData = useCallback(() => {
    if (!mapReady || markers.length === 0) return;

    const coords = [
      ...markers.map((m) => m.coordinate),
      ...routes.flatMap((r) => r.coordinates),
    ];

    if (mapRef.current?.fitToCoordinates) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
        animated: true,
      });
      return;
    }

    mapRef.current?.animateToRegion?.(region, 600);
  }, [mapReady, markers, routes, region]);

  useEffect(() => {
    fitMapToData();
  }, [markerSignature, routes.length, mapReady, fitMapToData]);

  // ── Sheet transform ───────────────────────────────────

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_SHEET_HEIGHT + 50, 0],
  });

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  const webMarkers = filteredMarkers.map((m) => ({
    id: m.id,
    coordinate: m.coordinate,
    label: m.label,
    pinColor: SEVERITY_PIN_COLORS[m.severity],
    onPress: () => handleMarkerPress(m),
  }));

  const webRoutes = showRoutes
    ? routes.map((r) => ({ id: r.id, coordinates: r.coordinates, strokeColor: r.color }))
    : [];

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={ISLAMABAD_REGION}
        mapType={mapType}
        showsUserLocation={Platform.OS !== 'web'}
        showsMyLocationButton={false}
        showsCompass
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(r: Region) => setRegion(r)}
        onPress={() => { if (sheetVisible) closeSheet(); }}
        mapMarkers={Platform.OS === 'web' ? webMarkers : undefined}
        mapRoutes={Platform.OS === 'web' ? webRoutes : undefined}
      >
        {Platform.OS !== 'web' && (
          <>
            {!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY && (
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
              />
            )}
            {filteredMarkers.map((m) => (
              <Marker
                key={`${m.id}-${m.coordinate.latitude.toFixed(5)}-${m.coordinate.longitude.toFixed(5)}`}
                identifier={m.id}
                coordinate={m.coordinate}
                title={m.label}
                description={`${m.type.replace(/_/g, ' ').toUpperCase()} — ${m.severity.toUpperCase()}`}
                pinColor={SEVERITY_PIN_COLORS[m.severity]}
                onPress={() => handleMarkerPress(m)}
                tracksViewChanges={false}
              />
            ))}

            {showRoutes && routes.map((r) => (
              <Polyline
                key={r.id}
                coordinates={r.coordinates}
                strokeColor={r.color}
                strokeWidth={r.type === 'blocked' ? 5 : 3}
                lineDashPattern={
                  r.type === 'alternate' ? [10, 6] : r.type === 'dispatch' ? [4, 4] : undefined
                }
              />
            ))}
          </>
        )}
      </MapView>

      {/* Loading overlay */}
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading map tiles...</Text>
        </View>
      )}

      {mapsStatus && (
        <View style={styles.mapsApiBadge}>
          <Text style={styles.mapsApiText} numberOfLines={1}>{mapsStatus}</Text>
        </View>
      )}

      {/* DEV disclaimer */}
      {markers.length > 0 && (
        <View style={styles.disclaimerBadge}>
          <Text style={styles.disclaimerText}>⚠ SYNTHETIC DATA · {filteredMarkers.length} visible</Text>
        </View>
      )}

      {/* Top controls bar */}
      <View style={styles.topBar}>
        {/* Map type toggle */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        >
          <Text style={styles.controlIcon}>{mapType === 'standard' ? '🛰️' : '🗺️'}</Text>
        </TouchableOpacity>

        {/* My location */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => mapRef.current?.animateToRegion(ISLAMABAD_REGION, 500)}
        >
          <Text style={styles.controlIcon}>📍</Text>
        </TouchableOpacity>
      </View>

      {activeView && pipelineStatus === 'complete' && (
        <View style={styles.activeBannerWrap}>
          <ActiveCrisisBanner view={activeView} compact />
        </View>
      )}

      {/* Layer filter chips */}
      <View style={styles.filterBar}>
        {([
          ['all', 'All'],
          ['critical', '🔴 Critical'],
          ['markers', '📌 Markers'],
          ['routes', '🛤️ Routes'],
        ] as [LayerFilter, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, layerFilter === key && styles.filterChipActive]}
            onPress={() => setLayerFilter(key)}
          >
            <Text style={[styles.filterChipText, layerFilter === key && styles.filterChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Demo inject button */}
      <TouchableOpacity
        style={[styles.demoBtn, demoRunning && styles.demoBtnRunning]}
        onPress={runDemoScenario}
        disabled={demoRunning}
      >
        {demoRunning ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.demoBtnText}>⚡ Inject Crisis Scenario</Text>
        )}
      </TouchableOpacity>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{markers.length}</Text>
          <Text style={styles.statLabel}>Markers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{markers.filter((m) => m.severity === 'critical').length}</Text>
          <Text style={[styles.statLabel, { color: SEVERITY_COLORS.critical.primary }]}>Critical</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{routes.length}</Text>
          <Text style={styles.statLabel}>Routes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: pipelineStatus === 'running' ? COLORS.accent : COLORS.textSecondary }]}>
            {pipelineStatus === 'running' ? '●' : '○'}
          </Text>
          <Text style={styles.statLabel}>{pipelineStatus.toUpperCase()}</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      {sheetVisible && selectedMarker && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEmoji}>
              {CRISIS_EMOJI[selectedMarker.type] ?? '❓'}
            </Text>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedMarker.label}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {CRISIS_TYPE_LABELS[selectedMarker.type] ?? selectedMarker.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_PIN_COLORS[selectedMarker.severity] }]}>
              <Text style={styles.severityBadgeText}>
                {selectedMarker.severity.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Details */}
          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Detection</Text>
              <Text style={styles.detailValue}>
                {markerSheetStats ? `${markerSheetStats.detection}%` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Severity</Text>
              <Text style={styles.detailValue}>
                {markerSheetStats ? `${markerSheetStats.severity}/100` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Confirming Signals</Text>
              <Text style={styles.detailValue}>
                {markerSheetStats ? String(markerSheetStats.signals) : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Coordinates</Text>
              <Text style={styles.detailValue}>
                {selectedMarker.coordinate.latitude.toFixed(4)}°N, {selectedMarker.coordinate.longitude.toFixed(4)}°E
              </Text>
            </View>

            {/* Recommended actions */}
            <Text style={styles.actionsTitle}>Recommended Actions</Text>
            {[
              `Dispatch ${selectedMarker.type === 'power_outage' ? 'electrical repair' : selectedMarker.type === 'flood' ? 'flood rescue' : 'response'} team`,
              `Alert citizens in ${selectedMarker.label?.split(',')[0] ?? 'area'}`,
              'Activate traffic rerouting',
            ].map((action, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={styles.actionNumber}>{i + 1}</Text>
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}

            {/* Run simulation button */}
            <TouchableOpacity
              style={styles.simBtn}
              onPress={() => {
                closeSheet();
                // Pipeline already runs from demo; this is placeholder for per-marker sim
              }}
            >
              <Text style={styles.simBtnText}>▶ Run Simulation</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  map: { flex: 1 },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md, marginTop: SPACING.md },

  // Disclaimer
  mapsApiBadge: {
    position: 'absolute', top: 48, left: 12, right: 80,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  mapsApiText: { color: COLORS.textSecondary, fontSize: 9 },

  disclaimerBadge: {
    position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center',
  },
  disclaimerText: {
    backgroundColor: 'rgba(255,214,0,0.85)', color: '#000',
    fontSize: FONT_SIZES.xs, fontWeight: '700',
    paddingHorizontal: SPACING.md, paddingVertical: 3, borderRadius: RADII.sm,
  },

  // Top controls
  topBar: {
    position: 'absolute', top: 50, right: 12,
    gap: SPACING.sm,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: RADII.md,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4, marginBottom: SPACING.sm,
  },
  controlIcon: { fontSize: 20 },

  activeBannerWrap: {
    position: 'absolute',
    top: 100,
    left: 12,
    right: 12,
    zIndex: 5,
  },

  // Filter bar
  filterBar: {
    position: 'absolute', top: 50, left: 12, right: 70,
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADII.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent, borderColor: COLORS.accent,
  },
  filterChipText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#000' },

  // Demo button
  demoBtn: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: COLORS.accentAlt, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADII.full, flexDirection: 'row', alignItems: 'center',
    shadowColor: COLORS.accentAlt, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  demoBtnRunning: { backgroundColor: COLORS.textMuted },
  demoBtnText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: '700' },

  // Stats bar
  statsBar: {
    position: 'absolute', bottom: 40, left: 12, right: 12,
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: RADII.lg, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    justifyContent: 'space-around', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '800' },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADII.xl, borderTopRightRadius: RADII.xl,
    paddingTop: SPACING.sm, paddingHorizontal: SPACING.xl,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  sheetEmoji: { fontSize: 30, marginRight: SPACING.md },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  sheetSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 2 },
  severityBadge: {
    paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADII.sm,
  },
  severityBadgeText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: '800' },

  sheetBody: { flex: 1 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  detailLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  detailValue: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '600' },

  actionsTitle: {
    color: COLORS.accent, fontSize: FONT_SIZES.md, fontWeight: '700',
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  actionNumber: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accent,
    color: '#000', fontSize: FONT_SIZES.xs, fontWeight: '800',
    textAlign: 'center', lineHeight: 22, marginRight: SPACING.sm,
  },
  actionText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, flex: 1 },

  simBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADII.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xl,
  },
  simBtnText: { color: '#000', fontSize: FONT_SIZES.md, fontWeight: '800' },
});
