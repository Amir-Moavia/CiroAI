// ─────────────────────────────────────────────────────────────
// InputAgent — Agent 1: Signal Ingestion & Normalisation
// ─────────────────────────────────────────────────────────────
// Ingests raw crisis signals from any source (citizen text,
// sensor JSON, API payloads). Detects language, normalises
// Urdu-Roman phrases, extracts location, tags crisis type,
// assigns preliminary severity, and logs full reasoning traces.
// ─────────────────────────────────────────────────────────────

import type {
  CrisisSignal,
  CrisisType,
  Severity,
  SignalSource,
  Location,
  AgentAction,
  ActionStatus,
} from '../types';

// ── Urdu-Roman → English Normalisation Map (25 phrases) ─────

const URDU_PHRASE_MAP: Record<string, { english: string; crisisHint: CrisisType }> = {
  'phat gaya':       { english: 'exploded/failed',              crisisHint: 'power_outage' },
  'phat gayi':       { english: 'exploded/failed',              crisisHint: 'power_outage' },
  'andhere mein':    { english: 'power outage / no electricity', crisisHint: 'power_outage' },
  'bijli nahi':      { english: 'no electricity',               crisisHint: 'power_outage' },
  'bijli gayi':      { english: 'electricity gone',             crisisHint: 'power_outage' },
  'bijli band':      { english: 'electricity shut off',         crisisHint: 'power_outage' },
  'transformer':     { english: 'transformer',                  crisisHint: 'power_outage' },
  'paani nahi':      { english: 'no water supply',              crisisHint: 'water_crisis' },
  'paani band':      { english: 'water shut off',               crisisHint: 'water_crisis' },
  'paani aa gaya':   { english: 'flooding / water came in',     crisisHint: 'flood' },
  'gaariyan phans':  { english: 'vehicles stranded/stuck',    crisisHint: 'flood' },
  'phans gayi':      { english: 'stuck/stranded (vehicles)',  crisisHint: 'flood' },
  'garmi':           { english: 'extreme heat',               crisisHint: 'heatwave' },
  'lu lag rahi':     { english: 'heatstroke symptoms',        crisisHint: 'heatwave' },
  'selab':           { english: 'flood',                        crisisHint: 'flood' },
  'barish':          { english: 'rain / rainfall',              crisisHint: 'flood' },
  'darya barh gaya': { english: 'river/flood overflow',         crisisHint: 'flood' },
  'doob gaya':       { english: 'submerged / drowned',          crisisHint: 'flood' },
  'rasta band':      { english: 'road blocked',                 crisisHint: 'road_damage' },
  'road band':       { english: 'road blocked',                 crisisHint: 'road_damage' },
  'pul toot gaya':   { english: 'bridge collapsed/damaged',     crisisHint: 'road_damage' },
  'pul gir gaya':    { english: 'bridge fallen',                crisisHint: 'road_damage' },
  'aag lag gayi':    { english: 'fire outbreak',                crisisHint: 'fire' },
  'aag lagi hai':    { english: 'fire burning',                 crisisHint: 'fire' },
  'dhuen':           { english: 'smoke',                        crisisHint: 'fire' },
  'zakhmi':          { english: 'injured',                      crisisHint: 'unknown' },
  'mar gaya':        { english: 'died / fatality',              crisisHint: 'unknown' },
  'badboo':          { english: 'foul smell / stench',          crisisHint: 'water_crisis' },
  'ganda paani':     { english: 'dirty/contaminated water',     crisisHint: 'water_crisis' },
  'hospital':        { english: 'hospital',                     crisisHint: 'unknown' },
  'rescue':          { english: 'rescue',                       crisisHint: 'unknown' },
  'madad':           { english: 'help needed',                  crisisHint: 'unknown' },
  'khatrah':         { english: 'danger/risk',                  crisisHint: 'unknown' },
  'landslide':       { english: 'landslide',                    crisisHint: 'road_damage' },
};

// ── Known Pakistan Locations (with coordinates) ─────────────

interface KnownLocation {
  pattern: RegExp;
  name: string;
  city: string;
  province: string;
  coordinate: { latitude: number; longitude: number };
}

