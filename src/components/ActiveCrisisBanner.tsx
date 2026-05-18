import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import type { ActiveCrisisView } from '../utils/activeCrisisView';

type Props = {
  view: ActiveCrisisView;
  compact?: boolean;
};

export function ActiveCrisisBanner({ view, compact }: Props) {
  const sevColor = SEVERITY_COLORS[view.severityLevel]?.primary ?? COLORS.accent;

  return (
    <View style={[styles.banner, compact && styles.bannerCompact]}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{view.typeLabel}</Text>
        <View style={[styles.badge, { backgroundColor: sevColor }]}>
          <Text style={styles.badgeText}>{view.severityLevel.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        Detection {view.detectionConfidencePercent}% · Severity {view.severityScore}/100 · {view.locationLabel}
        {!compact && view.hasPipeline ? ` · ${view.signalCount} signals · ${view.dispatchCount} dispatches` : ''}
        {view.hasSearchContext ? ' · 🔍 Search' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  bannerCompact: { marginHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '800', marginRight: SPACING.sm },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADII.sm },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  meta: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs },
});
