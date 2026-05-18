// ─────────────────────────────────────────────────────────────
// SimulationAgent — Agent 5: Execution Simulation & Outcomes
// ─────────────────────────────────────────────────────────────
// Takes an ActionPlan and simulates real-world execution:
// team dispatch, citizen alerts, traffic rerouting, and system
// updates. Produces outcome metrics, edge-case demonstrations,
// and agentic-vs-heuristic comparisons.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisEvent,
  Coordinate,
  AgentAction,
  ActionPlan,
  PlannedAction,
  TeamType,
  DispatchTicket,
  TicketStatus,
  AlertResult,
  RerouteResult,
  StateSnapshot,
  OutcomeMetric,
  OutcomeReport,
  LogEntry,
  SimulationOutput,
  SeverityAnalysis,
  ImpactAnalysis,
} from '../types';
import { naiveHeuristicFromSignals } from '../utils/naiveHeuristic';

// ── Helpers ─────────────────────────────────────────────────

let _ticketCounter = 0;
function ticketId(): string { return `INFRA-${2000 + (++_ticketCounter)}`; }
function now(): string { return new Date().toISOString(); }
function ts(): string { return new Date().toLocaleTimeString('en-PK', { hour12: false }); }
function chance(pct: number): boolean { return Math.random() * 100 < pct; }

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a coordinate path simulating team movement */
function generatePath(from: Coordinate, to: Coordinate, steps: number): Coordinate[] {
  const path: Coordinate[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t + (Math.random() - 0.5) * 0.002,
      longitude: from.longitude + (to.longitude - from.longitude) * t + (Math.random() - 0.5) * 0.002,
    });
  }
  return path;
}

// ── Team base coordinates (Islamabad) ───────────────────────

const TEAM_BASES: Partial<Record<TeamType, Coordinate>> = {
  electrical_repair: { latitude: 33.6950, longitude: 73.0400 },
  road_crew:         { latitude: 33.6700, longitude: 73.0300 },
  emergency_medical: { latitude: 33.7100, longitude: 73.0500 },
  traffic_police:    { latitude: 33.6938, longitude: 73.0652 },
  flood_rescue:      { latitude: 33.6500, longitude: 73.0200 },
  civil_defence:     { latitude: 33.6800, longitude: 73.0550 },
  fire_brigade:      { latitude: 33.7000, longitude: 73.0350 },
};

const DEFAULT_BASE: Coordinate = { latitude: 33.6844, longitude: 73.0479 };

// ═══════════════════════════════════════════════════════════════
// SimulationAgent Class
// ═══════════════════════════════════════════════════════════════

export class SimulationAgent {
  readonly name = 'SimulationAgent';
  private traceLog: AgentAction[] = [];
  private systemLog: LogEntry[] = [];

  // ── 1. executeSimulation() ──────────────────────────────

