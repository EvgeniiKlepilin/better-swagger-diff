/**
 * Top-level differ (task 1.3.1).
 *
 * `diff(base, head, options?)` is the single public entry point for
 * comparing two normalised IRSpec objects.
 */

import type { IRSpec } from '../ir/types.js';
import type { DiffOptions, DiffResult } from './types.js';
import { diffPathMaps } from './diff-paths.js';
import {
  diffGlobalSecurity,
  diffSecuritySchemes,
  diffServers,
  diffSpecExtensions,
  diffTags,
} from './diff-misc.js';

/**
 * Produce a structured diff between two normalised specs.
 *
 * @param base     The "before" spec (older version).
 * @param head     The "after" spec (newer version).
 * @param options  Optional configuration (e.g. extension inclusion).
 * @returns        A {@link DiffResult} describing every change found.
 */
export function diff(base: IRSpec, head: IRSpec, options: DiffOptions = {}): DiffResult {
  const includeExtensions = options.includeExtensions ?? true;

  // ── Paths (1.3.2 – 1.3.7, 1.3.11, 1.3.12) ────────────────────────────────
  const paths = diffPathMaps(base.paths, head.paths, '/paths', includeExtensions);

  // ── Webhooks (OAS 3.1) ────────────────────────────────────────────────────
  const webhooks = diffPathMaps(
    base.webhooks ?? {},
    head.webhooks ?? {},
    '/webhooks',
    includeExtensions,
  );

  // ── Security schemes (1.3.8) ─────────────────────────────────────────────
  const securitySchemes = diffSecuritySchemes(base.securitySchemes, head.securitySchemes);

  // ── Global security requirements (1.3.8) ─────────────────────────────────
  const security = diffGlobalSecurity(base.security, head.security);

  // ── Tags (1.3.9) ─────────────────────────────────────────────────────────
  const tags = diffTags(base.tags, head.tags);

  // ── Servers / basePath (1.3.10) ───────────────────────────────────────────
  const servers = diffServers(base.servers, head.servers);

  // ── Spec-level extensions (1.3.11) ────────────────────────────────────────
  const extensions = includeExtensions
    ? diffSpecExtensions(base.extensions, head.extensions)
    : [];

  const isEmpty =
    paths.length === 0 &&
    webhooks.length === 0 &&
    securitySchemes.length === 0 &&
    security === undefined &&
    tags.length === 0 &&
    servers.length === 0 &&
    extensions.length === 0;

  return { isEmpty, paths, webhooks, securitySchemes, security, tags, servers, extensions };
}
