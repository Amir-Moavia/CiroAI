// Shared LLM analysis prompt fragments (Groq + Gemini)

export const LLM_CONFIDENCE_RULES = `
Set "confidence" (0.0–1.0) from evidence strength ONLY:
- 1 vague citizen report, no location: 0.30–0.45
- 1 clear citizen report with sector/landmark: 0.45–0.65
- 2–3 corroborating sources (citizen + API): 0.55–0.75
- 4+ diverse sources with matching type: 0.70–0.88
Do NOT default to 0.85. Vary the score based on the signals above.`;

export function buildCrisisAnalysisPrompt(
  signalTexts: string,
  locationHint: string,
  typeGuess: string,
  feedSummary?: string,
  searchSummary?: string,
): string {
  return `You are CrisisAI for Pakistan urban emergencies. Use the PRIMARY incident type from citizen reports — do NOT label multi_crisis unless multiple independent citizen reports describe different crisis types.

Signals:
${signalTexts}

${feedSummary ? `External feeds:\n${feedSummary}\n` : ''}${searchSummary ? `Google Search context (grounding):\n${searchSummary}\n` : ''}
Location hint: ${locationHint}
Current type guess: ${typeGuess}

${LLM_CONFIDENCE_RULES}

Return ONLY valid JSON (no markdown):
{
  "detectedType": "infrastructure_failure|power_outage|flood|road_damage|water_crisis|heatwave|multi_crisis|fire|unknown",
  "severity": "critical|high|medium|low|info",
  "confidence": 0.0,
  "locationLabel": "string",
  "directEffects": ["string"],
  "secondaryEffects": ["string"],
  "explanation": "string",
  "recommendedActionsAuthorities": ["string"],
  "recommendedActionsCitizens": ["string"]
}`;
}