  executeSimulation(
    plan: ActionPlan,
    event: CrisisEvent,
    severity: SeverityAnalysis,
    impact: ImpactAnalysis,
  ): SimulationOutput {
    const startMs = Date.now();
    this.systemLog = [];
    const tickets: DispatchTicket[] = [];
    const alerts: AlertResult[] = [];
    const reroutes: RerouteResult[] = [];

    this.log('INFO', 'SimulationAgent', `Simulation started for plan ${plan.id} (${plan.actions.length} actions)`);

    const area = event.location.label ?? event.location.district ?? 'Unknown';
    const destCoord = event.location.coordinate;

    // Process each action
    for (const action of plan.actions) {
      if (action.assignedTeam) {
        const ticket = this.simulateDispatch(action, destCoord);
        tickets.push(ticket);
      } else if (action.target === 'CITIZEN') {
        const alert = this.simulateAlert(action, area, impact.estimatedAffectedPopulation);
        alerts.push(alert);
      } else if (action.action.toLowerCase().includes('rout') || action.action.toLowerCase().includes('traffic')) {
        const reroute = this.simulateRouteRerouting(action, area);
        reroutes.push(reroute);
      } else {
        this.simulateSystemUpdate(action);
      }
    }

    // Calculate outcomes
    const before = this.buildBeforeSnapshot(event, severity);
    const after = this.buildAfterSnapshot(before, tickets, alerts, reroutes);
    const outcome = this.calculateOutcomeMetrics(before, after);

    // Edge case + comparison
    const edgeCaseDemo = this.demonstrateEdgeCase(area, destCoord);
    const agenticComparison = this.compareAgenticVsHeuristic(event, severity, impact, plan, outcome);

    this.log('SUCCESS', 'SimulationAgent', `Simulation complete. ${tickets.length} dispatches, ${alerts.length} alerts, ${reroutes.length} reroutes.`);

    const output: SimulationOutput = {
      tickets, alerts, reroutes,
      logs: [...this.systemLog],
      outcome, edgeCaseDemo, agenticComparison,
    };

    this.logTrace('executeSimulation', { planId: plan.id }, { ticketCount: tickets.length, alertCount: alerts.length }, `Simulated ${plan.actions.length} actions`, startMs);

    return output;
  }

  // ── simulateDispatch() ──────────────────────────────────

  private simulateDispatch(action: PlannedAction, destination: Coordinate): DispatchTicket {
    const team = action.assignedTeam!;
    const base = TEAM_BASES[team] ?? DEFAULT_BASE;
    const id = ticketId();
    const etaMinutes = parseInt(action.eta ?? '15', 10) || 15;

    // 30% chance of delay
    const isDelayed = chance(30);
    const finalEta = isDelayed ? etaMinutes + randomBetween(5, 15) : etaMinutes;
    const path = generatePath(base, destination, 8);

    // Status progression simulation
    let status: TicketStatus = 'DISPATCHED';
    let failureReason: string | null = null;

    if (isDelayed) {
      status = 'DELAYED';
      failureReason = chance(50)
        ? 'Flood on primary route — rerouting via alternate path'
        : 'Traffic congestion delaying team — ETA extended';
      this.log('WARN', 'SimulationAgent',
        `⚠ ${team.replace(/_/g, ' ')} delayed. Reason: ${failureReason}. New ETA: ${finalEta} mins`);
    }

    // Advance status
    if (!isDelayed || chance(80)) {
      status = 'EN_ROUTE';
      this.log('SUCCESS', 'SimulationAgent',
        `✓ ${team.replace(/_/g, ' ')} dispatched to ${action.location}. Ticket: ${id}. ETA: ${finalEta} mins. Status: ${status}`);
    }

    return {
      ticketId: id,
      team,
      status,
      eta: finalEta,
      location: action.location,
      coordinatePath: path,
      failureReason,
    };
  }

  // ── simulateAlert() ─────────────────────────────────────

  private simulateAlert(action: PlannedAction, area: string, population: number): AlertResult {
    const recipients = Math.round(population * 0.85);
    const failRate = randomBetween(1, 5);
    const failed = Math.round(recipients * failRate / 100);
    const sent = recipients - failed;

    // SMS
    const smsMessage = `CrisisAI Alert [${area}]: ${action.action.slice(0, 120)}. Stay safe. Call 1122 for emergency.`;
    this.log('SUCCESS', 'SimulationAgent',
      `✓ SMS alert sent to ${sent.toLocaleString()} users in ${area}. Message: "${smsMessage.slice(0, 80)}..."`);

    // App notification
    this.log('INFO', 'SimulationAgent',
      `✓ App push notification dispatched to ${Math.round(recipients * 0.6).toLocaleString()} app users`);

    return {
      channel: 'SMS',
      recipients,
      sent,
      failed,
      message: smsMessage,
    };
  }

  // ── simulateRouteRerouting() ────────────────────────────

