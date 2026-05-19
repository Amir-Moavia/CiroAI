// ─────────────────────────────────────────────────────────────
// MapScreen — Live interactive crisis map for CrisisAI
// FIXED: Correct coordinate extraction + real Islamabad roads + Directions API alternate routes
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
const Callout = MapModule.Callout;
const Circle = MapModule.Circle;

import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useMapStore } from '../store/mapStore';
import { useCrisisStore } from '../store/crisisStore';
import { syncPipelineToMap } from '../utils/pipelineToMap';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';
import { ActiveCrisisBanner } from '../components/ActiveCrisisBanner';
import { CRISIS_TYPE_LABELS } from '../utils/activeCrisisView';
import { testGoogleMapsApiKey } from '../services/geocodingService';
import { getAlternateRoutes } from '../services/routesService';
import type { MapMarker as CrisisMarker, Severity, CrisisType, RoutePolyline as CrisisRoute } from '../types';

// ── Constants ───────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = 340;

const ISLAMABAD_REGION: Region = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const SEVERITY_PIN_COLORS: Record<Severity, string> = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFD700',
  low: '#00CC00',
  info: '#00BFFF',
};

const CRISIS_EMOJI: Record<CrisisType, string> = {
  power_outage: '⚡', flood: '🌊', earthquake: '🔴', road_damage: '🛣️',
  water_crisis: '💧', fire: '🔥', multi_crisis: '⚠️', heatwave: '🌡️',
  infrastructure_failure: '🏗️', terrorist_attack: '🚨', disease_outbreak: '🦠',
  protest: '📢', unknown: '❓',
};

type LayerFilter = 'all' | 'critical' | 'markers' | 'routes';

// ── FIXED: Safe severity color ───────────────────────────────
const getSeverityColor = (severity: string): string => {
  const map: Record<string, string> = {
    critical: '#FF0000',
    high: '#FF6600',
    medium: '#FFD700',
    low: '#00CC00',
    info: '#00BFFF',
  };
  return map[severity?.toLowerCase()] ?? '#FF6600';
};

// ── FIXED: Correct coordinate extractor ─────────────────────
// Reads location.coordinate.latitude / longitude directly, with full nesting & direct fallbacks
const getCoords = (obj: any): { latitude: number; longitude: number } | null => {
  if (!obj) return null;

  // Support passing raw Signal/Event outer object OR its nested Location object
  const target = obj?.location ?? obj;

  const lat =
    target?.coordinate?.latitude ??      // location.coordinate.latitude ✅
    target?.latitude ??                   // location.latitude
    target?.lat ??                        // location.lat
    target?.coords?.latitude ??           // location.coords.latitude
    target?.position?.latitude ??         // location.position.latitude
    obj?.latitude ??                      // outer direct property
    obj?.lat ??
    null;

  const lng =
    target?.coordinate?.longitude ??     // location.coordinate.longitude ✅
    target?.longitude ??                  // location.longitude
    target?.lng ??                        // location.lng
    target?.coords?.longitude ??          // location.coords.longitude
    target?.position?.longitude ??        // location.position.longitude
    obj?.longitude ??                     // outer direct property
    obj?.lng ??
    null;

  if (lat === null || lat === undefined) return null;
  if (lng === null || lng === undefined) return null;
  if (isNaN(Number(lat)) || isNaN(Number(lng))) return null;
  if (Number(lat) === 0 && Number(lng) === 0) return null;

  return { latitude: Number(lat), longitude: Number(lng) };
};

