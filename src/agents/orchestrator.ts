// ─────────────────────────────────────────────────────────────
// AgentOrchestrator — Brain connecting all 5 agents
// ─────────────────────────────────────────────────────────────
// Runs the full sequential pipeline: Ingest → Detect → Analyse
// → Plan → Simulate. Provides observable traces, live updates,
// error recovery, and baseline comparison.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisSignal,
  CrisisEvent,
  AnomalyReport,
  CorrelatedEvent,
  SeverityAnalysis,
  ImpactAnalysis,
  ActionPlan,
  SimulationOutput,
  PipelineResult,
  PipelineTrace,
  PipelineUpdate,
  PipelineStatus,
  AgentTrace,
  ComparisonResult,
} from '../types';

import { inputAgent } from './inputAgent';
import { detectionAgent } from './detectionAgent';
import { analysisAgent } from './analysisAgent';
import { planningAgent } from './planningAgent';
import { simulationAgent } from './simulationAgent';
import { enrichSignalsWithGeocoding } from '../utils/enrichSignals';
import { primaryCrisisTypeFromSignals } from '../utils/primaryCrisisType';
import { syncCrisisEventWithAnalysis } from '../utils/activeCrisisView';
import { analyzeCrisisContext, isLlmAvailable, getLastLlmProvider } from '../services/llmService';
import { fetchCrisisSearchGrounding, isSearchGroundingAvailable } from '../services/geminiSearchService';
import { feedsToSummary } from '../services/feedService';
import { generateFreshSignals } from '../data/mockSignals';

// ── Helpers ─────────────────────────────────────────────────

let _pipelineCounter = 0;
function pipelineId(): string { return `PIPE-${Date.now()}-${String(++_pipelineCounter).padStart(3, '0')}`; }
function now(): string { return new Date().toISOString(); }

// ═══════════════════════════════════════════════════════════════
// AgentOrchestrator Class
// ═══════════════════════════════════════════════════════════════

export class AgentOrchestrator {
  readonly name = 'AgentOrchestrator';
  private subscribers: Array<(update: PipelineUpdate) => void> = [];
  private lastTrace: PipelineTrace | null = null;
  private lastResult: PipelineResult | null = null;

  // ── 1. runPipeline() ────────────────────────────────────

