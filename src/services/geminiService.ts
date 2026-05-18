// ─────────────────────────────────────────────────────────────
// Gemini — LLM analysis (fallback; multi-key rotation on quota)
// ─────────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';
import { APP_CONFIG } from '../constants/config';
import { ApiKeyPool, isQuotaOrRateLimitError } from '../utils/apiKeyPool';
import { buildCrisisAnalysisPrompt } from '../utils/llmAnalysisPrompt';
import type { CrisisEvent, CrisisSignal, CrisisType, Severity } from '../types';

export interface GeminiCrisisAnalysis {
  detectedType: CrisisType;
  severity: Severity;
  confidence: number;
  locationLabel: string;
  directEffects: string[];
  secondaryEffects: string[];
  explanation: string;
  recommendedActionsAuthorities: string[];
  recommendedActionsCitizens: string[];
}

const geminiPool = new ApiKeyPool(APP_CONFIG.geminiApiKeys);

export function isGeminiAvailable(): boolean {
  return geminiPool.hasKeys();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function generateWithKey(key: string, prompt: string, jsonMode: boolean): Promise<string> {
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

export async function normalizeUrduRoman(text: string): Promise<string> {
  const out = await geminiPool.tryEach(async (key) => {
    const result = await withTimeout(
      generateWithKey(
        key,
        `Translate this Pakistan Urdu-Roman crisis report to clear English (one sentence). Keep location names:\n"${text}"`,
        false,
      ),
      10_000,
    );
    if (!result) throw new Error('Gemini timeout');
    return result;
  });
  return out?.result ?? text;
}

export async function analyzeCrisisContext(
  event: CrisisEvent,
  signals: CrisisSignal[],
  feedSummary?: string,
  searchSummary?: string,
): Promise<GeminiCrisisAnalysis | null> {
  const signalTexts = signals.map((s) => `[${s.source}] ${s.text}`).join('\n');
  const prompt = buildCrisisAnalysisPrompt(
    signalTexts,
    event.location.label ?? event.location.district ?? 'Islamabad area',
    event.detectedType,
    feedSummary,
    searchSummary,
  );

  const out = await geminiPool.tryEach(async (key) => {
    const raw = await withTimeout(generateWithKey(key, prompt, true), 12_000);
    if (!raw) throw new Error('Gemini timeout');
    try {
      const parsed = JSON.parse(raw) as GeminiCrisisAnalysis;
      const c = Number(parsed.confidence);
      if (Number.isFinite(c)) {
        parsed.confidence = Math.min(0.95, Math.max(0.2, c));
      }
      return parsed;
    } catch {
      throw new Error('Invalid Gemini JSON');
    }
  }, (err) => {
    const msg = (err as Error)?.message ?? '';
    return isQuotaOrRateLimitError(msg) || msg.includes('timeout');
  });

  if (out) {
    console.log('[GeminiService] Analysis OK (rotated key pool)');
  }
  return out?.result ?? null;
}
