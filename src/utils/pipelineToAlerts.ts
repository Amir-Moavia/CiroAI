// ─────────────────────────────────────────────────────────────
// Pipeline → Alerts sync
// ─────────────────────────────────────────────────────────────

import { useAlertStore } from '../store/alertStore';
import type { PipelineResult } from '../types';

const CRISIS_TITLES: Record<string, string> = {
  power_outage: 'Power Grid Alert',
  flood: 'Flood Warning',
  road_damage: 'Road / Bridge Alert',
  water_crisis: 'Water Supply Alert',
  multi_crisis: 'Multi-Crisis Alert',
  infrastructure_failure: 'Infrastructure Alert',
  fire: 'Fire Emergency',
  unknown: 'Crisis Alert',
};

export function syncPipelineToAlerts(result: PipelineResult): void {
  const store = useAlertStore.getState();
  const event = result.crisisEvent;

  if (result.status === 'NO_CRISIS_DETECTED') {
    store.addAlertFromCrisis({
      title: 'Monitoring — No crisis confirmed',
      message: 'Signals reviewed; threshold not met. System remains on watch.',
      severity: 'info',
      crisisType: 'unknown',
      location: 'Islamabad metro',
    });
    return;
  }

  if (!event) return;

  const location =
    event.location.label ?? event.location.district ?? event.location.city ?? 'Islamabad area';
  const title = CRISIS_TITLES[event.detectedType] ?? 'Crisis Alert';

  store.addAlertFromCrisis({
    title: `${title} — ${location}`,
    message:
      result.explanation?.slice(0, 280) ??
      `Crisis detected (${event.detectedType}). ${event.signals.length} confirming signal(s). Confidence ${Math.round(event.confidence * 100)}%.`,
    severity: event.severity,
    crisisType: event.detectedType,
    location,
  });

  if (result.plan) {
    const topAuthority = result.plan.authorityActions[0];
    if (topAuthority) {
      store.addAlertFromCrisis({
        title: 'Authority action required',
        message: topAuthority.action,
        severity: event.severity,
        crisisType: event.detectedType,
        location: topAuthority.location || location,
      });
    }
    const topCitizen = result.plan.citizenActions[0];
    if (topCitizen) {
      store.addAlertFromCrisis({
        title: 'Public safety advisory',
        message: topCitizen.action,
        severity: event.severity === 'critical' ? 'high' : event.severity,
        crisisType: event.detectedType,
        location,
      });
    }
  }

  const sim = result.simulation;
  if (!sim) return;

  for (const alertResult of sim.alerts) {
    if (alertResult.sent > 0) {
      store.addAlertFromCrisis({
        title: `${alertResult.channel} broadcast`,
        message: alertResult.message,
        severity: event.severity,
        crisisType: event.detectedType,
        location,
      });
      store.addSimulatedSMS(alertResult.sent);
    }
  }
}
