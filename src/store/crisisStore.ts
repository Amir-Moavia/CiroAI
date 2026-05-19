// ─────────────────────────────────────────────────────────────
// CrisisAI — Crisis Store (Zustand)
// ─────────────────────────────────────────────────────────────
// Central state for pipeline execution, crisis events, agent
// traces, and system logs.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import axios from 'axios';
import { APP_CONFIG } from '../constants/config';
import { syncPipelineToMap } from '../utils/pipelineToMap';
import { syncPipelineToAlerts } from '../utils/pipelineToAlerts';
import { useMapStore } from './mapStore';
import { useAlertStore } from './alertStore';
import type {
  CrisisSignal,
  CrisisEvent,
  PipelineResult,
  PipelineTrace,
  LogEntry,
} from '../types';

// Lazy-import orchestrator to avoid circular deps at module load
function getOrchestrator() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../agents/orchestrator').orchestrator as import('../agents/orchestrator').AgentOrchestrator;
}

// ── Types ───────────────────────────────────────────────────

type PipelineStatus = 'idle' | 'running' | 'complete' | 'error';

export type LiveAgentKey =
  | 'InputAgent'
  | 'DetectionAgent'
  | 'AnalysisAgent'
  | 'PlanningAgent'
  | 'SimulationAgent';

export interface LiveAgentStep {
  key: LiveAgentKey;
  name: string;
  emoji: string;
  status: 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';
  message: string;
}

const INITIAL_LIVE_STEPS: LiveAgentStep[] = [
  { key: 'InputAgent', name: 'Input Agent', emoji: '📥', status: 'waiting', message: 'Waiting…' },
  { key: 'DetectionAgent', name: 'Detection Agent', emoji: '🔍', status: 'waiting', message: 'Waiting…' },
  { key: 'AnalysisAgent', name: 'Analysis Agent', emoji: '📊', status: 'waiting', message: 'Waiting…' },
  { key: 'PlanningAgent', name: 'Planning Agent', emoji: '📋', status: 'waiting', message: 'Waiting…' },
  { key: 'SimulationAgent', name: 'Simulation Agent', emoji: '▶️', status: 'waiting', message: 'Waiting…' },
];

function applyLiveUpdate(
  steps: LiveAgentStep[],
  agentName: string,
  status: 'started' | 'completed' | 'failed' | 'skipped',
  message: string,
): LiveAgentStep[] {
  const idx = steps.findIndex((s) => s.key === agentName);
  if (idx < 0) return steps;
  const next = [...steps];
  if (status === 'started') {
    next[idx] = { ...next[idx], status: 'running', message };
    for (let i = idx + 1; i < next.length; i++) {
      if (next[i].status === 'waiting') {
        next[i] = { ...next[i], message: 'Waiting…' };
      }
    }
  } else if (status === 'completed') {
    next[idx] = { ...next[idx], status: 'completed', message };
  } else if (status === 'failed') {
    next[idx] = { ...next[idx], status: 'failed', message };
  } else {
    next[idx] = { ...next[idx], status: 'skipped', message };
  }
  return next;
}

interface CrisisState {
  // Data
  signals: CrisisSignal[];
  activeCrises: CrisisEvent[];
  currentPipeline: PipelineResult | null;
  pipelineStatus: PipelineStatus;
  agentTraces: PipelineTrace[];
  systemLogs: LogEntry[];
  liveAgentSteps: LiveAgentStep[];
  mapsApiStatus: string | null;

  // Actions
  startPipeline: (inputs: Array<string | Record<string, unknown>>) => Promise<void>;
  addSignal: (signal: CrisisSignal) => void;
  updateCrisisStatus: (id: string, status: CrisisEvent['status']) => void;
  addSystemLog: (log: LogEntry) => void;
  clearAll: () => void;
  lastBriefAt: string | null;
  checkMapsApi: () => Promise<void>;
}

function applyPipelineSideEffects(result: PipelineResult): void {
  const map = useMapStore.getState();
  syncPipelineToMap(result, map.setMarkers, map.setRoutes, map.setRegion);
  syncPipelineToAlerts(result);
}

// ── Helper ──────────────────────────────────────────────────

function makeLog(msg: string, level: LogEntry['level'] = 'INFO'): LogEntry {
  return {
    timestamp: new Date().toLocaleTimeString('en-PK', { hour12: false }),
    level,
    agent: 'CrisisStore',
    message: msg,
  };
}

// ── Store ───────────────────────────────────────────────────

