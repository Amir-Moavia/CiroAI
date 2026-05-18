// ─────────────────────────────────────────────────────────────
// CrisisAI — Utility: Severity Scorer
// ─────────────────────────────────────────────────────────────

import type { Severity, CrisisSignal } from '../types';

/**
 * Score a set of signals and return a unified severity level.
 *
 * TODO: implement weighted scoring algorithm
 */
export function scoreSeverity(_signals: CrisisSignal[]): Severity {
  // Stub — default to medium
  return 'medium';
}

/**
 * Convert a numeric confidence value (0-1) into a severity label.
 */
export function confidenceToSeverity(confidence: number): Severity {
  if (confidence >= 0.9) return 'critical';
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  if (confidence >= 0.2) return 'low';
  return 'info';
}
