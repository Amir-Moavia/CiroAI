// ─────────────────────────────────────────────────────────────
// Single source of truth for "current active crisis" across tabs
// ─────────────────────────────────────────────────────────────

import type { CrisisEvent, CrisisType, PipelineResult, Severity } from '../types';

export const CRISIS_TYPE_LABELS: Record<CrisisType, string> = {
  infrastructure_failure: 'Infrastructure Failure',
  power_outage: 'Power Grid Failure',
  flood: 'Flood Emergency',
  road_damage: 'Road / Bridge Damage',
  water_crisis: 'Water System Failure',
  multi_crisis: 'Multi-Crisis Event',
  fire: 'Fire Emergency',
  heatwave: 'Heatwave Emergency',
  earthquake: 'Earthquake',
  terrorist_attack: 'Security Emergency',
  disease_outbreak: 'Disease Outbreak',
  protest: 'Public Disorder',
  unknown: 'Unclassified Event',
};

export interface ActiveCrisisView {
  event: CrisisEvent;
  crisisType: CrisisType;
  typeLabel: string;
  typeLabelShort: string;
  /** Detection agent correlation confidence (0–100) */
  detectionConfidencePercent: number;
  /** Analysis agent severity score (0–100) — separate from detection */
  severityScore: number;
  /** @deprecated use detectionConfidencePercent — kept for gradual migration */
  confidencePercent: number;
  severityLevel: Severity;
  locationLabel: string;
  signalCount: number;
  anomalyCount: number;
  actionCount: number;
  dispatchCount: number;
  routeCount: number;
  smsSent: number;
  pipelineStatus: string | null;
  hasPipeline: boolean;
  hasSearchContext: boolean;
}

export function formatCrisisTypeShort(type: CrisisType): string {
  return type.replace(/_/g, ' ').toUpperCase();
}

/** Sync severity level onto event; preserve detection confidence on event.confidence */
export function syncCrisisEventWithAnalysis(
  event: CrisisEvent,
  severityLevel: Severity,
): CrisisEvent {
  return {
    ...event,
    severity: severityLevel,
  };
}

export function buildActiveCrisisView(
  pipeline: PipelineResult | null,
  pipelineStatus: 'idle' | 'running' | 'complete' | 'error',
  activeCrises: CrisisEvent[],
): ActiveCrisisView | null {
  const event = pipeline?.crisisEvent ?? (activeCrises.length > 0 ? activeCrises[activeCrises.length - 1] : null);
  if (!event) return null;

  const severity = pipeline?.severity;
  const detectionConfidencePercent = Math.round(event.confidence * 100);
  const severityScore = severity?.score ?? Math.max(15, Math.min(95, detectionConfidencePercent + 10));
  const severityLevel = severity?.level ?? event.severity;

  const sim = pipeline?.simulation;

  return {
    event,
    crisisType: event.detectedType,
    typeLabel: CRISIS_TYPE_LABELS[event.detectedType] ?? 'Crisis Event',
    typeLabelShort: formatCrisisTypeShort(event.detectedType),
    detectionConfidencePercent,
    severityScore,
    confidencePercent: detectionConfidencePercent,
    severityLevel,
    locationLabel: event.location.label ?? event.location.district ?? event.location.city ?? 'Unknown',
    signalCount: pipeline?.signals.length ?? event.signals.length,
    anomalyCount: pipeline?.anomalies.length ?? 0,
    actionCount: pipeline?.plan?.actions.length ?? 0,
    dispatchCount: sim?.tickets.length ?? 0,
    routeCount: sim?.reroutes.length ?? 0,
    smsSent: sim?.alerts.reduce((s, a) => s + a.sent, 0) ?? 0,
    pipelineStatus: pipeline ? pipeline.status : null,
    hasPipeline: !!pipeline && pipelineStatus !== 'idle',
    hasSearchContext: !!pipeline?.searchContext?.summary,
  };
}
