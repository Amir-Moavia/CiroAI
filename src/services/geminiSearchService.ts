// ─────────────────────────────────────────────────────────────
// Gemini + Google Search grounding for live crisis context
// ─────────────────────────────────────────────────────────────

import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai';
import { APP_CONFIG } from '../constants/config';
import { ApiKeyPool, isQuotaOrRateLimitError } from '../utils/apiKeyPool';
import type { CrisisType } from '../types';

export interface SearchGroundingResult {
  summary: string;
  queries: string[];
  sources: string[];
}

const geminiPool = new ApiKeyPool(APP_CONFIG.geminiApiKeys);

export function isSearchGroundingAvailable(): boolean {
  return geminiPool.hasKeys();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function fetchCrisisSearchGrounding(
  crisisType: CrisisType,
  locationLabel: string,
): Promise<SearchGroundingResult | null> {
  if (!geminiPool.hasKeys()) return null;

  const typeLabel = crisisType.replace(/_/g, ' ');
  const prompt = `Search for recent urban crisis and emergency response news about ${typeLabel} affecting ${locationLabel}, Pakistan (Islamabad/Rawalpindi region if applicable). Summarize in 2–3 sentences what similar incidents look like and typical response actions. Be factual and concise.`;

  const out = await geminiPool.tryEach(async (key) => {
    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: DynamicRetrievalMode.MODE_DYNAMIC,
            dynamicThreshold: 0.25,
          },
        },
      }],
    });

    const result = await withTimeout(model.generateContent(prompt), 16_000);
    if (!result) throw new Error('Gemini search timeout');

    const response = result.response;
    const summary = response.text()?.trim() ?? '';
    if (!summary) throw new Error('Empty search grounding response');

    const meta = response.candidates?.[0]?.groundingMetadata;
    const queries = meta?.webSearchQueries ?? [];
    const sources = (meta?.groundingChunks ?? [])
      .map((c) => c.web?.uri)
      .filter((u): u is string => !!u);

    return { summary, queries, sources };
  }, (err) => {
    const msg = (err as Error)?.message ?? '';
    return isQuotaOrRateLimitError(msg) || msg.includes('timeout');
  });

  if (out?.result) {
    console.log(`[GeminiSearch] Grounding OK — ${out.result.queries.length} queries, ${out.result.sources.length} sources`);
  }
  return out?.result ?? null;
}
