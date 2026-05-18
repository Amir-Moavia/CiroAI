// ─────────────────────────────────────────────────────────────
// CrisisAI — Alert Store (Zustand)
// ─────────────────────────────────────────────────────────────
// Manages citizen-facing alerts, read/unread state, and
// simulated SMS metrics.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type {
  Alert as CrisisAlert,
  Severity,
  CrisisType,
  LogEntry,
} from '../types';

// ── Types ───────────────────────────────────────────────────

interface AlertState {
  alerts: CrisisAlert[];
  unreadCount: number;
  simulatedSMSCount: number;
  sideEffectLog: LogEntry[];

  // Actions
  addAlert: (alert: CrisisAlert) => void;
  addAlertFromCrisis: (params: {
    title: string;
    message: string;
    severity: Severity;
    crisisType: CrisisType;
    location: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addSimulatedSMS: (count: number) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

// ── Helper ──────────────────────────────────────────────────

function makeLog(msg: string, level: LogEntry['level'] = 'INFO'): LogEntry {
  return {
    timestamp: new Date().toLocaleTimeString('en-PK', { hour12: false }),
    level,
    agent: 'AlertStore',
    message: msg,
  };
}

// ── Store ───────────────────────────────────────────────────

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  simulatedSMSCount: 0,
  sideEffectLog: [],

  addAlert: (alert) => {
    set((s) => ({
      alerts: [alert, ...s.alerts],
      unreadCount: s.unreadCount + (alert.read ? 0 : 1),
      sideEffectLog: [...s.sideEffectLog, makeLog(`Alert added: "${alert.title}" (${alert.severity})`)],
    }));
  },

  addAlertFromCrisis: ({ title, message, severity, crisisType, location }) => {
    const alert: CrisisAlert = {
      id: `ALERT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      severity,
      crisisType,
      location,
      timestamp: new Date().toISOString(),
      read: false,
    };
    get().addAlert(alert);
  },

  markAsRead: (id) => {
    const found = get().alerts.find((a) => a.id === id);
    if (found && !found.read) {
      set((s) => ({
        alerts: s.alerts.map((a) => a.id === id ? { ...a, read: true } : a),
        unreadCount: Math.max(0, s.unreadCount - 1),
        sideEffectLog: [...s.sideEffectLog, makeLog(`Alert ${id} marked as read`)],
      }));
    }
  },

  markAllAsRead: () => {
    set((s) => ({
      alerts: s.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
      sideEffectLog: [...s.sideEffectLog, makeLog(`All ${s.alerts.length} alerts marked as read`)],
    }));
  },

  addSimulatedSMS: (count) => {
    set((s) => ({
      simulatedSMSCount: s.simulatedSMSCount + count,
      sideEffectLog: [...s.sideEffectLog, makeLog(`Simulated SMS: +${count.toLocaleString()} (total: ${(s.simulatedSMSCount + count).toLocaleString()})`, 'SUCCESS')],
    }));
  },

  removeAlert: (id) => {
    const found = get().alerts.find((a) => a.id === id);
    set((s) => ({
      alerts: s.alerts.filter((a) => a.id !== id),
      unreadCount: found && !found.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      sideEffectLog: [...s.sideEffectLog, makeLog(`Alert ${id} removed`)],
    }));
  },

  clearAlerts: () => {
    set({
      alerts: [],
      unreadCount: 0,
      simulatedSMSCount: 0,
      sideEffectLog: [makeLog('All alerts cleared')],
    });
  },
}));
