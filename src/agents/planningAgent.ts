// ─────────────────────────────────────────────────────────────
// PlanningAgent — Agent 4: Coordinated Action Planning
// ─────────────────────────────────────────────────────────────
// Takes crisis analysis output → generates prioritised action
// plans, allocates resources, computes alternate routes, and
// handles fallback/escalation scenarios.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisEvent,
  CrisisType,
  Severity,
  Coordinate,
  AgentAction,
  SeverityAnalysis,
  ImpactAnalysis,
  PlannedAction,
  ActionPlan,
  ActionCategory,
  ActionTarget,
  PrioritisedPlan,
  RouteAlternative,
  ResourceAllocation,
  TeamType,
  CascadeEffect,
} from '../types';

// ── Priority ordering (lower = more urgent) ─────────────────

const CATEGORY_PRIORITY: Record<ActionCategory, number> = {
  LIFE_SAFETY: 1,
  INFRASTRUCTURE: 2,
  TRAFFIC: 3,
  RESOURCE: 4,
  PUBLIC_INFO: 5,
  ESCALATION: 0, // always top
};

// ── Team → crisis type mapping ──────────────────────────────

const TEAM_MAPPING: Record<CrisisType, TeamType[]> = {
  power_outage: ['electrical_repair'],
  flood: ['flood_rescue', 'emergency_medical'],
  road_damage: ['road_crew', 'traffic_police'],
  fire: ['fire_brigade', 'emergency_medical'],
  water_crisis: ['road_crew', 'civil_defence'],
  earthquake: ['emergency_medical', 'civil_defence', 'road_crew'],
  multi_crisis: ['emergency_medical', 'civil_defence', 'electrical_repair', 'flood_rescue'],
  heatwave: ['emergency_medical'],
  infrastructure_failure: ['electrical_repair', 'road_crew'],
  terrorist_attack: ['emergency_medical', 'civil_defence'],
  disease_outbreak: ['emergency_medical'],
  protest: ['traffic_police', 'civil_defence'],
  unknown: ['civil_defence'],
};

// ── Team availability simulation ────────────────────────────

const TEAM_AVAILABILITY: Record<TeamType, { available: boolean; count: number; etaMinutes: number }> = {
  electrical_repair: { available: true,  count: 3, etaMinutes: 12 },
  road_crew:         { available: true,  count: 2, etaMinutes: 20 },
  emergency_medical: { available: true,  count: 4, etaMinutes: 8 },
  traffic_police:    { available: true,  count: 6, etaMinutes: 10 },
  flood_rescue:      { available: false, count: 0, etaMinutes: 0 },  // simulated unavailability
  civil_defence:     { available: true,  count: 2, etaMinutes: 25 },
  fire_brigade:      { available: true,  count: 2, etaMinutes: 15 },
};

const TEAM_FALLBACKS: Partial<Record<TeamType, TeamType>> = {
  flood_rescue: 'civil_defence',
  fire_brigade: 'civil_defence',
  electrical_repair: 'road_crew',
};

// ── Alternate route data (Islamabad/Rawalpindi) ─────────────

interface RouteData {
  name: string;
  extraMinutes: number;
  congestion: RouteAlternative['congestionLevel'];
  coords: Coordinate[];
  description: string;
}

