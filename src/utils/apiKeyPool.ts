// ─────────────────────────────────────────────────────────────
// API key pool — rotate keys and skip quota/rate-limited ones
// ─────────────────────────────────────────────────────────────

const QUOTA_PATTERNS = [
  /quota/i,
  /rate.?limit/i,
  /429/,
  /resource_exhausted/i,
  /too many requests/i,
  /limit:\s*0/i,
];

export function isQuotaOrRateLimitError(message: string): boolean {
  return QUOTA_PATTERNS.some((p) => p.test(message));
}

export function parseApiKeys(
  multi?: string,
  single?: string,
): string[] {
  const fromMulti = (multi ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 10 && !k.includes('your_'));
  if (fromMulti.length > 0) return [...new Set(fromMulti)];

  const one = (single ?? '').trim();
  if (one.length > 10 && !one.includes('your_')) return [one];
  return [];
}

export class ApiKeyPool {
  private readonly keys: string[];
  private cursor = 0;
  /** key index → retry after timestamp (ms) */
  private readonly cooldownUntil = new Map<number, number>();
  private static readonly COOLDOWN_MS = 60_000;

  constructor(keys: string[]) {
    this.keys = [...new Set(keys.filter(Boolean))];
  }

  get size(): number {
    return this.keys.length;
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  /** Mark a key exhausted (quota/rate limit) for a short cooldown */
  markExhausted(key: string): void {
    const idx = this.keys.indexOf(key);
    if (idx >= 0) {
      this.cooldownUntil.set(idx, Date.now() + ApiKeyPool.COOLDOWN_MS);
    }
  }

  /** Next available key, or null if all are on cooldown */
  nextKey(): string | null {
    if (this.keys.length === 0) return null;

    const now = Date.now();
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = (this.cursor + attempt) % this.keys.length;
      const until = this.cooldownUntil.get(idx) ?? 0;
      if (until <= now) {
        this.cursor = (idx + 1) % this.keys.length;
        return this.keys[idx];
      }
    }
    return null;
  }

  /** Try each key once via async callback; returns first success or null */
  async tryEach<T>(
    fn: (key: string) => Promise<T>,
    isRetryableError: (err: unknown) => boolean = (err) =>
      isQuotaOrRateLimitError((err as Error)?.message ?? String(err)),
  ): Promise<{ result: T; key: string } | null> {
    const tried = new Set<string>();

    for (let i = 0; i < this.keys.length; i++) {
      const key = this.nextKey();
      if (!key || tried.has(key)) continue;
      tried.add(key);

      try {
        const result = await fn(key);
        return { result, key };
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        if (isRetryableError(err) || isQuotaOrRateLimitError(msg)) {
          this.markExhausted(key);
          continue;
        }
        throw err;
      }
    }
    return null;
  }
}
