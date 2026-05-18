// ─────────────────────────────────────────────────────────────
// IngestorAgent — Normalises raw multi-source signals
// ─────────────────────────────────────────────────────────────

import type { CrisisSignal } from '../types';

export const IngestorAgent = {
  name: 'IngestorAgent',

  /** Ingest and normalise a raw payload into a CrisisSignal */
  async process(_rawPayload: Record<string, unknown>): Promise<CrisisSignal | null> {
    // TODO: implement ingestion logic
    return null;
  },
};
