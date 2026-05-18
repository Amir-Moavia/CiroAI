// ─────────────────────────────────────────────────────────────
// CrisisAI — TypeScript Interfaces
// ─────────────────────────────────────────────────────────────

/** Geographic coordinate */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** Location with optional human-readable metadata */
export interface Location {
  coordinate: Coordinate;
  city?: string;
  district?: string;
  province?: string;
  label?: string;
}

/** Severity levels used across the system */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Source of a crisis signal */
export type SignalSource =
  | 'twitter'
  | 'news'
  | 'sensor'
  | 'government'
  | 'citizen_report'
  | 'weather_api'
  | 'traffic_api'
  | 'utility_api'
  | 'grid_sensor'
  | 'citizen_cluster'
  | 'simulated';

/** Type of crisis detected */
export type CrisisType =
  | 'flood'
  | 'earthquake'
  | 'heatwave'
  | 'terrorist_attack'
  | 'disease_outbreak'
  | 'infrastructure_failure'
  | 'power_outage'
  | 'water_crisis'
  | 'road_damage'
  | 'multi_crisis'
  | 'protest'
  | 'fire'
  | 'unknown';

/** Status of an agent action */
export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed';

// ── Core Domain Models ──────────────────────────────────────

/**
 * A raw signal ingested from any source.
 * Represents a single piece of evidence about a potential crisis.
 */
