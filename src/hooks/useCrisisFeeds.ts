// ─────────────────────────────────────────────────────────────
// Live feed polling — simulated near-real-time monitoring
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { APP_CONFIG } from '../constants/config';
import { fetchSimulatedFeeds } from '../services/feedService';
import { useCrisisStore } from '../store/crisisStore';
import { useMapStore } from '../store/mapStore';
import { inputAgent } from '../agents/inputAgent';

export function useCrisisFeeds(enabled: boolean): void {
  const pipelineStatus = useCrisisStore((s) => s.pipelineStatus);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!enabled || pipelineStatus === 'running') return;

    const interval = setInterval(async () => {
      tickRef.current += 1;
      const feeds = await fetchSimulatedFeeds();
      const raw = feeds.rawInputs[tickRef.current % feeds.rawInputs.length];
      const signal = inputAgent.ingest(raw);

      useCrisisStore.getState().addSignal(signal);
      useCrisisStore.getState().addSystemLog({
        timestamp: new Date().toLocaleTimeString('en-PK', { hour12: false }),
        level: 'INFO',
        agent: 'FeedService',
        message: `[LIVE] ${raw.text as string}`,
      });

      const map = useMapStore.getState();
      map.setMarkers([
        ...map.markers,
        {
          id: signal.id,
          coordinate: signal.location.coordinate,
          type: signal.type,
          severity: signal.severity,
          label: signal.location.label ?? 'Live feed',
        },
      ]);
    }, APP_CONFIG.refreshIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, pipelineStatus]);
}
