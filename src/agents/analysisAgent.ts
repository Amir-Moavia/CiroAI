// ─────────────────────────────────────────────────────────────
// AnalysisAgent — Agent 3: Deep Situational Analysis
// ─────────────────────────────────────────────────────────────
// Takes confirmed crisis events from DetectionAgent. Performs
// weighted severity scoring, cascading-effect inference, impact
// estimation, contradiction handling, and generates human-
// readable explanations with full reasoning traces.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisSignal,
  CrisisEvent,
  CrisisType,
  Severity,
  AgentAction,
  SeverityAnalysis,
  ImpactAnalysis,
  CascadeEffect,
  BaselineComparison,
} from '../types';
import { naiveHeuristicFromSignals } from '../utils/naiveHeuristic';

// ── Weights & Config ────────────────────────────────────────

const WEIGHTS = {
  signalStrength: 0.25,
  typeCriticality: 0.30,
  populationDensity: 0.20,
  timeOfDay: 0.15,
  infrastructure: 0.10,
} as const;

/** Crisis-type base criticality (0–100 scale) */
const TYPE_CRITICALITY: Record<CrisisType, number> = {
  earthquake: 100, flood: 95, fire: 90, terrorist_attack: 100,
  multi_crisis: 95, heatwave: 75, power_outage: 65,
  road_damage: 60, water_crisis: 55, infrastructure_failure: 50,
  disease_outbreak: 80, protest: 35, unknown: 20,
};

/** Population density tiers for Pakistan areas */
const POPULATION_TIERS: Record<string, { density: number; population: number; tier: string }> = {
  'f-6':          { density: 85, population: 55_000,  tier: 'HIGH' },
  'f-7':          { density: 90, population: 60_000,  tier: 'HIGH' },
  'f-8':          { density: 80, population: 50_000,  tier: 'HIGH' },
  'g-9':          { density: 88, population: 65_000,  tier: 'HIGH' },
  'g-10':         { density: 82, population: 58_000,  tier: 'HIGH' },
  'g-11':         { density: 78, population: 52_000,  tier: 'HIGH' },
  'i-8':          { density: 75, population: 48_000,  tier: 'MEDIUM' },
  'i-9':          { density: 60, population: 35_000,  tier: 'MEDIUM' },
  'i-10':         { density: 55, population: 30_000,  tier: 'MEDIUM' },
  'e-7':          { density: 70, population: 42_000,  tier: 'MEDIUM' },
  'blue area':    { density: 95, population: 80_000,  tier: 'VERY_HIGH' },
  'saddar':       { density: 92, population: 120_000, tier: 'VERY_HIGH' },
  'dha':          { density: 65, population: 45_000,  tier: 'MEDIUM' },
  'gt road':      { density: 85, population: 100_000, tier: 'HIGH' },
  'zero point':   { density: 70, population: 20_000,  tier: 'MEDIUM' },
  'faizabad':     { density: 80, population: 40_000,  tier: 'HIGH' },
  'murree road':  { density: 75, population: 70_000,  tier: 'HIGH' },
};
const DEFAULT_POP = { density: 50, population: 25_000, tier: 'LOW' };

/** Critical infrastructure near known areas */
const CRITICAL_INFRA: Record<string, string[]> = {
  'g-9':       ['Children\'s Hospital G-9', 'G-9 Markaz commercial zone'],
  'f-8':       ['PIMS Hospital', 'F-8 Markaz'],
  'f-6':       ['Polyclinic Hospital', 'Supreme Court'],
  'blue area': ['Stock Exchange', 'State Bank branch', 'Telecom HQ'],
  'saddar':    ['District HQ Hospital', 'Rawalpindi Railway Station', 'Commercial hub'],
  'faizabad':  ['Faizabad Interchange (arterial junction)', 'Emergency route hub'],
  'zero point':['Zero Point Interchange', 'Faisal Mosque access'],
  'gt road':   ['GT Road arterial highway', 'Multiple petrol stations'],
  'i-8':       ['NUST University', 'I-8 Markaz', 'Industrial area'],
  'g-11':      ['G-11 Markaz', 'Residential cluster'],
  'e-7':       ['E-7 Sector residential', 'CDA water pump station'],
};

