// ─────────────────────────────────────────────────────────────
// SimulateScreen — Full crisis simulation runner for CrisisAI
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useCrisisStore, type LiveAgentStep } from '../store/crisisStore';
import type { OutcomeMetric } from '../types';
import {
  POWER_OUTAGE_SIGNALS,
  FLOOD_WEATHER_SIGNALS,
  ROAD_DAMAGE_SIGNALS,
  MULTI_CRISIS_SIGNALS,
} from '../data/mockSignals';
import { EDGE_SCENARIOS } from '../data/edgeScenarios';
import type { EdgeScenario } from '../data/edgeScenarios';
import { CHALLENGE_SCENARIOS } from '../data/demoScenarios';
import { buildScenarioInputs } from '../services/feedService';
import type { CrisisType } from '../types';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';
import { ActiveCrisisBanner } from '../components/ActiveCrisisBanner';

// ── Constants ───────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

interface DemoScenario {
  id: string;
  label: string;
  emoji: string;
  description: string;
  inputs: string[];
  withFeeds?: boolean;
  primaryType?: CrisisType;
}

const SCENARIOS: DemoScenario[] = [
  {
    id: 'power', label: 'F-7 Power Grid Failure', emoji: '⚡',
    description: 'Multi-signal power outage with grid sensor + citizen reports + traffic impact',
    inputs: POWER_OUTAGE_SIGNALS.map((s) => s.text),
  },
  {
    id: 'road', label: 'GT Road Bridge Damage', emoji: '🛣️',
    description: 'Structural stress sensor + traffic spike + citizen reports of cracked bridge',
    inputs: ROAD_DAMAGE_SIGNALS.map((s) => s.text),
  },
  {
    id: 'flood', label: 'DHA-2 Flood + Power Crisis', emoji: '🌊',
    description: 'Complex cascade: flooding + power failure + electrocution risk',
    inputs: [...FLOOD_WEATHER_SIGNALS.slice(0, 3), ...MULTI_CRISIS_SIGNALS.slice(0, 2)].map((s) => s.text),
  },
  {
    id: 'heatwave', label: 'Blue Area Heatwave', emoji: '🌡️',
    description: 'Citizen heatstroke reports + PMD extreme heat API alert',
    inputs: ['Extreme heat in Blue Area Islamabad — people fainting outdoors, need cooling centres and water'],
    withFeeds: true,
    primaryType: 'heatwave',
  },
  {
    id: 'accident', label: 'GT Road Accident Blockage', emoji: '🚗',
    description: 'Multi-vehicle crash citizen report + traffic gridlock API spike',
    inputs: ['Major accident on GT Road near Faizabad — 3 vehicles crashed, road completely blocked, ambulances stuck'],
    withFeeds: true,
    primaryType: 'road_damage',
  },
];

// ═══════════════════════════════════════════════════════════════
// SimulateScreen Component
// ═══════════════════════════════════════════════════════════════

type FeedItem = { icon: string; text: string; level: string };

function agentStepsToFeed(steps: LiveAgentStep[]): FeedItem[] {
  return steps
    .filter((s) => s.status !== 'waiting')
    .map((s) => ({
      icon: s.emoji,
      text: `${s.name}: ${s.message}`,
      level:
        s.status === 'failed' ? 'warn'
        : s.status === 'running' ? 'info'
        : s.status === 'skipped' ? 'info'
        : 'success',
    }));
}