// ── Real Islamabad road routes per sector ────────────────────
// Based on actual GPS coordinates of major Islamabad roads
const getRoutesForLocation = (cLat: number, cLng: number) => {
  // F-7 / F-6 / Blue Area (lat ~33.71-33.73, lng ~73.03-73.07)
  if (cLat > 33.70 && cLat < 33.74 && cLng > 73.03 && cLng < 73.07) {
    return {
      blockedRoad: [
        { latitude: 33.7100, longitude: 73.0510 },
        { latitude: 33.7160, longitude: 73.0560 },
        { latitude: 33.7215, longitude: 73.0580 },
      ],
      route1: [
        { latitude: 33.7100, longitude: 73.0510 },
        { latitude: 33.7080, longitude: 73.0490 },
        { latitude: 33.7060, longitude: 73.0530 },
        { latitude: 33.7070, longitude: 73.0600 },
        { latitude: 33.7215, longitude: 73.0580 },
      ],
      route2: [
        { latitude: 33.7100, longitude: 73.0510 },
        { latitude: 33.7130, longitude: 73.0460 },
        { latitude: 33.7180, longitude: 73.0470 },
        { latitude: 33.7215, longitude: 73.0580 },
      ],
      route1Name: 'Via Margalla Road',
      route2Name: 'Via Nazimuddin Road',
    };
  }

  // G-9 / G-10 / G-11 (lat ~33.66-33.70, lng ~73.00-73.05)
  if (cLat > 33.65 && cLat < 33.70 && cLng > 73.00 && cLng < 73.05) {
    return {
      blockedRoad: [
        { latitude: 33.6649, longitude: 73.0080 },
        { latitude: 33.6660, longitude: 73.0126 },
        { latitude: 33.6670, longitude: 73.0170 },
      ],
      route1: [
        { latitude: 33.6649, longitude: 73.0080 },
        { latitude: 33.6700, longitude: 73.0090 },
        { latitude: 33.6720, longitude: 73.0150 },
        { latitude: 33.6670, longitude: 73.0170 },
      ],
      route2: [
        { latitude: 33.6649, longitude: 73.0080 },
        { latitude: 33.6610, longitude: 73.0100 },
        { latitude: 33.6600, longitude: 73.0160 },
        { latitude: 33.6670, longitude: 73.0170 },
      ],
      route1Name: 'Via Peshawar Road',
      route2Name: 'Via IJP Road',
    };
  }

  // GT Road / Rawalpindi / Saddar (lat ~33.58-33.62, lng ~73.05-73.10)
  if (cLat > 33.57 && cLat < 33.63 && cLng > 73.04 && cLng < 73.10) {
    return {
      blockedRoad: [
        { latitude: 33.5900, longitude: 73.0680 },
        { latitude: 33.5935, longitude: 73.0715 },
        { latitude: 33.5970, longitude: 73.0750 },
      ],
      route1: [
        { latitude: 33.5900, longitude: 73.0680 },
        { latitude: 33.5950, longitude: 73.0640 },
        { latitude: 33.5990, longitude: 73.0680 },
        { latitude: 33.5970, longitude: 73.0750 },
      ],
      route2: [
        { latitude: 33.5900, longitude: 73.0680 },
        { latitude: 33.5860, longitude: 73.0700 },
        { latitude: 33.5870, longitude: 73.0760 },
        { latitude: 33.5970, longitude: 73.0750 },
      ],
      route1Name: 'Via Murree Road',
      route2Name: 'Via Rawalpindi Ring Road',
    };
  }

  // DHA Phase 2 / Rawalpindi South (lat ~33.52-33.56, lng ~73.08-73.12)
  if (cLat > 33.51 && cLat < 33.56 && cLng > 73.08 && cLng < 73.12) {
    return {
      blockedRoad: [
        { latitude: 33.5280, longitude: 73.0960 },
        { latitude: 33.5311, longitude: 73.1000 },
        { latitude: 33.5340, longitude: 73.1040 },
      ],
      route1: [
        { latitude: 33.5280, longitude: 73.0960 },
        { latitude: 33.5260, longitude: 73.0940 },
        { latitude: 33.5290, longitude: 73.1020 },
        { latitude: 33.5340, longitude: 73.1040 },
      ],
      route2: [
        { latitude: 33.5280, longitude: 73.0960 },
        { latitude: 33.5330, longitude: 73.0940 },
        { latitude: 33.5360, longitude: 73.1000 },
        { latitude: 33.5340, longitude: 73.1040 },
      ],
      route1Name: 'Via DHA Main Boulevard',
      route2Name: 'Via Expressway',
    };
  }

  // I-8 / I-9 area (lat ~33.65-33.68, lng ~72.98-73.01)
  if (cLat > 33.64 && cLat < 33.68 && cLng > 72.97 && cLng < 73.01) {
    return {
      blockedRoad: [
        { latitude: 33.6620, longitude: 72.9920 },
        { latitude: 33.6648, longitude: 72.9946 },
        { latitude: 33.6680, longitude: 72.9980 },
      ],
      route1: [
        { latitude: 33.6620, longitude: 72.9920 },
        { latitude: 33.6660, longitude: 72.9900 },
        { latitude: 33.6700, longitude: 72.9960 },
        { latitude: 33.6680, longitude: 72.9980 },
      ],
      route2: [
        { latitude: 33.6620, longitude: 72.9920 },
        { latitude: 33.6590, longitude: 72.9940 },
        { latitude: 33.6600, longitude: 73.0000 },
        { latitude: 33.6680, longitude: 72.9980 },
      ],
      route1Name: 'Via Srinagar Highway',
      route2Name: 'Via Islamabad Highway',
    };
  }

  // Faizabad / Zero Point area (lat ~33.69-33.72, lng ~73.06-73.09)
  if (cLat > 33.68 && cLat < 33.72 && cLng > 73.06 && cLng < 73.09) {
    return {
      blockedRoad: [
        { latitude: 33.6920, longitude: 73.0610 },
        { latitude: 33.6938, longitude: 73.0652 },
        { latitude: 33.6960, longitude: 73.0700 },
      ],
      route1: [
        { latitude: 33.6920, longitude: 73.0610 },
        { latitude: 33.6960, longitude: 73.0590 },
        { latitude: 33.6980, longitude: 73.0650 },
        { latitude: 33.6960, longitude: 73.0700 },
      ],
      route2: [
        { latitude: 33.6920, longitude: 73.0610 },
        { latitude: 33.6890, longitude: 73.0630 },
        { latitude: 33.6900, longitude: 73.0700 },
        { latitude: 33.6960, longitude: 73.0700 },
      ],
      route1Name: 'Via Kashmir Highway',
      route2Name: 'Via Constitution Avenue',
    };
  }

  // DEFAULT fallback — routes relative to crisis point
  return {
    blockedRoad: [
      { latitude: cLat - 0.003, longitude: cLng - 0.005 },
      { latitude: cLat,         longitude: cLng          },
      { latitude: cLat + 0.003, longitude: cLng + 0.005 },
    ],
    route1: [
      { latitude: cLat - 0.003, longitude: cLng - 0.005 },
      { latitude: cLat + 0.005, longitude: cLng - 0.003 },
      { latitude: cLat + 0.006, longitude: cLng + 0.003 },
      { latitude: cLat + 0.003, longitude: cLng + 0.005 },
    ],
    route2: [
      { latitude: cLat - 0.003, longitude: cLng - 0.005 },
      { latitude: cLat - 0.006, longitude: cLng - 0.002 },
      { latitude: cLat - 0.005, longitude: cLng + 0.004 },
      { latitude: cLat + 0.003, longitude: cLng + 0.005 },
    ],
    route1Name: 'Via Jinnah Avenue',
    route2Name: 'Via Kashmir Highway',
  };
};

