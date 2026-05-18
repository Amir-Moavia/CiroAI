// ─────────────────────────────────────────────────────────────
// LogsScreen — Agent reasoning trace viewer for CrisisAI
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useCrisisStore } from '../store/crisisStore';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';
import { ActiveCrisisBanner } from '../components/ActiveCrisisBanner';
import type { AgentTrace, PipelineTrace, LogEntry } from '../types';

// ── Constants ───────────────────────────────────────────────

type AgentFilter = 'all' | 'InputAgent' | 'DetectionAgent' | 'AnalysisAgent' | 'PlanningAgent' | 'SimulationAgent';

const AGENT_FILTERS: Array<{ key: AgentFilter; label: string; emoji: string }> = [
  { key: 'all', label: 'All Agents', emoji: '🔗' },
  { key: 'InputAgent', label: 'Input', emoji: '📥' },
  { key: 'DetectionAgent', label: 'Detection', emoji: '🔍' },
  { key: 'AnalysisAgent', label: 'Analysis', emoji: '📊' },
  { key: 'PlanningAgent', label: 'Planning', emoji: '📋' },
  { key: 'SimulationAgent', label: 'Simulation', emoji: '▶️' },
];

type ViewTab = 'traces' | 'logs' | 'comparison';

// ═══════════════════════════════════════════════════════════════
// LogsScreen Component
// ═══════════════════════════════════════════════════════════════