/** Cascade rules: if X crisis → Y effect in Z minutes */
interface CascadeRule {
  trigger: CrisisType;
  effect: string;
  category: string;
  timeframeMinutes: number;
  riskLevel: Severity;
  condition?: (event: CrisisEvent) => boolean;
}

const CASCADE_RULES: CascadeRule[] = [
  { trigger: 'power_outage', effect: 'Water pumps fail → water shortage',       category: 'WATER_RISK',        timeframeMinutes: 120, riskLevel: 'high' },
  { trigger: 'power_outage', effect: 'Traffic signals offline → accident risk',  category: 'TRAFFIC_SAFETY',    timeframeMinutes: 5,   riskLevel: 'high' },
  { trigger: 'power_outage', effect: 'Hospital backup generators limited',       category: 'HEALTH_RISK',       timeframeMinutes: 30,  riskLevel: 'critical',
    condition: (e) => hasNearbyInfra(e, 'Hospital') },
  { trigger: 'power_outage', effect: 'Telecom towers lose backup in ~4h',        category: 'COMM_RISK',         timeframeMinutes: 240, riskLevel: 'medium' },
  { trigger: 'heatwave',       effect: 'Heat exhaustion and stroke risk in outdoor workers', category: 'HEALTH_RISK', timeframeMinutes: 30, riskLevel: 'high' },
  { trigger: 'heatwave',       effect: 'Power grid overload from AC demand → load shedding', category: 'POWER_RISK', timeframeMinutes: 60, riskLevel: 'medium' },
  { trigger: 'flood',        effect: 'Electrocution risk from submerged wires',  category: 'ELECTROCUTION_RISK', timeframeMinutes: 0,  riskLevel: 'critical',
    condition: (e) => e.signals.some((s) => s.type === 'power_outage' || /power|bijli|transformer/i.test(s.text)) },
  { trigger: 'flood',        effect: 'Sewage contamination of drinking water',   category: 'HEALTH_RISK',       timeframeMinutes: 60,  riskLevel: 'high' },
  { trigger: 'flood',        effect: 'Emergency vehicle access blocked',         category: 'RESPONSE_DELAY',    timeframeMinutes: 10,  riskLevel: 'high' },
  { trigger: 'road_damage',  effect: 'Emergency vehicles must reroute (+15 min)', category: 'RESPONSE_DELAY',   timeframeMinutes: 0,   riskLevel: 'high' },
  { trigger: 'road_damage',  effect: 'Supply chain disruption to nearby areas',  category: 'ECONOMIC',          timeframeMinutes: 360, riskLevel: 'medium' },
  { trigger: 'water_crisis', effect: 'Sanitation risk → disease within 48h',     category: 'HEALTH_RISK',       timeframeMinutes: 2880, riskLevel: 'high' },
  { trigger: 'water_crisis', effect: 'Tanker mafia price exploitation',          category: 'ECONOMIC',          timeframeMinutes: 60,  riskLevel: 'medium' },
  { trigger: 'fire',         effect: 'Smoke inhalation risk in surrounding blocks', category: 'HEALTH_RISK',    timeframeMinutes: 5,   riskLevel: 'high' },
  { trigger: 'fire',         effect: 'Gas pipeline exposure risk',               category: 'EXPLOSION_RISK',    timeframeMinutes: 15,  riskLevel: 'critical' },
  { trigger: 'multi_crisis', effect: 'Rescue resources spread thin → delayed response', category: 'RESPONSE_DELAY', timeframeMinutes: 0, riskLevel: 'critical' },
];

function hasNearbyInfra(event: CrisisEvent, keyword: string): boolean {
  const area = (event.location.district ?? event.location.city ?? '').toLowerCase();
  const infra = CRITICAL_INFRA[area] ?? [];
  return infra.some((i) => i.toLowerCase().includes(keyword.toLowerCase()));
}

function areaKeyFromEvent(event: CrisisEvent): string {
  return (event.location.district ?? event.location.city ?? 'unknown').toLowerCase();
}

function now(): string { return new Date().toISOString(); }

const SEV_ORDER: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function scoreToLevel(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'low';
  return 'info';
}

// ═══════════════════════════════════════════════════════════════
// AnalysisAgent Class
// ═══════════════════════════════════════════════════════════════

export class AnalysisAgent {
  readonly name = 'AnalysisAgent';
  private traceLog: AgentAction[] = [];

  // ── 1. analyzeSeverity() ────────────────────────────────

