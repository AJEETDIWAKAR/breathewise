interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number, maxEntries = 250) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): { value: T; ageMs: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order on read
    this.store.delete(key);
    this.store.set(key, entry);
    return { value: entry.value, ageMs: now - entry.cachedAt };
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    const now = Date.now();
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      for (const [k, v] of this.store) {
        if (now > v.expiresAt) {
          this.store.delete(k);
        }
      }
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
          this.store.delete(oldestKey);
        }
      }
    }
    this.store.set(key, {
      value,
      cachedAt: now,
      expiresAt: now + ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