const KNOWN_LOCATIONS: KnownLocation[] = [
  // Islamabad sectors
  { pattern: /\bF[-\s]?6\b/i,           name: 'F-6',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7280, longitude: 73.0550 } },
  { pattern: /\bF[-\s]?7\b/i,           name: 'F-7',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7215, longitude: 73.0580 } },
  { pattern: /\bF[-\s]?8\b/i,           name: 'F-8',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7100, longitude: 73.0400 } },
  { pattern: /\bF[-\s]?10\b/i,          name: 'F-10',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6960, longitude: 73.0200 } },
  { pattern: /\bF[-\s]?11\b/i,          name: 'F-11',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6880, longitude: 73.0050 } },
  { pattern: /\bG[-\s]?9\b/i,           name: 'G-9',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6850, longitude: 73.0200 } },
  { pattern: /\bG[-\s]?10\b/i,          name: 'G-10',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6750, longitude: 73.0100 } },
  { pattern: /\bG[-\s]?11\b/i,          name: 'G-11',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6649, longitude: 73.0126 } },
  { pattern: /\bI[-\s]?8\b/i,           name: 'I-8',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6648, longitude: 72.9946 } },
  { pattern: /\bI[-\s]?9\b/i,           name: 'I-9',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6550, longitude: 72.9800 } },
  { pattern: /\bI[-\s]?10\b/i,          name: 'I-10',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6450, longitude: 72.9700 } },
  { pattern: /\bE[-\s]?7\b/i,           name: 'E-7',           city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7300, longitude: 73.0500 } },
  { pattern: /\bE[-\s]?11\b/i,          name: 'E-11',          city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6900, longitude: 72.9900 } },
  { pattern: /\bBlue\s*Area\b/i,        name: 'Blue Area',     city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7100, longitude: 73.0600 } },
  { pattern: /\bZero\s*Point\b/i,       name: 'Zero Point',    city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6938, longitude: 73.0652 } },
  { pattern: /\bFaizabad\b/i,           name: 'Faizabad',      city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6660, longitude: 73.0763 } },
  { pattern: /\bMargalla\b/i,           name: 'Margalla',      city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.7480, longitude: 73.0601 } },
  // Rawalpindi
  { pattern: /\bSaddar\b/i,             name: 'Saddar',        city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5981, longitude: 73.0478 } },
  { pattern: /\bGT\s*Road\b/i,          name: 'GT Road',       city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5935, longitude: 73.0715 } },
  { pattern: /\bMurree\s*Road\b/i,      name: 'Murree Road',   city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.6281, longitude: 73.0716 } },
  { pattern: /\bCommittee\s*Chowk\b/i,  name: 'Committee Chowk', city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5889, longitude: 73.0556 } },
  { pattern: /\bNullah\s*L[ae]i\b/i,    name: 'Nullah Lai',    city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5889, longitude: 73.0556 } },
  { pattern: /\bDHA\b/i,                name: 'DHA',           city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5311, longitude: 73.1000 } },
  // Major cities (fallback)
  { pattern: /\bIslamabad\b/i,          name: 'Islamabad',     city: 'Islamabad', province: 'Federal Capital', coordinate: { latitude: 33.6844, longitude: 73.0479 } },
  { pattern: /\bRawalpindi\b/i,         name: 'Rawalpindi',    city: 'Rawalpindi', province: 'Punjab', coordinate: { latitude: 33.5651, longitude: 73.0169 } },
  { pattern: /\bLahore\b/i,             name: 'Lahore',        city: 'Lahore',     province: 'Punjab', coordinate: { latitude: 31.5204, longitude: 74.3587 } },
  { pattern: /\bKarachi\b/i,            name: 'Karachi',       city: 'Karachi',    province: 'Sindh',  coordinate: { latitude: 24.8607, longitude: 67.0011 } },
  { pattern: /\bPeshawar\b/i,           name: 'Peshawar',      city: 'Peshawar',   province: 'KPK',   coordinate: { latitude: 34.0151, longitude: 71.5249 } },
  { pattern: /\bQuetta\b/i,             name: 'Quetta',        city: 'Quetta',     province: 'Balochistan', coordinate: { latitude: 30.1798, longitude: 66.9750 } },
];

// ── Crisis-Type Keyword Map ─────────────────────────────────

