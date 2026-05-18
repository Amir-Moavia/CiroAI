// ─────────────────────────────────────────────────────────────
// AnalystAgent — Assesses severity and impact
// ─────────────────────────────────────────────────────────────

import type { CrisisEvent, Severity } from '../types';

export const AnalystAgent = {
  name: 'AnalystAgent',

  /** Analyse a crisis event and assign severity + impacts */
  async process(_event: Partial<CrisisEvent>): Promise<{ severity: Severity; impacts: string[] } | null> {
    // TODO: implement analysis logic
    return null;
  },
};