export const useCrisisStore = create<CrisisState>((set) => ({
  // Initial state
  signals: [],
  activeCrises: [],
  currentPipeline: null,
  pipelineStatus: 'idle',
  agentTraces: [],
  systemLogs: [],
  lastBriefAt: null,
  liveAgentSteps: INITIAL_LIVE_STEPS.map((s) => ({ ...s })),
  mapsApiStatus: null,

  checkMapsApi: async () => {
    const { testGoogleMapsApiKey } = await import('../services/geocodingService');
    const result = await testGoogleMapsApiKey();
    const msg = result.ok
      ? '✓ Maps: static locations + Google Geocoding OK'
      : `⚠ Maps: using offline coordinates — ${result.message}`;
    set({ mapsApiStatus: msg });
    set((s) => ({ systemLogs: [...s.systemLogs, makeLog(msg, result.ok ? 'SUCCESS' : 'WARN')] }));
  },

  // ── startPipeline ─────────────────────────────────
  startPipeline: async (inputs) => {
    set({
      pipelineStatus: 'running',
      currentPipeline: null,
      liveAgentSteps: INITIAL_LIVE_STEPS.map((s) => ({ ...s })),
      activeCrises: [],
    });
    set((s) => ({ systemLogs: [...s.systemLogs, makeLog(`Pipeline started. Processing ${inputs.length} inputs...`)] }));

    if (APP_CONFIG.useRemoteBackend) {
      try {
        set((s) => ({ systemLogs: [...s.systemLogs, makeLog('Routing request to remote FastAPI backend...', 'INFO')] }));
        
        const response = await axios.post<PipelineResult>(`${APP_CONFIG.apiBaseUrl}/pipeline/run`, {
          inputs,
        });

        const result = response.data;
        const newCrises: CrisisEvent[] = [];
        if (result.crisisEvent) {
          newCrises.push({ ...result.crisisEvent, createdAt: new Date().toISOString() });
        }
        const simLogs = result.simulation?.logs ?? [];

        set((s) => ({
          currentPipeline: result,
          pipelineStatus: result.status === 'COMPLETED' || result.status === 'NO_CRISIS_DETECTED' ? 'complete' : 'error',
          activeCrises: [...s.activeCrises, ...newCrises],
          signals: [...s.signals, ...result.signals],
          agentTraces: [...s.agentTraces, result.trace],
          systemLogs: [...s.systemLogs, ...simLogs],
          lastBriefAt: new Date().toISOString(),
        }));
        applyPipelineSideEffects(result);

        set((s) => ({ systemLogs: [...s.systemLogs, makeLog(`Pipeline completed via remote API backend. Status: ${result.status}`, 'SUCCESS')] }));
      } catch (err) {
        set({ pipelineStatus: 'error' });
        set((s) => ({ systemLogs: [...s.systemLogs, makeLog(`Remote API request FAILED: ${(err as Error).message}`, 'ERROR')] }));
      }
    } else {
      try {
        const orch = getOrchestrator();

        // Subscribe to live updates → push to systemLogs
        const unsub = orch.subscribeToUpdates((update) => {
          const level: LogEntry['level'] = update.status === 'failed' ? 'ERROR' : update.status === 'completed' ? 'SUCCESS' : 'INFO';
          set((s) => ({
            systemLogs: [...s.systemLogs, makeLog(`[${update.agentName}] ${update.message}`, level)],
            liveAgentSteps: applyLiveUpdate(
              s.liveAgentSteps,
              update.agentName,
              update.status === 'started' ? 'started' : update.status === 'failed' ? 'failed' : 'completed',
              update.message,
            ),
          }));
        });

        const result = await orch.runPipeline(inputs);

        unsub();

        if (result.status === 'NO_CRISIS_DETECTED') {
          set((s) => ({
            liveAgentSteps: s.liveAgentSteps.map((step) =>
              step.status === 'waiting' || step.status === 'running'
                ? { ...step, status: 'skipped' as const, message: 'No crisis correlated — pipeline stopped' }
                : step,
            ),
          }));
        }

        // Extract crises
        const newCrises: CrisisEvent[] = [];
        if (result.crisisEvent) {
          newCrises.push({ ...result.crisisEvent, createdAt: new Date().toISOString() });
        }

        // Extract simulation logs
        const simLogs = result.simulation?.logs ?? [];

        set((s) => ({
          currentPipeline: result,
          pipelineStatus: result.status === 'COMPLETED' || result.status === 'NO_CRISIS_DETECTED' ? 'complete' : 'error',
          activeCrises: [...s.activeCrises, ...newCrises],
          signals: [...s.signals, ...result.signals],
          agentTraces: [...s.agentTraces, result.trace],
          systemLogs: [...s.systemLogs, ...simLogs],
          lastBriefAt: new Date().toISOString(),
        }));
        applyPipelineSideEffects(result);

        set((s) => ({ systemLogs: [...s.systemLogs, makeLog(`Pipeline ${result.status}. ${result.signals.length} signals processed. Map synced.`, 'SUCCESS')] }));
      } catch (err) {
        set({ pipelineStatus: 'error' });
        set((s) => ({ systemLogs: [...s.systemLogs, makeLog(`Pipeline FAILED: ${(err as Error).message}`, 'ERROR')] }));
      }
    }
  },

  // ── addSignal ─────────────────────────────────────
  addSignal: (signal) => {
    set((s) => ({
      signals: [...s.signals, signal],
      systemLogs: [...s.systemLogs, makeLog(`Signal added: ${signal.id} (${signal.type}, ${signal.severity})`)],
    }));
  },

  // ── updateCrisisStatus ────────────────────────────
  updateCrisisStatus: (id, status) => {
    set((s) => ({
      activeCrises: s.activeCrises.map((c) =>
        c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c
      ),
      systemLogs: [...s.systemLogs, makeLog(`Crisis ${id} status → ${status}`)],
    }));
  },

  // ── addSystemLog ──────────────────────────────────
  addSystemLog: (log) => {
    set((s) => ({ systemLogs: [...s.systemLogs, log] }));
  },

  // ── clearAll ──────────────────────────────────────
  clearAll: () => {
    try { getOrchestrator().clearAllTraces(); } catch { /* orchestrator may not be loaded */ }
    set({
      signals: [],
      activeCrises: [],
      currentPipeline: null,
      pipelineStatus: 'idle',
      agentTraces: [],
      systemLogs: [makeLog('All state cleared.')],
      lastBriefAt: null,
      liveAgentSteps: INITIAL_LIVE_STEPS.map((s) => ({ ...s })),
    });
    useMapStore.getState().clearMap();
    useAlertStore.getState().clearAlerts();
  },
}));