const CRISIS_KEYWORDS: Record<CrisisType, RegExp> = {
  power_outage:           /\b(power|electricity|bijli|transformer|load.?shed|blackout|andher|wapda|iesco|grid.?fail|feeder)\b/i,
  flood:                  /\b(flood|rain|barish|selab|water.?log|submerge|doob|nullah|overflow|underpass.?water|paani\s+aa)\b/i,
  road_damage:            /\b(road|bridge|pul|pothole|landslide|crack|block|rasta\s+band|collapse|traffic.?jam|congestion)\b/i,
  water_crisis:           /\b(water.?supply|pipeline|burst|sewage|paani\s+nahi|paani\s+band|tanker|pressure.?drop|ganda\s+paani|badboo)\b/i,
  fire:                   /\b(fire|aag|blaze|burn|flame|smoke|dhuen)\b/i,
  earthquake:             /\b(earthquake|quake|tremor|seismic|zalzala)\b/i,
  heatwave:               /\b(heat.?wave|extreme.?heat|temperature|garmi|lu.?chal|heat.?stroke)\b/i,
  infrastructure_failure: /\b(internet|telecom|network.?down|ptcl|fiber|cable.?cut|tower.?down)\b/i,
  terrorist_attack:       /\b(blast|bomb|explosion|attack|terrorist|militant|firing|shoot)\b/i,
  disease_outbreak:       /\b(disease|outbreak|epidemic|cholera|dengue|virus|infection)\b/i,
  protest:                /\b(protest|dharna|rally|strike|hartal|demonstration)\b/i,
  multi_crisis:           /\b(multiple|combined|cascad|compound|simultaneous)\b/i,
  unknown:                /(?:)/, // always matches — used as final fallback
};

// ── Severity Keyword Escalators ─────────────────────────────

const SEVERITY_ESCALATORS: { pattern: RegExp; boost: number }[] = [
  { pattern: /\b(death|died|fatal|mar\s+gaya|killed)\b/i,         boost: 3 },
  { pattern: /\b(hospital|children|bachon|school|injured|zakhmi)\b/i, boost: 2 },
  { pattern: /\b(fire.?risk|electrocution|explosion|explod|phat)\b/i, boost: 2 },
  { pattern: /\b(critical|emergency|urgent|danger|khatrah)\b/i,   boost: 2 },
  { pattern: /\b(stuck|trapped|isolated|stranded|rescue)\b/i,     boost: 2 },
  { pattern: /\b(accident|crash|collision)\b/i,                   boost: 1 },
  { pattern: /\b(blocked|submerge|overflow|gridlock)\b/i,         boost: 1 },
  { pattern: /\b(not.?respond|helpline.?busy|no.?answer)\b/i,     boost: 1 },
];

// ── Helpers ─────────────────────────────────────────────────

let _signalCounter = 0;
function generateId(): string {
  _signalCounter += 1;
  return `SIG-${Date.now()}-${String(_signalCounter).padStart(4, '0')}`;
}

function now(): string {
  return new Date().toISOString();
}

// ═══════════════════════════════════════════════════════════════
// InputAgent Class
// ═══════════════════════════════════════════════════════════════

export class InputAgent {
  readonly name = 'InputAgent';
  private traceLog: AgentAction[] = [];

  // ── 1. ingest() ─────────────────────────────────────────

  ingest(rawInput: string | Record<string, unknown>): CrisisSignal {
    const startMs = Date.now();
    const reasoning: string[] = [];
    const id = generateId();

    // Step 1 — Extract raw text
    const rawText = this.extractRawText(rawInput);
    reasoning.push(`Received raw input (${typeof rawInput}). Extracted text: "${rawText.slice(0, 80)}..."`);

    // Step 2 — Detect source
    const source = this.detectSource(rawInput);
    reasoning.push(`Source classified as: ${source}`);

    // Step 3 — Detect language
    const language = this.detectLanguage(rawText);
    reasoning.push(`Language detected: ${language}`);

    // Step 4 — Normalise Urdu-Roman phrases
    const { normalized, matches } = this.normaliseText(rawText);
    if (matches.length > 0) {
      for (const m of matches) {
        reasoning.push(`Phrase '${m.original}' → normalised: '${m.english}' (hint: ${m.crisisHint})`);
      }
    } else {
      reasoning.push('No Urdu-Roman phrases detected — text used as-is');
    }

    // Step 5 — Extract location
    const location = this.extractLocation(rawText, rawInput);
    reasoning.push(`Location detected: ${location.label ?? location.city ?? 'UNKNOWN'} (${location.coordinate.latitude}, ${location.coordinate.longitude})`);

    // Step 6 — Classify crisis type
    const urduHints = matches.map((m) => m.crisisHint).filter((h) => h !== 'unknown');
    const crisisType = this.classifyCrisisType(normalized, urduHints);
    reasoning.push(`CrisisType classified: ${crisisType}`);

    // Step 7 — Score severity
    const severity = this.scoreSeverity(normalized, crisisType, matches.length);
    reasoning.push(`Severity assigned: ${severity.toUpperCase()}`);

    // Build the signal
    const signal: CrisisSignal = {
      id,
      source,
      text: normalized,
      location,
      timestamp: now(),
      type: crisisType,
      severity,
      language,
      rawPayload: typeof rawInput === 'object' ? rawInput : { originalText: rawText },
    };

    // Log trace
    const fullReasoning = reasoning.join('\n');
    this.logTrace(id, rawInput, signal, fullReasoning, startMs);

    console.log(
      `[InputAgent] ${source} | Lang: ${language} | Type: ${crisisType} | Severity: ${severity.toUpperCase()} | Location: ${location.label ?? 'N/A'}\n` +
      `  Text: "${rawText.slice(0, 100)}${rawText.length > 100 ? '...' : ''}"`
    );

    return signal;
  }