const ALTERNATE_ROUTES: Record<string, RouteData[]> = {
  'gt road': [
    { name: 'Kashmir Highway → Islamabad Expressway', extraMinutes: 12, congestion: 'MODERATE',
      coords: [{ latitude: 33.6600, longitude: 73.0400 }, { latitude: 33.6300, longitude: 73.0800 }],
      description: 'Take Kashmir Highway south to Islamabad Expressway. Moderate traffic.' },
    { name: 'IJP Road → Rawat Bypass', extraMinutes: 18, congestion: 'LIGHT',
      coords: [{ latitude: 33.6100, longitude: 73.0200 }, { latitude: 33.5800, longitude: 73.1100 }],
      description: 'Use IJP Road to Rawat Bypass. Longer but less congested.' },
    { name: '9th Avenue → Faisal Avenue', extraMinutes: 15, congestion: 'MODERATE',
      coords: [{ latitude: 33.6900, longitude: 73.0500 }, { latitude: 33.7100, longitude: 73.0650 }],
      description: 'Route through Islamabad via 9th Avenue to Faisal Avenue.' },
  ],
  'faizabad': [
    { name: 'Margalla Road → 7th Avenue', extraMinutes: 10, congestion: 'LIGHT',
      coords: [{ latitude: 33.7400, longitude: 73.0600 }, { latitude: 33.7000, longitude: 73.0450 }],
      description: 'Bypass Faizabad via Margalla Road to 7th Avenue.' },
    { name: 'Murree Road → Khayaban-e-Suharwardy', extraMinutes: 14, congestion: 'MODERATE',
      coords: [{ latitude: 33.6500, longitude: 73.0700 }, { latitude: 33.7100, longitude: 73.0800 }],
      description: 'Use Murree Road south and loop via Khayaban-e-Suharwardy.' },
  ],
  'murree road': [
    { name: 'Islamabad Expressway → Lehtrar Road', extraMinutes: 15, congestion: 'LIGHT',
      coords: [{ latitude: 33.6500, longitude: 73.0900 }, { latitude: 33.6700, longitude: 73.1100 }],
      description: 'Take Islamabad Expressway to Lehtrar Road connector.' },
    { name: 'IJP Road → Peshawar Road', extraMinutes: 20, congestion: 'MODERATE',
      coords: [{ latitude: 33.6100, longitude: 73.0200 }, { latitude: 33.5700, longitude: 73.0400 }],
      description: 'Longer route via IJP Road and Peshawar Road.' },
  ],
  'margalla': [
    { name: 'Trail-5 → E-7 Service Road', extraMinutes: 25, congestion: 'FREE_FLOW',
      coords: [{ latitude: 33.7500, longitude: 73.0500 }, { latitude: 33.7300, longitude: 73.0400 }],
      description: 'Mountain trail route to E-7 service road. Slow but clear.' },
    { name: '7th Avenue → Faisal Avenue', extraMinutes: 12, congestion: 'LIGHT',
      coords: [{ latitude: 33.7000, longitude: 73.0400 }, { latitude: 33.7100, longitude: 73.0650 }],
      description: 'Use 7th Avenue through central Islamabad.' },
  ],
};

// ── Helpers ─────────────────────────────────────────────────

let _actionCounter = 0;
let _planCounter = 0;
function actionId(): string { return `ACT-${Date.now()}-${String(++_actionCounter).padStart(3, '0')}`; }
function planId(): string { return `PLAN-${Date.now()}-${String(++_planCounter).padStart(3, '0')}`; }
function now(): string { return new Date().toISOString(); }

function makeAction(
  cat: ActionCategory, target: ActionTarget, priority: number,
  action: string, location: string, reasoning: string,
  team: TeamType | null = null, eta: string | null = null
): PlannedAction {
  return { id: actionId(), category: cat, target, priority, action, location, eta, reasoning, assignedTeam: team, status: 'planned' };
}

// ═══════════════════════════════════════════════════════════════
// PlanningAgent Class
// ═══════════════════════════════════════════════════════════════

export class PlanningAgent {
  readonly name = 'PlanningAgent';
  private traceLog: AgentAction[] = [];

  // ── 1. generateActionPlan() ─────────────────────────────

