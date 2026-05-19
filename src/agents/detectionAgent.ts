// ─────────────────────────────────────────────────────────────
// DetectionAgent — Agent 2: Anomaly Detection & Correlation
// ─────────────────────────────────────────────────────────────
// Receives normalised signals from InputAgent. Detects clusters,
// threshold breaches, contradictions, cross-correlates multi-
// source signals, and produces classified crisis assessments.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisSignal,
  CrisisType,
  Severity,
  SignalSource,
  Location,
  AgentAction,
  AnomalyReport,
  AnomalyType,
  CorrelatedEvent,
  CrisisClassification,
  VerificationStatus,
} from '../types';
import { primaryCrisisTypeFromSignals } from '../utils/primaryCrisisType';

// ── Constants ───────────────────────────────────────────────

const CLUSTER_THRESHOLD = 3;        // minimum signals to form a cluster
const CLUSTER_WINDOW_MS = 10 * 60_000;  // 10 minutes
const DEFAULT_LOCATION: Location = {
  coordinate: { latitude: 33.6844, longitude: 73.0479 },
  city: 'Islamabad',
  province: 'Federal Capital',
  label: 'Islamabad (inferred)',
};

/** Source categories for cross-correlation */
const SOURCE_CATEGORIES: Record<string, string> = {
  twitter: 'SOCIAL', citizen_report: 'SOCIAL', news: 'SOCIAL',
  citizen_cluster: 'SOCIAL',
  sensor: 'SENSOR', grid_sensor: 'SENSOR',
  weather_api: 'API', traffic_api: 'API', utility_api: 'API',
  government: 'OFFICIAL', simulated: 'SIMULATED',
};

/** Sensor fields that indicate threshold breaches */
const SENSOR_THRESHOLDS: Record<string, { field: string; critical: number; direction: 'above' | 'below' }> = {
  stressLevel:    { field: 'stressLevel',    critical: 80,  direction: 'above' },
  dropPercent:    { field: 'dropPercent',     critical: 60,  direction: 'above' },
  currentLoadMW:  { field: 'currentLoadMW',  critical: 10,  direction: 'below' },
  value:          { field: 'value',           critical: -50, direction: 'below' },
};

// ── Helpers ─────────────────────────────────────────────────

let _anomalyCounter = 0;
let _eventCounter = 0;

function anomalyId(): string {
  return `ANOM-${Date.now()}-${String(++_anomalyCounter).padStart(3, '0')}`;
}
function eventId(): string {
  return `CORR-${Date.now()}-${String(++_eventCounter).padStart(3, '0')}`;
}
function now(): string {
  return new Date().toISOString();
}

function areaKey(sig: CrisisSignal): string {
  const district = sig.location.district ?? '';
  const city = sig.location.city ?? '';
  return `${district}|${city}`.toLowerCase();
}

function isDefaultLocation(loc: Location): boolean {
  return loc.label?.includes('(default)') === true || loc.label?.includes('(inferred)') === true;
}