  // ── 2. batchIngest() ────────────────────────────────────

  batchIngest(signals: Array<string | Record<string, unknown>>): CrisisSignal[] {
    console.log(`[InputAgent] Batch ingesting ${signals.length} signals...`);

    // Process all signals
    const processed = signals.map((s) => this.ingest(s));

    // Deduplicate: same location + type within 15-minute window
    const deduped = this.deduplicateSignals(processed, 15);
    console.log(`[InputAgent] Deduplication: ${processed.length} → ${deduped.length} unique signals`);

    // Sort by severity DESC
    const severityOrder: Record<Severity, number> = {
      critical: 4, high: 3, medium: 2, low: 1, info: 0,
    };
    deduped.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return deduped;
  }

  // ── 3. getAgentTrace() ──────────────────────────────────

  getAgentTrace(): AgentAction[] {
    return [...this.traceLog];
  }

  /** Clear trace log */
  clearTrace(): void {
    this.traceLog = [];
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════

  private extractRawText(input: string | Record<string, unknown>): string {
    if (typeof input === 'string') return input.trim();

    // Try common field names in order
    for (const key of ['text', 'rawText', 'message', 'description', 'content', 'body', 'alert']) {
      if (typeof input[key] === 'string') return (input[key] as string).trim();
    }

    // Fallback: JSON-stringify non-text payloads
    return JSON.stringify(input);
  }

  private detectSource(input: string | Record<string, unknown>): SignalSource {
    if (typeof input === 'string') return 'citizen_report';
    const src = input.source ?? input.type ?? '';
    const s = String(src).toLowerCase();
    if (s.includes('twitter') || s.includes('social'))   return 'twitter';
    if (s.includes('news'))                               return 'news';
    if (s.includes('weather'))                             return 'weather_api';
    if (s.includes('traffic'))                             return 'traffic_api';
    if (s.includes('grid') || s.includes('sensor'))       return 'grid_sensor';
    if (s.includes('utility') || s.includes('water'))     return 'utility_api';
    if (s.includes('government') || s.includes('govt'))   return 'government';
    if (s.includes('cluster'))                             return 'citizen_cluster';
    return 'citizen_report';
  }

  private detectLanguage(text: string): string {
    // Urdu-Roman detection: look for common Urdu transliterated words
    const urduMarkers = /\b(hai|mein|nahi|ke|ka|ki|se|ko|gaya|gayi|raha|rahi|wala|nahi|koi|yeh|hum|kuch|aur|bhi|abhi|bohot|bahut)\b/i;
    const urduCount = (text.match(urduMarkers) || []).length;
    // English detection: ASCII-letter ratio
    const asciiLetters = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length || 1;
    const asciiRatio = asciiLetters / totalChars;

    if (urduCount >= 3 && asciiRatio > 0.8)  return 'MIXED';
    if (urduCount >= 2)                       return 'UR';
    if (asciiRatio > 0.9)                     return 'EN';
    return 'MIXED';
  }

  private normaliseText(text: string): {
    normalized: string;
    matches: Array<{ original: string; english: string; crisisHint: CrisisType }>;
  } {
    let normalized = text;
    const matches: Array<{ original: string; english: string; crisisHint: CrisisType }> = [];

    for (const [phrase, mapping] of Object.entries(URDU_PHRASE_MAP)) {
      const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      if (regex.test(normalized)) {
        matches.push({ original: phrase, english: mapping.english, crisisHint: mapping.crisisHint });
        // Append English meaning in brackets rather than replacing,
        // so the original text is preserved for context
        normalized = normalized.replace(regex, `${phrase} [${mapping.english}]`);
      }
    }

    return { normalized, matches };
  }

  private extractLocation(text: string, rawInput: string | Record<string, unknown>): Location {
    // Priority 1: structured location in raw payload
    if (typeof rawInput === 'object') {
      const loc = rawInput.location as Record<string, unknown> | undefined;
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        return {
          coordinate: { latitude: loc.latitude, longitude: loc.longitude },
          city: typeof loc.city === 'string' ? loc.city : undefined,
          district: typeof loc.district === 'string' ? loc.district : undefined,
          province: typeof loc.province === 'string' ? loc.province : undefined,
          label: typeof loc.label === 'string' ? loc.label : undefined,
        };
      }
      // Check zone/region fields
      const zone = (rawInput.zone ?? rawInput.region ?? '') as string;
      if (zone) {
        const found = KNOWN_LOCATIONS.find((kl) => kl.pattern.test(zone));
        if (found) {
          return {
            coordinate: found.coordinate,
            city: found.city,
            district: found.name,
            province: found.province,
            label: `${found.name}, ${found.city}`,
          };
        }
      }
    }

    // Priority 2: regex match on text — return FIRST match (most specific)
    for (const kl of KNOWN_LOCATIONS) {
      if (kl.pattern.test(text)) {
        return {
          coordinate: kl.coordinate,
          city: kl.city,
          district: kl.name,
          province: kl.province,
          label: `${kl.name}, ${kl.city}`,
        };
      }
    }

    // Fallback: Islamabad centre
    return {
      coordinate: { latitude: 33.6844, longitude: 73.0479 },
      city: 'Islamabad',
      province: 'Federal Capital',
      label: 'Islamabad (default)',
    };
  }