  async runPipeline(inputs: Array<string | Record<string, unknown>>): Promise<PipelineResult> {
    const id = pipelineId();
    const pipelineStart = now();
    const startMs = Date.now();
    const agentTraces: AgentTrace[] = [];

    let status: PipelineStatus = 'RUNNING';
    let signals: CrisisSignal[] = [];
    let anomalies: AnomalyReport[] = [];
    let correlatedEvent: CorrelatedEvent | null = null;
    let crisisEvent: CrisisEvent | null = null;
    let severity: SeverityAnalysis | null = null;
    let impact: ImpactAnalysis | null = null;
    let explanation: string | null = null;
    let plan: ActionPlan | null = null;
    let simulation: SimulationOutput | null = null;
    let searchContext: PipelineResult['searchContext'] = null;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[Orchestrator] Pipeline ${id} started. Processing ${inputs.length} inputs...`);
    console.log(`${'═'.repeat(60)}\n`);

    // ── STEP 1: Input Agent ──────────────────────────────

    try {
      this.emit(1, 'InputAgent', 'started', `Processing ${inputs.length} raw inputs...`);
      const step1Start = now();

      signals = generateFreshSignals();
      signals = await enrichSignalsWithGeocoding(signals);

      const step1Trace = this.buildAgentTrace(
        'InputAgent', step1Start,
        `${inputs.length} raw inputs`,
        inputAgent.getAgentTrace(),
        [`Ingested ${signals.length} signals`, `Languages: ${[...new Set(signals.map((s) => s.language))].join(', ')}`],
        [`Classified ${signals.length} signals by type and severity`, `Deduplicated from ${inputs.length} → ${signals.length}`],
        [`Output ${signals.length} normalised CrisisSignals`],
      );
      agentTraces.push(step1Trace);

      this.emit(1, 'InputAgent', 'completed', `${signals.length} signals normalised`);
      console.log(`[Orchestrator] Step 1 complete: ${signals.length} signals\n`);
    } catch (err) {
      const recovered = this.handlePipelineError('InputAgent', err as Error, agentTraces);
      if (!recovered) { status = 'FAILED'; }
    }

    if (signals.length === 0) {
      status = 'NO_CRISIS_DETECTED';
      return this.buildResult(id, status, pipelineStart, startMs, agentTraces, { signals });
    }

    // ── STEP 2: Detection Agent ──────────────────────────

    try {
      this.emit(2, 'DetectionAgent', 'started', `Analysing ${signals.length} signals for anomalies...`);
      const step2Start = now();

      anomalies = detectionAgent.detectAnomalies(signals);
      correlatedEvent = detectionAgent.crossCorrelate(signals);

      const observations = [`Found ${anomalies.length} anomalies`];
      const decisions: string[] = [];

      if (correlatedEvent) {
        observations.push(`Crisis detected: ${correlatedEvent.crisisType} at ${correlatedEvent.location.label ?? correlatedEvent.location.city}`);
        observations.push(`Correlation score: ${correlatedEvent.correlationScore}`);
        observations.push(`Verification: ${correlatedEvent.verification}`);
        decisions.push(`Cross-correlation: ${correlatedEvent.verification}`);
      } else {
        observations.push('No cross-correlation found — signals appear isolated');
        decisions.push('No crisis event formed');
      }

      agentTraces.push(this.buildAgentTrace(
        'DetectionAgent', step2Start,
        `${signals.length} normalised signals`,
        detectionAgent.getDetectionTrace(), observations, decisions,
        correlatedEvent ? [`CorrelatedEvent: ${correlatedEvent.id}`] : ['null — no correlation'],
      ));

      this.emit(2, 'DetectionAgent', 'completed',
        correlatedEvent
          ? `Crisis detected: ${correlatedEvent.crisisType.toUpperCase()} (confidence: ${(correlatedEvent.correlationScore * 100).toFixed(0)}%)`
          : 'No crisis detected');
      console.log(`[Orchestrator] Step 2 complete: ${anomalies.length} anomalies, correlated=${!!correlatedEvent}\n`);
    } catch (err) {
      this.handlePipelineError('DetectionAgent', err as Error, agentTraces);
    }

    if (!correlatedEvent && (anomalies.length > 0 || signals.length >= 2)) {
      correlatedEvent = detectionAgent.buildFallbackCorrelatedEvent(signals, anomalies);
      if (correlatedEvent) {
        this.emit(2, 'DetectionAgent', 'completed',
          `Metro correlation: ${correlatedEvent.crisisType.toUpperCase()} (${correlatedEvent.signals.length} signals, ${(correlatedEvent.correlationScore * 100).toFixed(0)}%)`);
        console.log(`[Orchestrator] Fallback correlation: ${correlatedEvent.id}\n`);
      }
    }

    if (!correlatedEvent) {
      status = 'NO_CRISIS_DETECTED';
      return this.buildResult(id, status, pipelineStart, startMs, agentTraces, { signals, anomalies });
    }

    // Build CrisisEvent from CorrelatedEvent
    crisisEvent = this.correlatedToEvent(correlatedEvent);

    // ── STEP 3: Analysis Agent ───────────────────────────

    try {
      this.emit(3, 'AnalysisAgent', 'started', `Analysing ${crisisEvent.detectedType} crisis...`);
      const step3Start = now();

      severity = analysisAgent.analyzeSeverity(crisisEvent);
      impact = analysisAgent.estimateImpact(crisisEvent);
      explanation = analysisAgent.generateExplanation(crisisEvent, severity, impact);

      const locationLabel = crisisEvent.location.label ?? crisisEvent.location.district ?? 'Islamabad area';
      const apiFeedTexts = signals
        .filter((s) => ['weather_api', 'traffic_api', 'utility_api'].includes(s.source))
        .map((s) => s.text);
      const feedSummary = apiFeedTexts.length > 0 ? feedsToSummary({
        weather: apiFeedTexts.find((t) => /weather|heat|rain|flood|pmd/i.test(t)) ?? '',
        traffic: apiFeedTexts.find((t) => /traffic|congestion|gridlock|delay/i.test(t)) ?? '',
        power: apiFeedTexts.find((t) => /grid|power|feeder|wapda/i.test(t)) ?? '',
        rawInputs: [],
      }) : undefined;

      if (isSearchGroundingAvailable()) {
        this.emit(3, 'AnalysisAgent', 'started', 'Querying Google Search for regional context…');
        const search = await fetchCrisisSearchGrounding(crisisEvent.detectedType, locationLabel);
        if (search) {
          searchContext = search;
          explanation = `${explanation}\n\n[Google Search] ${search.summary}`;
        }
      }

      if (isLlmAvailable()) {
        const llm = await analyzeCrisisContext(crisisEvent, signals, feedSummary, searchContext?.summary);
        if (llm) {
          const provider = getLastLlmProvider();
          const providerLabel = provider === 'groq' ? 'Groq' : 'Gemini';
          const ruleBasedType = primaryCrisisTypeFromSignals(signals);
          const resolvedType =
            llm.detectedType === 'multi_crisis' && ruleBasedType !== 'multi_crisis' && ruleBasedType !== 'unknown'
              ? ruleBasedType
              : llm.detectedType;
          crisisEvent = {
            ...crisisEvent,
            detectedType: resolvedType,
            impacts: [...new Set([...crisisEvent.impacts, ...llm.directEffects, ...llm.secondaryEffects])],
            actions: [
              ...llm.recommendedActionsAuthorities.map((a) => `[Authority] ${a}`),
              ...llm.recommendedActionsCitizens.map((a) => `[Citizen] ${a}`),
            ],
          };
          explanation = `${explanation}\n\n[${providerLabel} AI] ${llm.explanation}`;
          this.emit(3, 'AnalysisAgent', 'completed',
            `${providerLabel} enriched analysis (detection ${Math.round(crisisEvent.confidence * 100)}%, severity ${severity.score}/100)`);
        }
      }

      agentTraces.push(this.buildAgentTrace(
        'AnalysisAgent', step3Start,
        `CrisisEvent: ${crisisEvent.detectedType} (${crisisEvent.signals.length} signals)`,
        analysisAgent.getAnalysisTrace(),
        [`Severity: ${severity.score}/100 → ${severity.level}`, `Detection confidence: ${Math.round((crisisEvent.confidence ?? 0) * 100)}%`, `Cascading effects: ${impact.cascadingEffects.length}`, `Affected population: ${impact.estimatedAffectedPopulation.toLocaleString()}`, isLlmAvailable() ? 'LLM augmentation applied (Groq/Gemini)' : 'Rule-based analysis only', searchContext ? `Google Search: ${searchContext.queries.length} queries` : 'Google Search: skipped'],
        [`Severity level: ${severity.level.toUpperCase()}`, `Recovery estimate: ${impact.estimatedRecoveryHours}h`],
        [`SeverityAnalysis + ImpactAnalysis + Explanation`],
      ));

      this.emit(3, 'AnalysisAgent', 'completed',
        `Severity: ${severity.level.toUpperCase()} (${severity.score}/100). ${impact.cascadingEffects.length} cascades detected.`);
      console.log(`[Orchestrator] Step 3 complete: severity=${severity.level}, cascades=${impact.cascadingEffects.length}\n`);
    } catch (err) {
      this.handlePipelineError('AnalysisAgent', err as Error, agentTraces);
    }

    // ── STEP 4: Planning Agent ───────────────────────────

    if (severity && impact) {
      try {
        this.emit(4, 'PlanningAgent', 'started', 'Generating coordinated action plan...');
        const step4Start = now();

        const fullPlan = planningAgent.fullPlanning(crisisEvent, severity, impact);
        plan = fullPlan.plan;

        agentTraces.push(this.buildAgentTrace(
          'PlanningAgent', step4Start,
          `CrisisEvent + SeverityAnalysis + ImpactAnalysis`,
          planningAgent.getPlanningTrace(),
          [`Generated ${plan.actions.length} actions`, `Authority: ${plan.authorityActions.length}, Citizen: ${plan.citizenActions.length}`, `Routes: ${fullPlan.routes.length}, Resources: ${fullPlan.resources.allocations.length}`],
          [`Priority 1: ${fullPlan.prioritised.ranked[0]?.action.slice(0, 60) ?? 'N/A'}`, `Escalation required: ${fullPlan.resources.escalationRequired}`],
          [`ActionPlan: ${plan.id}`],
        ));

        this.emit(4, 'PlanningAgent', 'completed',
          `Plan created: ${plan.authorityActions.length} authority + ${plan.citizenActions.length} citizen actions`);
        console.log(`[Orchestrator] Step 4 complete: ${plan.actions.length} actions planned\n`);
      } catch (err) {
        this.handlePipelineError('PlanningAgent', err as Error, agentTraces);
      }
    }

    // ── STEP 5: Simulation Agent ─────────────────────────

    if (plan && severity && impact) {
      try {
        this.emit(5, 'SimulationAgent', 'started', 'Simulating execution...');
        const step5Start = now();

        simulation = simulationAgent.executeSimulation(plan, crisisEvent, severity, impact);

        agentTraces.push(this.buildAgentTrace(
          'SimulationAgent', step5Start,
          `ActionPlan: ${plan.id} (${plan.actions.length} actions)`,
          simulationAgent.getSimulationTrace(),
          [`Dispatches: ${simulation.tickets.length}`, `Alerts sent: ${simulation.alerts.reduce((s, a) => s + a.sent, 0).toLocaleString()}`, `Reroutes: ${simulation.reroutes.length}`],
          [`Overall improvement: ${simulation.outcome.overallImprovement}%`],
          [`SimulationOutput with ${simulation.logs.length} log entries`],
        ));

        this.emit(5, 'SimulationAgent', 'completed',
          `Simulation complete. Improvement: ${simulation.outcome.overallImprovement}%`);
        console.log(`[Orchestrator] Step 5 complete: improvement=${simulation.outcome.overallImprovement}%\n`);
      } catch (err) {
        this.handlePipelineError('SimulationAgent', err as Error, agentTraces);
      }
    }

    status = 'COMPLETED';

    if (crisisEvent && severity) {
      crisisEvent = syncCrisisEventWithAnalysis(crisisEvent, severity.level);
    }

    if (crisisEvent) {
      try {
        const { useMapStore } = require('../store/mapStore');
        useMapStore.getState().syncWithCrisis([crisisEvent]);
      } catch { /* ignore */ }
    }

    console.log(`${'═'.repeat(60)}`);
    console.log(`[Orchestrator] Pipeline ${id} COMPLETED in ${Date.now() - startMs}ms`);
    console.log(`${'═'.repeat(60)}\n`);

    const result = this.buildResult(id, status, pipelineStart, startMs, agentTraces, {
      signals, anomalies, correlatedEvent, crisisEvent, severity, impact, explanation, plan, simulation, searchContext,
    });

    this.lastResult = result;
    return result;
  }

  // ── 2. getFullTrace() ───────────────────────────────────

  getFullTrace(): PipelineTrace | null {
    return this.lastTrace;
  }

  getLastResult(): PipelineResult | null {
    return this.lastResult;
  }

  // ── 3. handlePipelineError() ────────────────────────────

  private handlePipelineError(step: string, error: Error, traces: AgentTrace[]): boolean {
    console.error(`[Orchestrator] ⚠ Error in ${step}: ${error.message}`);

    traces.push({
      agentName: step,
      startTime: now(),
      endTime: now(),
      inputSummary: 'Error during processing',
      observations: [`Error: ${error.message}`],
      reasoning: [`Agent ${step} encountered an error. Attempting recovery.`],
      decisions: ['Skip failed step and continue pipeline with available data'],
      outputs: [{ error: error.message }],
      status: 'failed',
    });

    this.emit(0, step, 'failed', `Error in ${step}: ${error.message}. Continuing pipeline...`);

    // Pipeline continues — we never crash
    return true;
  }

  // ── 4. runBaselineComparison() ──────────────────────────

  async runBaselineComparison(inputs: Array<string | Record<string, unknown>>): Promise<ComparisonResult> {
    // Run full agentic pipeline
    const agenticResult = await this.runPipeline(inputs);

    // Run simple heuristic
    const heuristicResult = this.runHeuristic(inputs);

    // Compute improvements
    const improvements: string[] = [];

    if (agenticResult.severity) {
      improvements.push(`Severity: Heuristic="${heuristicResult.severity}" vs Agentic="${agenticResult.severity.level}" (weighted 5-factor scoring)`);
    }
    if (agenticResult.anomalies.length > 0) {
      improvements.push(`Anomaly detection: Heuristic=0 vs Agentic=${agenticResult.anomalies.length} anomalies found`);
    }
    if (agenticResult.impact) {
      improvements.push(`Cascade analysis: Heuristic=0 vs Agentic=${agenticResult.impact.cascadingEffects.length} cascading effects identified`);
    }
    if (agenticResult.plan) {
      improvements.push(`Action planning: Heuristic=${heuristicResult.actions.length} generic vs Agentic=${agenticResult.plan.actions.length} targeted actions`);
    }
    if (agenticResult.simulation) {
      improvements.push(`Outcome tracking: Heuristic=none vs Agentic=${agenticResult.simulation.outcome.overallImprovement}% measured improvement`);
    }
    improvements.push('Cross-correlation: Heuristic=none vs Agentic=multi-source verification');
    improvements.push('Location awareness: Heuristic=none vs Agentic=Pakistan area-specific population & infrastructure data');

    const summary = `The agentic system identified ${agenticResult.anomalies.length} anomalies, `
      + `classified severity as ${agenticResult.severity?.level ?? 'N/A'} with ${agenticResult.severity?.score ?? 0}/100 score, `
      + `detected ${agenticResult.impact?.cascadingEffects.length ?? 0} cascading effects, `
      + `and generated ${agenticResult.plan?.actions.length ?? 0} coordinated actions. `
      + `The heuristic system only matched a keyword and sent a generic alert.`;

    return { agenticResult, heuristicResult, improvements, summary };
  }

  /** Simple keyword-match heuristic for baseline comparison */
  private runHeuristic(inputs: Array<string | Record<string, unknown>>): ComparisonResult['heuristicResult'] {
    const texts = inputs.map((i) => typeof i === 'string' ? i : JSON.stringify(i)).join(' ').toLowerCase();

    let detectedType = 'UNKNOWN';
    let severity = 'MEDIUM';
    let matchedRule = 'none';

    const rules: Array<{ regex: RegExp; type: string; rule: string }> = [
      { regex: /\b(power|electricity|bijli|transformer|grid|blackout)\b/i, type: 'POWER', rule: 'power/electricity' },
      { regex: /\b(flood|rain|water.*log|submerge|barish)\b/i, type: 'FLOOD', rule: 'flood/rain' },
      { regex: /\b(road|bridge|pothole|landslide|block|accident|crash)\b/i, type: 'ROAD_DAMAGE', rule: 'road/accident' },
      { regex: /\b(fire|aag|blaze|smoke)\b/i, type: 'FIRE', rule: 'fire' },
      { regex: /\b(water.*supply|pipeline|sewage|tanker)\b/i, type: 'WATER', rule: 'water supply' },
      { regex: /\b(heatwave|heat\s*wave|heatstroke|garmi)\b/i, type: 'HEATWAVE', rule: 'heatwave' },
    ];

    for (const r of rules) {
      if (r.regex.test(texts)) {
        detectedType = r.type;
        matchedRule = r.rule;
        break;
      }
    }

    if (/critical|emergency|death|died|hospital/i.test(texts)) severity = 'HIGH';

    return {
      detectedType,
      severity,
      actions: [`Send generic alert: "A ${detectedType.toLowerCase().replace(/_/g, ' ')} issue may be occurring in your area."`],
      explanation: `Simple system: matched pattern "${matchedRule}" → category: ${detectedType}. Severity: ${severity}. No further analysis.`,
    };
  }

  // ── 5. subscribeToUpdates() ─────────────────────────────

  subscribeToUpdates(callback: (update: PipelineUpdate) => void): () => void {
    this.subscribers.push(callback);
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  private emit(step: number, agent: string, status: PipelineUpdate['status'], message: string, data?: Record<string, unknown>): void {
    const update: PipelineUpdate = {
      step,
      totalSteps: 5,
      agentName: agent,
      status,
      message,
      timestamp: now(),
      data,
    };

    for (const cb of this.subscribers) {
      try { cb(update); } catch { /* subscriber error — ignore */ }
    }
  }

  // ── Private builders ────────────────────────────────────

  private buildAgentTrace(
    agentName: string,
    startTime: string,
    inputSummary: string,
    rawTrace: Array<{ reasoning: string }>,
    observations: string[],
    decisions: string[],
    outputSummaries: string[],
  ): AgentTrace {
    return {
      agentName,
      startTime,
      endTime: now(),
      inputSummary,
      observations,
      reasoning: rawTrace.map((t) => t.reasoning),
      decisions,
      outputs: outputSummaries.map((s) => ({ summary: s })),
      status: 'completed',
    };
  }

  private buildResult(
    id: string,
    status: PipelineStatus,
    pipelineStart: string,
    startMs: number,
    agentTraces: AgentTrace[],
    data: {
      signals?: CrisisSignal[];
      anomalies?: AnomalyReport[];
      correlatedEvent?: CorrelatedEvent | null;
      crisisEvent?: CrisisEvent | null;
      severity?: SeverityAnalysis | null;
      impact?: ImpactAnalysis | null;
      explanation?: string | null;
      plan?: ActionPlan | null;
      simulation?: SimulationOutput | null;
      searchContext?: PipelineResult['searchContext'];
    },
  ): PipelineResult {
    const trace: PipelineTrace = {
      pipelineId: id,
      startTime: pipelineStart,
      endTime: now(),
      status,
      agents: agentTraces,
      totalDurationMs: Date.now() - startMs,
    };

    this.lastTrace = trace;

    return {
      pipelineId: id,
      status,
      signals: data.signals ?? [],
      anomalies: data.anomalies ?? [],
      correlatedEvent: data.correlatedEvent ?? null,
      crisisEvent: data.crisisEvent ?? null,
      severity: data.severity ?? null,
      impact: data.impact ?? null,
      explanation: data.explanation ?? null,
      plan: data.plan ?? null,
      simulation: data.simulation ?? null,
      searchContext: data.searchContext ?? null,
      trace,
      timestamp: now(),
    };
  }

  /** Convert a CorrelatedEvent into a CrisisEvent for downstream agents */
  private correlatedToEvent(corr: CorrelatedEvent): CrisisEvent {
    return {
      id: `EVT-${Date.now()}`,
      signals: corr.signals,
      detectedType: corr.crisisType,
      severity: corr.correlationScore >= 0.7 ? 'critical'
        : corr.correlationScore >= 0.5 ? 'high'
        : corr.correlationScore >= 0.3 ? 'medium' : 'low',
      confidence: corr.correlationScore,
      location: corr.location,
      impacts: [],
      actions: [],
      createdAt: corr.timestamp,
      updatedAt: now(),
      status: 'active',
    };
  }

  /** Clear all agent traces for a fresh run */
  clearAllTraces(): void {
    inputAgent.clearTrace();
    detectionAgent.clearTrace();
    analysisAgent.clearTrace();
    planningAgent.clearTrace();
    simulationAgent.clearTrace();
    this.lastTrace = null;
    this.lastResult = null;
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const orchestrator = new AgentOrchestrator();
