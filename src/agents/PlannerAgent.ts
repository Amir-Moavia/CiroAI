// ─────────────────────────────────────────────────────────────
// PlannerAgent — Generates response action plans
// ─────────────────────────────────────────────────────────────

import type { CrisisEvent } from '../types';

export const PlannerAgent = {
  name: 'PlannerAgent',

  /** Generate a list of recommended actions for a crisis event */
  async process(_event: CrisisEvent): Promise<string[] | null> {
    // TODO: implement planning logic
    return null;
  },
};