export default function SimulateScreen() {
  const navigation = useNavigation();
  const {
    currentPipeline, pipelineStatus, startPipeline, systemLogs, liveAgentSteps,
  } = useCrisisStore();
  const activeView = useActiveCrisisView();

  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>(SCENARIOS[0]);
  const [localRunning, setLocalRunning] = useState(false);
  const [edgeFeed, setEdgeFeed] = useState<FeedItem[]>([]);
  const [activeEdge, setActiveEdge] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const isRunning = localRunning || pipelineStatus === 'running';

  const executionFeed = useMemo((): FeedItem[] => {
    const agentFeed = agentStepsToFeed(liveAgentSteps);
    const logFeed = systemLogs.slice(-12).map((log) => ({
      icon: log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'SUCCESS' ? '✅' : '▸',
      text: `[${log.agent}] ${log.message}`,
      level: log.level === 'ERROR' ? 'warn' : log.level === 'WARN' ? 'warn' : log.level === 'SUCCESS' ? 'success' : 'info',
    }));
    return [...agentFeed, ...logFeed];
  }, [liveAgentSteps, systemLogs]);

  const progress = useMemo(() => {
    const done = liveAgentSteps.filter((s) =>
      s.status === 'completed' || s.status === 'failed' || s.status === 'skipped',
    ).length;
    return Math.round((done / liveAgentSteps.length) * 100);
  }, [liveAgentSteps]);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress / 100, duration: 400, useNativeDriver: false }).start();
  }, [progress, progressAnim]);

  const runSimulation = useCallback(async () => {
    if (isRunning) return;
    setLocalRunning(true);
    setActiveEdge(null);
    setEdgeFeed([]);
    progressAnim.setValue(0);
    try {
      const inputs = selectedScenario.withFeeds && selectedScenario.primaryType
        ? await buildScenarioInputs(selectedScenario.inputs[0], selectedScenario.primaryType)
        : selectedScenario.inputs;
      await startPipeline(inputs);
    } finally {
      setLocalRunning(false);
    }
  }, [isRunning, selectedScenario, startPipeline, progressAnim]);

  const runEdgeScenario = useCallback(async (scenario: EdgeScenario) => {
    if (isRunning) return;
    setLocalRunning(true);
    setActiveEdge(scenario.id);
    setEdgeFeed([
      { icon: '🧪', text: `${scenario.tag}: ${scenario.label}`, level: 'info' },
      { icon: '📋', text: scenario.description, level: 'info' },
    ]);
    progressAnim.setValue(0);
    try {
      await startPipeline(scenario.inputs);
      const result = useCrisisStore.getState().currentPipeline;
      const tail: FeedItem[] = [];
      if (result?.status === 'NO_CRISIS_DETECTED') {
        tail.push({ icon: '🚫', text: 'No crisis generated — false alarm avoided', level: 'edge' });
      } else if (result?.crisisEvent) {
        const det = Math.round(result.crisisEvent.confidence * 100);
        const sev = result.severity?.score ?? det;
        tail.push({
          icon: '✅',
          text: `Detected: ${result.crisisEvent.detectedType} (detection ${det}%, severity ${sev}/100)`,
          level: 'success',
        });
      }
      if (result?.simulation) {
        tail.push({
          icon: '📊',
          text: `Outcome: ${result.simulation.outcome.overallImprovement}% improvement · ${result.simulation.tickets.length} dispatches`,
          level: 'success',
        });
      }
      setEdgeFeed((prev) => [...prev, ...tail]);
    } finally {
      setLocalRunning(false);
    }
  }, [isRunning, startPipeline, progressAnim]);

  useEffect(() => {
    if (!activeEdge) return;
    setEdgeFeed((prev) => {
      const live = agentStepsToFeed(liveAgentSteps);
      const merged = [...prev];
      for (const item of live) {
        if (!merged.some((m) => m.text === item.text)) merged.push(item);
      }
      return merged;
    });
  }, [liveAgentSteps, activeEdge]);

  useEffect(() => {
    if (executionFeed.length > 0 || edgeFeed.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [executionFeed.length, edgeFeed.length]);

  // ── Derived data ──────────────────────────────────────

  const sim = currentPipeline?.simulation;
  const outcome = sim?.outcome;
  const comparison = sim?.agenticComparison;
  const showComparison = !!comparison && pipelineStatus === 'complete';

  const METRIC_ICONS: Record<string, string> = {
    'Traffic Congestion': '🚗',
    'Infrastructure Status': '⚡',
    'Emergency Response': '🚑',
    'Alert Coverage': '📨',
    'Residents with Assistance': '👥',
    'Accident Probability': '⚠️',
  };

  const beforeData = outcome
    ? outcome.metrics.map((m) => ({
        label: m.metric,
        value: m.before,
        icon: METRIC_ICONS[m.metric] ?? '•',
      }))
    : [];

  const afterData = outcome
    ? outcome.metrics.map((m) => ({
        label: m.metric,
        value: m.after,
        icon: METRIC_ICONS[m.metric] ?? '•',
      }))
    : [];

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>

      {/* Title */}
      <Text style={styles.title}>🧪 Crisis Simulation</Text>
      <Text style={styles.subtitle}>Run scenarios through the full 5-agent pipeline</Text>

      {activeView && pipelineStatus === 'complete' && (
        <View style={styles.activeBanner}>
          <ActiveCrisisBanner view={activeView} compact />
        </View>
      )}

      <Text style={styles.sectionTitle}>CIRO CHALLENGE DEMOS</Text>
      {CHALLENGE_SCENARIOS.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={styles.scenarioCard}
          onPress={async () => {
            if (isRunning) return;
            setLocalRunning(true);
            try {
              const inputs = await buildScenarioInputs(s.text, s.primaryType);
              await startPipeline(inputs);
            } finally {
              setLocalRunning(false);
            }
          }}
          disabled={isRunning}
        >
          <Text style={styles.scenarioEmoji}>{s.emoji}</Text>
          <View style={styles.scenarioInfo}>
            <Text style={styles.scenarioLabel}>{s.label}</Text>
            <Text style={styles.scenarioDesc}>{s.description}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* ── 1. Scenario Selector ──────────────────────── */}
      <Text style={styles.sectionTitle}>SELECT SCENARIO</Text>
      {SCENARIOS.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.scenarioCard, selectedScenario.id === s.id && styles.scenarioCardActive]}
          onPress={() => setSelectedScenario(s)}
          disabled={isRunning}
        >
          <Text style={styles.scenarioEmoji}>{s.emoji}</Text>
          <View style={styles.scenarioInfo}>
            <Text style={styles.scenarioLabel}>{s.label}</Text>
            <Text style={styles.scenarioDesc}>{s.description}</Text>
          </View>
          {selectedScenario.id === s.id && (
            <View style={styles.selectedDot} />
          )}
        </TouchableOpacity>
      ))}

      {/* ── Robustness Edge Cases ─────────────────────── */}
      <Text style={styles.sectionTitle}>⚠️ ROBUSTNESS SCENARIOS</Text>
      <Text style={styles.edgeSubtitle}>Demonstrate failure handling & adaptation</Text>
      {EDGE_SCENARIOS.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.edgeCard, activeEdge === s.id && styles.edgeCardActive]}
          onPress={() => runEdgeScenario(s)}
          disabled={isRunning}
        >
          <View style={styles.edgeHeader}>
            <Text style={styles.edgeEmoji}>{s.emoji}</Text>
            <View style={styles.edgeInfo}>
              <View style={styles.edgeTagRow}>
                <View style={styles.edgeTag}>
                  <Text style={styles.edgeTagText}>{s.tag}</Text>
                </View>
                <Text style={styles.edgeLabel}>{s.label}</Text>
              </View>
              <Text style={styles.edgeDesc}>{s.description}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Edge case feed */}
      {edgeFeed.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🧪 EDGE CASE LOG</Text>
          <View style={[styles.feedContainer, styles.edgeFeedContainer]}>
            {edgeFeed.map((item, i) => (
              <View key={i} style={[
                styles.feedItem,
                item.level === 'warn' && styles.feedItemWarn,
                item.level === 'edge' && styles.feedItemEdge,
                item.level === 'info' && styles.feedItemInfo,
              ]}>
                <Text style={styles.feedIcon}>{item.icon}</Text>
                <Text style={[
                  styles.feedText,
                  item.level === 'warn' && styles.feedTextWarn,
                  item.level === 'edge' && styles.feedTextEdge,
                  item.level === 'info' && styles.feedTextInfo,
                ]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── 3. Simulation Controls ────────────────────── */}
      <TouchableOpacity
        style={[styles.runBtn, isRunning && styles.runBtnDisabled]}
        onPress={runSimulation}
        disabled={isRunning}
      >
        {isRunning ? (
          <View style={styles.runBtnRow}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.runBtnText}>  Agents processing…</Text>
          </View>
        ) : (
          <Text style={styles.runBtnText}>▶  Run Simulation</Text>
        )}
      </TouchableOpacity>

      {/* Live status */}
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          Pipeline: <Text style={styles.statusBold}>{pipelineStatus.toUpperCase()}</Text>
          {currentPipeline?.status ? ` · ${currentPipeline.status}` : ''}
        </Text>
      </View>

      {/* Progress bar */}
      {(isRunning || progress > 0) && (
        <View style={styles.progressContainer}>
          <Animated.View style={[
            styles.progressBar,
            { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]} />
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {/* ── 4. Execution Feed ─────────────────────────── */}
      {executionFeed.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>EXECUTION LOG</Text>
          <View style={styles.feedContainer}>
            {executionFeed.map((item, i) => (
              <View key={i} style={[
                styles.feedItem,
                item.level === 'warn' && styles.feedItemWarn,
                item.level === 'info' && styles.feedItemInfo,
              ]}>
                <Text style={styles.feedIcon}>{item.icon}</Text>
                <Text style={[
                  styles.feedText,
                  item.level === 'warn' && styles.feedTextWarn,
                  item.level === 'info' && styles.feedTextInfo,
                ]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── 2. Before/After Panel ─────────────────────── */}
      {outcome && beforeData.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>BEFORE vs AFTER</Text>
          <View style={styles.baColumns}>
            {/* Before column */}
            <View style={[styles.baColumn, styles.baColumnBefore]}>
              <Text style={styles.baColumnTitle}>⛔ BEFORE</Text>
              {beforeData.map((d, i) => (
                <View key={i} style={styles.baRow}>
                  <Text style={styles.baIcon}>{d.icon}</Text>
                  <View style={styles.baInfo}>
                    <Text style={styles.baLabel}>{d.label}</Text>
                    <Text style={[styles.baValue, styles.baValueBefore]}>{d.value}</Text>
                  </View>
                </View>
              ))}
            </View>
            {/* After column */}
            <View style={[styles.baColumn, styles.baColumnAfter]}>
              <Text style={styles.baColumnTitle}>✅ AFTER</Text>
              {afterData.map((d, i) => (
                <View key={i} style={styles.baRow}>
                  <Text style={styles.baIcon}>{d.icon}</Text>
                  <View style={styles.baInfo}>
                    <Text style={styles.baLabel}>{d.label}</Text>
                    <Text style={[styles.baValue, styles.baValueAfter]}>{d.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── 5. Outcome Metric Bars ────────────────── */}
          <Text style={styles.sectionTitle}>IMPROVEMENT METRICS</Text>
          <View style={styles.metricsCard}>
            {outcome.metrics.map((m, i) => (
              <MetricBar key={i} metric={m} />
            ))}
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Overall Improvement</Text>
              <Text style={styles.overallValue}>{outcome.overallImprovement}%</Text>
            </View>
          </View>
        </>
      )}

      {/* ── 6. Baseline Comparison ────────────────────── */}
      {showComparison && comparison && (
        <>
          <Text style={styles.sectionTitle}>AGENTIC vs HEURISTIC</Text>
          <View style={styles.compCard}>
            <View style={styles.compSection}>
              <View style={[styles.compBadge, { backgroundColor: SEVERITY_COLORS.high.primary }]}>
                <Text style={styles.compBadgeText}>📝 SIMPLE SYSTEM</Text>
              </View>
              <Text style={styles.compText}>{comparison.simple}</Text>
            </View>
            <View style={styles.compDivider} />
            <View style={styles.compSection}>
              <View style={[styles.compBadge, { backgroundColor: COLORS.accent }]}>
                <Text style={[styles.compBadgeText, { color: '#000' }]}>🤖 AGENTIC SYSTEM</Text>
              </View>
              <Text style={styles.compText}>{comparison.agentic}</Text>
            </View>
          </View>
        </>
      )}

      {/* ── 7. Trace Button ───────────────────────────── */}
      {outcome && (
        <TouchableOpacity
          style={styles.traceBtn}
          onPress={() => navigation.navigate('Logs' as never)}
        >
          <Text style={styles.traceBtnText}>📜 View Full Agent Reasoning →</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// MetricBar sub-component
// ═══════════════════════════════════════════════════════════════

function MetricBar({ metric }: { metric: OutcomeMetric }) {
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: 1, duration: 1500, useNativeDriver: false }).start();
  }, [barAnim]);

  // Parse numeric value from "after" string
  const numericAfter = parseInt(metric.after.replace(/[^0-9]/g, ''), 10) || 0;
  const barWidth = Math.min(100, numericAfter);

  return (
    <View style={mStyles.row}>
      <Text style={mStyles.label}>{metric.metric}</Text>
      <View style={mStyles.barTrack}>
        <Animated.View style={[
          mStyles.barFill,
          {
            width: barAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', `${barWidth}%`],
            }),
          },
        ]} />
      </View>
      <Text style={mStyles.improvement}>{metric.improvement}</Text>
    </View>
  );
}

const mStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  label: { width: 100, color: COLORS.textSecondary, fontSize: FONT_SIZES.xs },
  barTrack: { flex: 1, height: 8, backgroundColor: COLORS.card, borderRadius: 4, marginHorizontal: SPACING.sm, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: COLORS.accent, borderRadius: 4 },
  improvement: { width: 70, color: COLORS.success, fontSize: FONT_SIZES.xs, fontWeight: '700', textAlign: 'right' },
});

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 56 },

  title: { fontSize: FONT_SIZES.xxl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.md },
  activeBanner: { marginBottom: SPACING.md },
  statusRow: { marginBottom: SPACING.md },
  statusText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  statusBold: { color: COLORS.accent, fontWeight: '800' },
  sectionTitle: {
    fontSize: FONT_SIZES.xs, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: SPACING.xl, marginBottom: SPACING.md,
  },

  // Scenario selector
  scenarioCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADII.md, padding: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  scenarioCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.card },
  scenarioEmoji: { fontSize: 28, marginRight: SPACING.md },
  scenarioInfo: { flex: 1 },
  scenarioLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700' },
  scenarioDesc: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 2 },
  selectedDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.accent },

  // Run button
  runBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADII.md,
    paddingVertical: SPACING.lg, alignItems: 'center', marginTop: SPACING.lg,
  },
  runBtnDisabled: { backgroundColor: COLORS.textMuted },
  runBtnRow: { flexDirection: 'row', alignItems: 'center' },
  runBtnText: { color: '#000', fontSize: FONT_SIZES.lg, fontWeight: '800' },

  // Progress
  progressContainer: {
    marginTop: SPACING.md, height: 24, backgroundColor: COLORS.surface,
    borderRadius: RADII.sm, overflow: 'hidden', justifyContent: 'center',
  },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.accent, borderRadius: RADII.sm },
  progressText: { textAlign: 'center', color: '#000', fontSize: FONT_SIZES.xs, fontWeight: '800', zIndex: 1 },

  // Feed
  feedContainer: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  feedItem: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  feedItemWarn: { backgroundColor: 'rgba(255,109,0,0.08)' },
  feedItemInfo: { opacity: 0.7 },
  feedIcon: { fontSize: 14, marginRight: SPACING.sm, width: 22 },
  feedText: { color: COLORS.success, fontSize: FONT_SIZES.xs, flex: 1, lineHeight: 18 },
  feedTextWarn: { color: SEVERITY_COLORS.high.primary },
  feedTextInfo: { color: COLORS.textSecondary },

  // Edge case styles
  edgeSubtitle: { color: SEVERITY_COLORS.medium.primary, fontSize: FONT_SIZES.xs, marginBottom: SPACING.md, fontStyle: 'italic' },
  edgeCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: SEVERITY_COLORS.medium.primary, borderStyle: 'dashed',
  },
  edgeCardActive: { borderColor: SEVERITY_COLORS.high.primary, backgroundColor: 'rgba(255,109,0,0.06)', borderStyle: 'solid' },
  edgeHeader: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  edgeEmoji: { fontSize: 24, marginRight: SPACING.md },
  edgeInfo: { flex: 1 },
  edgeTagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  edgeTag: { backgroundColor: SEVERITY_COLORS.medium.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADII.sm, marginRight: SPACING.sm },
  edgeTagText: { color: '#000', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  edgeLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  edgeDesc: { color: COLORS.textMuted, fontSize: 10 },
  edgeFeedContainer: { borderColor: SEVERITY_COLORS.medium.primary },
  feedItemEdge: { backgroundColor: 'rgba(255,23,68,0.08)' },
  feedTextEdge: { color: SEVERITY_COLORS.critical.primary, fontWeight: '700' },

  // Before/After
  baColumns: { flexDirection: 'row', gap: SPACING.sm },
  baColumn: { flex: 1, borderRadius: RADII.md, padding: SPACING.md, borderWidth: 1 },
  baColumnBefore: { backgroundColor: 'rgba(255,23,68,0.06)', borderColor: 'rgba(255,23,68,0.2)' },
  baColumnAfter: { backgroundColor: 'rgba(0,230,118,0.06)', borderColor: 'rgba(0,230,118,0.2)' },
  baColumnTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '800', marginBottom: SPACING.md, textAlign: 'center' },
  baRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  baIcon: { fontSize: 14, marginRight: 6, width: 20 },
  baInfo: { flex: 1 },
  baLabel: { color: COLORS.textMuted, fontSize: 9, letterSpacing: 0.3 },
  baValue: { fontSize: FONT_SIZES.xs, fontWeight: '700', marginTop: 1 },
  baValueBefore: { color: SEVERITY_COLORS.critical.primary },
  baValueAfter: { color: COLORS.success },

  // Metrics
  metricsCard: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  overallRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  overallLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700' },
  overallValue: { color: COLORS.accent, fontSize: FONT_SIZES.xl, fontWeight: '900' },

  // Comparison
  compCard: {
    backgroundColor: COLORS.surface, borderRadius: RADII.lg,
    padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  compSection: { marginBottom: SPACING.sm },
  compBadge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 3, borderRadius: RADII.sm, marginBottom: SPACING.sm },
  compBadgeText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: '800' },
  compText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, lineHeight: 18 },
  compDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.lg },

  // Trace
  traceBtn: {
    alignSelf: 'center', marginTop: SPACING.xl,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl,
    borderRadius: RADII.full, borderWidth: 1, borderColor: COLORS.accentAlt,
  },
  traceBtnText: { color: COLORS.accentAlt, fontSize: FONT_SIZES.sm, fontWeight: '700' },
});
