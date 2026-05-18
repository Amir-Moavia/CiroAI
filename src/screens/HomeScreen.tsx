// ─────────────────────────────────────────────────────────────
// HomeScreen — CrisisAI Command Center Dashboard
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useCrisisStore } from '../store/crisisStore';
import { useAlertStore } from '../store/alertStore';
import type { CrisisEvent, Severity, CrisisType } from '../types';
import { ALL_MOCK_SIGNALS } from '../data/mockSignals';
import { SOCIAL_PRESETS } from '../data/demoScenarios';
import { fetchSimulatedFeeds, buildScenarioInputs } from '../services/feedService';
import { CHALLENGE_SCENARIOS, type ChallengeScenario } from '../data/demoScenarios';
import { isLlmAvailable, getLlmStatusLabel } from '../services/llmService';
import { useCrisisFeeds } from '../hooks/useCrisisFeeds';
import { runFullDemo } from '../utils/runFullDemo';
import { inferCrisisTypeFromText } from '../utils/primaryCrisisType';
import { formatAgentTraceSummary } from '../utils/agentTraceSummary';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';

type InputMode = 'text' | 'social' | 'api';

// ── Constants ───────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CRISIS_CARD_W = SCREEN_W * 0.65;

const SEVERITY_BG: Record<Severity, string> = {
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

type QuickType = { emoji: string; label: string; text: string; withFeeds?: boolean; primaryType?: CrisisType };
const QUICK_TYPES: QuickType[] = [
  { emoji: '⚡', label: 'Power', text: 'Power outage in my area. Electricity gone for hours.' },
  { emoji: '🌊', label: 'Flood', text: 'Street flooding, water rising fast. Cars stuck.' },
  { emoji: '🛣️', label: 'Road', text: 'Road damaged badly, dangerous pothole causing accidents.' },
  { emoji: '💧', label: 'Water', text: 'No water supply since morning. Taps completely dry.' },
  { emoji: '🌡️', label: 'Heat', text: 'Extreme heat in Blue Area Islamabad — people fainting outdoors, need cooling centres', withFeeds: true, primaryType: 'heatwave' },
  { emoji: '🚗', label: 'Accident', text: 'Major accident on GT Road near Faizabad — 3 vehicles crashed, road completely blocked', withFeeds: true, primaryType: 'road_damage' },
  { emoji: '📡', label: 'Telecom', text: 'Internet and mobile network completely down in area.' },
];

// ═══════════════════════════════════════════════════════════════
// HomeScreen Component
// ═══════════════════════════════════════════════════════════════

export default function HomeScreen() {
  // Stores
  const {
    activeCrises, currentPipeline, pipelineStatus,
    signals, systemLogs, startPipeline, clearAll,
    liveAgentSteps, mapsApiStatus, checkMapsApi,
  } = useCrisisStore();
  const { simulatedSMSCount, unreadCount } = useAlertStore();
  const activeView = useActiveCrisisView();

  // Local state
  const [inputText, setInputText] = useState('');
  const [clock, setClock] = useState(new Date());
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [liveFeeds, setLiveFeeds] = useState(false);
  const [attachFeeds, setAttachFeeds] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStatus, setDemoStatus] = useState('');

  useCrisisFeeds(liveFeeds);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    checkMapsApi();
  }, [checkMapsApi]);

  // ── Handlers ──────────────────────────────────────────

  const buildInputsWithFeeds = useCallback(async (texts: string[]) => {
    const inputs: Array<string | Record<string, unknown>> = [...texts];
    if (attachFeeds && texts.length > 0) {
      const primaryType = inferCrisisTypeFromText(texts.join(' '));
      const feeds = await fetchSimulatedFeeds(undefined, primaryType);
      inputs.push(...feeds.rawInputs);
    }
    return inputs;
  }, [attachFeeds]);

  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return;
    const inputs = await buildInputsWithFeeds([inputText.trim()]);
    await startPipeline(inputs);
    setInputText('');
  }, [inputText, startPipeline, buildInputsWithFeeds]);

  const handleSocialSubmit = useCallback(async (text: string) => {
    const inputs = await buildInputsWithFeeds([text]);
    await startPipeline(inputs);
  }, [startPipeline, buildInputsWithFeeds]);

  const handleApiOnly = useCallback(async () => {
    const feeds = await fetchSimulatedFeeds();
    await startPipeline(feeds.rawInputs);
  }, [startPipeline]);

  const handleFullDemo = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    try {
      await runFullDemo(startPipeline, clearAll, setDemoStatus);
    } finally {
      setDemoRunning(false);
    }
  }, [demoRunning, startPipeline, clearAll]);

  const handleQuickTap = useCallback(async (q: QuickType) => {
    if (q.withFeeds && q.primaryType) {
      const inputs = await buildScenarioInputs(q.text, q.primaryType);
      await startPipeline(inputs);
      return;
    }
    setInputText(q.text);
  }, [startPipeline]);

  const handleChallengeScenario = useCallback(async (scenario: ChallengeScenario) => {
    const inputs = await buildScenarioInputs(scenario.text, scenario.primaryType);
    await startPipeline(inputs);
  }, [startPipeline]);

  const handleInjectMock = useCallback(async () => {
    const mockTexts = ALL_MOCK_SIGNALS.slice(0, 5).map((s) => s.text);
    await startPipeline(mockTexts);
  }, [startPipeline]);

  // ── Derived ───────────────────────────────────────────

  const isRunning = pipelineStatus === 'running';
  const statusLabel = isRunning ? 'SIMULATION RUNNING'
    : liveFeeds ? 'LIVE MONITORING'
    : activeCrises.length > 0 ? 'ACTIVE CRISIS'
    : 'STANDBY';
  const statusColor = isRunning ? COLORS.accent
    : activeCrises.length > 0 ? SEVERITY_COLORS.critical.primary
    : COLORS.success;

  const teamsDispatched = currentPipeline?.simulation?.tickets.length ?? 0;
  const pipelineSignalCount = currentPipeline?.signals.length ?? 0;
  const pipelineSeverity = currentPipeline?.severity;
  const pipelineTypeLabel = activeView?.typeLabel ?? currentPipeline?.crisisEvent?.detectedType?.replace(/_/g, ' ');

  const trace = currentPipeline?.trace;
  const pipelineDone = pipelineStatus === 'complete' || pipelineStatus === 'error';
  const noCrisis = currentPipeline?.status === 'NO_CRISIS_DETECTED';

  const agentSteps = liveAgentSteps.map((live) => {
    const traced = trace?.agents.find((a) => a.agentName === live.key);
    const done = isRunning ? live.status === 'completed' : traced?.status === 'completed';
    const failed = isRunning ? live.status === 'failed' : traced?.status === 'failed';
    const skipped = live.status === 'skipped' || (pipelineDone && !traced && !done && !failed);
    const running = isRunning && live.status === 'running';

    let summary = live.message;
    if (!isRunning && traced) {
      summary = formatAgentTraceSummary(live.key, traced, live.message);
    } else if (skipped) {
      summary = noCrisis ? 'Skipped — no crisis correlated' : 'Skipped';
    } else if (!done && !running && !failed) {
      summary = 'Waiting…';
    }

    return {
      name: live.name,
      emoji: live.emoji,
      done,
      failed,
      skipped,
      running,
      summary,
    };
  });

  // Baseline comparison
  const comparison = currentPipeline?.simulation?.agenticComparison;

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── 1. Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>🚨 CrisisAI</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <Text style={styles.timeText}>
            {clock.toLocaleTimeString('en-PK', { hour12: true })} — Pakistan Standard Time
          </Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* ── 2. Input Section ──────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.modeRow}>
          {(['text', 'social', 'api'] as InputMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeChip, inputMode === mode && styles.modeChipActive]}
              onPress={() => setInputMode(mode)}
            >
              <Text style={[styles.modeChipText, inputMode === mode && styles.modeChipTextActive]}>
                {mode === 'text' ? '📝 Text' : mode === 'social' ? '📱 Social' : '📡 APIs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.cardLabel}>REPORT A CRISIS</Text>

        {inputMode === 'text' && (
          <>
            <TextInput
              style={styles.textInput}
              placeholder="Describe what you see (English or Urdu)…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={inputText}
              onChangeText={setInputText}
              editable={!isRunning}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {QUICK_TYPES.map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={styles.quickBtn}
                  onPress={() => handleQuickTap(q)}
                  disabled={isRunning}
                >
                  <Text style={styles.quickEmoji}>{q.emoji}</Text>
                  <Text style={styles.quickLabel}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.challengeLabel}>CIRO challenge demos (report + API feeds)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {CHALLENGE_SCENARIOS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.quickBtn, styles.challengeBtn]}
                  onPress={() => handleChallengeScenario(s)}
                  disabled={isRunning}
                >
                  <Text style={styles.quickEmoji}>{s.emoji}</Text>
                  <Text style={styles.quickLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {inputMode === 'social' && (
          <View style={styles.presetGrid}>
            {SOCIAL_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={styles.presetBtn}
                onPress={() => handleSocialSubmit(p.text)}
                disabled={isRunning}
              >
                <Text style={styles.presetBtnText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {inputMode === 'api' && (
          <View style={styles.presetGrid}>
            <TouchableOpacity style={styles.presetBtn} onPress={handleApiOnly} disabled={isRunning}>
              <Text style={styles.presetBtnText}>🌧️ Weather + Traffic + Grid</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.feedToggle, attachFeeds && styles.feedToggleOn]}
          onPress={() => setAttachFeeds(!attachFeeds)}
        >
          <Text style={styles.feedToggleText}>
            {attachFeeds ? '✓ Attach simulated API feeds' : '○ API feeds off'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.feedToggle, liveFeeds && styles.feedToggleOn]}
          onPress={() => setLiveFeeds(!liveFeeds)}
        >
          <Text style={styles.feedToggleText}>
            {liveFeeds ? '● LIVE monitoring (15s)' : '○ Live monitoring off'}
          </Text>
        </TouchableOpacity>

        {isLlmAvailable() && (
          <Text style={styles.geminiBadge}>✨ AI enabled ({getLlmStatusLabel()})</Text>
        )}

        {inputMode === 'text' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.mockBtn}
              onPress={handleInjectMock}
              disabled={isRunning || demoRunning}
            >
              <Text style={styles.mockBtnText}>💉 Mock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (isRunning || !inputText.trim()) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isRunning || !inputText.trim()}
            >
              {isRunning ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.submitBtnText}> Processing…</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Submit →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.demoBtn, (demoRunning || isRunning) && styles.btnDisabled]}
          onPress={handleFullDemo}
          disabled={demoRunning || isRunning}
        >
          {demoRunning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.demoBtnText}>▶ RUN FULL DEMO (90s)</Text>
          )}
        </TouchableOpacity>
        {demoStatus ? <Text style={styles.demoStatus}>{demoStatus}</Text> : null}
      </View>

      {/* ── 3. Active Crises ──────────────────────────── */}
      <Text style={styles.sectionTitle}>Active Crises</Text>
      {activeCrises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active crises — system monitoring</Text>
        </View>
      ) : (
        <FlatList<CrisisEvent>
          data={activeCrises}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.crisisList}
          renderItem={({ item }) => (
            <CrisisCard
              event={item}
              display={item.id === activeView?.event.id ? {
                typeLabel: activeView.typeLabel,
                detectionConfidencePercent: activeView.detectionConfidencePercent,
                severityScore: activeView.severityScore,
                severityLevel: activeView.severityLevel,
              } : undefined}
            />
          )}
        />
      )}

      {mapsApiStatus ? (
        <Text style={styles.mapsStatus} numberOfLines={2}>{mapsApiStatus}</Text>
      ) : null}

      {/* ── 4. Agent Pipeline Status ──────────────────── */}
      <Text style={styles.sectionTitle}>Agent Pipeline</Text>
      <View style={styles.card}>
        {agentSteps.map((agent) => (
          <View key={agent.name} style={styles.agentRow}>
            <Text style={styles.agentEmoji}>{agent.emoji}</Text>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>{agent.name}</Text>
              <Text style={[
                styles.agentSummary,
                agent.done && styles.agentSummaryDone,
                agent.failed && styles.agentSummaryFailed,
                agent.skipped && styles.agentSummarySkipped,
              ]} numberOfLines={2}>
                {agent.summary}
              </Text>
            </View>
            <View style={styles.agentStatus}>
              {agent.running ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <View style={[
                  styles.agentDot,
                  {
                    backgroundColor: agent.done
                      ? COLORS.success
                      : agent.failed
                        ? SEVERITY_COLORS.critical.primary
                        : agent.skipped
                          ? COLORS.textMuted
                          : COLORS.border,
                  },
                ]} />
              )}
            </View>
          </View>
        ))}

        {/* Pipeline timing */}
        {trace && (
          <View style={styles.pipelineTiming}>
            <Text style={styles.timingText}>
              Pipeline: {trace.totalDurationMs}ms · {trace.agents.length} agents · Status: {trace.status}
            </Text>
          </View>
        )}
      </View>

      {/* ── 5. Quick Stats (latest pipeline run) ───────── */}
      <Text style={styles.sectionTitle}>Quick Stats {currentPipeline ? '(last run)' : ''}</Text>
      <View style={styles.statsRow}>
        <StatBox
          label="Crisis Type"
          value={pipelineTypeLabel ?? '—'}
          color={COLORS.accent}
        />
        <StatBox
          label="Signals"
          value={pipelineDone ? String(pipelineSignalCount) : String(signals.length)}
          color={COLORS.accent}
        />
        <StatBox
          label="Detection"
          value={activeView ? `${activeView.detectionConfidencePercent}%` : '—'}
          color={COLORS.accent}
        />
        <StatBox
          label="Severity"
          value={activeView ? `${activeView.severityScore}/100` : pipelineSeverity ? `${pipelineSeverity.score}/100` : '—'}
          color={SEVERITY_COLORS[activeView?.severityLevel ?? pipelineSeverity?.level ?? 'medium'].primary}
        />
        <StatBox
          label="Dispatches"
          value={pipelineDone ? String(teamsDispatched) : '—'}
          color={COLORS.success}
        />
      </View>
      {simulatedSMSCount > 0 && (
        <Text style={styles.smsHint}>
          {simulatedSMSCount.toLocaleString()} simulated SMS alerts sent (session total)
        </Text>
      )}

      {/* ── 6. Baseline Comparison Teaser ─────────────── */}
      {comparison && (
        <>
          <Text style={styles.sectionTitle}>Agentic vs Heuristic</Text>
          <BaselineTeaser
            comparison={comparison}
            detectionPercent={activeView?.detectionConfidencePercent}
            severityScore={activeView?.severityScore}
          />
        </>
      )}

      {/* Clear button */}
      <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
        <Text style={styles.clearBtnText}>🗑 Clear All Data</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function CrisisCard({
  event,
  display,
}: {
  event: CrisisEvent;
  display?: {
    typeLabel: string;
    detectionConfidencePercent: number;
    severityScore: number;
    severityLevel: Severity;
  };
}) {
  const ago = Math.round((Date.now() - new Date(event.createdAt).getTime()) / 60_000);
  const emoji = CRISIS_EMOJI[event.detectedType] ?? '❓';
  const severity = display?.severityLevel ?? event.severity;
  const sevColor = SEVERITY_BG[severity];
  const detectionPct = display?.detectionConfidencePercent ?? Math.round(event.confidence * 100);
  const severityScore = display?.severityScore;
  const typeTitle = display?.typeLabel ?? event.detectedType.replace(/_/g, ' ').toUpperCase();

  return (
    <View style={[styles.crisisCard, { borderLeftColor: sevColor }]}>
      <View style={styles.crisisCardHeader}>
        <Text style={styles.crisisEmoji}>{emoji}</Text>
        <View style={[styles.sevBadge, { backgroundColor: sevColor }]}>
          <Text style={styles.sevBadgeText}>{severity.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.crisisType} numberOfLines={2}>{typeTitle}</Text>
      <Text style={styles.crisisLocation} numberOfLines={1}>
        {event.location.label ?? event.location.district ?? event.location.city ?? 'Unknown'}
      </Text>
      <View style={styles.crisisFooter}>
        <Text style={styles.crisisConf}>
          {severityScore != null
            ? `Det ${detectionPct}% · Sev ${severityScore}/100`
            : `${detectionPct}% detection`}
        </Text>
        <Text style={styles.crisisAgo}>{ago < 1 ? 'Just now' : `${ago}m ago`}</Text>
      </View>
      <Text style={styles.crisisSignals}>{event.signals.length} confirming signal(s)</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function BaselineTeaser({
  comparison,
  detectionPercent,
  severityScore,
}: {
  comparison: { simple: string; agentic: string };
  detectionPercent?: number;
  severityScore?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.baselineCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.baselineHeader}>
        <Text style={styles.baselineTitle}>🤖 Agentic System vs 📝 Simple Heuristic</Text>
        <Text style={styles.baselineExpand}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {!expanded ? (
        <Text style={styles.baselineTeaser}>
          {detectionPercent != null && severityScore != null
            ? `Detection ${detectionPercent}% · Severity ${severityScore}/100 — tap to compare naive keyword rules vs 5-agent pipeline`
            : 'Tap to see how 5 AI agents outperform a keyword matcher →'}
        </Text>
      ) : (
        <View>
          <Text style={styles.baselineLabel}>SIMPLE SYSTEM:</Text>
          <Text style={styles.baselineText}>{comparison.simple}</Text>
          <View style={styles.baselineDivider} />
          <Text style={[styles.baselineLabel, { color: COLORS.accent }]}>AGENTIC SYSTEM:</Text>
          <Text style={styles.baselineText}>{comparison.agentic}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 56 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl },
  headerLeft: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '900', color: COLORS.accent },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: SPACING.sm },
  timeText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 4 },
  statusBadge: {
    borderWidth: 1.5, borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 4, marginTop: 4,
  },
  statusBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '800', letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADII.lg,
    padding: SPACING.xl, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardLabel: {
    fontSize: FONT_SIZES.xs, color: COLORS.textMuted,
    fontWeight: '700', letterSpacing: 1, marginBottom: SPACING.md,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  modeChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADII.full,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  modeChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  modeChipText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  modeChipTextActive: { color: '#000' },
  presetGrid: { gap: SPACING.sm, marginBottom: SPACING.md },
  presetBtn: {
    backgroundColor: COLORS.card, borderRadius: RADII.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  presetBtnText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  feedToggle: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADII.sm,
    backgroundColor: COLORS.card, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  feedToggleOn: { borderColor: COLORS.success, backgroundColor: 'rgba(0,230,118,0.08)' },
  feedToggleText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  geminiBadge: { color: COLORS.accent, fontSize: FONT_SIZES.xs, fontWeight: '700', marginBottom: SPACING.sm },
  demoBtn: {
    backgroundColor: COLORS.accentAlt, borderRadius: RADII.md, paddingVertical: SPACING.md,
    alignItems: 'center', marginTop: SPACING.sm,
  },
  demoBtnText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: '800' },
  demoStatus: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm, textAlign: 'center' },

  // Text input
  textInput: {
    backgroundColor: COLORS.card, borderRadius: RADII.md,
    padding: SPACING.lg, color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md, minHeight: 80,
    textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border,
  },

  // Quick buttons
  quickRow: { flexDirection: 'row', marginTop: SPACING.md, marginBottom: SPACING.md },
  challengeLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  challengeBtn: { borderColor: COLORS.accent, borderWidth: 1 },
  quickBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.card, borderRadius: RADII.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  quickEmoji: { fontSize: 20, marginBottom: 2 },
  quickLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  mockBtn: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: RADII.md,
    paddingVertical: SPACING.md, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  mockBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  submitBtn: {
    flex: 1, backgroundColor: COLORS.accent, borderRadius: RADII.md,
    paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { color: '#000', fontSize: FONT_SIZES.md, fontWeight: '800' },
  btnDisabled: { backgroundColor: COLORS.textMuted },
  typingRow: { flexDirection: 'row', alignItems: 'center' },

  // Section title
  sectionTitle: {
    fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 0.5, marginBottom: SPACING.md, textTransform: 'uppercase',
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },

  // Crisis list
  crisisList: { paddingBottom: SPACING.sm, marginBottom: SPACING.xl },
  crisisCard: {
    width: CRISIS_CARD_W, backgroundColor: COLORS.surface,
    borderRadius: RADII.lg, padding: SPACING.lg, marginRight: SPACING.md,
    borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  crisisCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  crisisEmoji: { fontSize: 28 },
  sevBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADII.sm },
  sevBadgeText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: '800' },
  crisisType: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700', marginBottom: 2 },
  crisisLocation: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginBottom: SPACING.sm },
  crisisFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  crisisConf: { color: COLORS.accent, fontSize: FONT_SIZES.xs, fontWeight: '600' },
  crisisAgo: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  crisisSignals: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 4 },

  // Agent pipeline
  agentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  agentEmoji: { fontSize: 20, marginRight: SPACING.md, width: 28 },
  agentInfo: { flex: 1 },
  agentName: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  agentSummary: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: 2 },
  agentSummaryDone: { color: COLORS.success },
  agentSummaryFailed: { color: SEVERITY_COLORS.critical.primary },
  agentSummarySkipped: { color: COLORS.textMuted, fontStyle: 'italic' },
  mapsStatus: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginBottom: SPACING.md, paddingHorizontal: 4 },
  agentStatus: { width: 28, alignItems: 'center' },
  agentDot: { width: 10, height: 10, borderRadius: 5 },
  pipelineTiming: { marginTop: SPACING.md, alignItems: 'center' },
  timingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  // Stats — 2-column wrap so narrow phones are not crushed (was 5× flex:1 in one row)
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    columnGap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: '100%',
  },
  smsHint: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm, marginBottom: SPACING.md },

  // Baseline
  baselineCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.lg,
    padding: SPACING.xl, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.accentAlt, borderStyle: 'dashed',
  },
  baselineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  baselineTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '700', flex: 1 },
  baselineExpand: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  baselineTeaser: { color: COLORS.accentAlt, fontSize: FONT_SIZES.sm, fontStyle: 'italic' },
  baselineLabel: { color: SEVERITY_COLORS.high.primary, fontSize: FONT_SIZES.xs, fontWeight: '800', marginBottom: 4, marginTop: SPACING.sm },
  baselineText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, lineHeight: 18 },
  baselineDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  // Clear
  clearBtn: {
    alignSelf: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderRadius: RADII.full, borderWidth: 1, borderColor: COLORS.border,
  },
  clearBtnText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
});
