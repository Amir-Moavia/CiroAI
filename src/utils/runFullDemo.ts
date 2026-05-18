// ─────────────────────────────────────────────────────────────
// One-tap hackathon demo runner (~90 seconds)
// ─────────────────────────────────────────────────────────────

import { FULL_DEMO_SIGNALS } from '../data/demoScenarios';
import { fetchSimulatedFeeds } from '../services/feedService';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runFullDemo(
  startPipeline: (inputs: Array<string | Record<string, unknown>>) => Promise<void>,
  clearAll: () => void,
  onProgress?: (msg: string) => void,
): Promise<void> {
  clearAll();
  onProgress?.('Demo started — injecting crisis signals…');

  const feeds = await fetchSimulatedFeeds();
  const allInputs: Array<string | Record<string, unknown>> = [...FULL_DEMO_SIGNALS];

  for (let i = 0; i < Math.min(5, FULL_DEMO_SIGNALS.length); i++) {
    onProgress?.(`Signal ${i + 1}/5: ${FULL_DEMO_SIGNALS[i].slice(0, 50)}…`);
    await delay(2500);
  }

  onProgress?.('Attaching weather, traffic, and grid feeds…');
  allInputs.push(...feeds.rawInputs);

  onProgress?.('Running 5-agent pipeline…');
  await startPipeline(allInputs);
  onProgress?.('Demo complete — check Brief and Map tabs.');
}