  generateActionPlan(
    event: CrisisEvent,
    severity: SeverityAnalysis,
    impact: ImpactAnalysis,
  ): ActionPlan {
    const startMs = Date.now();
    const reasons: string[] = [];
    const actions: PlannedAction[] = [];
    const area = event.location.label ?? event.location.district ?? event.location.city ?? 'Unknown';
    const type = event.detectedType;

    reasons.push(`Generating action plan for ${type} in ${area} (severity ${severity.level})`);

    // ── AUTHORITY ACTIONS ──

    // Dispatch appropriate teams
    const teams = TEAM_MAPPING[type] ?? ['civil_defence'];
    for (const team of teams) {
      const avail = TEAM_AVAILABILITY[team];
      const eta = avail.available ? `${avail.etaMinutes} mins` : null;
      const teamLabel = team.replace(/_/g, ' ');
      actions.push(makeAction(
        type === 'flood' || type === 'fire' ? 'LIFE_SAFETY' : 'INFRASTRUCTURE',
        'AUTHORITY', type === 'flood' || type === 'fire' ? 1 : 2,
        `Dispatch ${teamLabel} team to ${area}. ETA: ${eta ?? 'UNAVAILABLE'}`,
        area,
        `${teamLabel} needed for ${type} response at ${area}`,
        team, eta,
      ));
      reasons.push(`Dispatch: ${teamLabel} → ${area} (ETA: ${eta ?? 'N/A'})`);
    }

    // Power-specific actions
    if (type === 'power_outage' || type === 'multi_crisis') {
      actions.push(makeAction('LIFE_SAFETY', 'AUTHORITY', 1,
        `Activate backup generator for hospitals near ${area}`,
        area, 'Hospital backup power is life-safety priority',
        null, '5 mins'));
      actions.push(makeAction('INFRASTRUCTURE', 'AUTHORITY', 2,
        `Notify WAPDA/IESCO of grid failure in ${area}`,
        area, 'Utility must be informed for grid restoration'));
      reasons.push('Added: hospital generator activation + WAPDA notification');
    }

    // Road/bridge actions
    if (type === 'road_damage' || type === 'flood') {
      const blockedRoad = event.location.district ?? 'affected road';
      actions.push(makeAction('LIFE_SAFETY', 'AUTHORITY', 1,
        `Close ${blockedRoad}. Reason: ${type === 'road_damage' ? 'structural damage' : 'flooding'}`,
        area, `${blockedRoad} poses danger to vehicles and pedestrians`,
        'road_crew', '10 mins'));
      // Traffic police at intersections
      actions.push(makeAction('TRAFFIC', 'AUTHORITY', 3,
        `Deploy traffic police to signal-less intersections near ${area}`,
        area, 'Power outage or flooding may disable traffic signals',
        'traffic_police', '10 mins'));
      reasons.push(`Added: road closure for ${blockedRoad} + traffic police deployment`);
    }

    // Flood-specific
    if (type === 'flood') {
      actions.push(makeAction('LIFE_SAFETY', 'AUTHORITY', 1,
        `Evacuate low-lying residential blocks in ${area}`,
        area, 'Flash flood risk requires immediate evacuation',
        'civil_defence', '15 mins'));
    }

    // ── CITIZEN ACTIONS ──

    // Route avoidance
    const blockedKey = (event.location.district ?? '').toLowerCase();
    const altRoutes = ALTERNATE_ROUTES[blockedKey];
    if (altRoutes && altRoutes.length > 0) {
      const routeNames = altRoutes.slice(0, 2).map((r) => r.name).join(' or ');
      actions.push(makeAction('PUBLIC_INFO', 'CITIZEN', 4,
        `Avoid ${event.location.district ?? area}. Use ${routeNames}`,
        area, 'Route avoidance reduces congestion and citizen risk'));
      reasons.push(`Citizen route advisory: avoid ${blockedKey}, use alternates`);
    }

    // Resource conservation
    if (type === 'power_outage' || type === 'multi_crisis') {
      actions.push(makeAction('PUBLIC_INFO', 'CITIZEN', 5,
        `Reduce electricity usage in ${area} and surrounding sectors`,
        area, 'Load reduction helps grid restoration'));
    }
    if (type === 'water_crisis') {
      actions.push(makeAction('PUBLIC_INFO', 'CITIZEN', 5,
        `Conserve water in ${area}. Boil water before drinking`,
        area, 'Water supply disruption requires conservation and safety measures'));
    }

    // Safety advisory
    if (type === 'flood') {
      actions.push(makeAction('PUBLIC_INFO', 'CITIZEN', 4,
        `Do not enter flooded underpasses near ${area}. Stay on elevated ground`,
        area, 'Flooded underpasses are leading cause of drowning'));
    }

    // Emergency contact
    actions.push(makeAction('PUBLIC_INFO', 'CITIZEN', 5,
      'Call Rescue 1122 for emergency assistance. Call 115 for WAPDA complaints.',
      area, 'Emergency helpline information for affected citizens'));

    // Cascade-driven actions
    for (const cascade of impact.cascadingEffects) {
      if (cascade.riskLevel === 'critical') {
        actions.push(makeAction('LIFE_SAFETY', 'AUTHORITY', 1,
          `URGENT: Mitigate cascade — ${cascade.effect}`,
          area, `Cascade from ${cascade.trigger}. Timeframe: ${cascade.timeframeMinutes} mins`,
        ));
        reasons.push(`Cascade action: ${cascade.effect} (${cascade.riskLevel})`);
      }
    }

    const authorityActions = actions.filter((a) => a.target === 'AUTHORITY');
    const citizenActions = actions.filter((a) => a.target === 'CITIZEN');

    const plan: ActionPlan = {
      id: planId(),
      eventId: event.id,
      actions,
      authorityActions,
      citizenActions,
      reasoning: reasons.join('\n'),
      createdAt: now(),
    };

    console.log(`[PlanningAgent] Plan ${plan.id}: ${actions.length} actions (${authorityActions.length} authority, ${citizenActions.length} citizen)`);
    this.logTrace('generateActionPlan', { eventId: event.id }, { planId: plan.id, actionCount: actions.length }, reasons.join('\n'), startMs);

    return plan;
  }

