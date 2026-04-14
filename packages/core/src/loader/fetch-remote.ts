import { specCache } from './cache.js';
import type { LoadOptions } from '../types.js';

/**
 * Fetch a remote spec over HTTP/HTTPS with optional caching and auth.
 *
 * Caching strategy:
 * 1. If a fresh cache entry exists (within `cacheTtl`), return it immediately.
 * 2. If a stale entry with validators (ETag / Last-Modified) exists, issue a
 *    conditional request. A 304 returns the cached content; a 200 updates the
 *    cache with the new body and validators.
 * 3. Otherwise, perform a full request and store the result.
 *
 * @throws {Error} on non-2xx / non-304 responses, network failures, or timeouts.
 */
export async function fetchRemote(
  url: string,
  options: LoadOptions = {},
): Promise<string> {
  const {
    timeout = 30_000,
    headers: customHeaders = {},
    cache = true,
    cacheTtl = 300_000,
  } = options;

  if (cache) {
    // Always peek first so we never lose the entry before checking validators.
    const cached = specCache.peek(url);
    if (cached) {
      const isFresh = Date.now() - cached.fetchedAt <= cacheTtl;
      if (isFresh) {
        return cached.content;
      }
    }

    // Stale entry may still have validators — attempt conditional revalidation.
    const stale = cached;
    if (stale) {
      const conditionals = specCache.conditionalHeaders(url);
      if (Object.keys(conditionals).length > 0) {
        try {
          const res = await fetchWithTimeout(url, {
            headers: { ...customHeaders, ...conditionals },
            timeout,
          });
          if (res.status === 304) {
            // Server confirmed the cached copy is still valid — refresh timestamp.
            specCache.set(url, {
              content: stale.content,
              etag: stale.etag,
              lastModified: stale.lastModified,
            });
            return stale.content;
          }
          if (res.ok) {
            const content = await res.text();
            specCache.set(url, {
              content,
              etag: res.headers.get('etag') ?? undefined,
              lastModified: res.headers.get('last-modified') ?? undefined,
            });
            return content;
          }
          throw new HttpError(url, res.status, res.statusText);
        } catch (err) {
          if (err instanceof HttpError) throw err;
          // Network failure during revalidation — fall through to return stale copy.
          return stale.content;
        }
      }
    }
  }

  // Fresh request.
  const res = await fetchWithTimeout(url, { headers: customHeaders, timeout });
  if (!res.ok) {
    throw new HttpError(url, res.status, res.statusText);
  }

  const content = await res.text();

  if (cache) {
    specCache.set(url, {
      content,
      etag: res.headers.get('etag') ?? undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
    });
  }

  return content;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  opts: { headers: Record<string, string>; timeout: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout);
  try {
    return await fetch(url, { headers: opts.headers, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${opts.timeout}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`HTTP ${status} ${statusText} fetching spec from: ${url}`);
    this.name = 'HttpError';
  }
}
