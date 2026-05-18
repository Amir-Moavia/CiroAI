// ─────────────────────────────────────────────────────────────
// CrisisBriefScreen — Full situational report for judges
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SEVERITY_COLORS, FONT_SIZES, SPACING, RADII } from '../constants/colors';
import { useCrisisStore } from '../store/crisisStore';
import { useActiveCrisisView } from '../hooks/useActiveCrisisView';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function Check({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function CrisisBriefScreen() {
  const { currentPipeline, pipelineStatus, liveAgentSteps, activeCrises } = useCrisisStore();
  const activeView = useActiveCrisisView();
  const pipeline = currentPipeline;

  if (pipelineStatus === 'running') {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.emptyTitle}>Generating Brief…</Text>
        <Text style={styles.emptySub}>Agents are analysing the crisis</Text>
        {liveAgentSteps.map((step) => (
          <Text key={step.key} style={styles.liveStep}>
            {step.emoji} {step.name}: {step.message}
          </Text>
        ))}
      </View>
    );
  }

  if (!pipeline || pipelineStatus === 'idle') {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>No Crisis Brief Yet</Text>
        <Text style={styles.emptySub}>
          Submit a report on Home or run the full demo. The 5-agent pipeline will generate a brief here.
        </Text>
        {activeCrises.length > 0 && (
          <Text style={styles.emptySub}>
            {activeCrises.length} crisis event(s) logged — run pipeline again to refresh the brief.
          </Text>
        )}
      </View>
    );
  }

  const event = pipeline.crisisEvent;
  const impact = pipeline.impact;
  const plan = pipeline.plan;
  const sim = pipeline.simulation;
  const displayDetection = activeView?.detectionConfidencePercent ?? Math.round((event?.confidence ?? 0.35) * 100);
  const displaySeverity = activeView?.severityScore ?? pipeline.severity?.score ?? displayDetection;
  const displayTitle = activeView?.typeLabel ?? 'Crisis Event';
  const searchCtx = pipeline.searchContext;

  const locations = [
    ...new Set(
      pipeline.signals.map((s) => s.location.label ?? s.location.district ?? s.location.city).filter(Boolean),
    ),
  ] as string[];

  const directEffects: string[] = [];
  if (impact) {
    directEffects.push(impact.directEffects.trafficDisruption.description);
    directEffects.push(impact.directEffects.communicationImpact.description);
    directEffects.push(impact.directEffects.safetyRisk.description);
    directEffects.push(impact.directEffects.economicDisruption.description);
  }
  impact?.cascadingEffects.slice(0, 4).forEach((c) => directEffects.push(c.effect));

  const authorityActions = plan?.authorityActions.map((a) => a.action) ?? event?.actions.filter((a) => a.startsWith('[Authority]')).map((a) => a.replace('[Authority] ', '')) ?? [];
  const citizenActions = plan?.citizenActions.map((a) => a.action) ?? event?.actions.filter((a) => a.startsWith('[Citizen]')).map((a) => a.replace('[Citizen] ', '')) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>⚠ DEMO — SYNTHETIC & SIMULATED DATA</Text>
      </View>

      <Text style={styles.detectedLabel}>DETECTED SITUATION</Text>
      <Text style={styles.detectedTitle}>{displayTitle}</Text>
      <Text style={styles.detectedSub}>
        {activeView?.typeLabelShort ?? ''} · {activeView?.locationLabel ?? ''}
      </Text>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{displayDetection}%</Text>
          <Text style={styles.scoreLabel}>DETECTION</Text>
        </View>
        <View style={[styles.scoreBadge, styles.severityBadge]}>
          <Text style={[styles.scoreValue, styles.severityValue]}>{displaySeverity}</Text>
          <Text style={styles.scoreLabel}>SEVERITY /100</Text>
        </View>
      </View>

      {searchCtx?.summary ? (
        <Section title="Google Search Context">
          <Text style={styles.muted}>{searchCtx.summary}</Text>
          {searchCtx.sources.length > 0 && (
            <Text style={styles.searchMeta}>{searchCtx.sources.length} web source(s) grounded</Text>
          )}
        </Section>
      ) : null}

      <Section title="Locations">
        <View style={styles.chipRow}>
          {locations.length > 0 ? locations.map((loc) => (
            <View key={loc} style={styles.chip}><Text style={styles.chipText}>{loc}</Text></View>
          )) : (
            <Text style={styles.muted}>Islamabad metropolitan area</Text>
          )}
        </View>
      </Section>

      <Section title="Impact — Direct Effects">
        {directEffects.slice(0, 6).map((e, i) => <Bullet key={i} text={e} />)}
      </Section>

      {impact && impact.cascadingEffects.length > 0 && (
        <Section title="Impact — Secondary Effects">
          {impact.cascadingEffects.map((c, i) => (
            <Bullet key={i} text={`${c.effect} (~${c.timeframeMinutes} min)`} />
          ))}
        </Section>
      )}

      <Section title="Recommended Actions — Authorities">
        {authorityActions.slice(0, 6).map((a, i) => <Bullet key={i} text={a} />)}
      </Section>

      <Section title="Recommended Actions — Citizens">
        {citizenActions.slice(0, 5).map((a, i) => <Bullet key={i} text={a} />)}
      </Section>

      {sim && (
        <>
          <Section title="Simulated Execution">
            {sim.reroutes.map((r, i) => (
              <Check key={`r${i}`} text={`Alternate route: congestion ${r.beforeCongestion}% → ${r.afterCongestion}%`} />
            ))}
            {sim.tickets.map((t) => (
              <Check key={t.ticketId} text={`Ticket ${t.ticketId}: ${t.team} dispatched (ETA ${t.eta} min)`} />
            ))}
            {sim.alerts.map((a, i) => (
              <Check key={`a${i}`} text={`${a.channel}: ${a.sent.toLocaleString()} alerts sent`} />
            ))}
            <Check text="System Status: CRITICAL RESPONSE ACTIVE" />
          </Section>

          <Section title="Outcome">
            {sim.outcome.metrics.map((m, i) => (
              <Check key={i} text={`${m.metric}: ${m.before} → ${m.after}`} />
            ))}
            <Text style={styles.outcomeSummary}>{sim.outcome.summary}</Text>
          </Section>
        </>
      )}

      {pipeline.explanation && (
        <Section title="AI Explanation">
          <Text style={styles.explanation}>{pipeline.explanation}</Text>
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 40 },
  empty: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZES.md, textAlign: 'center', marginTop: SPACING.sm },
  liveStep: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 6, textAlign: 'center' },
  banner: { backgroundColor: 'rgba(255,214,0,0.2)', padding: SPACING.sm, borderRadius: RADII.sm, marginBottom: SPACING.lg },
  bannerText: { color: COLORS.accent, fontSize: FONT_SIZES.xs, fontWeight: '700', textAlign: 'center' },
  detectedLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, fontWeight: '700', letterSpacing: 1 },
  detectedTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xxl, fontWeight: '800', marginTop: 4 },
  detectedSub: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, marginBottom: SPACING.md },
  scoreRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  scoreBadge: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  severityBadge: { borderColor: SEVERITY_COLORS.critical.primary },
  scoreValue: { color: COLORS.accent, fontSize: 28, fontWeight: '900' },
  severityValue: { color: SEVERITY_COLORS.critical.primary },
  scoreLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, fontWeight: '700', marginTop: 2 },
  searchMeta: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.accent, fontSize: FONT_SIZES.md, fontWeight: '700', marginBottom: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.full, borderWidth: 1, borderColor: COLORS.border },
  chipText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bulletDot: { color: COLORS.accent, marginRight: 8, fontSize: 16 },
  check: { color: COLORS.success, marginRight: 8, fontSize: 16, fontWeight: '700' },
  bulletText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, flex: 1 },
  muted: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  outcomeSummary: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm, fontStyle: 'italic' },
  explanation: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, lineHeight: 22 },
});
