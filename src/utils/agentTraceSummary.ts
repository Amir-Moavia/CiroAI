// ─────────────────────────────────────────────────────────────
// Human-readable one-line summaries per agent trace
// ─────────────────────────────────────────────────────────────

import type { AgentTrace } from '../types';
import type { LiveAgentKey } from '../store/crisisStore';

export function formatAgentTraceSummary(
  agentKey: LiveAgentKey,
  trace: AgentTrace | undefined,
  fallback: string,
): string {
  if (!trace) return fallback;

  switch (agentKey) {
    case 'InputAgent': {
      const ingested = trace.observations.find((o) => o.startsWith('Ingested'));
      const langs = trace.observations.find((o) => o.startsWith('Languages'));
      return [ingested, langs].filter(Boolean).join(' · ') || fallback;
    }
    case 'DetectionAgent': {
      const crisis = trace.observations.find((o) => o.includes('Crisis detected'));
      const anomalies = trace.observations.find((o) => o.startsWith('Found'));
      return crisis ?? anomalies ?? trace.decisions[0] ?? fallback;
    }
    case 'AnalysisAgent': {
      const sev = trace.observations.find((o) => o.startsWith('Severity:'));
      const cascades = trace.observations.find((o) => o.includes('Cascading'));
      return [sev, cascades].filter(Boolean).join(' · ') || fallback;
    }
    case 'PlanningAgent': {
      const gen = trace.observations.find((o) => o.startsWith('Generated'));
      const auth = trace.observations.find((o) => o.includes('Authority'));
      return [gen, auth].filter(Boolean).join(' · ') || fallback;
    }
    case 'SimulationAgent': {
      const disp = trace.observations.find((o) => o.startsWith('Dispatches'));
      const improve = trace.observations.find((o) => o.includes('improvement'));
      return [disp, improve].filter(Boolean).join(' · ') || fallback;
    }
    default:
      return trace.decisions[trace.decisions.length - 1] ?? trace.observations[0] ?? fallback;
  }
}
