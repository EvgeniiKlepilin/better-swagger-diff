/**
 * Differ for IRParameter arrays and IRRequestBody (tasks 1.3.4, 1.3.5).
 */

import type { IRParameter, IRRequestBody } from '../ir/types.js';
import type { DiffItem, MediaTypeDiff, ParameterDiff, RequestBodyDiff } from './types.js';
import { appendPointer, deepEqual } from './utils.js';
import { diffSchemas } from './diff-schema.js';

// ---------------------------------------------------------------------------
// Parameters (1.3.4)
// ---------------------------------------------------------------------------

const PARAMETER_SCALAR_FIELDS = [
  'required',
  'description',
  'deprecated',
  'style',
  'explode',
  'allowEmptyValue',
] as const satisfies Array<keyof IRParameter>;

/**
 * Compare two parameter lists.
 * Parameters are keyed by `${name}:${in}` so renames are treated as
 * remove + add pairs.
 *
 * @param base      Parameters from the base spec.
 * @param head      Parameters from the head spec.
 * @param basePath  JSON Pointer prefix, e.g. "/paths/~1pets/get/parameters".
 */
export function diffParameters(
  base: IRParameter[],
  head: IRParameter[],
  basePath: string,
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];

  const baseMap = new Map<string, IRParameter>();
  const headMap = new Map<string, IRParameter>();

  for (const p of base) baseMap.set(`${p.name}:${p.in}`, p);
  for (const p of head) headMap.set(`${p.name}:${p.in}`, p);

  // Removed
  for (const [key, param] of baseMap) {
    if (!headMap.has(key)) {
      diffs.push({
        name: param.name,
        in: param.in,
        type: 'removed',
        jsonPointer: appendPointer(basePath, `${param.name}(${param.in})`),
        before: param,
        after: undefined,
        changes: [],
      });
    }
  }

  // Added
  for (const [key, param] of headMap) {
    if (!baseMap.has(key)) {
      diffs.push({
        name: param.name,
        in: param.in,
        type: 'added',
        jsonPointer: appendPointer(basePath, `${param.name}(${param.in})`),
        before: undefined,
        after: param,
        changes: [],
      });
    }
  }

  // Modified
  for (const [key, bParam] of baseMap) {
    const hParam = headMap.get(key);
    if (!hParam) continue;

    const changes = diffSingleParameter(bParam, hParam, appendPointer(basePath, `${bParam.name}(${bParam.in})`));
    if (changes.length > 0) {
      diffs.push({
        name: bParam.name,
        in: bParam.in,
        type: 'modified',
        jsonPointer: appendPointer(basePath, `${bParam.name}(${bParam.in})`),
        before: bParam,
        after: hParam,
        changes,
      });
    }
  }

  return diffs;
}

function diffSingleParameter(base: IRParameter, head: IRParameter, basePath: string): DiffItem[] {
  const changes: DiffItem[] = [];

  for (const field of PARAMETER_SCALAR_FIELDS) {
    if (!deepEqual(base[field], head[field])) {
      const bVal = base[field];
      const hVal = head[field];
      changes.push({
        type: bVal === undefined ? 'added' : hVal === undefined ? 'removed' : 'modified',
        path: appendPointer(basePath, field),
        before: bVal,
        after: hVal,
      });
    }
  }

  // Schema (recursive)
  changes.push(...diffSchemas(base.schema, head.schema, appendPointer(basePath, 'schema')));

  // Extensions
  changes.push(...diffExtensionMap(base.extensions, head.extensions, appendPointer(basePath, 'extensions')));

  return changes;
}

// ---------------------------------------------------------------------------
// Request body (1.3.5)
// ---------------------------------------------------------------------------

/**
 * Compare two IRRequestBody values.
 * Returns `undefined` if both inputs are `undefined` (no change).
 */
export function diffRequestBody(
  base: IRRequestBody | undefined,
  head: IRRequestBody | undefined,
  basePath: string,
): RequestBodyDiff | undefined {
  if (!base && !head) return undefined;

  const result: RequestBodyDiff = { content: [], extensions: [] };

  if (!base || !head) {
    // Entirely added or removed — represent as a single content entry for the whole body.
    result.content.push({
      mediaType: '*',
      type: base ? 'removed' : 'added',
      jsonPointer: basePath,
      before: base ? Object.values(base.content)[0] : undefined,
      after: head ? Object.values(head.content)[0] : undefined,
      schemaChanges: [],
    });
    return result;
  }

  // required flag
  if (base.required !== head.required) {
    result.required = {
      type: 'modified',
      path: appendPointer(basePath, 'required'),
      before: base.required,
      after: head.required,
    };
  }

  // description
  if (base.description !== head.description) {
    result.description = {
      type: base.description === undefined ? 'added' : head.description === undefined ? 'removed' : 'modified',
      path: appendPointer(basePath, 'description'),
      before: base.description,
      after: head.description,
    };
  }

  // content (media types)
  result.content = diffMediaTypes(base.content, head.content, appendPointer(basePath, 'content'));

  // extensions
  result.extensions = diffExtensionMap(base.extensions, head.extensions, appendPointer(basePath, 'extensions'));

  const hasChanges =
    result.required !== undefined ||
    result.description !== undefined ||
    result.content.length > 0 ||
    result.extensions.length > 0;

  return hasChanges ? result : undefined;
}

// ---------------------------------------------------------------------------
// Media types — shared helper used by request body and responses
// ---------------------------------------------------------------------------

/**
 * Diff two media-type maps.
 * Keys are MIME type strings, e.g. `"application/json"`.
 */
export function diffMediaTypes(
  base: Record<string, import('../ir/types.js').IRMediaType>,
  head: Record<string, import('../ir/types.js').IRMediaType>,
  basePath: string,
): MediaTypeDiff[] {
  const diffs: MediaTypeDiff[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const mt of allKeys) {
    const bMt = base[mt];
    const hMt = head[mt];

    if (!bMt) {
      diffs.push({ mediaType: mt, type: 'added', jsonPointer: appendPointer(basePath, mt), before: undefined, after: hMt, schemaChanges: [] });
      continue;
    }
    if (!hMt) {
      diffs.push({ mediaType: mt, type: 'removed', jsonPointer: appendPointer(basePath, mt), before: bMt, after: undefined, schemaChanges: [] });
      continue;
    }

    const schemaChanges = diffSchemas(bMt.schema, hMt.schema, appendPointer(basePath, mt, 'schema'));
    const extChanges = diffExtensionMap(bMt.extensions, hMt.extensions, appendPointer(basePath, mt, 'extensions'));

    if (schemaChanges.length > 0 || extChanges.length > 0) {
      diffs.push({
        mediaType: mt,
        type: 'modified',
        jsonPointer: appendPointer(basePath, mt),
        before: bMt,
        after: hMt,
        schemaChanges: [...schemaChanges, ...extChanges],
      });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Extension map helper — used throughout the differ
// ---------------------------------------------------------------------------

export function diffExtensionMap(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  basePath: string,
): DiffItem[] {
  const changes: DiffItem[] = [];
  const b = base ?? {};
  const h = head ?? {};
  const allKeys = new Set([...Object.keys(b), ...Object.keys(h)]);

  for (const key of allKeys) {
    if (!deepEqual(b[key], h[key])) {
      const bVal = b[key];
      const hVal = h[key];
      changes.push({
        type: bVal === undefined ? 'added' : hVal === undefined ? 'removed' : 'modified',
        path: appendPointer(basePath, key),
        before: bVal,
        after: hVal,
      });
    }
  }

  return changes;
}