function distanceKm(a: Location, b: Location): number {
  const R = 6371;
  const dLat = ((b.coordinate.latitude - a.coordinate.latitude) * Math.PI) / 180;
  const dLon = ((b.coordinate.longitude - a.coordinate.longitude) * Math.PI) / 180;
  const lat1 = (a.coordinate.latitude * Math.PI) / 180;
  const lat2 = (b.coordinate.latitude * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

// ═══════════════════════════════════════════════════════════════
// DetectionAgent Class
// ═══════════════════════════════════════════════════════════════

export class DetectionAgent {
  readonly name = 'DetectionAgent';
  private traceLog: AgentAction[] = [];

  // ── 1. detectAnomalies() ────────────────────────────────

  detectAnomalies(signals: CrisisSignal[]): AnomalyReport[] {
    const startMs = Date.now();
    const reasoning: string[] = [];
    const anomalies: AnomalyReport[] = [];

    reasoning.push(`Analysing ${signals.length} signals for anomalies...`);

    // 1a — Cluster detection
    const clusters = this.findClusters(signals);
    for (const cluster of clusters) {
      const conf = Math.min(100, 60 + cluster.signals.length * 8);
      const report: AnomalyReport = {
        id: anomalyId(),
        anomalyType: 'cluster',
        signals: cluster.signals,
        area: cluster.area,
        crisisType: cluster.type,
        confidence: conf,
        description: `Cluster of ${cluster.signals.length} ${cluster.type.toUpperCase()} signals in ${cluster.area} within ${Math.round(cluster.windowMs / 60_000)} minutes`,
        flags: [],
        detectedAt: now(),
      };
      anomalies.push(report);
      reasoning.push(`[CLUSTER] ${report.description}. Confidence: ${conf}%`);
    }

    // 1b — Threshold breaches
    const breaches = this.findThresholdBreaches(signals);
    for (const b of breaches) {
      anomalies.push(b);
      reasoning.push(`[THRESHOLD] ${b.description}. Confidence: ${b.confidence}%`);
    }

    // 1c — Contradiction detection
    const contradictions = this.findContradictions(signals);
    for (const c of contradictions) {
      anomalies.push(c);
      reasoning.push(`[CONTRADICTION] ${c.description}`);
    }

    // 1d — Location-unknown flags
    const unknowns = this.flagUnknownLocations(signals);
    for (const u of unknowns) {
      anomalies.push(u);
      reasoning.push(`[LOCATION_UNKNOWN] ${u.description}`);
    }

    // 1e — Citizen-override detection
    const overrides = this.findCitizenOverrides(signals);
    for (const o of overrides) {
      anomalies.push(o);
      reasoning.push(`[CITIZEN_OVERRIDE] ${o.description}`);
    }

    this.logTrace('detectAnomalies', { signalCount: signals.length }, { anomalyCount: anomalies.length, anomalies: anomalies.map((a) => a.id) }, reasoning.join('\n'), startMs);

    console.log(`[DetectionAgent] Found ${anomalies.length} anomalies across ${signals.length} signals`);
    return anomalies;
  }

  // ── 2. crossCorrelate() ─────────────────────────────────

  crossCorrelate(signals: CrisisSignal[]): CorrelatedEvent | null {
    const startMs = Date.now();
    const reasoning: string[] = [];

    if (signals.length === 0) {
      reasoning.push('No signals — cannot cross-correlate.');
      this.logTrace('crossCorrelate', { signalCount: signals.length }, { result: null }, reasoning.join('\n'), startMs);
      return null;
    }

    if (signals.length === 1) {
      reasoning.push('Single signal — creating basic correlation.');
      const sig = signals[0];
      const anomalies = this.detectAnomalies(signals);
      const event: CorrelatedEvent = {
        id: eventId(),
        anomalies,
        signals: signals,
        sourceTypes: [sig.source],
        crisisType: sig.type,
        correlationScore: 0.6,
        verification: 'UNCONFIRMED',
        location: sig.location,
        reasoning: 'Single signal fallback correlation.',
        timestamp: now(),
      };
      this.logTrace('crossCorrelate', { signalCount: signals.length }, { eventId: event.id, score: event.correlationScore }, reasoning.join('\n'), startMs);
      return event;
    }

    reasoning.push(`Cross-correlating ${signals.length} signals...`);

    // Group by area
    const areaGroups = this.groupByArea(signals);
    let bestEvent: CorrelatedEvent | null = null;
    let bestScore = 0;

    for (const [area, areaSignals] of Object.entries(areaGroups)) {
      if (areaSignals.length < 2) continue;

      // Get unique source categories
      const categories = new Set(areaSignals.map((s) => SOURCE_CATEGORIES[s.source] ?? 'OTHER'));
      const sourceTypes = [...new Set(areaSignals.map((s) => s.source))];
      const crisisTypes = [...new Set(areaSignals.map((s) => s.type))];

      // Correlation scoring
      let score = 0;
      const corReasons: string[] = [];

      // Multi-source bonus: SOCIAL + SENSOR + API = strong correlation
      if (categories.has('SOCIAL') && categories.has('SENSOR')) {
        score += 0.3;
        corReasons.push('SOCIAL report confirmed by SENSOR data');
      }
      if (categories.has('SOCIAL') && categories.has('API')) {
        score += 0.2;
        corReasons.push('SOCIAL report confirmed by API data');
      }
      if (categories.has('SENSOR') && categories.has('API')) {
        score += 0.2;
        corReasons.push('SENSOR data confirmed by API data');
      }
      if (categories.size >= 3) {
        score += 0.15;
        corReasons.push(`Triple-source confirmation (${[...categories].join(', ')})`);
      }

      // Signal volume bonus
      score += Math.min(0.15, areaSignals.length * 0.03);

      // Temporal proximity bonus
      const timestamps = areaSignals.map((s) => new Date(s.timestamp).getTime());
      const span = Math.max(...timestamps) - Math.min(...timestamps);
      if (span < 5 * 60_000) { score += 0.1; corReasons.push('All signals within 5-minute window'); }
      else if (span < 15 * 60_000) { score += 0.05; corReasons.push('Signals within 15-minute window'); }

      // Same crisis type bonus
      if (crisisTypes.length === 1) {
        score += 0.1;
        corReasons.push(`All signals agree on type: ${crisisTypes[0]}`);
      }

      score = Math.min(1, score);

      // Determine verification status
      let verification: VerificationStatus = 'UNCERTAIN';
      if (score >= 0.7 && categories.size >= 2) verification = 'CONFIRMED';
      else if (score >= 0.4) verification = 'UNCONFIRMED';

      // Determine dominant crisis type (citizen reports weigh more than mixed API feeds)
      const dominantType = primaryCrisisTypeFromSignals(areaSignals);

      // Pick best location (prefer non-default)
      const bestLoc = areaSignals.find((s) => !isDefaultLocation(s.location))?.location
        ?? areaSignals[0].location;

      if (score > bestScore) {
        bestScore = score;
        const anomalies = this.detectAnomalies(areaSignals);

        bestEvent = {
          id: eventId(),
          anomalies,
          signals: areaSignals,
          sourceTypes: sourceTypes as SignalSource[],
          crisisType: dominantType,
          correlationScore: Math.round(score * 100) / 100,
          verification,
          location: bestLoc,
          reasoning: corReasons.join('. ') + `. Cross-correlation score: ${score.toFixed(2)}. ${verification}.`,
          timestamp: now(),
        };
      }

      reasoning.push(`Area "${area}": ${areaSignals.length} signals, ${categories.size} source types, score=${score.toFixed(2)}, ${verification}`);
      for (const r of corReasons) reasoning.push(`  → ${r}`);
    }

    if (bestEvent) {
      reasoning.push(`Best correlated event: ${bestEvent.id} (${bestEvent.crisisType}, score=${bestEvent.correlationScore})`);
      console.log(`[DetectionAgent] Cross-correlation: ${bestEvent.verification} ${bestEvent.crisisType.toUpperCase()} at ${bestEvent.location.label ?? bestEvent.location.city}. Score: ${bestEvent.correlationScore}`);
    } else {
      reasoning.push('No area-based cross-correlation — will try metro fallback if applicable.');
    }

    this.logTrace('crossCorrelate', { signalCount: signals.length }, bestEvent ? { eventId: bestEvent.id, score: bestEvent.correlationScore } : { result: null }, reasoning.join('\n'), startMs);

    return bestEvent;
  }

  /** When signals span multiple areas but clearly describe a regional crisis (hackathon / citizen reports) */
  buildFallbackCorrelatedEvent(
    signals: CrisisSignal[],
    anomalies: AnomalyReport[],
  ): CorrelatedEvent | null {
    if (signals.length === 0) return null;

    const pool = anomalies.length > 0
      ? [...new Set(anomalies.flatMap((a) => a.signals))]
      : signals;

    if (pool.length < 1) return null;

    const dominantType = primaryCrisisTypeFromSignals(pool);
    const sourceTypes = [...new Set(pool.map((s) => s.source))] as SignalSource[];
    const categories = new Set(pool.map((s) => SOURCE_CATEGORIES[s.source] ?? 'OTHER'));

    let score = 0.35 + Math.min(0.25, pool.length * 0.05);
    if (categories.size >= 2) score += 0.15;
    if (anomalies.length > 0) score += 0.1;
    score = Math.min(0.75, score);

    const bestLoc =
      pool.find((s) => !isDefaultLocation(s.location))?.location ?? pool[0].location;

    const areas = [...new Set(pool.map((s) => s.location.district ?? s.location.city ?? 'Unknown'))];

    return {
      id: eventId(),
      anomalies: anomalies.length > 0 ? anomalies : this.detectAnomalies(pool),
      signals: pool,
      sourceTypes,
      crisisType: dominantType === 'unknown' && pool.length >= 2 ? 'multi_crisis' : dominantType,
      correlationScore: Math.round(score * 100) / 100,
      verification: pool.length >= 3 && categories.size >= 2 ? 'UNCONFIRMED' : 'UNCERTAIN',
      location: bestLoc,
      reasoning:
        `Metro fallback: ${pool.length} signal(s) across ${areas.join(', ')} treated as coordinated ${dominantType} event (score ${score.toFixed(2)}).`,
      timestamp: now(),
    };
  }

  // ── 3. classifyCrisis() ─────────────────────────────────

  classifyCrisis(event: CorrelatedEvent): CrisisClassification {
    const startMs = Date.now();
    const reasoning: string[] = [];
    const flags: string[] = [];

    reasoning.push(`Classifying correlated event ${event.id} (${event.signals.length} signals)...`);

    // Type
    const type = event.crisisType;
    reasoning.push(`Crisis type: ${type}`);

    // Confidence from correlation score + signal count
    let confidence = event.correlationScore;
    if (event.signals.length === 1) {
      confidence = Math.max(0.6, confidence);
      flags.push('UNCONFIRMED — single signal only');
      reasoning.push('Single signal → setting confidence to 0.6 minimum, flagging UNCONFIRMED');
    }

    // Check for missing data
    const missingLocations = event.signals.filter((s) => isDefaultLocation(s.location));
    if (missingLocations.length > 0) {
      confidence *= 0.85;
      flags.push(`LOCATION_GAP — ${missingLocations.length} signal(s) have inferred locations`);
      reasoning.push(`${missingLocations.length} signals lack real location → confidence reduced by 15%`);
    }

    // Check for contradictions in anomalies
    const contradictions = event.anomalies.filter((a) => a.anomalyType === 'contradiction');
    if (contradictions.length > 0) {
      flags.push('CONFLICTED — contradictory signals detected');
      confidence *= 0.7;
      reasoning.push(`${contradictions.length} contradiction(s) found → confidence reduced by 30%, flagging CONFLICTED`);
    }

    // Determine verification
    let verification: VerificationStatus = event.verification;
    if (flags.some((f) => f.startsWith('CONFLICTED'))) verification = 'CONFLICTED';
    else if (flags.some((f) => f.startsWith('UNCONFIRMED'))) verification = 'UNCONFIRMED';
    else if (confidence < 0.4) verification = 'UNCERTAIN';

    // Severity — escalate from highest signal severity
    const maxSev = event.signals.reduce<Severity>((best, s) => {
      return SEVERITY_ORDER[s.severity] > SEVERITY_ORDER[best] ? s.severity : best;
    }, 'info');
    // Multi-crisis or high-confidence clusters escalate one level
    let severity = maxSev;
    if (type === 'multi_crisis' && SEVERITY_ORDER[severity] < 4) {
      const levels: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
      severity = levels[SEVERITY_ORDER[severity] + 1];
      reasoning.push(`Multi-crisis → severity escalated from ${maxSev} to ${severity}`);
    }

    // Affected area
    const area = event.location.label ?? event.location.district ?? event.location.city ?? 'Unknown';

    // Impact radius estimate
    let radiusKm = 1;
    if (event.signals.length >= 10) radiusKm = 5;
    else if (event.signals.length >= 5) radiusKm = 3;
    else if (event.signals.length >= 3) radiusKm = 2;
    if (type === 'flood' || type === 'earthquake') radiusKm *= 2;
    reasoning.push(`Estimated impact radius: ${radiusKm} km (based on ${event.signals.length} signals, type=${type})`);

    // Multi-crisis check
    const uniqueTypes = new Set(event.signals.map((s) => s.type));
    if (uniqueTypes.size >= 2 && type !== 'multi_crisis') {
      flags.push(`MULTI_CRISIS_POSSIBLE — detected types: ${[...uniqueTypes].join(', ')}`);
      reasoning.push(`Multiple crisis types in same area: ${[...uniqueTypes].join(', ')}`);
    }

    confidence = Math.round(Math.min(1, Math.max(0.6, confidence)) * 100) / 100;

    const classification: CrisisClassification = {
      type,
      severity,
      confidence,
      affectedArea: area,
      estimatedImpactRadiusKm: radiusKm,
      verification,
      flags,
      reasoning: reasoning.join('. '),
    };

    console.log(`[DetectionAgent] Classification: ${type.toUpperCase()} | Severity: ${severity.toUpperCase()} | Confidence: ${(confidence * 100).toFixed(0)}% | Area: ${area} | ${verification}`);

    this.logTrace('classifyCrisis', { eventId: event.id }, classification as unknown as Record<string, unknown>, reasoning.join('\n'), startMs);

    return classification;
  }

  // ── 4. handleEdgeCases() (integrated into detection) ────

  /**
   * Processes a batch through the full detection pipeline with
   * edge-case handling: missing locations, multi-crisis, citizen
   * overrides, and contradictions.
   */
  fullDetection(signals: CrisisSignal[]): {
    anomalies: AnomalyReport[];
    correlatedEvent: CorrelatedEvent | null;
    classification: CrisisClassification | null;
  } {
    // Handle missing locations first
    const repaired = this.repairMissingLocations(signals);

    const anomalies = this.detectAnomalies(repaired);
    const correlatedEvent = this.crossCorrelate(repaired);
    const classification = correlatedEvent ? this.classifyCrisis(correlatedEvent) : null;

    return { anomalies, correlatedEvent, classification };
  }

  // ── 5. getDetectionTrace() ──────────────────────────────

  getDetectionTrace(): AgentAction[] {
    return [...this.traceLog];
  }

  clearTrace(): void {
    this.traceLog = [];
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Cluster Detection
  // ═══════════════════════════════════════════════════════════

  private findClusters(signals: CrisisSignal[]): Array<{
    area: string; type: CrisisType; signals: CrisisSignal[]; windowMs: number;
  }> {
    const groups: Record<string, CrisisSignal[]> = {};
    for (const sig of signals) {
      const key = `${areaKey(sig)}::${sig.type}`;
      (groups[key] ??= []).push(sig);
    }

    const clusters: Array<{ area: string; type: CrisisType; signals: CrisisSignal[]; windowMs: number }> = [];

    for (const [, group] of Object.entries(groups)) {
      if (group.length < CLUSTER_THRESHOLD) continue;

      const sorted = group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const span = new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime();

      if (span <= CLUSTER_WINDOW_MS) {
        clusters.push({
          area: group[0].location.district ?? group[0].location.city ?? 'Unknown',
          type: group[0].type,
          signals: group,
          windowMs: span,
        });
      }
    }

    return clusters;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Threshold Breach Detection
  // ═══════════════════════════════════════════════════════════

  private findThresholdBreaches(signals: CrisisSignal[]): AnomalyReport[] {
    const reports: AnomalyReport[] = [];

    for (const sig of signals) {
      if (!sig.rawPayload) continue;

      for (const [, threshold] of Object.entries(SENSOR_THRESHOLDS)) {
        const val = sig.rawPayload[threshold.field];
        if (typeof val !== 'number') continue;

        const breached = threshold.direction === 'above'
          ? val >= threshold.critical
          : val <= threshold.critical;

        if (breached) {
          reports.push({
            id: anomalyId(),
            anomalyType: 'threshold_breach',
            signals: [sig],
            area: sig.location.district ?? sig.location.city ?? 'Unknown',
            crisisType: sig.type,
            confidence: Math.min(100, 70 + Math.abs(val - threshold.critical)),
            description: `Sensor ${threshold.field}=${val} crossed critical threshold (${threshold.direction} ${threshold.critical}) at ${sig.location.label ?? sig.location.city}`,
            flags: ['HARDWARE_ALERT'],
            detectedAt: now(),
          });
        }
      }
    }

    return reports;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Contradiction Detection
  // ═══════════════════════════════════════════════════════════

  private findContradictions(signals: CrisisSignal[]): AnomalyReport[] {
    const reports: AnomalyReport[] = [];
    const areaGroups = this.groupByArea(signals);

    for (const [area, group] of Object.entries(areaGroups)) {
      // Look for power-on vs power-off contradictions
      const powerSignals = group.filter((s) => s.type === 'power_outage');
      const hasOutageReport = powerSignals.some((s) =>
        /\b(outage|failure|gone|band|nahi|off)\b/i.test(s.text)
      );
      const hasRestoreReport = powerSignals.some((s) =>
        /\b(restored|back|online|on|aa\s+gayi|wapas)\b/i.test(s.text)
      );

      if (hasOutageReport && hasRestoreReport) {
        reports.push({
          id: anomalyId(),
          anomalyType: 'contradiction',
          signals: powerSignals,
          area,
          crisisType: 'power_outage',
          confidence: 50,
          description: `Contradictory power signals in ${area}: some report outage, others report restoration`,
          flags: ['CONFLICTED', 'NEEDS_VERIFICATION'],
          detectedAt: now(),
        });
      }
    }

    return reports;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Citizen Override Detection
  // ═══════════════════════════════════════════════════════════

  private findCitizenOverrides(signals: CrisisSignal[]): AnomalyReport[] {
    const reports: AnomalyReport[] = [];
    const areaGroups = this.groupByArea(signals);

    for (const [area, group] of Object.entries(areaGroups)) {
      const citizenSources: SignalSource[] = ['citizen_report', 'twitter', 'citizen_cluster'];
      const sensorSources: SignalSource[] = ['sensor', 'grid_sensor', 'weather_api', 'utility_api'];

      const citizenReports = group.filter((s) => citizenSources.includes(s.source));
      const sensorReports = group.filter((s) => sensorSources.includes(s.source));

      // If 5+ citizen reports but sensor says OK
      if (citizenReports.length >= 5 && sensorReports.length > 0) {
        const sensorOk = sensorReports.some((s) => {
          const payload = s.rawPayload;
          if (!payload) return false;
          return payload.status === 'ONLINE' || payload.status === 'NORMAL';
        });

        if (sensorOk) {
          reports.push({
            id: anomalyId(),
            anomalyType: 'citizen_override',
            signals: [...citizenReports, ...sensorReports],
            area,
            crisisType: citizenReports[0].type,
            confidence: 75,
            description: `${citizenReports.length} citizen reports contradict sensor reading in ${area}. Trusting citizen volume — possible sensor malfunction.`,
            flags: ['SENSOR_DISCREPANCY', 'CITIZEN_VOLUME_OVERRIDE'],
            detectedAt: now(),
          });
        }
      }
    }

    return reports;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Unknown Location Handling
  // ═══════════════════════════════════════════════════════════

  private flagUnknownLocations(signals: CrisisSignal[]): AnomalyReport[] {
    const reports: AnomalyReport[] = [];

    for (const sig of signals) {
      if (isDefaultLocation(sig.location)) {
        reports.push({
          id: anomalyId(),
          anomalyType: 'location_unknown',
          signals: [sig],
          area: 'UNKNOWN',
          crisisType: sig.type,
          confidence: 30,
          description: `Signal ${sig.id} has no usable location. Tagged for inference from nearby signals.`,
          flags: ['LOCATION_UNKNOWN', 'NEEDS_INFERENCE'],
          detectedAt: now(),
        });
      }
    }

    return reports;
  }

  /**
   * Attempts to repair signals with missing/default locations
   * by inferring from nearby same-type signals.
   */
  private repairMissingLocations(signals: CrisisSignal[]): CrisisSignal[] {
    const knownSignals = signals.filter((s) => !isDefaultLocation(s.location));
    const unknownSignals = signals.filter((s) => isDefaultLocation(s.location));

    if (unknownSignals.length === 0) return signals;

    console.log(`[DetectionAgent] Repairing ${unknownSignals.length} signal(s) with missing locations...`);

    return signals.map((sig) => {
      if (!isDefaultLocation(sig.location)) return sig;

      // Find same-type signals with known locations
      const candidates = knownSignals.filter((k) => k.type === sig.type);
      if (candidates.length === 0) {
        console.log(`[DetectionAgent] ⚠ No candidates to infer location for ${sig.id}. Keeping default.`);
        return sig;
      }

      // Pick the closest in time
      const sigTime = new Date(sig.timestamp).getTime();
      candidates.sort((a, b) =>
        Math.abs(new Date(a.timestamp).getTime() - sigTime) -
        Math.abs(new Date(b.timestamp).getTime() - sigTime)
      );

      const inferred = candidates[0].location;
      console.log(`[DetectionAgent] ✓ Inferred location for ${sig.id}: ${inferred.label ?? inferred.city} (from ${candidates[0].id})`);

      return {
        ...sig,
        location: { ...inferred, label: `${inferred.label ?? inferred.city} (inferred from ${candidates[0].id})` },
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Utility
  // ═══════════════════════════════════════════════════════════

  private groupByArea(signals: CrisisSignal[]): Record<string, CrisisSignal[]> {
    const groups: Record<string, CrisisSignal[]> = {};
    for (const sig of signals) {
      const key = areaKey(sig);
      (groups[key] ??= []).push(sig);
    }
    return groups;
  }

  private dominantCrisisType(signals: CrisisSignal[]): CrisisType {
    const counts: Partial<Record<CrisisType, number>> = {};
    for (const s of signals) {
      counts[s.type] = (counts[s.type] ?? 0) + 1;
    }
    const uniqueTypes = Object.keys(counts) as CrisisType[];
    if (uniqueTypes.length >= 2) {
      // Check if any two types have significant counts
      const sorted = uniqueTypes.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
      if ((counts[sorted[1]] ?? 0) >= 2) return 'multi_crisis';
    }
    return uniqueTypes.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? 'unknown';
  }

  private logTrace(
    method: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    reasoning: string,
    startMs: number,
  ): void {
    this.traceLog.push({
      id: `TRACE-${this.name}-${method}-${Date.now()}`,
      agentName: this.name,
      input,
      reasoning,
      output,
      timestamp: now(),
      status: 'completed',
      durationMs: Date.now() - startMs,
    });
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const detectionAgent = new DetectionAgent();
