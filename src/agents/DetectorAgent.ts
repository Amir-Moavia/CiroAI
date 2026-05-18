// ─────────────────────────────────────────────────────────────
// DetectorAgent — Identifies crisis patterns from signals
// ─────────────────────────────────────────────────────────────

import type { CrisisSignal, CrisisType } from '../types';

export const DetectorAgent = {
  name: 'DetectorAgent',

  /** Detect crisis type from a batch of signals */
  async process(_signals: CrisisSignal[]): Promise<{ type: CrisisType; confidence: number } | null> {
    // TODO: implement detection logic
    return null;
  },
};