  // ── 2. prioritiseActions() ──────────────────────────────

  prioritiseActions(actions: PlannedAction[]): PrioritisedPlan {
    const reasons: string[] = [];

    const ranked = [...actions].sort((a, b) => {
      // First by category priority
      const catDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
      if (catDiff !== 0) return catDiff;
      // Then by explicit priority number
      return a.priority - b.priority;
    });

    // Re-number
    ranked.forEach((a, i) => { a.priority = i + 1; });

    // Log reasoning for top 5
    for (let i = 0; i < Math.min(5, ranked.length); i++) {
      const a = ranked[i];
      reasons.push(`Rank ${i + 1}: [${a.category}] ${a.action.slice(0, 80)}...`);
    }

    // Explain key priority decisions
    const lifeSafety = ranked.filter((a) => a.category === 'LIFE_SAFETY');
    const infra = ranked.filter((a) => a.category === 'INFRASTRUCTURE');
    const traffic = ranked.filter((a) => a.category === 'TRAFFIC');

    if (lifeSafety.length > 0 && traffic.length > 0) {
      reasons.push(`Prioritising ${lifeSafety[0].action.slice(0, 50)} (rank ${lifeSafety[0].priority}) over traffic management (rank ${traffic[0].priority}) because life safety > mobility.`);
    }
    if (lifeSafety.length > 0 && infra.length > 0) {
      reasons.push(`Life safety actions (${lifeSafety.length}) ranked before infrastructure repairs (${infra.length}).`);
    }

    console.log(`[PlanningAgent] Prioritised ${ranked.length} actions. Top: ${ranked[0]?.category ?? 'N/A'}`);
    return { ranked, reasoning: reasons.join('\n') };
  }

  // ── 3. generateAlternateRoutes() ────────────────────────

  generateAlternateRoutes(blockedRoads: string[], _location: Coordinate): RouteAlternative[] {
    const alternatives: RouteAlternative[] = [];

    for (const road of blockedRoads) {
      const key = road.toLowerCase().replace(/\s+/g, ' ').trim();
      // Try exact match, then partial
      const routes = ALTERNATE_ROUTES[key]
        ?? Object.entries(ALTERNATE_ROUTES).find(([k]) => key.includes(k))?.[1]
        ?? [];

      for (const r of routes) {
        alternatives.push({
          routeName: r.name,
          estimatedExtraMinutes: r.extraMinutes,
          congestionLevel: r.congestion,
          coordinates: r.coords,
          description: `Blocked: ${road}. ${r.description}`,
        });
      }
    }

    if (alternatives.length === 0) {
      // Generic fallback
      alternatives.push({
        routeName: 'Islamabad Expressway (general bypass)',
        estimatedExtraMinutes: 20,
        congestionLevel: 'MODERATE',
        coordinates: [{ latitude: 33.6500, longitude: 73.0900 }],
        description: 'No specific alternate found. Use Islamabad Expressway as general bypass.',
      });
    }

    console.log(`[PlanningAgent] Generated ${alternatives.length} alternate route(s) for ${blockedRoads.length} blocked road(s)`);
    return alternatives;
  }

  // ── 4. allocateResources() ──────────────────────────────