  private classifyCrisisType(text: string, urduHints: CrisisType[]): CrisisType {
    const scores: Partial<Record<CrisisType, number>> = {};

    // Score from Urdu phrase hints
    for (const hint of urduHints) {
      scores[hint] = (scores[hint] ?? 0) + 2;
    }

    // Score from keyword regex
    for (const [type, regex] of Object.entries(CRISIS_KEYWORDS) as Array<[CrisisType, RegExp]>) {
      if (type === 'unknown') continue;
      const matchCount = (text.match(new RegExp(regex.source, 'gi')) || []).length;
      if (matchCount > 0) {
        scores[type] = (scores[type] ?? 0) + matchCount;
      }
    }

    // If multiple types detected with similar scores → multi_crisis
    const entries = Object.entries(scores) as Array<[CrisisType, number]>;
    if (entries.length === 0) return 'unknown';

    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];

    // If 2+ different crisis types scored ≥ 2, flag as multi
    const significantTypes = entries.filter(([, s]) => s >= 2);
    if (significantTypes.length >= 2) return 'multi_crisis';

    return top[0];
  }

  private scoreSeverity(text: string, crisisType: CrisisType, urduMatchCount: number): Severity {
    let score = 1; // base: LOW

    // Crisis-type base scores
    const typeBase: Partial<Record<CrisisType, number>> = {
      multi_crisis: 3,
      fire: 2,
      flood: 2,
      earthquake: 3,
      terrorist_attack: 3,
      power_outage: 1,
      road_damage: 1,
      water_crisis: 1,
    };
    score += typeBase[crisisType] ?? 0;

    // Keyword escalators
    for (const esc of SEVERITY_ESCALATORS) {
      if (esc.pattern.test(text)) score += esc.boost;
    }

    // Urdu phrase density bonus (more phrases → more urgent local report)
    if (urduMatchCount >= 3) score += 1;

    // Map to severity
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    if (score >= 1) return 'low';
    return 'info';
  }

  private deduplicateSignals(signals: CrisisSignal[], windowMinutes: number): CrisisSignal[] {
    const kept: CrisisSignal[] = [];
    const windowMs = windowMinutes * 60 * 1000;

    for (const signal of signals) {
      const isDuplicate = kept.some((existing) => {
        if (existing.type !== signal.type) return false;
        // Same district/label counts as same location
        const sameLocation =
          existing.location.district === signal.location.district &&
          existing.location.city === signal.location.city;
        if (!sameLocation) return false;
        // Within time window
        const timeDiff = Math.abs(
          new Date(signal.timestamp).getTime() - new Date(existing.timestamp).getTime()
        );
        return timeDiff <= windowMs;
      });

      if (!isDuplicate) {
        kept.push(signal);
      }
    }

    return kept;
  }

  private logTrace(
    signalId: string,
    rawInput: string | Record<string, unknown>,
    output: CrisisSignal,
    reasoning: string,
    startMs: number,
  ): void {
    const action: AgentAction = {
      id: `TRACE-${this.name}-${signalId}`,
      agentName: this.name,
      input: typeof rawInput === 'string' ? { text: rawInput } : rawInput,
      reasoning,
      output: output as unknown as Record<string, unknown>,
      timestamp: now(),
      status: 'completed' as ActionStatus,
      durationMs: Date.now() - startMs,
    };
    this.traceLog.push(action);
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const inputAgent = new InputAgent();