export default function LogsScreen() {
  const { agentTraces, systemLogs, currentPipeline, pipelineStatus } = useCrisisStore();
  const activeView = useActiveCrisisView();

  const [selectedTraceIdx, setSelectedTraceIdx] = useState(0);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('traces');

  // ── Derived ───────────────────────────────────────────

  const selectedTrace: PipelineTrace | null = agentTraces[selectedTraceIdx] ?? null;

  const filteredAgents: AgentTrace[] = useMemo(() => {
    if (!selectedTrace) return [];
    if (agentFilter === 'all') return selectedTrace.agents;
    return selectedTrace.agents.filter((a) => a.agentName === agentFilter);
  }, [selectedTrace, agentFilter]);

  const comparison = currentPipeline?.simulation?.agenticComparison;

  useEffect(() => {
    if (agentTraces.length > 0) {
      setSelectedTraceIdx(agentTraces.length - 1);
    }
  }, [agentTraces.length]);

  // ── Copy trace ────────────────────────────────────────

  const copyTrace = useCallback(() => {
    if (!selectedTrace) return;
    const json = JSON.stringify(selectedTrace, null, 2);
    try {
      const RNClipboard = require('react-native').Clipboard;
      if (RNClipboard && typeof RNClipboard.setString === 'function') {
        RNClipboard.setString(json);
      }
    } catch {
      // Clipboard may not be available in all environments
    }
  }, [selectedTrace]);

  const tracesListHeader = useMemo(
    () => (
      <View style={styles.tracesListHeader}>
        {agentTraces.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pipelineRow}>
            {agentTraces.map((t, i) => (
              <TouchableOpacity
                key={t.pipelineId}
                style={[styles.pipelineChip, selectedTraceIdx === i && styles.pipelineChipActive]}
                onPress={() => setSelectedTraceIdx(i)}
              >
                <Text style={[styles.pipelineChipText, selectedTraceIdx === i && styles.pipelineChipTextActive]}>
                  {t.pipelineId.slice(-7)} · {t.totalDurationMs}ms
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {AGENT_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, agentFilter === f.key && styles.filterChipActive]}
              onPress={() => setAgentFilter(f.key)}
            >
              <Text style={[styles.filterText, agentFilter === f.key && styles.filterTextActive]}>
                {f.emoji} {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedTrace && (
          <TouchableOpacity style={styles.exportBtn} onPress={copyTrace}>
            <Text style={styles.exportBtnText}>📋 Copy Trace to Clipboard</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [agentTraces, selectedTraceIdx, agentFilter, selectedTrace, copyTrace],
  );

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>📋 Agent Logs</Text>

      {activeView && pipelineStatus === 'complete' && (
        <ActiveCrisisBanner view={activeView} />
      )}

      {/* View tabs — solid bg + elevation so list scroll never paints over tabs */}
      <View style={styles.viewTabsWrap}>
        <View style={styles.viewTabs}>
          {([
            ['traces', '🔍 Traces'],
            ['logs', '📜 System Logs'],
            ['comparison', '⚖️ Comparison'],
          ] as [ViewTab, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.viewTab, viewTab === key && styles.viewTabActive]}
              onPress={() => setViewTab(key)}
            >
              <Text style={[styles.viewTabText, viewTab === key && styles.viewTabTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── TRACES TAB ──────────────────────────────── */}
      {viewTab === 'traces' && (
        <FlatList<AgentTrace>
          data={filteredAgents}
          keyExtractor={(item) => item.agentName + item.startTime}
          style={styles.tabList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={tracesListHeader}
          renderItem={({ item }) => <TraceCard trace={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔬</Text>
              <Text style={styles.emptyText}>No agent traces</Text>
              <Text style={styles.emptyHint}>Run a simulation to see agent reasoning here</Text>
            </View>
          }
        />
      )}

      {/* ── SYSTEM LOGS TAB ─────────────────────────── */}
      {viewTab === 'logs' && (
        <FlatList<LogEntry>
          data={systemLogs}
          keyExtractor={(_, i) => String(i)}
          style={styles.tabList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <LogEntryRow entry={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📜</Text>
              <Text style={styles.emptyText}>No system logs</Text>
              <Text style={styles.emptyHint}>Logs appear as agents process signals</Text>
            </View>
          }
        />
      )}

      {/* ── COMPARISON TAB ──────────────────────────── */}
      {viewTab === 'comparison' && (
        <ScrollView style={styles.tabList} contentContainerStyle={styles.list}>
          {comparison ? (
            <View>
              {/* Simple */}
              <View style={styles.compCard}>
                <View style={[styles.compBadge, { backgroundColor: SEVERITY_COLORS.high.primary }]}>
                  <Text style={styles.compBadgeText}>📝 SIMPLE HEURISTIC</Text>
                </View>
                <Text style={styles.compDescription}>{comparison.simple}</Text>
              </View>

              {/* Agentic */}
              <View style={[styles.compCard, { borderColor: COLORS.accent }]}>
                <View style={[styles.compBadge, { backgroundColor: COLORS.accent }]}>
                  <Text style={[styles.compBadgeText, { color: '#000' }]}>🤖 AGENTIC SYSTEM</Text>
                </View>
                {selectedTrace?.agents.map((agent, i) => (
                  <View key={agent.agentName} style={styles.compAgentRow}>
                    <Text style={styles.compAgentNum}>{i + 1}</Text>
                    <View style={styles.compAgentInfo}>
                      <Text style={styles.compAgentName}>{agent.agentName}</Text>
                      <Text style={styles.compAgentObs} numberOfLines={1}>
                        {agent.observations[0] ?? '—'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.compAgentStatus,
                      { color: agent.status === 'completed' ? COLORS.success : SEVERITY_COLORS.critical.primary },
                    ]}>
                      {agent.status === 'completed' ? '✅' : '❌'}
                    </Text>
                  </View>
                ))}
                <Text style={styles.compDescription}>{comparison.agentic}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>⚖️</Text>
              <Text style={styles.emptyText}>No comparison data</Text>
              <Text style={styles.emptyHint}>Run a simulation to see agentic vs heuristic</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// TraceCard sub-component
// ═══════════════════════════════════════════════════════════════

function TraceCard({ trace }: { trace: AgentTrace }) {
  const [expanded, setExpanded] = useState(false);
  const isEdgeCase = trace.status === 'failed' || trace.reasoning.some((r) => r.toLowerCase().includes('error') || r.toLowerCase().includes('fallback'));
  const statusIcon = trace.status === 'completed' ? '✅' : trace.status === 'failed' ? '❌' : '⚠️';

  return (
    <TouchableOpacity
      style={[styles.traceCard, isEdgeCase && styles.traceCardEdge]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.traceHeader}>
        <Text style={styles.traceAgent}>{statusIcon} {trace.agentName}</Text>
        {isEdgeCase && <Text style={styles.edgeTag}>⚠️ EDGE CASE</Text>}
        <Text style={styles.traceExpand}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Input summary */}
      <Text style={styles.traceInput}>📥 {trace.inputSummary}</Text>

      {/* Observations */}
      {trace.observations.length > 0 && (
        <View style={styles.traceSection}>
          <Text style={styles.traceSectionLabel}>OBSERVATION</Text>
          {trace.observations.slice(0, expanded ? undefined : 1).map((o, i) => (
            <Text key={i} style={styles.traceSectionText}>• {o}</Text>
          ))}
        </View>
      )}

      {/* Reasoning */}
      {trace.reasoning.length > 0 && (
        <View style={styles.traceSection}>
          <Text style={[styles.traceSectionLabel, { color: COLORS.accentAlt }]}>REASONING</Text>
          {trace.reasoning.slice(0, expanded ? undefined : 1).map((r, i) => (
            <Text key={i} style={styles.traceSectionText}>💭 {r}</Text>
          ))}
        </View>
      )}

      {/* Decisions */}
      {trace.decisions.length > 0 && (
        <View style={styles.traceSection}>
          <Text style={[styles.traceSectionLabel, { color: COLORS.accent }]}>DECISION</Text>
          {trace.decisions.slice(0, expanded ? undefined : 1).map((d, i) => (
            <Text key={i} style={styles.traceSectionText}>⚡ {d}</Text>
          ))}
        </View>
      )}

      {/* Outputs (expanded only) */}
      {expanded && trace.outputs.length > 0 && (
        <View style={styles.traceSection}>
          <Text style={[styles.traceSectionLabel, { color: COLORS.success }]}>OUTPUT</Text>
          {trace.outputs.map((o, i) => (
            <Text key={i} style={styles.traceJsonText}>
              {JSON.stringify(o, null, 2)}
            </Text>
          ))}
        </View>
      )}

      {/* Timing */}
      <Text style={styles.traceTiming}>
        {new Date(trace.startTime).toLocaleTimeString('en-PK', { hour12: false })}
      </Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════
// LogEntryRow sub-component
// ═══════════════════════════════════════════════════════════════

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const levelColor = entry.level === 'ERROR' ? SEVERITY_COLORS.critical.primary
    : entry.level === 'SUCCESS' ? COLORS.success
    : entry.level === 'WARN' ? SEVERITY_COLORS.high.primary
    : COLORS.textMuted;

  return (
    <View style={styles.logRow}>
      <Text style={styles.logTime}>{entry.timestamp}</Text>
      <View style={[styles.logLevelDot, { backgroundColor: levelColor }]} />
      <Text style={styles.logAgent}>{entry.agent}</Text>
      <Text style={styles.logMessage} numberOfLines={2}>{entry.message}</Text>
    </View>
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

  // View tabs — wrap keeps tabs above scroll content; zIndex avoids overlap glitches
  viewTabsWrap: {
    zIndex: 2,
    elevation: 6,
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.xs,
  },
  viewTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    padding: 3,
  },
  viewTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADII.sm, minWidth: 0 },
  viewTabActive: { backgroundColor: COLORS.accent },
  viewTabText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, fontWeight: '700', textAlign: 'center' },
  viewTabTextActive: { color: '#000' },

  tabList: { flex: 1 },

  tracesListHeader: {
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },

  // Pipeline selector
  pipelineRow: { marginBottom: SPACING.sm, maxHeight: 44 },
  pipelineChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: 8, borderRadius: RADII.full,
    backgroundColor: COLORS.surface, marginRight: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pipelineChipActive: { borderColor: COLORS.accentAlt, backgroundColor: COLORS.card },
  pipelineChipText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, fontFamily: 'monospace' },
  pipelineChipTextActive: { color: COLORS.accentAlt },

  // Agent filter
  filterRow: { marginBottom: SPACING.md, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADII.full,
    backgroundColor: COLORS.surface, marginRight: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' },
  filterTextActive: { color: '#000' },

  // Export
  exportBtn: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  exportBtnText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, textAlign: 'center' },

  // List
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 80 },

  // Trace card
  traceCard: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  traceCardEdge: { borderColor: SEVERITY_COLORS.medium.primary, backgroundColor: 'rgba(255,214,0,0.04)' },
  traceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  traceAgent: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', flex: 1 },
  edgeTag: {
    fontSize: 9, fontWeight: '800', color: '#000',
    backgroundColor: SEVERITY_COLORS.medium.primary, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADII.sm, marginRight: SPACING.sm,
  },
  traceExpand: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  traceInput: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginBottom: SPACING.sm },

  // Trace sections
  traceSection: { marginBottom: SPACING.sm },
  traceSectionLabel: {
    fontSize: 9, fontWeight: '800', color: SEVERITY_COLORS.high.primary,
    letterSpacing: 1, marginBottom: 3,
  },
  traceSectionText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, lineHeight: 17, marginLeft: SPACING.sm },
  traceJsonText: {
    color: COLORS.accent, fontSize: 10, fontFamily: 'monospace',
    backgroundColor: COLORS.card, padding: SPACING.sm, borderRadius: RADII.sm,
    overflow: 'hidden',
  },
  traceTiming: { color: COLORS.textMuted, fontSize: 9, textAlign: 'right', marginTop: SPACING.xs },

  // Log entry
  logRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  logTime: { color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace', width: 65 },
  logLevelDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 6 },
  logAgent: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '700', width: 70 },
  logMessage: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs, flex: 1 },

  // Comparison
  compCard: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.xl, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  compBadge: {
    alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: RADII.sm, marginBottom: SPACING.md,
  },
  compBadgeText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: '800' },
  compLogBlock: {
    backgroundColor: COLORS.card, borderRadius: RADII.sm, padding: SPACING.md, marginBottom: SPACING.md,
  },
  compLogLine: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, lineHeight: 20, fontFamily: 'monospace' },
  compDescription: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, lineHeight: 17 },
  compAgentRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  compAgentNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accent,
    color: '#000', fontSize: FONT_SIZES.xs, fontWeight: '800',
    textAlign: 'center', lineHeight: 22, marginRight: SPACING.sm,
  },
  compAgentInfo: { flex: 1 },
  compAgentName: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  compAgentObs: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  compAgentStatus: { fontSize: 14 },

  // Empty
  empty: { alignItems: 'center', paddingTop: SPACING.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  emptyHint: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
});
