/**
 * Differs for tags (1.3.9), servers/basePath (1.3.10),
 * security schemes (1.3.8), global security requirements,
 * and vendor extensions (1.3.11).
 */

import type {
  IRSecurityRequirement,
  IRSecurityScheme,
  IRServer,
  IRTag,
} from '../ir/types.js';
import type { DiffItem } from './types.js';
import { appendPointer, deepEqual } from './utils.js';
import { diffExtensionMap } from './diff-params.js';

// ---------------------------------------------------------------------------
// Tags (1.3.9)
// ---------------------------------------------------------------------------

/**
 * Diff two tag arrays keyed by `name`.
 */
export function diffTags(
  base: IRTag[],
  head: IRTag[],
): DiffItem<IRTag>[] {
  const diffs: DiffItem<IRTag>[] = [];
  const baseMap = new Map(base.map((t) => [t.name, t]));
  const headMap = new Map(head.map((t) => [t.name, t]));

  for (const [name, bTag] of baseMap) {
    if (!headMap.has(name)) {
      diffs.push({ type: 'removed', path: appendPointer('/tags', name), before: bTag, after: undefined });
    }
  }

  for (const [name, hTag] of headMap) {
    if (!baseMap.has(name)) {
      diffs.push({ type: 'added', path: appendPointer('/tags', name), before: undefined, after: hTag });
    }
  }

  for (const [name, bTag] of baseMap) {
    const hTag = headMap.get(name);
    if (!hTag) continue;
    if (!deepEqual(bTag, hTag)) {
      diffs.push({ type: 'modified', path: appendPointer('/tags', name), before: bTag, after: hTag });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Servers / basePath (1.3.10)
// ---------------------------------------------------------------------------

/**
 * Diff two server arrays keyed by `url`.
 * Servers with the same URL but changed metadata are reported as 'modified'.
 */
export function diffServers(
  base: IRServer[],
  head: IRServer[],
): DiffItem<IRServer>[] {
  const diffs: DiffItem<IRServer>[] = [];
  const baseMap = new Map(base.map((s) => [s.url, s]));
  const headMap = new Map(head.map((s) => [s.url, s]));

  for (const [url, bServer] of baseMap) {
    if (!headMap.has(url)) {
      diffs.push({ type: 'removed', path: appendPointer('/servers', url), before: bServer, after: undefined });
    }
  }

  for (const [url, hServer] of headMap) {
    if (!baseMap.has(url)) {
      diffs.push({ type: 'added', path: appendPointer('/servers', url), before: undefined, after: hServer });
    }
  }

  for (const [url, bServer] of baseMap) {
    const hServer = headMap.get(url);
    if (!hServer) continue;
    if (!deepEqual(bServer, hServer)) {
      diffs.push({ type: 'modified', path: appendPointer('/servers', url), before: bServer, after: hServer });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Security schemes (1.3.8)
// ---------------------------------------------------------------------------

/**
 * Diff two security-scheme maps.
 * Schemes are keyed by their name in `securitySchemes` /
 * `securityDefinitions`.
 */
export function diffSecuritySchemes(
  base: Record<string, IRSecurityScheme>,
  head: Record<string, IRSecurityScheme>,
): DiffItem<IRSecurityScheme>[] {
  const diffs: DiffItem<IRSecurityScheme>[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const name of allKeys) {
    const bScheme = base[name];
    const hScheme = head[name];
    const ptr = appendPointer('/securitySchemes', name);

    if (!bScheme) {
      diffs.push({ type: 'added', path: ptr, before: undefined, after: hScheme });
    } else if (!hScheme) {
      diffs.push({ type: 'removed', path: ptr, before: bScheme, after: undefined });
    } else if (!deepEqual(bScheme, hScheme)) {
      diffs.push({ type: 'modified', path: ptr, before: bScheme, after: hScheme });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Global security requirements (1.3.8)
// ---------------------------------------------------------------------------

/**
 * Returns a single DiffItem when the global security array changed,
 * or `undefined` when it is identical.
 */
export function diffGlobalSecurity(
  base: IRSecurityRequirement[] | undefined,
  head: IRSecurityRequirement[] | undefined,
): DiffItem<IRSecurityRequirement[]> | undefined {
  if (deepEqual(base, head)) return undefined;
  return {
    type: base === undefined ? 'added' : head === undefined ? 'removed' : 'modified',
    path: '/security',
    before: base,
    after: head,
  };
}

// ---------------------------------------------------------------------------
// Spec-level vendor extensions (1.3.11)
// ---------------------------------------------------------------------------

/**
 * Diff `x-*` extension fields at the spec root.
 */
export function diffSpecExtensions(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
): DiffItem[] {
  return diffExtensionMap(base, head, '/extensions');
}