  private simulateRouteRerouting(action: PlannedAction, area: string): RerouteResult {
    const beforeCongestion = randomBetween(75, 95);
    const afterCongestion = Math.max(20, beforeCongestion - randomBetween(30, 50));
    const blockedRoads = [area];
    const activatedRoutes = ['Kashmir Highway', 'IJP Road', '7th Avenue'].slice(0, randomBetween(2, 3));

    this.log('SUCCESS', 'SimulationAgent',
      `✓ Traffic rerouted via ${activatedRoutes.join(', ')}. Congestion reduced: ${beforeCongestion}% → ${afterCongestion}%`);

    return {
      beforeCongestion,
      afterCongestion,
      blockedRoads,
      activatedRoutes,
      mapMarkers: activatedRoutes.map((_, i) => ({
        latitude: 33.68 + i * 0.01,
        longitude: 73.04 + i * 0.015,
      })),
    };
  }

  // ── simulateSystemUpdate() ──────────────────────────────

  private simulateSystemUpdate(action: PlannedAction): void {
    this.log('INFO', 'SimulationAgent',
      `✓ System update: ${action.action.slice(0, 100)}`);

    if (action.action.toLowerCase().includes('signal') || action.action.toLowerCase().includes('traffic')) {
      this.log('INFO', 'SimulationAgent',
        '  → Smart traffic signals updated: emergency mode activated at 3 intersections');
    }
    if (action.action.toLowerCase().includes('wapda') || action.action.toLowerCase().includes('utility')) {
      this.log('INFO', 'SimulationAgent',
        '  → Utility department notified. Work order generated. Audit trail created.');
    }
  }

  // ── 2. calculateOutcomeMetrics() ────────────────────────

  calculateOutcomeMetrics(before: StateSnapshot, after: StateSnapshot): OutcomeReport {
    const metrics: OutcomeMetric[] = [
      {
        metric: 'Traffic Congestion',
        before: `${before.congestionPercent}%`,
        after: `${after.congestionPercent}%`,
        improvement: `↓ ${before.congestionPercent - after.congestionPercent}%`,
      },
      {
        metric: 'Emergency Response',
        before: before.emergencyResponseStatus,
        after: after.emergencyResponseStatus,
        improvement: before.emergencyResponseStatus !== after.emergencyResponseStatus ? '✓ Active' : 'No change',
      },
      {
        metric: 'Residents with Assistance',
        before: `${before.affectedWithAssistance}%`,
        after: `${after.affectedWithAssistance}%`,
        improvement: `↑ ${after.affectedWithAssistance - before.affectedWithAssistance}%`,
      },
      {
        metric: 'Infrastructure Status',
        before: before.infrastructureStatus,
        after: after.infrastructureStatus,
        improvement: after.infrastructureStatus.includes('REPAIR') ? '✓ Repair initiated' : 'Monitoring',
      },
      {
        metric: 'Alert Coverage',
        before: `${before.alertCoverage.toLocaleString()} notified`,
        after: `${after.alertCoverage.toLocaleString()} notified`,
        improvement: `↑ ${(after.alertCoverage - before.alertCoverage).toLocaleString()} citizens`,
      },
      {
        metric: 'Accident Probability',
        before: before.accidentProbability,
        after: after.accidentProbability,
        improvement: before.accidentProbability !== after.accidentProbability ? `↓ ${before.accidentProbability} → ${after.accidentProbability}` : 'Unchanged',
      },
    ];

    // Overall improvement score
    const improvements = [
      Math.min(50, before.congestionPercent - after.congestionPercent),
      after.emergencyResponseStatus.includes('DISPATCH') ? 20 : 0,
      Math.min(20, after.affectedWithAssistance - before.affectedWithAssistance) / 2,
      after.alertCoverage > before.alertCoverage ? 10 : 0,
    ];
    const overallImprovement = Math.min(100, improvements.reduce((a, b) => a + b, 0));

    const summary = `System reduced congestion by ${before.congestionPercent - after.congestionPercent}%, `
      + `activated emergency response, notified ${after.alertCoverage.toLocaleString()} citizens, `
      + `and reduced accident probability from ${before.accidentProbability} to ${after.accidentProbability}. `
      + `Overall improvement: ${overallImprovement}%.`;

    return { metrics, overallImprovement, summary };
  }

