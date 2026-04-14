/**
 * In-memory cache for remote spec responses.
 *
 * Supports ETag-based conditional revalidation and TTL-based expiry.
 * A single shared instance (`specCache`) is exported for use across all loaders.
 * Tests should call `specCache.clear()` in `beforeEach`/`afterEach` to avoid
 * cross-test pollution.
 */

interface CacheEntry {
  /** Raw response body (JSON or YAML string). */
  content: string;
  /** ETag value from the last successful response, if present. */
  etag?: string;
  /** `Last-Modified` value from the last successful response, if present. */
  lastModified?: string;
  /** Unix timestamp (ms) when this entry was stored. */
  fetchedAt: number;
}

export class SpecCache {
  private readonly store = new Map<string, CacheEntry>();

  /**
   * Store or overwrite a cache entry for `url`.
   */
  set(
    url: string,
    entry: Omit<CacheEntry, 'fetchedAt'>,
    fetchedAt = Date.now(),
  ): void {
    this.store.set(url, { ...entry, fetchedAt });
  }

  /**
   * Retrieve a cache entry if it exists and has not exceeded `ttl` milliseconds.
   * Returns `null` if the entry is absent or stale (the stale entry is evicted).
   */
  get(url: string, ttl: number): CacheEntry | null {
    const entry = this.store.get(url);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > ttl) {
      this.store.delete(url);
      return null;
    }
    return entry;
  }

  /**
   * Peek at an entry without checking TTL.
   * Used for ETag-based revalidation after a stale entry has been evicted.
   */
  peek(url: string): CacheEntry | undefined {
    return this.store.get(url);
  }

  /**
   * Build the conditional request headers (`If-None-Match` / `If-Modified-Since`)
   * for the cached entry at `url`, if any validators are stored.
   */
  conditionalHeaders(url: string): Record<string, string> {
    const entry = this.store.get(url);
    if (!entry) return {};
    const headers: Record<string, string> = {};
    if (entry.etag) headers['If-None-Match'] = entry.etag;
    if (entry.lastModified) headers['If-Modified-Since'] = entry.lastModified;
    return headers;
  }

  /** Remove all entries. Primarily used in tests. */
  clear(): void {
    this.store.clear();
  }

  /** Number of entries currently held. */
  get size(): number {
    return this.store.size;
  }
}

/** Shared cache instance used by all remote fetches. */
export const specCache = new SpecCache();
