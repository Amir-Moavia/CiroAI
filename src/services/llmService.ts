// ─────────────────────────────────────────────────────────────
// Unified LLM — Groq (primary) + Gemini (fallback), multi-key rotation
// ─────────────────────────────────────────────────────────────

import { APP_CONFIG } from '../constants/config';
import {
  analyzeCrisisContext as analyzeGemini,
  normalizeUrduRoman as normalizeGemini,
  isGeminiAvailable,
  type GeminiCrisisAnalysis,
} from './geminiService';
import {
  fetchCrisisSearchGrounding,
  isSearchGroundingAvailable,
  type SearchGroundingResult,
} from './geminiSearchService';
import {
  analyzeCrisisContextGroq,
  normalizeUrduRomanGroq,
  isGroqAvailable,
} from './groqService';
import type { CrisisEvent, CrisisSignal } from '../types';

export type { GeminiCrisisAnalysis };
export type { SearchGroundingResult };
export { fetchCrisisSearchGrounding, isSearchGroundingAvailable };

export type LlmProvider = 'groq' | 'gemini' | 'none';

let lastProvider: LlmProvider = 'none';

export function getLastLlmProvider(): LlmProvider {
  return lastProvider;
}

export function isLlmAvailable(): boolean {
  return isGroqAvailable() || isGeminiAvailable();
}

export function getLlmStatusLabel(): string {
  const parts: string[] = [];
  if (APP_CONFIG.groqApiKeys.length > 0) {
    parts.push(`Groq ×${APP_CONFIG.groqApiKeys.length}`);
  }
  if (APP_CONFIG.geminiApiKeys.length > 0) {
    parts.push(`Gemini ×${APP_CONFIG.geminiApiKeys.length}`);
  }
  return parts.length > 0 ? parts.join(' + ') : 'No LLM keys';
}

export async function normalizeUrduRoman(text: string): Promise<string> {
  if (isGroqAvailable()) {
    const groq = await normalizeUrduRomanGroq(text);
    if (groq) {
      lastProvider = 'groq';
      return groq;
    }
  }
  if (isGeminiAvailable()) {
    const gemini = await normalizeGemini(text);
    if (gemini !== text) {
      lastProvider = 'gemini';
      return gemini;
    }
  }
  return text;
}

export async function analyzeCrisisContext(
  event: CrisisEvent,
  signals: CrisisSignal[],
  feedSummary?: string,
  searchSummary?: string,
): Promise<GeminiCrisisAnalysis | null> {
  if (isGroqAvailable()) {
    const groq = await analyzeCrisisContextGroq(event, signals, feedSummary, searchSummary);
    if (groq) {
      lastProvider = 'groq';
      return groq;
    }
  }

  if (isGeminiAvailable()) {
    const gemini = await analyzeGemini(event, signals, feedSummary, searchSummary);
    if (gemini) {
      lastProvider = 'gemini';
      return gemini;
    }
  }

  lastProvider = 'none';
  return null;
}

/** Quick health check for Home screen */
export async function testLlmApis(): Promise<{
  ok: boolean;
  message: string;
  groq: boolean;
  gemini: boolean;
}> {
  let groqOk = false;
  let geminiOk = false;

  if (isGroqAvailable()) {
    const t = await normalizeUrduRomanGroq('test');
    groqOk = !!t;
  }
  if (isGeminiAvailable()) {
    const t = await normalizeGemini('test');
    geminiOk = t !== 'test' || false;
    // normalizeGemini returns original on fail — try minimal via analyze is heavy; use groq only for ping
  }

  if (groqOk) {
    return {
      ok: true,
      message: `✓ AI: ${getLlmStatusLabel()} (Groq active, keys rotate on quota)`,
      groq: true,
      gemini: geminiOk,
    };
  }
  if (geminiOk) {
    return {
      ok: true,
      message: `✓ AI: Gemini active (${APP_CONFIG.geminiApiKeys.length} keys)`,
      groq: false,
      gemini: true,
    };
  }
  return {
    ok: false,
    message: `⚠ AI offline — ${getLlmStatusLabel()}. Using rule-based agents only.`,
    groq: false,
    gemini: false,
  };
}
