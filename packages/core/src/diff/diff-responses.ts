/**
 * Differ for IRResponse maps (task 1.3.6).
 */

import type { IRHeader, IRResponse } from '../ir/types.js';
import type { DiffItem, HeaderDiff, ResponseDiff } from './types.js';
import { appendPointer, deepEqual } from './utils.js';
import { diffSchemas } from './diff-schema.js';
import { diffExtensionMap, diffMediaTypes } from './diff-params.js';

// ---------------------------------------------------------------------------
// Responses (keyed by status code string)
// ---------------------------------------------------------------------------

/**
 * Diff two response maps.
 *
 * @param base      Response map from the base spec.
 * @param head      Response map from the head spec.
 * @param basePath  JSON Pointer prefix, e.g. "/paths/~1pets/get/responses".
 */
export function diffResponses(
  base: Record<string, IRResponse>,
  head: Record<string, IRResponse>,
  basePath: string,
): ResponseDiff[] {
  const diffs: ResponseDiff[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const statusCode of allKeys) {
    const bResp = base[statusCode];
    const hResp = head[statusCode];

    if (!bResp) {
      diffs.push({
        statusCode,
        type: 'added',
        jsonPointer: appendPointer(basePath, statusCode),
        before: undefined,
        after: hResp,
        changes: [],
        content: [],
        headers: [],
      });
      continue;
    }

    if (!hResp) {
      diffs.push({
        statusCode,
        type: 'removed',
        jsonPointer: appendPointer(basePath, statusCode),
        before: bResp,
        after: undefined,
        changes: [],
        content: [],
        headers: [],
      });
      continue;
    }

    const ptr = appendPointer(basePath, statusCode);
    const changes: DiffItem[] = [];

    // description
    if (bResp.description !== hResp.description) {
      changes.push({
        type: 'modified',
        path: appendPointer(ptr, 'description'),
        before: bResp.description,
        after: hResp.description,
      });
    }

    // extensions
    changes.push(...diffExtensionMap(bResp.extensions, hResp.extensions, appendPointer(ptr, 'extensions')));

    // content (media types)
    const content = diffMediaTypes(bResp.content, hResp.content, appendPointer(ptr, 'content'));

    // headers
    const headers = diffHeaders(bResp.headers ?? {}, hResp.headers ?? {}, appendPointer(ptr, 'headers'));

    if (changes.length > 0 || content.length > 0 || headers.length > 0) {
      diffs.push({
        statusCode,
        type: 'modified',
        jsonPointer: ptr,
        before: bResp,
        after: hResp,
        changes,
        content,
        headers,
      });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

const HEADER_SCALAR_FIELDS = [
  'description',
  'required',
  'deprecated',
] as const satisfies Array<keyof IRHeader>;

function diffHeaders(
  base: Record<string, IRHeader>,
  head: Record<string, IRHeader>,
  basePath: string,
): HeaderDiff[] {
  const diffs: HeaderDiff[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const name of allKeys) {
    const bHdr = base[name];
    const hHdr = head[name];

    if (!bHdr) {
      diffs.push({ name, type: 'added', jsonPointer: appendPointer(basePath, name), before: undefined, after: hHdr, changes: [] });
      continue;
    }
    if (!hHdr) {
      diffs.push({ name, type: 'removed', jsonPointer: appendPointer(basePath, name), before: bHdr, after: undefined, changes: [] });
      continue;
    }

    const ptr = appendPointer(basePath, name);
    const changes: DiffItem[] = [];

    for (const field of HEADER_SCALAR_FIELDS) {
      if (!deepEqual(bHdr[field], hHdr[field])) {
        const bVal = bHdr[field];
        const hVal = hHdr[field];
        changes.push({
          type: bVal === undefined ? 'added' : hVal === undefined ? 'removed' : 'modified',
          path: appendPointer(ptr, field),
          before: bVal,
          after: hVal,
        });
      }
    }

    changes.push(...diffSchemas(bHdr.schema, hHdr.schema, appendPointer(ptr, 'schema')));
    changes.push(...diffExtensionMap(bHdr.extensions, hHdr.extensions, appendPointer(ptr, 'extensions')));

    if (changes.length > 0) {
      diffs.push({ name, type: 'modified', jsonPointer: ptr, before: bHdr, after: hHdr, changes });
    }
  }

  return diffs;
}