  allocateResources(event: CrisisEvent, plan: ActionPlan): ResourceAllocation {
    const startMs = Date.now();
    const reasons: string[] = [];
    const allocations: ResourceAllocation['allocations'] = [];
    const unmetNeeds: string[] = [];
    let escalationRequired = false;

    const teamActions = plan.actions.filter((a) => a.assignedTeam !== null);

    for (const action of teamActions) {
      const team = action.assignedTeam!;
      const avail = TEAM_AVAILABILITY[team];

      if (avail.available && avail.count > 0) {
        allocations.push({ team, actionId: action.id, available: true, fallback: null });
        reasons.push(`✓ ${team.replace(/_/g, ' ')} allocated to ${action.action.slice(0, 50)}...`);
      } else {
        // Try fallback
        const fallback = TEAM_FALLBACKS[team] ?? null;
        const fallbackAvail = fallback ? TEAM_AVAILABILITY[fallback] : null;

        if (fallback && fallbackAvail?.available) {
          allocations.push({ team, actionId: action.id, available: false, fallback });
          reasons.push(`⚠ ${team.replace(/_/g, ' ')} UNAVAILABLE → fallback to ${fallback.replace(/_/g, ' ')}`);
        } else {
          allocations.push({ team, actionId: action.id, available: false, fallback: null });
          unmetNeeds.push(`${team.replace(/_/g, ' ')} for: ${action.action.slice(0, 60)}`);
          escalationRequired = true;
          reasons.push(`✗ ${team.replace(/_/g, ' ')} UNAVAILABLE, no fallback → ESCALATION REQUIRED`);
        }
      }
    }

    if (escalationRequired) {
      reasons.push('Primary resource unavailable. Escalating to higher authority. Activating fallback protocol.');
      reasons.push('→ Alert neighbouring zone teams (Rawalpindi Cantonment, Taxila Civil Defence)');
    }

    const result: ResourceAllocation = { allocations, unmetNeeds, escalationRequired, reasoning: reasons.join('\n') };

    console.log(`[PlanningAgent] Resources: ${allocations.filter((a) => a.available).length}/${allocations.length} allocated. Escalation: ${escalationRequired}`);
    this.logTrace('allocateResources', { eventId: event.id }, result as unknown as Record<string, unknown>, reasons.join('\n'), startMs);

    return result;
  }

  // ── 5. fallbackScenario() ───────────────────────────────

  fallbackScenario(unmetNeeds: string[], area: string): PlannedAction[] {
    const reasons: string[] = [];
    const fallbackActions: PlannedAction[] = [];

    reasons.push(`Fallback protocol activated for ${unmetNeeds.length} unmet need(s) in ${area}`);

    // Escalation to higher authority
    fallbackActions.push(makeAction('ESCALATION', 'SYSTEM', 0,
      `ESCALATE: Request NDMA intervention for ${area}. Unmet: ${unmetNeeds.join('; ')}`,
      area, 'Local resources exhausted. National Disaster Management Authority notified.'));

    // Alert neighboring zones
    fallbackActions.push(makeAction('ESCALATION', 'AUTHORITY', 0,
      `Alert neighbouring zone teams: Rawalpindi Cantonment, Taxila, Wah Civil Defence`,
      area, 'Cross-zone mutual aid request dispatched'));

    // Military aid request (for severe crises)
    if (unmetNeeds.length >= 2) {
      fallbackActions.push(makeAction('ESCALATION', 'SYSTEM', 0,
        `Request Pakistan Army / FC assistance for ${area}. Multiple resource gaps.`,
        area, 'Military aid requested under NDMA disaster protocol'));
    }

    for (const a of fallbackActions) {
      reasons.push(`→ ${a.action}`);
    }

    console.log(`[PlanningAgent] Fallback: ${fallbackActions.length} escalation action(s) created`);
    return fallbackActions;
  }

  // ── Full Planning Pipeline ──────────────────────────────

  fullPlanning(
    event: CrisisEvent,
    severity: SeverityAnalysis,
    impact: ImpactAnalysis,
  ): {
    plan: ActionPlan;
    prioritised: PrioritisedPlan;
    routes: RouteAlternative[];
    resources: ResourceAllocation;
    fallback: PlannedAction[];
  } {
    const plan = this.generateActionPlan(event, severity, impact);
    const prioritised = this.prioritiseActions(plan.actions);
    const blockedRoads = event.location.district ? [event.location.district] : [];
    const routes = this.generateAlternateRoutes(blockedRoads, event.location.coordinate);
    const resources = this.allocateResources(event, plan);
    const fallback = resources.escalationRequired
      ? this.fallbackScenario(resources.unmetNeeds, event.location.label ?? event.location.city ?? 'Unknown')
      : [];

    return { plan, prioritised, routes, resources, fallback };
  }

  // ── Trace ───────────────────────────────────────────────

  getPlanningTrace(): AgentAction[] { return [...this.traceLog]; }
  clearTrace(): void { this.traceLog = []; }

  private logTrace(method: string, input: Record<string, unknown>, output: Record<string, unknown>, reasoning: string, startMs: number): void {
    this.traceLog.push({
      id: `TRACE-${this.name}-${method}-${Date.now()}`,
      agentName: this.name, input, reasoning, output,
      timestamp: now(), status: 'completed', durationMs: Date.now() - startMs,
    });
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const planningAgent = new PlanningAgent();