  // ── 3. generateSystemLog() ──────────────────────────────

  generateSystemLog(): LogEntry[] {
    return [...this.systemLog];
  }

  // ── 4. demonstrateEdgeCase() ────────────────────────────

  demonstrateEdgeCase(area: string, destination: Coordinate): LogEntry[] {
    const edgeLogs: LogEntry[] = [];
    const addLog = (level: LogEntry['level'], msg: string) => {
      const entry: LogEntry = { timestamp: ts(), level, agent: 'SimulationAgent', message: msg };
      edgeLogs.push(entry);
      this.systemLog.push(entry);
    };

    addLog('INFO', `--- EDGE CASE DEMONSTRATION: Dispatch Failure Recovery ---`);
    addLog('INFO', `Primary repair team dispatched to ${area}`);
    addLog('WARN', `⚠ Primary team DELAYED — flood on Route-A (Murree Road underpass submerged)`);
    addLog('WARN', `⚠ ETA exceeded by 12 mins. Team cannot reach destination.`);
    addLog('INFO', `Agent detecting delay... analysing alternate teams in adjacent zones`);
    addLog('INFO', `Found: Civil Defence Zone-2 (Rawalpindi Cantonment) available. Distance: 8km`);

    const backupPath = generatePath(
      { latitude: 33.5700, longitude: 73.0500 },
      destination, 6
    );
    addLog('SUCCESS', `✓ Backup team dispatched via ${backupPath.length}-waypoint route (avoiding flood zone)`);
    addLog('SUCCESS', `✓ New ETA: +8 mins from original. Ticket updated: INFRA-BACKUP-${Date.now() % 10000}`);
    addLog('SUCCESS', `✓ Recovery: SUCCESSFUL — seamless handoff to backup team`);
    addLog('INFO', `--- END EDGE CASE DEMONSTRATION ---`);

    return edgeLogs;
  }

  // ── 5. compareAgenticVsHeuristic() ──────────────────────

  compareAgenticVsHeuristic(
    event: CrisisEvent,
    severity: SeverityAnalysis,
    impact: ImpactAnalysis,
    plan: ActionPlan,
    outcome: OutcomeReport,
  ): { simple: string; agentic: string } {
    const naive = naiveHeuristicFromSignals(event.signals);
    const agenticType = event.detectedType.replace(/_/g, ' ').toUpperCase();
    const detectionPct = Math.round(event.confidence * 100);

    const simpleMismatch =
      naive.category !== 'UNKNOWN' && naive.category !== agenticType
        ? `\n⚠ Misclassification risk: naive rule says ${naive.category} but multi-source analysis says ${agenticType}.`
        : '';

    const simple = [
      `SIMPLE SYSTEM (keyword rules only):`,
      `Scans ${naive.matchedIn === 'citizen' ? 'citizen report' : 'API feed'} text for fixed patterns.`,
      `Matched rule: "${naive.matchedRule}" → category: ${naive.category}.`,
      `Does not use: cross-source correlation, severity scoring, or location context.`,
      `Action: send generic alert "There may be a ${naive.category.toLowerCase()} in your area."`,
      `No team dispatch. No route planning. No cascade detection. No outcome tracking.`,
      `Result: Users get a vague notification — no coordinated response.${simpleMismatch}`,
    ].join('\n');

    const agentic = [
      `AGENTIC SYSTEM (5-agent pipeline):`,
      `${event.signals.length} signals cross-correlated from ${new Set(event.signals.map((s) => s.source)).size} sources.`,
      `Detection confidence: ${detectionPct}% (evidence strength from correlated signals).`,
      `Severity: ${severity.score}/100 (${severity.level}) — weighted across 5 contextual factors.`,
      `${impact.cascadingEffects.length} cascading effects identified and pre-emptively addressed.`,
      `${plan.actions.length} coordinated actions (${plan.authorityActions.length} authority, ${plan.citizenActions.length} citizen).`,
      `${plan.actions.filter((a) => a.assignedTeam).length} teams dispatched with live tracking.`,
      `${outcome.metrics.find((m) => m.metric === 'Alert Coverage')?.after ?? '0'} citizens notified with specific, actionable info.`,
      `Congestion: ${outcome.metrics.find((m) => m.metric === 'Traffic Congestion')?.improvement ?? 'N/A'}.`,
      `Overall improvement: ${outcome.overallImprovement}%.`,
    ].join('\n');

    this.log('INFO', 'SimulationAgent', '--- AGENTIC vs HEURISTIC COMPARISON ---');
    this.log('INFO', 'SimulationAgent', simple);
    this.log('INFO', 'SimulationAgent', agentic);

    return { simple, agentic };
  }