  analyzeSeverity(event: CrisisEvent): SeverityAnalysis {
    const startMs = Date.now();
    const reasons: string[] = [];
    const area = areaKeyFromEvent(event);

    // Factor 1 — Signal strength (0–25)
    const sigCount = event.signals.length;
    const signalStrength = Math.min(25, Math.round((sigCount / 10) * 25));
    reasons.push(`Signal strength: ${sigCount} signals → ${signalStrength}/25`);

    // Factor 2 — Type criticality (0–30)
    let detectedType = event.detectedType;
    if (!detectedType || detectedType === 'unknown' || (detectedType as string) === 'undefined') {
      const text = event.signals.map((s) => s.text.toLowerCase()).join(' ');
      if (/\b(power|electricity|outage|bijli|transformer|light)\b/i.test(text)) detectedType = 'power_outage';
      else if (/\b(flood|water|rain|drainage|selab)\b/i.test(text)) detectedType = 'flood';
      else if (/\b(accident|blocked|traffic|road|jam)\b/i.test(text)) detectedType = 'road_damage';
      else if (/\b(fire|dhuan|aag)\b/i.test(text)) detectedType = 'fire';
      reasons.push(`Fallback classification used: ${detectedType} based on keywords.`);
    }

    const baseCrit = TYPE_CRITICALITY[detectedType] ?? 20;
    const typeCriticality = Math.round((baseCrit / 100) * 30);
    reasons.push(`Type criticality: ${detectedType} (base ${baseCrit}) → ${typeCriticality}/30`);

    // Factor 3 — Population density (0–20)
    const pop = POPULATION_TIERS[area] ?? DEFAULT_POP;
    const populationDensity = Math.round((pop.density / 100) * 20);
    reasons.push(`Population density: ${area} tier=${pop.tier}, pop≈${pop.population.toLocaleString()} → ${populationDensity}/20`);

    // Factor 4 — Time of day (0–15)
    const hour = new Date(event.createdAt || now()).getHours();
    const isNight = hour >= 22 || hour < 6;
    const isRush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    let timeOfDay = 5;
    if (isNight) { timeOfDay = 15; reasons.push(`Time of day: night (${hour}:00) → ${timeOfDay}/15 (max — reduced visibility, delayed response)`); }
    else if (isRush) { timeOfDay = 12; reasons.push(`Time of day: rush hour (${hour}:00) → ${timeOfDay}/15 (high exposure)`); }
    else { reasons.push(`Time of day: daytime (${hour}:00) → ${timeOfDay}/15`); }

    // Factor 5 — Infrastructure overlap (0–10)
    const infra = CRITICAL_INFRA[area] ?? [];
    let infrastructure = 0;
    if (infra.length > 0) {
      infrastructure = Math.min(10, infra.length * 4);
      reasons.push(`Critical infrastructure: ${infra.join(', ')} → ${infrastructure}/10`);
    } else {
      reasons.push(`Critical infrastructure: none identified nearby → ${infrastructure}/10`);
    }

    const rawScore = signalStrength + typeCriticality + populationDensity + timeOfDay + infrastructure;
    const score = Math.min(100, Math.max(50, rawScore));
    const level = scoreToLevel(score);

    reasons.push(`Base score: ${rawScore}. Final: ${score} → ${level.toUpperCase()}`);

    const analysis: SeverityAnalysis = {
      score,
      level,
      breakdown: { signalStrength, typeCriticality, populationDensity, timeOfDay, infrastructure },
      explanation: reasons.join('. '),
    };

    console.log(`[AnalysisAgent] Severity: ${score}/100 → ${level.toUpperCase()} | Area: ${area} | Signals: ${sigCount}`);
    this.logTrace('analyzeSeverity', { eventId: event.id }, analysis as unknown as Record<string, unknown>, reasons.join('\n'), startMs);

    return analysis;
  }

  // ── 2. estimateImpact() ─────────────────────────────────

