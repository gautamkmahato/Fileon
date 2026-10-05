/**
 * In-process LRU + TTL cache (Redis-like semantics, single-tab / single-server-instance).
 * Used across the app for hot Drive metadata and query results.
 */

export interface MemoryCacheOptions {
  /** Debug label for logging. */
  name: string;
  /** Max keys; oldest (LRU) evicted when exceeded. Omit for unbounded (not recommended). */
  maxEntries?: number;
  /** Default TTL per entry; expired entries are removed on read and by sweep(). */
  defaultTtlMs?: number;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  readonly name: string;
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  /** Insertion order = LRU (oldest first). */
  private readonly map = new Map<string, Entry<T>>();

  constructor(opts: MemoryCacheOptions) {
    this.name = opts.name;
    this.maxEntries = opts.maxEntries ?? 512;
    this.defaultTtlMs = opts.defaultTtlMs ?? 180_000;
  }

  private isExpired(entry: Entry<T>): boolean {
    return entry.expiresAt <= Date.now();
  }

  private touch(key: string, entry: Entry<T>): void {
    this.map.delete(key);
    this.map.set(key, entry);
  }

  private evictLru(): void {
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    this.touch(key, entry);
    return entry.value;
  }

  /** Returns value if present and younger than `maxAgeMs` (for stale-while-revalidate). */
  getIfYounger(key: string, maxAgeMs: number): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    const age = Date.now() - (entry.expiresAt - this.defaultTtlMs);
    if (age > maxAgeMs) return undefined;
    this.touch(key, entry);
    return entry.value;
  }

  peek(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry || this.isExpired(entry)) return undefined;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + Math.max(1, ttl);
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    this.evictLru();
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  /** Remove all expired entries; returns count removed. */
  sweep(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  forEach(fn: (value: T, key: string) => void): void {
    for (const [key, entry] of this.map) {
      if (!this.isExpired(entry)) fn(entry.value, key);
    }
  }
}

/** Deduplicate concurrent async work per key (single-flight). */
export class InflightDeduper<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.inflight.clear();
  }
}

const registry: MemoryCache<unknown>[] = [];
let sweeperStarted = false;

export function registerMemoryCache(cache: MemoryCache<unknown>): void {
  registry.push(cache);
  ensureCacheSweeper();
}

function ensureCacheSweeper(): void {
  if (sweeperStarted || typeof window === "undefined") return;
  sweeperStarted = true;
  const interval = 5 * 60_000;
  window.setInterval(() => {
    for (const cache of registry) {
      try {
        cache.sweep();
      } catch (err) {
        console.error(`[cache:${cache.name}] sweep failed`, err);
      }
    }
  }, interval);
}

export function sweepAllMemoryCaches(): number {
  let n = 0;
  for (const cache of registry) n += cache.sweep();
  return n;
}