  // ── Snapshot Builders ───────────────────────────────────

  private buildBeforeSnapshot(event: CrisisEvent, severity: SeverityAnalysis): StateSnapshot {
    return {
      congestionPercent: severity.level === 'critical' ? 90 : severity.level === 'high' ? 75 : 50,
      emergencyResponseStatus: 'NO_RESPONSE',
      affectedWithAssistance: 0,
      infrastructureStatus: 'FAILED',
      alertCoverage: 0,
      accidentProbability: severity.level === 'critical' ? 'CRITICAL' : 'HIGH',
    };
  }

  private buildAfterSnapshot(
    before: StateSnapshot,
    tickets: DispatchTicket[],
    alerts: AlertResult[],
    reroutes: RerouteResult[],
  ): StateSnapshot {
    const activeTickets = tickets.filter((t) => t.status !== 'FAILED');
    const totalAlerted = alerts.reduce((sum, a) => sum + a.sent, 0);
    const avgCongestionReduction = reroutes.length > 0
      ? reroutes.reduce((sum, r) => sum + (r.beforeCongestion - r.afterCongestion), 0) / reroutes.length
      : 10;

    return {
      congestionPercent: Math.max(15, before.congestionPercent - avgCongestionReduction),
      emergencyResponseStatus: activeTickets.length > 0 ? `DISPATCHED (${activeTickets.length} teams)` : 'PENDING',
      affectedWithAssistance: Math.min(95, activeTickets.length * 20 + (totalAlerted > 0 ? 25 : 0)),
      infrastructureStatus: activeTickets.length > 0 ? 'REPAIR_ACTIVE' : 'FAILED',
      alertCoverage: totalAlerted,
      accidentProbability: before.accidentProbability === 'CRITICAL' ? 'MEDIUM'
        : before.accidentProbability === 'HIGH' ? 'LOW' : before.accidentProbability,
    };
  }

  // ── Logging ─────────────────────────────────────────────

  private log(level: LogEntry['level'], agent: string, message: string): void {
    const entry: LogEntry = { timestamp: ts(), level, agent, message };
    this.systemLog.push(entry);
    const prefix = level === 'ERROR' ? '✗' : level === 'WARN' ? '⚠' : level === 'SUCCESS' ? '✓' : 'ℹ';
    console.log(`[${entry.timestamp}] ${prefix} [${agent}] ${message}`);
  }

  // ── Trace ───────────────────────────────────────────────

  getSimulationTrace(): AgentAction[] { return [...this.traceLog]; }
  clearTrace(): void { this.traceLog = []; this.systemLog = []; }

  private logTrace(method: string, input: Record<string, unknown>, output: Record<string, unknown>, reasoning: string, startMs: number): void {
    this.traceLog.push({
      id: `TRACE-${this.name}-${method}-${Date.now()}`,
      agentName: this.name, input, reasoning, output,
      timestamp: now(), status: 'completed', durationMs: Date.now() - startMs,
    });
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const simulationAgent = new SimulationAgent();
