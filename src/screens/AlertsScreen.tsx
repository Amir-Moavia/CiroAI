// ─────────────────────────────────────────────────────────────
// AlertsScreen — Crisis alerts & notification feed
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useAlertStore } from '../store/alertStore';
import { useCrisisStore } from '../store/crisisStore';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';
import { ActiveCrisisBanner } from '../components/ActiveCrisisBanner';
import type { Alert as CrisisAlert, Severity } from '../types';

// ── Filter tabs ─────────────────────────────────────────────

type FilterKey = 'all' | 'critical' | 'high' | 'sent' | 'unread';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: '🔴 Critical' },
  { key: 'high', label: '🟠 High' },
  { key: 'sent', label: '📨 Sent' },
  { key: 'unread', label: '● Unread' },
];

const SEV_COLORS: Record<Severity, string> = {
  critical: SEVERITY_COLORS.critical.primary,
  high: SEVERITY_COLORS.high.primary,
  medium: SEVERITY_COLORS.medium.primary,
  low: SEVERITY_COLORS.low.primary,
  info: SEVERITY_COLORS.info.primary,
};

const CRISIS_EMOJI: Record<string, string> = {
  power_outage: '⚡', flood: '🌊', road_damage: '🛣️', water_crisis: '💧',
  fire: '🔥', multi_crisis: '⚠️', infrastructure_failure: '🏗️',
  earthquake: '🔴', heatwave: '🌡️', unknown: '❓',
};

// ═══════════════════════════════════════════════════════════════
// AlertsScreen Component
// ═══════════════════════════════════════════════════════════════

