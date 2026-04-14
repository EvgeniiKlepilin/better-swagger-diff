import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type { IRSchema, NormalizeOptions } from './types.js';

type RawSchema =
  | OpenAPIV2.SchemaObject
  | OpenAPIV3.SchemaObject
  | OpenAPIV3_1.SchemaObject
  | Record<string, unknown>;

/** Pull `x-*` keys out of an object into a tidy record. */
function pickExtensions(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const exts: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (k.startsWith('x-')) exts[k] = obj[k];
  }
  return Object.keys(exts).length ? exts : undefined;
}

/** Convert a raw schema object from any spec version into an IRSchema. */
export function normalizeSchema(
  raw: RawSchema | boolean | undefined | null,
  opts: NormalizeOptions = {},
): IRSchema {
  // JSON Schema draft 2020-12 allows boolean schemas
  if (raw === true || raw === false) {
    return raw ? {} : { not: {} };
  }
  if (!raw || typeof raw !== 'object') return {};

  const s = raw as Record<string, unknown>;

  const ir: IRSchema = {};

  // --- type ---
  if (s['type'] !== undefined) {
    ir.type = s['type'] as string | string[];
  }
  if (s['format'] !== undefined) ir.format = s['format'] as string;
  if (s['nullable'] !== undefined) ir.nullable = s['nullable'] as boolean;
  if (s['enum'] !== undefined) ir.enum = s['enum'] as unknown[];
  if ('const' in s) ir.const = s['const'];
  if (s['$schema'] !== undefined) ir.$schema = s['$schema'] as string;
  if (s['$ref'] !== undefined) ir.$ref = s['$ref'] as string;
  if (s['$dynamicRef'] !== undefined) ir.$dynamicRef = s['$dynamicRef'] as string;

  // --- object ---
  if (s['properties']) {
    ir.properties = {};
    for (const [k, v] of Object.entries(s['properties'] as Record<string, RawSchema>)) {
      ir.properties[k] = normalizeSchema(v, opts);
    }
  }
  if (s['additionalProperties'] !== undefined) {
    const ap = s['additionalProperties'];
    ir.additionalProperties =
      typeof ap === 'boolean' ? ap : normalizeSchema(ap as RawSchema, opts);
  }
  if (s['unevaluatedProperties'] !== undefined) {
    const up = s['unevaluatedProperties'];
    ir.unevaluatedProperties =
      typeof up === 'boolean' ? up : normalizeSchema(up as RawSchema, opts);
  }
  if (s['required']) ir.required = s['required'] as string[];
  if (s['minProperties'] !== undefined) ir.minProperties = s['minProperties'] as number;
  if (s['maxProperties'] !== undefined) ir.maxProperties = s['maxProperties'] as number;

  // --- array ---
  if (s['items'] !== undefined) {
    const it = s['items'];
    ir.items = Array.isArray(it)
      ? (it as RawSchema[]).map((i) => normalizeSchema(i, opts))
      : normalizeSchema(it as RawSchema, opts);
  }
  if (s['prefixItems']) {
    ir.prefixItems = (s['prefixItems'] as RawSchema[]).map((i) => normalizeSchema(i, opts));
  }
  if (s['minItems'] !== undefined) ir.minItems = s['minItems'] as number;
  if (s['maxItems'] !== undefined) ir.maxItems = s['maxItems'] as number;
  if (s['uniqueItems'] !== undefined) ir.uniqueItems = s['uniqueItems'] as boolean;

  // --- string ---
  if (s['minLength'] !== undefined) ir.minLength = s['minLength'] as number;
  if (s['maxLength'] !== undefined) ir.maxLength = s['maxLength'] as number;
  if (s['pattern'] !== undefined) ir.pattern = s['pattern'] as string;
  if (s['contentMediaType'] !== undefined) ir.contentMediaType = s['contentMediaType'] as string;

  // --- numeric ---
  if (s['minimum'] !== undefined) ir.minimum = s['minimum'] as number;
  if (s['maximum'] !== undefined) ir.maximum = s['maximum'] as number;
  if (s['exclusiveMinimum'] !== undefined)
    ir.exclusiveMinimum = s['exclusiveMinimum'] as number | boolean;
  if (s['exclusiveMaximum'] !== undefined)
    ir.exclusiveMaximum = s['exclusiveMaximum'] as number | boolean;
  if (s['multipleOf'] !== undefined) ir.multipleOf = s['multipleOf'] as number;

  // --- composition ---
  if (s['allOf']) {
    ir.allOf = (s['allOf'] as RawSchema[]).map((sub) => normalizeSchema(sub, opts));
  }
  if (s['oneOf']) {
    ir.oneOf = (s['oneOf'] as RawSchema[]).map((sub) => normalizeSchema(sub, opts));
  }
  if (s['anyOf']) {
    ir.anyOf = (s['anyOf'] as RawSchema[]).map((sub) => normalizeSchema(sub, opts));
  }
  if (s['not']) {
    ir.not = normalizeSchema(s['not'] as RawSchema, opts);
  }

  // --- metadata ---
  if (s['title'] !== undefined) ir.title = s['title'] as string;
  if (s['description'] !== undefined) ir.description = s['description'] as string;
  if ('default' in s) ir.default = s['default'];
  if ('example' in s) ir.example = s['example'];
  if (s['examples'] !== undefined) ir.examples = s['examples'] as unknown[];
  if (s['deprecated'] !== undefined) ir.deprecated = s['deprecated'] as boolean;
  if (s['readOnly'] !== undefined) ir.readOnly = s['readOnly'] as boolean;
  if (s['writeOnly'] !== undefined) ir.writeOnly = s['writeOnly'] as boolean;

  // --- extensions ---
  ir.extensions = pickExtensions(s);

  // --- optional allOf flattening ---
  if (opts.flattenComposition && ir.allOf?.length) {
    const merged = flattenAllOf(ir.allOf);
    Object.assign(ir, merged);
  }

  // Remove undefined keys for cleanliness
  return pruneUndefined(ir);
}

/**
 * Merge an `allOf` array into a single partial IRSchema by shallow-merging
 * scalar fields and deep-merging `properties` / `required`.
 * The original `allOf` array is preserved on the result so callers can still
 * see the raw composition.
 */
function flattenAllOf(schemas: IRSchema[]): Partial<IRSchema> {
  const merged: Partial<IRSchema> = {};
  for (const s of schemas) {
    const { allOf: _nested, ...rest } = s;
    // Recurse into nested allOf
    const flat = _nested?.length ? flattenAllOf(_nested) : rest;
    for (const [k, v] of Object.entries(flat) as [keyof IRSchema, unknown][]) {
      if (k === 'properties' && merged.properties) {
        merged.properties = { ...merged.properties, ...(v as Record<string, IRSchema>) };
      } else if (k === 'required' && merged.required) {
        const existing = new Set(merged.required);
        for (const r of v as string[]) existing.add(r);
        merged.required = [...existing];
      } else {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
  }
  return merged;
}

function pruneUndefined<T extends object>(obj: T): T {
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}