  estimateImpact(event: CrisisEvent): ImpactAnalysis {
    const startMs = Date.now();
    const reasons: string[] = [];
    const area = areaKeyFromEvent(event);
    const pop = POPULATION_TIERS[area] ?? DEFAULT_POP;

    reasons.push(`Estimating impact for ${event.detectedType} in ${area}...`);

    // ── Direct effects ──

    // Traffic
    const isRoadCrisis = event.detectedType === 'road_damage' || event.detectedType === 'flood';
    const percentBlocked = isRoadCrisis ? Math.min(80, 20 + event.signals.length * 8) : (event.detectedType === 'power_outage' ? 15 : 5);
    const alternateRoutes = isRoadCrisis ? Math.max(1, 3 - Math.floor(event.signals.length / 3)) : 3;
    reasons.push(`Traffic: ${percentBlocked}% roads blocked, ${alternateRoutes} alternate route(s)`);

    // Economic
    const businessMult = pop.tier === 'VERY_HIGH' ? 3 : pop.tier === 'HIGH' ? 2 : 1;
    const businessesAffected = Math.round((pop.population * 0.05) * businessMult);
    reasons.push(`Economic: ~${businessesAffected.toLocaleString()} businesses/shops affected`);

    // Safety
    const infra = CRITICAL_INFRA[area] ?? [];
    const vulnerablePopulations: string[] = [];
    if (infra.some((i) => /hospital/i.test(i))) vulnerablePopulations.push('Hospital patients');
    if (infra.some((i) => /school|university|nust/i.test(i))) vulnerablePopulations.push('Students');
    if (pop.tier === 'VERY_HIGH' || pop.tier === 'HIGH') vulnerablePopulations.push('Dense residential population');
    if (event.detectedType === 'flood') vulnerablePopulations.push('Low-lying area residents');
    const safetyLevel: Severity = vulnerablePopulations.length >= 2 ? 'critical' : vulnerablePopulations.length === 1 ? 'high' : 'medium';
    reasons.push(`Safety: ${vulnerablePopulations.length} vulnerable group(s) → ${safetyLevel}`);

    // Communication
    const commAffected = event.detectedType === 'infrastructure_failure' || (event.detectedType === 'power_outage' && event.signals.length >= 5);
    reasons.push(`Communication: ${commAffected ? 'AFFECTED — telecom/internet disruption likely' : 'nominal'}`);

    // ── Cascading effects ──

    const cascades: CascadeEffect[] = [];
    for (const rule of CASCADE_RULES) {
      const typeMatch = event.detectedType === rule.trigger || event.signals.some((s) => s.type === rule.trigger);
      if (!typeMatch) continue;
      if (rule.condition && !rule.condition(event)) continue;

      cascades.push({
        trigger: `${rule.trigger} detected in ${area}`,
        effect: rule.effect,
        timeframeMinutes: rule.timeframeMinutes,
        riskLevel: rule.riskLevel,
        category: rule.category,
      });

      const timeLabel = rule.timeframeMinutes === 0 ? 'immediately' : `in ${rule.timeframeMinutes} min`;
      reasons.push(`[CASCADE] ${rule.trigger} → ${rule.effect} (${timeLabel}, risk: ${rule.riskLevel})`);
    }

    // Estimated population
    const estPop = pop.population;

    // Recovery estimate (hours)
    let recoveryHours = 4;
    if (event.detectedType === 'flood') recoveryHours = 24;
    else if (event.detectedType === 'road_damage') recoveryHours = 12;
    else if (event.detectedType === 'multi_crisis') recoveryHours = 36;
    else if (event.detectedType === 'earthquake') recoveryHours = 72;
    reasons.push(`Estimated recovery: ${recoveryHours} hours`);

    const impact: ImpactAnalysis = {
      directEffects: {
        trafficDisruption: { percentBlocked, alternateRoutes, description: `${percentBlocked}% of area roads disrupted, ${alternateRoutes} alternate route(s) available` },
        economicDisruption: { businessesAffected, description: `Approx. ${businessesAffected.toLocaleString()} businesses affected in ${area}` },
        safetyRisk: { vulnerablePopulations, riskLevel: safetyLevel, description: vulnerablePopulations.length > 0 ? `At-risk groups: ${vulnerablePopulations.join(', ')}` : 'No specific vulnerable populations identified' },
        communicationImpact: { affected: commAffected, description: commAffected ? 'Telecom/internet services likely disrupted' : 'Communication infrastructure appears unaffected' },
      },
      cascadingEffects: cascades,
      estimatedAffectedPopulation: estPop,
      estimatedRecoveryHours: recoveryHours,
      reasoning: reasons.join('\n'),
    };

    console.log(`[AnalysisAgent] Impact: ${estPop.toLocaleString()} affected, ${cascades.length} cascade(s), recovery ~${recoveryHours}h`);
    this.logTrace('estimateImpact', { eventId: event.id }, impact as unknown as Record<string, unknown>, reasons.join('\n'), startMs);

    return impact;
  }

