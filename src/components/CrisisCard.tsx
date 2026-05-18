// ─────────────────────────────────────────────────────────────
// CrisisCard — Card displaying a single crisis event summary
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CrisisEvent } from '../types';
import { COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import SeverityBadge from './SeverityBadge';

interface Props {
  event: CrisisEvent;
  onPress?: (event: CrisisEvent) => void;
}

export default function CrisisCard({ event, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(event)}
    >
      <View style={styles.header}>
        <Text style={styles.type}>{event.detectedType.toUpperCase()}</Text>
        <SeverityBadge severity={event.severity} size="sm" />
      </View>
      <Text style={styles.location}>
        {event.location.city ?? event.location.label ?? 'Unknown location'}
      </Text>
      <Text style={styles.confidence}>
        Confidence: {(event.confidence * 100).toFixed(0)}%
      </Text>
      <Text style={styles.signals}>
        {event.signals.length} signal{event.signals.length !== 1 ? 's' : ''} aggregated
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  type: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  location: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  confidence: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  signals: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});
