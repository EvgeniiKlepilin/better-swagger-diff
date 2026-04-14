/**
 * Differ for IROperation objects (task 1.3.3, 1.3.12).
 */

import type { IROperation } from '../ir/types.js';
import type { DiffItem, OperationDiff } from './types.js';
import { appendPointer, deepEqual } from './utils.js';
import { diffParameters, diffRequestBody, diffExtensionMap } from './diff-params.js';
import { diffResponses } from './diff-responses.js';

// Scalar fields on an operation that are compared atomically.
const OPERATION_SCALAR_FIELDS = [
  'operationId',
  'summary',
  'description',
  'deprecated',  // 1.3.12 — deprecated flag tracking
] as const satisfies Array<keyof IROperation>;

/**
 * Diff a single pair of operations (same path + method).
 * Returns `null` when the operations are identical.
 */
export function diffOperation(
  pathTemplate: string,
  method: import('../ir/types.js').HttpMethod,
  base: IROperation,
  head: IROperation,
  basePath: string,
  includeExtensions: boolean,
): OperationDiff | null {
  const changes: DiffItem[] = [];

  // ── Scalar fields ──────────────────────────────────────────────────────────
  for (const field of OPERATION_SCALAR_FIELDS) {
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

  // ── tags ───────────────────────────────────────────────────────────────────
  if (!deepEqual(base.tags, head.tags)) {
    changes.push({
      type: base.tags === undefined ? 'added' : head.tags === undefined ? 'removed' : 'modified',
      path: appendPointer(basePath, 'tags'),
      before: base.tags,
      after: head.tags,
    });
  }

  // ── parameters ────────────────────────────────────────────────────────────
  const parameters = diffParameters(base.parameters, head.parameters, appendPointer(basePath, 'parameters'));

  // ── requestBody ───────────────────────────────────────────────────────────
  const requestBody = diffRequestBody(base.requestBody, head.requestBody, appendPointer(basePath, 'requestBody'));

  // ── responses ─────────────────────────────────────────────────────────────
  const responses = diffResponses(base.responses, head.responses, appendPointer(basePath, 'responses'));

  // ── security requirements ─────────────────────────────────────────────────
  let security: DiffItem<import('../ir/types.js').IRSecurityRequirement[]> | undefined;
  if (!deepEqual(base.security, head.security)) {
    security = {
      type: base.security === undefined ? 'added' : head.security === undefined ? 'removed' : 'modified',
      path: appendPointer(basePath, 'security'),
      before: base.security,
      after: head.security,
    };
  }

  // ── extensions ────────────────────────────────────────────────────────────
  const extensions = includeExtensions
    ? diffExtensionMap(base.extensions, head.extensions, appendPointer(basePath, 'extensions'))
    : [];

  const hasChanges =
    changes.length > 0 ||
    parameters.length > 0 ||
    requestBody !== undefined ||
    responses.length > 0 ||
    security !== undefined ||
    extensions.length > 0;

  if (!hasChanges) return null;

  return {
    path: pathTemplate,
    method,
    type: 'modified',
    jsonPointer: basePath,
    before: base,
    after: head,
    changes,
    parameters,
    requestBody,
    responses,
    security,
    extensions,
  };
}