export interface CrisisSignal {
  id: string;
  source: SignalSource;
  text: string;
  location: Location;
  timestamp: string; // ISO-8601
  type: CrisisType;
  severity: Severity;
  language?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * An aggregated crisis event produced by the detection/analysis pipeline.
 * Groups multiple signals into a unified situational picture.
 */
export interface CrisisEvent {
  id: string;
  signals: CrisisSignal[];
  detectedType: CrisisType;
  severity: Severity;
  confidence: number; // 0 – 1
  location: Location;
  impacts: string[];
  actions: string[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'monitoring' | 'resolved';
}

/**
 * Tracks an individual action taken by one of the AI agents.
 */
export interface AgentAction {
  id: string;
  agentName: string;
  input: Record<string, unknown>;
  reasoning: string;
  output: Record<string, unknown>;
  timestamp: string;
  status: ActionStatus;
  durationMs?: number;
}

/**
 * Result of running a simulation scenario.
 */
export interface SimulationResult {
  before: CrisisEvent;
  after: CrisisEvent;
  actionsExecuted: AgentAction[];
  ticketId: string;
  outcome: 'mitigated' | 'escalated' | 'unchanged' | 'pending';
}

/**
 * Marker rendered on the live crisis map.
 */
export interface MapMarker {
  id: string;
  coordinate: Coordinate;
  type: CrisisType;
  severity: Severity;
  label: string;
}

/** A polyline representing a route on the map (blocked or alternate) */
export interface RoutePolyline {
  id: string;
  coordinates: Coordinate[];
  color: string;
  label: string;
  type: 'blocked' | 'alternate' | 'dispatch';
}

/** Map region (camera viewport) */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Alert for the alerts screen */
export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  crisisType: CrisisType;
  location: string;
  timestamp: string;
  read: boolean;
}

// ── Detection Agent Types ───────────────────────────────────

/** Anomaly type identified by the DetectionAgent */
export type AnomalyType =
  | 'cluster'           // 3+ same-type signals in same area within window
  | 'threshold_breach'  // sensor value crosses critical level
  | 'contradiction'     // conflicting signals from same area
  | 'citizen_override'  // citizens report crisis, sensor says OK
  | 'location_unknown'; // signal has no usable location

/** Report produced for each detected anomaly */
export interface AnomalyReport {
  id: string;
  anomalyType: AnomalyType;
  signals: CrisisSignal[];
  area: string;
  crisisType: CrisisType;
  confidence: number;           // 0–100
  description: string;
  flags: string[];
  detectedAt: string;
}

/** Verification status of a correlated event */
export type VerificationStatus =
  | 'CONFIRMED'
  | 'UNCONFIRMED'
  | 'CONFLICTED'
  | 'UNCERTAIN';

/** A correlated event linking multiple signal sources */
export interface CorrelatedEvent {
  id: string;
  anomalies: AnomalyReport[];
  signals: CrisisSignal[];
  sourceTypes: SignalSource[];
  crisisType: CrisisType;
  correlationScore: number;     // 0–1
  verification: VerificationStatus;
  location: Location;
  reasoning: string;
  timestamp: string;
}

/** Final crisis classification output */
export interface CrisisClassification {
  type: CrisisType;
  severity: Severity;
  confidence: number;           // 0–1
  affectedArea: string;
  estimatedImpactRadiusKm: number;
  verification: VerificationStatus;
  flags: string[];
  reasoning: string;
}

// ── Analysis Agent Types ────────────────────────────────────

/** Severity analysis output from AnalysisAgent */
export interface SeverityAnalysis {
  score: number;                // 0–100
  level: Severity;
  breakdown: {
    signalStrength: number;     // 0–25
    typeCriticality: number;    // 0–30
    populationDensity: number;  // 0–20
    timeOfDay: number;          // 0–15
    infrastructure: number;     // 0–10
  };
  explanation: string;
}

/** A single cascading effect inferred by the AnalysisAgent */
export interface CascadeEffect {
  trigger: string;
  effect: string;
  timeframeMinutes: number;
  riskLevel: Severity;
  category: string;
}

/** Full impact analysis output */
export interface ImpactAnalysis {
  directEffects: {
    trafficDisruption: { percentBlocked: number; alternateRoutes: number; description: string };
    economicDisruption: { businessesAffected: number; description: string };
    safetyRisk: { vulnerablePopulations: string[]; riskLevel: Severity; description: string };
    communicationImpact: { affected: boolean; description: string };
  };
  cascadingEffects: CascadeEffect[];
  estimatedAffectedPopulation: number;
  estimatedRecoveryHours: number;
  reasoning: string;
}

/** Baseline comparison: agentic vs non-agentic */
export interface BaselineComparison {
  simpleSystem: string;
  agenticSystem: string;
  improvementFactors: string[];
}

// ── Planning Agent Types ────────────────────────────────────

export type ActionCategory = 'LIFE_SAFETY' | 'INFRASTRUCTURE' | 'TRAFFIC' | 'PUBLIC_INFO' | 'RESOURCE' | 'ESCALATION';
export type ActionTarget = 'AUTHORITY' | 'CITIZEN' | 'SYSTEM';
export type TeamType = 'electrical_repair' | 'road_crew' | 'emergency_medical' | 'traffic_police' | 'flood_rescue' | 'civil_defence' | 'fire_brigade';

export interface PlannedAction {
  id: string;
  category: ActionCategory;
  target: ActionTarget;
  priority: number;             // 1 = highest
  action: string;               // human-readable action command
  location: string;
  eta: string | null;
  reasoning: string;
  assignedTeam: TeamType | null;
  status: 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'failed';
}

export interface ActionPlan {
  id: string;
  eventId: string;
  actions: PlannedAction[];
  authorityActions: PlannedAction[];
  citizenActions: PlannedAction[];
  reasoning: string;
  createdAt: string;
}

export interface PrioritisedPlan {
  ranked: PlannedAction[];
  reasoning: string;
}

export interface RouteAlternative {
  routeName: string;
  estimatedExtraMinutes: number;
  congestionLevel: 'FREE_FLOW' | 'LIGHT' | 'MODERATE' | 'HEAVY';
  coordinates: Coordinate[];
  description: string;
}

export interface ResourceAllocation {
  allocations: Array<{ team: TeamType; actionId: string; available: boolean; fallback: TeamType | null }>;
  unmetNeeds: string[];
  escalationRequired: boolean;
  reasoning: string;
}

// ── Simulation Agent Types ──────────────────────────────────

export type TicketStatus = 'ACTIVE' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'DELAYED' | 'COMPLETED' | 'FAILED';

export interface DispatchTicket {
  ticketId: string;
  team: TeamType;
  status: TicketStatus;
  eta: number;
  location: string;
  coordinatePath: Coordinate[];
  failureReason: string | null;
}

export interface AlertResult {
  channel: 'SMS' | 'APP_NOTIFICATION' | 'BROADCAST';
  recipients: number;
  sent: number;
  failed: number;
  message: string;
}

export interface RerouteResult {
  beforeCongestion: number;
  afterCongestion: number;
  blockedRoads: string[];
  activatedRoutes: string[];
  mapMarkers: Coordinate[];
}

export interface StateSnapshot {
  congestionPercent: number;
  emergencyResponseStatus: string;
  affectedWithAssistance: number;
  infrastructureStatus: string;
  alertCoverage: number;
  accidentProbability: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface OutcomeMetric {
  metric: string;
  before: string;
  after: string;
  improvement: string;
}

export interface OutcomeReport {
  metrics: OutcomeMetric[];
  overallImprovement: number;
  summary: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  agent: string;
  message: string;
}

export interface SimulationOutput {
  tickets: DispatchTicket[];
  alerts: AlertResult[];
  reroutes: RerouteResult[];
  logs: LogEntry[];
  outcome: OutcomeReport;
  edgeCaseDemo: LogEntry[];
  agenticComparison: { simple: string; agentic: string };
}

// ── Agent Pipeline Types ────────────────────────────────────

/** Configuration passed to each agent */
export interface AgentConfig {
  name: string;
  enabled: boolean;
  timeout: number;
}

/** Pipeline stage result wrapper */
export interface PipelineStageResult<T = unknown> {
  agentName: string;
  success: boolean;
  data: T | null;
  error?: string;
  timestamp: string;
}

// ── Orchestrator Types ──────────────────────────────────────

export type PipelineStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'NO_CRISIS_DETECTED';

export interface PipelineUpdate {
  step: number;
  totalSteps: number;
  agentName: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface AgentTrace {
  agentName: string;
  startTime: string;
  endTime: string;
  inputSummary: string;
  observations: string[];
  reasoning: string[];
  decisions: string[];
  outputs: Record<string, unknown>[];
  status: 'completed' | 'failed' | 'skipped';
}

export interface PipelineTrace {
  pipelineId: string;
  startTime: string;
  endTime: string;
  status: PipelineStatus;
  agents: AgentTrace[];
  totalDurationMs: number;
}

export interface PipelineResult {
  pipelineId: string;
  status: PipelineStatus;
  signals: CrisisSignal[];
  anomalies: AnomalyReport[];
  correlatedEvent: CorrelatedEvent | null;
  crisisEvent: CrisisEvent | null;
  severity: SeverityAnalysis | null;
  impact: ImpactAnalysis | null;
  explanation: string | null;
  plan: ActionPlan | null;
  simulation: SimulationOutput | null;
  trace: PipelineTrace;
  timestamp: string;
  /** Gemini Google Search grounding summary (when available) */
  searchContext?: {
    summary: string;
    queries: string[];
    sources: string[];
  } | null;
}

export interface ComparisonResult {
  agenticResult: PipelineResult;
  heuristicResult: {
    detectedType: string;
    severity: string;
    actions: string[];
    explanation: string;
  };
  improvements: string[];
  summary: string;
}
