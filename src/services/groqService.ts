// ─────────────────────────────────────────────────────────────
// Groq — OpenAI-compatible LLM (primary when Gemini quota is hit)
// ─────────────────────────────────────────────────────────────

import { APP_CONFIG } from '../constants/config';
import { ApiKeyPool, isQuotaOrRateLimitError } from '../utils/apiKeyPool';
import { buildCrisisAnalysisPrompt } from '../utils/llmAnalysisPrompt';
import type { GeminiCrisisAnalysis } from './geminiService';
import type { CrisisEvent, CrisisSignal } from '../types';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const groqPool = new ApiKeyPool(APP_CONFIG.groqApiKeys);

export function isGroqAvailable(): boolean {
  return groqPool.hasKeys();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function groqChat(key: string, userPrompt: string, jsonMode = false): Promise<string | null> {
  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 1024,
    temperature: 0.2,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `Groq HTTP ${res.status}`;
    if (isQuotaOrRateLimitError(msg)) throw new Error(msg);
    throw new Error(msg);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

export async function normalizeUrduRomanGroq(text: string): Promise<string | null> {
  const out = await groqPool.tryEach(async (key) => {
    const result = await withTimeout(
      groqChat(
        key,
        `Translate this Pakistan Urdu-Roman crisis report to clear English (one sentence). Keep location names:\n"${text}"`,
      ),
      10_000,
    );
    if (!result) throw new Error('Groq timeout');
    return result;
  });
  return out?.result ?? null;
}

export async function analyzeCrisisContextGroq(
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

  const out = await groqPool.tryEach(async (key) => {
    const raw = await withTimeout(groqChat(key, prompt, true), 14_000);
    if (!raw) throw new Error('Groq timeout');
    const parsed = JSON.parse(raw) as GeminiCrisisAnalysis;
    const c = Number(parsed.confidence);
    if (Number.isFinite(c)) {
      parsed.confidence = Math.min(0.95, Math.max(0.2, c));
    }
    return parsed;
  });

  if (out) {
    console.log('[GroqService] Analysis OK (key rotated pool)');
  }
  return out?.result ?? null;
}
