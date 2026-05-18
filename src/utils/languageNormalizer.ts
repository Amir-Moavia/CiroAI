// ─────────────────────────────────────────────────────────────
// CrisisAI — Utility: Language Normaliser
// ─────────────────────────────────────────────────────────────

/**
 * Normalise text from Urdu/Sindhi/Pashto/English into
 * a common English representation for the detection pipeline.
 *
 * TODO: integrate translation API or local model
 */
export function normalizeLanguage(text: string, _sourceLang?: string): string {
  // Stub — return text as-is for now
  return text.trim();
}

/**
 * Detect the language of an input string.
 * Returns ISO 639-1 code (e.g. 'ur', 'en', 'sd', 'ps').
 */
export function detectLanguage(_text: string): string {
  // Stub
  return 'en';
}