  // ── 3. generateExplanation() ────────────────────────────

  generateExplanation(event: CrisisEvent, severity: SeverityAnalysis, impact: ImpactAnalysis): string {
    const area = event.location.label ?? event.location.district ?? event.location.city ?? 'the affected area';
    const city = event.location.city ?? 'the city';
    const typeName = event.detectedType.replace(/_/g, ' ');
    const confPct = (event.confidence * 100).toFixed(0);
    const popStr = impact.estimatedAffectedPopulation.toLocaleString();

    const parts: string[] = [];

    // Opening
    parts.push(
      `A ${severity.level === 'critical' ? 'major' : severity.level} ${typeName} has been detected in ${area}, ${city} with ${confPct}% confidence.`
    );

    // Population
    parts.push(`This affects approximately ${popStr} residents.`);

    // Infrastructure
    const areaKey = areaKeyFromEvent(event);
    const infra = CRITICAL_INFRA[areaKey] ?? [];
    if (infra.length > 0) {
      parts.push(`The affected zone overlaps with critical infrastructure: ${infra.join(', ')}.`);
    }

    // Direct effects
    const traffic = impact.directEffects.trafficDisruption;
    if (traffic.percentBlocked > 10) {
      parts.push(`An estimated ${traffic.percentBlocked}% of local roads are disrupted with ${traffic.alternateRoutes} alternate route(s) available.`);
    }

    // Cascading effects
    if (impact.cascadingEffects.length > 0) {
      parts.push('Secondary effects include:');
      for (const c of impact.cascadingEffects.slice(0, 4)) {
        const time = c.timeframeMinutes === 0 ? 'immediately' : c.timeframeMinutes < 60 ? `within ${c.timeframeMinutes} minutes` : `within ${Math.round(c.timeframeMinutes / 60)} hours`;
        parts.push(`  • ${c.effect} (${time})`);
      }
    }

    // Recovery
    parts.push(`Estimated recovery time: ${impact.estimatedRecoveryHours} hours.`);

    const explanation = parts.join(' ');

    console.log(`[AnalysisAgent] Explanation generated (${explanation.length} chars)`);
    return explanation;
  }

  // ── 4. compareToBaseline() ──────────────────────────────

  compareToBaseline(event: CrisisEvent, severity: SeverityAnalysis, impact: ImpactAnalysis): BaselineComparison {
    const typeName = event.detectedType.replace(/_/g, ' ');
    const naive = naiveHeuristicFromSignals(event.signals);
    const detectionPct = Math.round(event.confidence * 100);

    const simpleSystem = [
      `Simple system: pattern "${naive.matchedRule}" (${naive.matchedIn} text) → category: ${naive.category}.`,
      `Severity: DEFAULT_MEDIUM. No cross-source check.`,
      `No location context, no population data, no cascading effects.`,
    ].join(' ');

    const agenticSystem = [
      `Agentic system: cross-correlated ${event.signals.length} signals from ${new Set(event.signals.map((s) => s.source)).size} sources.`,
      `Detection confidence: ${detectionPct}%.`,
      `Weighted severity: ${severity.score}/100 (${severity.level}).`,
      `Identified ${impact.cascadingEffects.length} cascading effects.`,
      `Population impact: ${impact.estimatedAffectedPopulation.toLocaleString()}.`,
      impact.directEffects.safetyRisk.vulnerablePopulations.length > 0
        ? `Flagged vulnerable groups: ${impact.directEffects.safetyRisk.vulnerablePopulations.join(', ')}.`
        : '',
    ].filter(Boolean).join(' ');

    const improvementFactors = [
      'Multi-source cross-correlation vs single-keyword match',
      'Weighted severity scoring with 5 contextual factors',
      `${impact.cascadingEffects.length} cascading effects identified vs 0`,
      'Population density and infrastructure overlap analysis',
      'Time-of-day risk adjustment',
      'Human-readable situational explanation',
    ];

    const comparison: BaselineComparison = { simpleSystem, agenticSystem, improvementFactors };

    console.log(`[AnalysisAgent] Baseline comparison: naive=${naive.matchedRule} vs agentic=${severity.score}/100 (${detectionPct}% detection)`);
    return comparison;
  }

