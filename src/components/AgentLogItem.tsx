// ─────────────────────────────────────────────────────────────
// AgentLogItem — Displays a single agent action in the log
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AgentAction } from '../types';
import { COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';

interface Props {
  action: AgentAction;
}

export default function AgentLogItem({ action }: Props) {
  const statusColor =
    action.status === 'completed'
      ? COLORS.success
      : action.status === 'failed'
        ? COLORS.danger
        : COLORS.warning;

  return (
    <View style={styles.item}>
      <View style={styles.header}>
        <Text style={styles.agent}>{action.agentName}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      <Text style={styles.reasoning} numberOfLines={2}>
        {action.reasoning || 'No reasoning recorded'}
      </Text>
      <Text style={styles.timestamp}>{action.timestamp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  agent: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.accentAlt,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reasoning: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  timestamp: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});
