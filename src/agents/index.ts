// ─────────────────────────────────────────────────────────────
// CrisisAI — Agent Barrel Exports
// ─────────────────────────────────────────────────────────────

// Agent 1 — Input / Ingestion
export { InputAgent, inputAgent } from './inputAgent';

// Agent 2 — Detection / Anomaly Correlation
export { DetectionAgent, detectionAgent } from './detectionAgent';

// Agent 3 — Deep Situational Analysis
export { AnalysisAgent, analysisAgent } from './analysisAgent';

// Agent 4 — Coordinated Action Planning
export { PlanningAgent, planningAgent } from './planningAgent';

// Agent 5 — Execution Simulation & Outcomes
export { SimulationAgent, simulationAgent } from './simulationAgent';

// Orchestrator — Pipeline Brain
export { AgentOrchestrator, orchestrator } from './orchestrator';

// Legacy stubs (kept for backward compatibility)
export { IngestorAgent } from './IngestorAgent';
export { DetectorAgent } from './DetectorAgent';
export { AnalystAgent } from './AnalystAgent';
export { PlannerAgent } from './PlannerAgent';
export { ExecutorAgent } from './ExecutorAgent';