export default function AlertsScreen() {
  const { alerts, unreadCount, simulatedSMSCount, markAsRead, markAllAsRead } = useAlertStore();
  const { currentPipeline, pipelineStatus } = useCrisisStore();
  const activeView = useActiveCrisisView();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // ── Filtered alerts ───────────────────────────────────

  const filteredAlerts = useMemo(() => {
    let list = alerts;
    switch (activeFilter) {
      case 'critical': list = alerts.filter((a) => a.severity === 'critical'); break;
      case 'high': list = alerts.filter((a) => a.severity === 'high'); break;
      case 'sent': list = alerts; break;
      case 'unread': list = alerts.filter((a) => !a.read); break;
      default: list = alerts;
    }
    if (activeView && activeFilter === 'all') {
      const activeType = activeView.crisisType;
      return [...list].sort((a, b) => {
        const aMatch = a.crisisType === activeType ? 0 : 1;
        const bMatch = b.crisisType === activeType ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return list;
  }, [alerts, activeFilter, activeView]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  // ── SMS preview data ──────────────────────────────────

  const smsPreview = currentPipeline?.simulation?.alerts[0];
  const smsText = smsPreview?.message ?? null;

  // ── Generate demo alerts if empty ─────────────────────

  const { addAlertFromCrisis, addSimulatedSMS } = useAlertStore();
  const generateDemoAlerts = useCallback(() => {
    const demos: Array<{ title: string; message: string; severity: Severity; crisisType: string; location: string }> = [
      { title: 'Power Grid Failure', message: 'Major power outage detected in F-7. Repair team dispatched. ETA: 12 mins.', severity: 'critical', crisisType: 'power_outage', location: 'F-7, Islamabad' },
      { title: 'Flood Alert', message: 'Street flooding in I-8. Water rising fast. Avoid Faizabad underpass.', severity: 'high', crisisType: 'flood', location: 'I-8, Islamabad' },
      { title: 'Bridge Damage Warning', message: 'GT Road bridge stress level critical (94%). Road closed for inspection.', severity: 'critical', crisisType: 'road_damage', location: 'GT Road, Rawalpindi' },
      { title: 'Water Supply Disruption', message: 'Pipeline burst in DHA Phase 2. Water tankers being dispatched.', severity: 'high', crisisType: 'water_crisis', location: 'DHA Phase 2' },
      { title: 'Multi-Crisis Warning', message: 'Power + flood + road blockage in G-11. Stay indoors. Call 1122 for help.', severity: 'critical', crisisType: 'multi_crisis', location: 'G-11, Islamabad' },
    ];
    for (const d of demos) {
      addAlertFromCrisis(d as Parameters<typeof addAlertFromCrisis>[0]);
    }
    addSimulatedSMS(12450);
  }, [addAlertFromCrisis, addSimulatedSMS]);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>⚠️ Alerts</Text>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryBold}>{alerts.length}</Text> alerts ·{' '}
          <Text style={styles.summaryBold}>{activeView ? activeView.typeLabel : 'none'}</Text> active · {' '}
          <Text style={[styles.summaryBold, { color: SEVERITY_COLORS.critical.primary }]}>{criticalCount}</Text> critical · {' '}
          <Text style={[styles.summaryBold, { color: COLORS.accent }]}>{simulatedSMSCount.toLocaleString()}</Text> SMS ·{' '}
          <Text style={styles.summaryBold}>{pipelineStatus}</Text>
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeView && pipelineStatus === 'complete' && (
        <ActiveCrisisBanner view={activeView} />
      )}

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
              {f.label}
              {f.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* SMS Preview Card */}
      {smsText && (
        <View style={styles.smsCard}>
          <Text style={styles.smsHeader}>📱 SIMULATED SMS PREVIEW</Text>
          <View style={styles.smsBody}>
            <Text style={styles.smsText}>{smsText}</Text>
          </View>
          <Text style={styles.smsFooter}>
            Sent: {smsPreview?.sent.toLocaleString()} · Failed: {smsPreview?.failed.toLocaleString()} · {Math.round(((smsPreview?.sent ?? 0) / (smsPreview?.recipients ?? 1)) * 100)}% delivered
          </Text>
        </View>
      )}

      {/* Alert list */}
      <FlatList<CrisisAlert>
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AlertCard alert={item} onPress={() => markAsRead(item.id)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No alerts yet</Text>
            <Text style={styles.emptyHint}>Run a pipeline on Home or Simulate — alerts appear automatically</Text>
            <TouchableOpacity style={styles.demoBtn} onPress={generateDemoAlerts}>
              <Text style={styles.demoBtnText}>💉 Generate Demo Alerts</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// AlertCard sub-component
// ═══════════════════════════════════════════════════════════════

function AlertCard({ alert, onPress }: { alert: CrisisAlert; onPress: () => void }) {
  const emoji = CRISIS_EMOJI[alert.crisisType] ?? '❓';
  const sevColor = SEV_COLORS[alert.severity];
  const ago = Math.round((Date.now() - new Date(alert.timestamp).getTime()) / 60_000);
  const agoText = ago < 1 ? 'Just now' : ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;

  return (
    <TouchableOpacity
      style={[styles.alertCard, !alert.read && styles.alertCardUnread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Severity bar */}
      <View style={[styles.sevBar, { backgroundColor: sevColor }]} />

      <View style={styles.alertBody}>
        {/* Header */}
        <View style={styles.alertHeader}>
          <Text style={styles.alertEmoji}>{emoji}</Text>
          <View style={styles.alertTitleBlock}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertLocation}>{alert.location}</Text>
          </View>
          <View style={[styles.sevBadge, { backgroundColor: sevColor }]}>
            <Text style={styles.sevBadgeText}>{alert.severity.toUpperCase()}</Text>
          </View>
        </View>

        {/* Message */}
        <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>

        {/* Footer */}
        <View style={styles.alertFooter}>
          <Text style={styles.alertTime}>{agoText}</Text>
          {!alert.read && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: {
    fontSize: FONT_SIZES.xxl, fontWeight: '900', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.sm,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.md,
  },
  summaryText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  summaryBold: { fontWeight: '800', color: COLORS.textPrimary },
  markAllText: { color: COLORS.accent, fontSize: FONT_SIZES.xs, fontWeight: '700' },

  // Filters
  filterRow: { paddingLeft: SPACING.xl, marginBottom: SPACING.md, maxHeight: 38 },
  filterChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: 8, borderRadius: RADII.full,
    backgroundColor: COLORS.surface, marginRight: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
  filterTextActive: { color: '#000' },

  // SMS preview
  smsCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    backgroundColor: COLORS.card, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.accent, overflow: 'hidden',
  },
  smsHeader: {
    backgroundColor: COLORS.accent, paddingVertical: 6, paddingHorizontal: SPACING.md,
    color: '#000', fontSize: FONT_SIZES.xs, fontWeight: '800',
  },
  smsBody: { padding: SPACING.md },
  smsText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, lineHeight: 20, fontFamily: 'monospace' },
  smsFooter: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  // List
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 80 },

  // Alert card
  alertCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: RADII.md, marginBottom: SPACING.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  alertCardUnread: { borderColor: COLORS.accent },
  sevBar: { width: 4 },
  alertBody: { flex: 1, padding: SPACING.md },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  alertEmoji: { fontSize: 22, marginRight: SPACING.sm },
  alertTitleBlock: { flex: 1 },
  alertTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700' },
  alertLocation: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 1 },
  sevBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADII.sm },
  sevBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  alertMessage: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, lineHeight: 18, marginBottom: SPACING.sm },
  alertFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertTime: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },

  // Empty
  empty: { alignItems: 'center', paddingTop: SPACING.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  emptyHint: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginBottom: SPACING.xl },
  demoBtn: {
    backgroundColor: COLORS.accentAlt, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADII.full,
  },
  demoBtnText: { color: '#fff', fontSize: FONT_SIZES.sm, fontWeight: '700' },
});