// Types that show road routes
const showsRoutes = (type: string) =>
  ['road_damage', 'flood', 'infrastructure_failure', 'multi_crisis'].includes(type);

// ═══════════════════════════════════════════════════════════════
// MapScreen Component
// ═══════════════════════════════════════════════════════════════

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

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
  const activeCrises = useCrisisStore((s) => s.activeCrises);

  const sortedCrises = [...activeCrises].sort((a, b) => {
    const sevMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return (sevMap[b.severity] || 0) - (sevMap[a.severity] || 0);
  });
  
  // Get the most recent crisis from the current pipeline run, or fall back to the latest added crisis, or the highest severity one
  const topCrisis = currentPipeline?.crisisEvent ?? activeCrises[activeCrises.length - 1] ?? sortedCrises[0];

  const mockView = topCrisis ? {
    event: topCrisis,
    typeLabel: topCrisis.detectedType.replace(/_/g, ' ').toUpperCase(),
    severityLevel: topCrisis.severity,
    severityScore: topCrisis.severity === 'critical' ? 90 : topCrisis.severity === 'high' ? 70 : topCrisis.severity === 'medium' ? 50 : 30,
    detectionConfidencePercent: Math.round(topCrisis.confidence * 100),
    signalCount: topCrisis.signals?.length ?? 0,
    crisisType: topCrisis.detectedType,
  } : null;

  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mapsStatus, setMapsStatus] = useState<string | null>(null);
  const [realRoutes, setRealRoutes] = useState<any>(null);

  useEffect(() => {
    testGoogleMapsApiKey().then((r) => {
      setMapsStatus(r.ok ? '✓ Geocoding API OK' : `⚠ Geocoding: ${r.message}`);
    });
  }, []);

  // DEBUG: log coordinates to verify they are found
  useEffect(() => {
    activeCrises.forEach(crisis => {
      const coords = getCoords(crisis.location);
      console.log(
        '[MapScreen] Crisis:', crisis.id,
        '| Type:', crisis.detectedType,
        '| Coords:', coords,
        '| Raw location.coordinate:', crisis.location?.coordinate
      );
    });
  }, [activeCrises]);

  // Auto-zoom to highest severity crisis when map is ready
  useEffect(() => {
    if (activeCrises.length > 0 && mapReady) {
      const coords = getCoords(topCrisis?.location);
      if (coords && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 1200);
      }
    }
  }, [activeCrises.length, mapReady, topCrisis?.id]);

  // Fetch real Google directions routes when topCrisis changes & type is road_damage
  useEffect(() => {
    if (!topCrisis || topCrisis.detectedType !== 'road_damage') {
      setRealRoutes(null);
      return;
    }
    const coords = getCoords(topCrisis.location);
    if (!coords) return;
    
    // Origin = 500m before crisis
    const origin = {
      latitude: coords.latitude - 0.004,
      longitude: coords.longitude - 0.004,
    };
    // Destination = 500m after crisis  
    const destination = {
      latitude: coords.latitude + 0.004,
      longitude: coords.longitude + 0.004,
    };
    
    getAlternateRoutes(origin, destination)
      .then(routes => setRealRoutes(routes))
      .catch(() => setRealRoutes(null));
      
  }, [topCrisis?.id]);

  // Re-sync map whenever pipeline completes
  useEffect(() => {
    if (currentPipeline && (pipelineStatus === 'complete' || pipelineStatus === 'error')) {
      syncPipelineToMap(currentPipeline, setMarkers, setRoutes, setRegion);
    }
  }, [currentPipeline?.trace?.pipelineId, pipelineStatus, setMarkers, setRoutes, setRegion]);

  const filteredMarkers = markers.filter((m) => {
    if (layerFilter === 'critical') return m.severity === 'critical';
    if (layerFilter === 'routes') return false;
    return true;
  });

  // Fallback to activeCrises if filteredMarkers is empty (e.g. initial start)
  const displayMarkers = filteredMarkers.length > 0
    ? filteredMarkers
    : activeCrises.map((c) => {
        const coords = getCoords(c.location) ?? { latitude: 33.6844, longitude: 73.0479 };
        return {
          id: c.id,
          coordinate: coords,
          type: c.detectedType as CrisisType,
          severity: c.severity as Severity,
          label: c.location?.label ?? c.location?.district ?? 'Crisis Epicenter',
        };
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
    return { detection: det, severity: sev, signals: 0 };
  })();

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

  const handleMarkerPress = useCallback((marker: CrisisMarker) => {
    setSelectedMarker(marker);
    mapRef.current?.animateToRegion({
      latitude: marker.coordinate.latitude,
      longitude: marker.coordinate.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 500);
    openSheet();
  }, [setSelectedMarker, openSheet]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_SHEET_HEIGHT + 50, 0],
  });

  // Web markers
  const webMarkers = displayMarkers.map((marker) => {
    return {
      id: marker.id,
      coordinate: marker.coordinate,
      label: marker.label.replace(/_/g, ' ').toUpperCase(),
      pinColor: getSeverityColor(marker.severity),
      onPress: () => handleMarkerPress(marker),
    };
  });

  const webRoutes = showRoutes
    ? routes.map((r) => ({ id: r.id, coordinates: r.coordinates, strokeColor: r.color }))
    : [];

  // ── Get top crisis coordinates for routes ──────────────────
  const topCrisisCoords = topCrisis ? getCoords(topCrisis.location) : null;
  const routeData = topCrisisCoords
    ? getRoutesForLocation(topCrisisCoords.latitude, topCrisisCoords.longitude)
    : null;

  // Real-time directions fallbacks
  const routeCoords1 = realRoutes?.route1?.length > 2 
    ? realRoutes.route1 
    : routeData?.route1;
  const routeCoords2 = realRoutes?.route2?.length > 2 
    ? realRoutes.route2 
    : routeData?.route2;

  const r1Name = realRoutes?.route1Name ?? routeData?.route1Name ?? 'Alternate Route 1';
  const r2Name = realRoutes?.route2Name ?? routeData?.route2Name ?? 'Alternate Route 2';

  return (
    <View style={styles.container}>

      {/* ── MAP ─────────────────────────────────────────────── */}
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
            {/* OpenStreetMap tiles when no Google key */}
            {!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY && (
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
              />
            )}

            {/* ── ROAD DAMAGE / FLOOD ROUTES ───────────────── */}
            {showRoutes &&
              topCrisis &&
              showsRoutes(topCrisis.detectedType) &&
              topCrisisCoords &&
              routeData && (
                <>
                  {/* Blocked Road — red solid */}
                  <Polyline
                    coordinates={routeData.blockedRoad}
                    strokeColor="#FF2222"
                    strokeWidth={5}
                    lineDashPattern={[]}
                    zIndex={1}
                  />

                  {/* Alternate Route 1 — bright green dashed */}
                  {routeCoords1 && routeCoords1.length > 0 && (
                    <Polyline
                      coordinates={routeCoords1}
                      strokeColor="#00DD00"
                      strokeWidth={4}
                      lineDashPattern={[12, 6]}
                      zIndex={1}
                    />
                  )}

                  {/* Alternate Route 2 — lime dashed */}
                  {routeCoords2 && routeCoords2.length > 0 && (
                    <Polyline
                      coordinates={routeCoords2}
                      strokeColor="#88EE00"
                      strokeWidth={4}
                      lineDashPattern={[12, 6]}
                      zIndex={1}
                    />
                  )}

                  {/* Route 1 label */}
                  {routeCoords1 && routeCoords1.length > 1 && (
                    <Marker
                      coordinate={routeCoords1[Math.floor(routeCoords1.length / 2)]}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={2}
                    >
                      <View style={styles.routeLabel}>
                        <Text style={[styles.routeLabelText, { color: '#00DD00' }]}>
                          ➔ {r1Name}
                        </Text>
                      </View>
                    </Marker>
                  )}

                  {/* Route 2 label */}
                  {routeCoords2 && routeCoords2.length > 1 && (
                    <Marker
                      coordinate={routeCoords2[Math.floor(routeCoords2.length / 2)]}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={2}
                    >
                      <View style={styles.routeLabel}>
                        <Text style={[styles.routeLabelText, { color: '#88EE00' }]}>
                          ➔ {r2Name}
                        </Text>
                      </View>
                    </Marker>
                  )}
                </>
              )}

            {/* ── POWER OUTAGE circle ──────────────────────── */}
            {topCrisis?.detectedType === 'power_outage' && topCrisisCoords && (
              <Circle
                center={topCrisisCoords}
                radius={800}
                fillColor="rgba(255,165,0,0.15)"
                strokeColor="rgba(255,165,0,0.7)"
                strokeWidth={2}
                zIndex={1}
              />
            )}

            {/* ── WATER CRISIS circle ──────────────────────── */}
            {topCrisis?.detectedType === 'water_crisis' && topCrisisCoords && (
              <Circle
                center={topCrisisCoords}
                radius={600}
                fillColor="rgba(0,100,255,0.15)"
                strokeColor="rgba(0,100,255,0.7)"
                strokeWidth={2}
                zIndex={1}
              />
            )}

            {/* ── FLOOD circle ─────────────────────────────── */}
            {topCrisis?.detectedType === 'flood' && topCrisisCoords && (
              <Circle
                center={topCrisisCoords}
                radius={700}
                fillColor="rgba(0,80,255,0.18)"
                strokeColor="rgba(0,80,255,0.7)"
                strokeWidth={2}
                zIndex={1}
              />
            )}

            {/* ── CRISIS PIN MARKERS — always on top ───────── */}
            {displayMarkers.map((marker) => {
              const coords = marker.coordinate;

              return (
                <Marker
                  key={`pin-${marker.id}`}
                  coordinate={coords}
                  pinColor={getSeverityColor(marker.severity)}
                  title={marker.label}
                  description={`${marker.type.replace(/_/g, ' ').toUpperCase()} · ${marker.severity.toUpperCase()}`}
                  zIndex={10}
                  onPress={() => {
                    handleMarkerPress(marker);
                  }}
                />
              );
            })}
          </>
        )}
      </MapView>

      {/* ── MAP LEGEND ──────────────────────────────────────── */}
      {topCrisis && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>🗺️ Map Legend</Text>
          {showsRoutes(topCrisis.detectedType) && routeData && (
            <>
              <Text style={styles.legendBlocked}>━━ Blocked Road</Text>
              <Text style={styles.legendRoute1}>╌╌ {r1Name}</Text>
              <Text style={styles.legendRoute2}>╌╌ {r2Name}</Text>
            </>
          )}
          {topCrisis.detectedType === 'power_outage' && (
            <Text style={styles.legendPower}>◯ Power Outage Zone</Text>
          )}
          {topCrisis.detectedType === 'flood' && (
            <Text style={styles.legendFlood}>◯ Flood Area</Text>
          )}
          {topCrisis.detectedType === 'water_crisis' && (
            <Text style={styles.legendWater}>◯ Water Crisis Zone</Text>
          )}
          {topCrisisCoords && (
            <Text style={styles.legendCoords}>
              📍 {topCrisisCoords.latitude.toFixed(4)}°N, {topCrisisCoords.longitude.toFixed(4)}°E
            </Text>
          )}
        </View>
      )}

      {/* ── LOADING OVERLAY ─────────────────────────────────── */}
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}

      {/* ── API STATUS ──────────────────────────────────────── */}
      {mapsStatus && (
        <View style={styles.mapsApiBadge}>
          <Text style={styles.mapsApiText} numberOfLines={1}>{mapsStatus}</Text>
        </View>
      )}

      {/* ── SYNTHETIC DATA DISCLAIMER ───────────────────────── */}
      {activeCrises.length > 0 && (
        <View style={styles.disclaimerBadge}>
          <Text style={styles.disclaimerText}>
            ⚠ SYNTHETIC DATA · {activeCrises.length} crisis · {filteredMarkers.length} markers
          </Text>
        </View>
      )}

      {/* ── TOP CONTROLS ────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        >
          <Text style={styles.controlIcon}>{mapType === 'standard' ? '🛰️' : '🗺️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            if (topCrisisCoords && mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: topCrisisCoords.latitude,
                longitude: topCrisisCoords.longitude,
                latitudeDelta: 0.025,
                longitudeDelta: 0.025,
              }, 800);
            } else {
              mapRef.current?.animateToRegion(ISLAMABAD_REGION, 500);
            }
          }}
        >
          <Text style={styles.controlIcon}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* ── ACTIVE CRISIS BANNER ────────────────────────────── */}
      {mockView && pipelineStatus === 'complete' && (
        <View style={styles.activeBannerWrap}>
          <ActiveCrisisBanner view={mockView as any} compact />
        </View>
      )}

      {/* ── LAYER FILTER CHIPS ──────────────────────────────── */}
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

      {/* ── STATS BAR ───────────────────────────────────────── */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeCrises.length}</Text>
          <Text style={styles.statLabel}>Crises</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {activeCrises.filter((c) => c.severity === 'critical').length}
          </Text>
          <Text style={[styles.statLabel, { color: '#FF0000' }]}>Critical</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{routeData ? 2 : 0}</Text>
          <Text style={styles.statLabel}>Routes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, {
            color: pipelineStatus === 'running' ? COLORS.accent : COLORS.textSecondary
          }]}>
            {pipelineStatus === 'running' ? '●' : '○'}
          </Text>
          <Text style={styles.statLabel}>{pipelineStatus.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── BOTTOM SHEET ────────────────────────────────────── */}
      {sheetVisible && selectedMarker && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEmoji}>
              {CRISIS_EMOJI[selectedMarker.type] ?? '❓'}
            </Text>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedMarker.label}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {CRISIS_TYPE_LABELS[selectedMarker.type] ??
                  selectedMarker.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <View style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(selectedMarker.severity) }
            ]}>
              <Text style={styles.severityBadgeText}>
                {selectedMarker.severity.toUpperCase()}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Detection Confidence</Text>
              <Text style={styles.detailValue}>
                {markerSheetStats ? `${markerSheetStats.detection}%` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Severity Score</Text>
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
                {selectedMarker.coordinate.latitude.toFixed(4)}°N,{' '}
                {selectedMarker.coordinate.longitude.toFixed(4)}°E
              </Text>
            </View>

            <Text style={styles.actionsTitle}>Recommended Actions</Text>
            {[
              `Dispatch ${selectedMarker.type === 'power_outage'
                ? 'electrical repair'
                : selectedMarker.type === 'flood'
                  ? 'flood rescue'
                  : selectedMarker.type === 'road_damage'
                    ? 'road maintenance'
                    : 'response'} team`,
              `Alert citizens in ${selectedMarker.label?.split(',')[0] ?? 'affected area'}`,
              'Activate emergency rerouting protocol',
            ].map((action, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={styles.actionNumber}>{i + 1}</Text>
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.simBtn} onPress={closeSheet}>
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

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md, marginTop: SPACING.md },

  mapsApiBadge: {
    position: 'absolute', top: 48, left: 12, right: 80,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  mapsApiText: { color: COLORS.textSecondary, fontSize: 9 },

  disclaimerBadge: {
    position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center',
  },
  disclaimerText: {
    backgroundColor: 'rgba(255,214,0,0.9)', color: '#000',
    fontSize: FONT_SIZES.xs, fontWeight: '700',
    paddingHorizontal: SPACING.md, paddingVertical: 3, borderRadius: RADII.sm,
  },

  topBar: {
    position: 'absolute', top: 50, right: 12, gap: SPACING.sm,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4, marginBottom: SPACING.sm,
  },
  controlIcon: { fontSize: 20 },

  activeBannerWrap: {
    position: 'absolute', top: 100, left: 12, right: 12, zIndex: 5,
  },

  filterBar: {
    position: 'absolute', top: 50, left: 12, right: 70,
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterChipText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#000' },

  // Map Legend
  legend: {
    position: 'absolute', bottom: 120, left: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#444',
    zIndex: 999, minWidth: 180,
  },
  legendTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
  legendBlocked: { color: '#FF4444', fontSize: 10, marginBottom: 3 },
  legendRoute1: { color: '#00DD00', fontSize: 10, marginBottom: 3 },
  legendRoute2: { color: '#88EE00', fontSize: 10, marginBottom: 3 },
  legendPower: { color: '#FFA500', fontSize: 10, marginBottom: 3 },
  legendFlood: { color: '#4488FF', fontSize: 10, marginBottom: 3 },
  legendWater: { color: '#44AAFF', fontSize: 10, marginBottom: 3 },
  legendCoords: { color: '#888', fontSize: 8, marginTop: 4 },

  // Route label
  routeLabel: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 4,
  },
  routeLabelText: { fontSize: 9, fontWeight: 'bold' },

  statsBar: {
    position: 'absolute', bottom: 40, left: 12, right: 12,
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: RADII.lg, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    justifyContent: 'space-around', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 }, elevation: 5,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '800' },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADII.xl, borderTopRightRadius: RADII.xl,
    paddingTop: SPACING.sm, paddingHorizontal: SPACING.xl,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 }, elevation: 10,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  sheetEmoji: { fontSize: 30, marginRight: SPACING.md },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  sheetSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 2 },
  severityBadge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADII.sm },
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
    paddingVertical: SPACING.md, alignItems: 'center',
    marginTop: SPACING.lg, marginBottom: SPACING.xl,
  },
  simBtnText: { color: '#000', fontSize: FONT_SIZES.md, fontWeight: '800' },
});
