/** Fixed-window limiter keyed by an arbitrary string (session id or IP). */
export class WindowRateLimiter {
  readonly #max: number;
  readonly #windowMs: number;
  readonly #hits = new Map<string, { count: number; resetAt: number }>();

  constructor(max: number, windowMs: number) {
    this.#max = max;
    this.#windowMs = windowMs;
  }

  /** Returns 0 when allowed, otherwise seconds until the window resets. */
  hit(key: string): number {
    const now = Date.now();
    const entry = this.#hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.#hits.set(key, { count: 1, resetAt: now + this.#windowMs });
      if (this.#hits.size > 10_000) this.prune(now);
      return 0;
    }
    if (entry.count >= this.#max) return Math.ceil((entry.resetAt - now) / 1000);
    entry.count++;
    return 0;
  }

  private prune(now: number): void {
    for (const [k, v] of this.#hits) if (v.resetAt <= now) this.#hits.delete(k);
  }
}