  // ── 5. handleContradictions() ───────────────────────────

  handleContradictions(signals: CrisisSignal[]): {
    resolution: string;
    trustSource: string;
    staleFlags: string[];
    reasoning: string;
  } {
    const startMs = Date.now();
    const reasons: string[] = [];

    const citizenSources = ['citizen_report', 'twitter', 'citizen_cluster', 'news'];
    const apiSources = ['sensor', 'grid_sensor', 'weather_api', 'utility_api', 'traffic_api'];

    const citizenSignals = signals.filter((s) => citizenSources.includes(s.source));
    const apiSignals = signals.filter((s) => apiSources.includes(s.source));

    reasons.push(`Contradiction analysis: ${citizenSignals.length} citizen signal(s), ${apiSignals.length} API signal(s)`);

    const staleFlags: string[] = [];
    let resolution: string;
    let trustSource: string;

    if (citizenSignals.length >= 5 && apiSignals.length > 0) {
      // Crowd signal overrides API
      trustSource = 'CITIZEN_CROWD';
      resolution = 'CITIZEN_OVERRIDE';

      for (const api of apiSignals) {
        const status = api.rawPayload?.status ?? 'unknown';
        if (status === 'ONLINE' || status === 'NORMAL') {
          staleFlags.push(`${api.source}:${api.id} reports ${String(status)} but contradicted by ${citizenSignals.length} citizen reports`);
          reasons.push(`API ${api.source} (${api.id}) reports status=${String(status)}. ${citizenSignals.length} citizen signals override. Flagging API as STALE.`);
        }
      }

      reasons.push(`Resolution: Trust citizen crowd (${citizenSignals.length} reports). API data flagged as potentially stale. Proceeding with crisis classification.`);
    } else if (apiSignals.length > citizenSignals.length) {
      trustSource = 'API_SENSOR';
      resolution = 'API_TRUSTED';
      reasons.push('API/sensor data volume exceeds citizen reports. Trusting sensor data.');
    } else {
      trustSource = 'INCONCLUSIVE';
      resolution = 'NEEDS_MORE_DATA';
      reasons.push('Insufficient signal volume to resolve contradiction. Requesting more data.');
    }

    const result = { resolution, trustSource, staleFlags, reasoning: reasons.join('\n') };

    console.log(`[AnalysisAgent] Contradiction: ${resolution} | Trust: ${trustSource} | Stale flags: ${staleFlags.length}`);
    this.logTrace('handleContradictions', { signalCount: signals.length }, result as unknown as Record<string, unknown>, reasons.join('\n'), startMs);

    return result;
  }

  // ── Full Analysis Pipeline ──────────────────────────────

  fullAnalysis(event: CrisisEvent): {
    severity: SeverityAnalysis;
    impact: ImpactAnalysis;
    explanation: string;
    baseline: BaselineComparison;
    contradictions: ReturnType<AnalysisAgent['handleContradictions']> | null;
  } {
    const severity = this.analyzeSeverity(event);
    const impact = this.estimateImpact(event);
    const explanation = this.generateExplanation(event, severity, impact);
    const baseline = this.compareToBaseline(event, severity, impact);

    // Check for contradictions if mixed sources
    const sources = new Set(event.signals.map((s) => s.source));
    const hasMixed = [...sources].some((s) => ['citizen_report', 'twitter'].includes(s))
      && [...sources].some((s) => ['sensor', 'grid_sensor', 'utility_api'].includes(s));
    const contradictions = hasMixed ? this.handleContradictions(event.signals) : null;

    return { severity, impact, explanation, baseline, contradictions };
  }

  // ── Trace ───────────────────────────────────────────────

  getAnalysisTrace(): AgentAction[] {
    return [...this.traceLog];
  }

  clearTrace(): void {
    this.traceLog = [];
  }

  private logTrace(method: string, input: Record<string, unknown>, output: Record<string, unknown>, reasoning: string, startMs: number): void {
    this.traceLog.push({
      id: `TRACE-${this.name}-${method}-${Date.now()}`,
      agentName: this.name,
      input, reasoning, output,
      timestamp: now(),
      status: 'completed',
      durationMs: Date.now() - startMs,
    });
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const analysisAgent = new AnalysisAgent();
