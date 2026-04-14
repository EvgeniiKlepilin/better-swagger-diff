/**
 * Deep recursive comparison of IRSchema objects (task 1.3.7).
 *
 * Returns a flat list of DiffItem entries, each carrying a JSON Pointer,
 * the before value, and the after value.  Callers pass a `basePath` that
 * is prepended to every pointer — e.g. "/paths/~1pets/get/parameters/limit/schema".
 */

import type { IRSchema } from '../ir/types.js';
import type { DiffItem } from './types.js';
import { appendPointer, deepEqual } from './utils.js';

// ---------------------------------------------------------------------------
// Helper: compare a single scalar/array field atomically
// ---------------------------------------------------------------------------

function compareField(
  bVal: unknown,
  hVal: unknown,
  path: string,
  out: DiffItem[],
): void {
  if (deepEqual(bVal, hVal)) return;
  out.push({
    type: bVal === undefined ? 'added' : hVal === undefined ? 'removed' : 'modified',
    path,
    before: bVal,
    after: hVal,
  });
}

// ---------------------------------------------------------------------------
// Scalar fields — compared atomically
// ---------------------------------------------------------------------------

const SCALAR_FIELDS = [
  'type',
  'format',
  'nullable',
  'const',
  'minProperties',
  'maxProperties',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'contentMediaType',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'title',
  'description',
  'deprecated',
  'readOnly',
  'writeOnly',
  '$ref',
  '$dynamicRef',
  '$schema',
] as const satisfies Array<keyof IRSchema>;

// Fields whose values are arrays or arbitrary JSON but compared atomically
const ATOMIC_ARRAY_FIELDS = [
  'enum',
  'required',
  'prefixItems',
  'default',
  'example',
  'examples',
] as const satisfies Array<keyof IRSchema>;

// Composition arrays compared atomically (member order is significant)
const COMPOSITION_FIELDS = ['allOf', 'oneOf', 'anyOf'] as const satisfies Array<keyof IRSchema>;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Compare two IRSchema values and return a list of atomic DiffItems.
 *
 * If either schema is `undefined` the entire schema is treated as an
 * added/removed item; no field-level breakdown is produced.
 *
 * @param base      Schema from the base spec (or undefined if absent).
 * @param head      Schema from the head spec (or undefined if absent).
 * @param basePath  JSON Pointer prefix for all change entries.
 */
export function diffSchemas(
  base: IRSchema | undefined,
  head: IRSchema | undefined,
  basePath: string,
): DiffItem[] {
  if (!base && !head) return [];
  if (!base) return [{ type: 'added', path: basePath, before: undefined, after: head }];
  if (!head) return [{ type: 'removed', path: basePath, before: base, after: undefined }];

  const changes: DiffItem[] = [];
  const b = base;
  const h = head;

  // ── Scalar fields ─────────────────────────────────────────────────────────
  for (const field of SCALAR_FIELDS) {
    compareField(b[field], h[field], appendPointer(basePath, field), changes);
  }

  // ── Atomic array / any-JSON fields ────────────────────────────────────────
  for (const field of ATOMIC_ARRAY_FIELDS) {
    compareField(b[field], h[field], appendPointer(basePath, field), changes);
  }

  // ── Composition arrays (allOf / oneOf / anyOf) ────────────────────────────
  // Compared atomically; member order is semantically significant.
  for (const field of COMPOSITION_FIELDS) {
    compareField(b[field], h[field], appendPointer(basePath, field), changes);
  }

  // ── properties ────────────────────────────────────────────────────────────
  changes.push(
    ...diffSchemaRecord(b.properties, h.properties, appendPointer(basePath, 'properties')),
  );

  // ── additionalProperties ──────────────────────────────────────────────────
  changes.push(...diffBooleanOrSchema(b.additionalProperties, h.additionalProperties, appendPointer(basePath, 'additionalProperties')));

  // ── unevaluatedProperties (OAS 3.1) ───────────────────────────────────────
  changes.push(...diffBooleanOrSchema(b.unevaluatedProperties, h.unevaluatedProperties, appendPointer(basePath, 'unevaluatedProperties')));

  // ── items ─────────────────────────────────────────────────────────────────
  // In OAS 3.1 items can be an IRSchema[]; compare atomically when either side
  // is an array.  Otherwise recurse into the single-schema form.
  if (Array.isArray(b.items) || Array.isArray(h.items)) {
    compareField(b.items, h.items, appendPointer(basePath, 'items'), changes);
  } else {
    changes.push(
      ...diffSchemas(b.items as IRSchema | undefined, h.items as IRSchema | undefined, appendPointer(basePath, 'items')),
    );
  }

  // ── not ───────────────────────────────────────────────────────────────────
  changes.push(...diffSchemas(b.not, h.not, appendPointer(basePath, 'not')));

  // ── extensions ────────────────────────────────────────────────────────────
  // Extensions on schemas are compared atomically per key.
  const bExt = b.extensions ?? {};
  const hExt = h.extensions ?? {};
  for (const key of new Set([...Object.keys(bExt), ...Object.keys(hExt)])) {
    compareField(bExt[key], hExt[key], appendPointer(basePath, 'extensions', key), changes);
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Diff a Record<string, IRSchema> map, keyed by property name. */
export function diffSchemaRecord(
  base: Record<string, IRSchema> | undefined,
  head: Record<string, IRSchema> | undefined,
  basePath: string,
): DiffItem[] {
  const changes: DiffItem[] = [];
  const b = base ?? {};
  const h = head ?? {};
  const allKeys = new Set([...Object.keys(b), ...Object.keys(h)]);

  for (const key of allKeys) {
    changes.push(...diffSchemas(b[key], h[key], appendPointer(basePath, key)));
  }

  return changes;
}

/**
 * Diff a field whose value is either `boolean | IRSchema | undefined`.
 *
 * When both sides are `IRSchema` objects, recurse into them.
 * Otherwise compare atomically (catches boolean ↔ object changes too).
 */
function diffBooleanOrSchema(
  base: boolean | IRSchema | undefined,
  head: boolean | IRSchema | undefined,
  path: string,
): DiffItem[] {
  if (deepEqual(base, head)) return [];

  const baseIsObj = base !== undefined && typeof base === 'object';
  const headIsObj = head !== undefined && typeof head === 'object';

  if (baseIsObj && headIsObj) {
    return diffSchemas(base as IRSchema, head as IRSchema, path);
  }

  return [
    {
      type: base === undefined ? 'added' : head === undefined ? 'removed' : 'modified',
      path,
      before: base,
      after: head,
    },
  ];
}
