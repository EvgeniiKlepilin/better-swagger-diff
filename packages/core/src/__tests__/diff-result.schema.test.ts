/**
 * Tests for Story 1.4 — Diff Result Schema.
 *
 * 1.4.1  DiffResult TypeScript type with full JSDoc (verified by typecheck).
 * 1.4.2  DiffItem carries location (SourceLocation) field.
 * 1.4.3  JSON Schema for DiffResult is exported and structurally valid.
 * 1.4.4  DiffResult is round-trip JSON serializable.
 */

import { describe, it, expect } from 'vitest';
import { diff } from '../diff/differ.js';
import { DIFF_RESULT_SCHEMA } from '../diff/diff-result.schema.js';
import type { DiffItem, DiffResult, SourceLocation } from '../diff/types.js';
import type { IRSpec } from '../ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides: Partial<IRSpec> = {}): IRSpec {
  return {
    sourceVersion: 'openapi-3.0',
    info: { title: 'Test API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
    paths: {},
    securitySchemes: {},
    tags: [],
    ...overrides,
  };
}

/** Deep-equal comparison that also verifies the same keys are present. */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Round-trip a value through JSON serialization. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// 1.4.2 — SourceLocation type exists and is assignable to DiffItem.location
// ---------------------------------------------------------------------------

describe('Story 1.4.2 — SourceLocation on DiffItem', () => {
  it('SourceLocation has required line and column fields', () => {
    const loc: SourceLocation = { line: 10, column: 5 };
    expect(loc.line).toBe(10);
    expect(loc.column).toBe(5);
    expect(loc.source).toBeUndefined();
  });

  it('SourceLocation accepts an optional source field', () => {
    const loc: SourceLocation = { line: 3, column: 1, source: '/api/openapi.yaml' };
    expect(loc.source).toBe('/api/openapi.yaml');
  });

  it('DiffItem accepts a location field', () => {
    const item: DiffItem<string> = {
      type: 'modified',
      path: '/info/title',
      location: { line: 2, column: 10, source: 'openapi.yaml' },
      before: 'Old Title',
      after: 'New Title',
    };
    expect(item.location).toBeDefined();
    expect(item.location?.line).toBe(2);
    expect(item.location?.source).toBe('openapi.yaml');
  });

  it('DiffItem.location is optional — absent location is fine', () => {
    const item: DiffItem<number> = {
      type: 'added',
      path: '/info/version',
      after: 42,
    };
    expect(item.location).toBeUndefined();
  });

  it('SourceLocation is preserved through JSON round-trip', () => {
    const item: DiffItem<string> = {
      type: 'removed',
      path: '/servers/0/url',
      location: { line: 8, column: 3 },
      before: 'https://old.example.com',
    };
    const restored = roundTrip(item);
    expect(restored.location).toEqual({ line: 8, column: 3 });
    expect(restored.before).toBe('https://old.example.com');
    expect(restored.after).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 1.4.3 — JSON Schema for DiffResult is structurally sound
// ---------------------------------------------------------------------------

describe('Story 1.4.3 — DIFF_RESULT_SCHEMA', () => {
  it('is exported as a non-null object', () => {
    expect(DIFF_RESULT_SCHEMA).toBeDefined();
    expect(typeof DIFF_RESULT_SCHEMA).toBe('object');
  });

  it('has $schema set to JSON Schema draft-07', () => {
    expect(DIFF_RESULT_SCHEMA.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('has $id', () => {
    expect(typeof DIFF_RESULT_SCHEMA.$id).toBe('string');
    expect(DIFF_RESULT_SCHEMA.$id.length).toBeGreaterThan(0);
  });

  it('title is "DiffResult"', () => {
    expect(DIFF_RESULT_SCHEMA.title).toBe('DiffResult');
  });

  it('required includes all mandatory DiffResult keys', () => {
    const required = DIFF_RESULT_SCHEMA.required as readonly string[];
    for (const key of ['isEmpty', 'paths', 'webhooks', 'securitySchemes', 'tags', 'servers', 'extensions']) {
      expect(required).toContain(key);
    }
  });

  it('properties includes all DiffResult fields', () => {
    const props = Object.keys(DIFF_RESULT_SCHEMA.properties);
    expect(props).toContain('isEmpty');
    expect(props).toContain('paths');
    expect(props).toContain('webhooks');
    expect(props).toContain('securitySchemes');
    expect(props).toContain('security');
    expect(props).toContain('tags');
    expect(props).toContain('servers');
    expect(props).toContain('extensions');
  });

  it('$defs includes all reusable sub-schema definitions', () => {
    const defs = Object.keys(DIFF_RESULT_SCHEMA.$defs);
    for (const name of [
      'DiffChangeType',
      'SourceLocation',
      'DiffItemAny',
      'DiffItemObject',
      'ParameterDiff',
      'MediaTypeDiff',
      'RequestBodyDiff',
      'HeaderDiff',
      'ResponseDiff',
      'OperationDiff',
      'PathDiff',
    ]) {
      expect(defs).toContain(name);
    }
  });

  it('DiffChangeType enum contains added, removed, modified', () => {
    const enumValues = DIFF_RESULT_SCHEMA.$defs.DiffChangeType.enum as readonly string[];
    expect(enumValues).toContain('added');
    expect(enumValues).toContain('removed');
    expect(enumValues).toContain('modified');
  });

  it('SourceLocation required fields are line and column', () => {
    const required = DIFF_RESULT_SCHEMA.$defs.SourceLocation.required as readonly string[];
    expect(required).toContain('line');
    expect(required).toContain('column');
  });

  it('schema itself is JSON serializable', () => {
    expect(() => JSON.stringify(DIFF_RESULT_SCHEMA)).not.toThrow();
    const restored = JSON.parse(JSON.stringify(DIFF_RESULT_SCHEMA));
    expect(restored.title).toBe('DiffResult');
  });
});

// ---------------------------------------------------------------------------
// 1.4.4 — DiffResult is round-trip JSON serializable
// ---------------------------------------------------------------------------

describe('Story 1.4.4 — DiffResult round-trip serialization', () => {
  it('empty diff result is round-trip safe', () => {
    const result = diff(makeSpec(), makeSpec());
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
  });

  it('result with added path round-trips cleanly', () => {
    const base = makeSpec();
    const head = makeSpec({
      paths: {
        '/users': {
          parameters: [],
          operations: {
            get: {
              operationId: 'listUsers',
              parameters: [],
              responses: {
                '200': {
                  description: 'OK',
                  content: { 'application/json': { schema: { type: 'array' } } },
                },
              },
            },
          },
        },
      },
    });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
    expect(restored.isEmpty).toBe(false);
    expect(restored.paths).toHaveLength(1);
    expect(restored.paths[0]!.type).toBe('added');
  });

  it('result with modified parameter round-trips cleanly', () => {
    const param = (required: boolean) => ({
      name: 'limit',
      in: 'query' as const,
      required,
      schema: { type: 'integer' as const },
    });
    const baseOp = {
      parameters: [param(false)],
      responses: { '200': { description: 'OK', content: {} } },
    };
    const headOp = {
      parameters: [param(true)],
      responses: { '200': { description: 'OK', content: {} } },
    };
    const base = makeSpec({
      paths: { '/items': { parameters: [], operations: { get: baseOp } } },
    });
    const head = makeSpec({
      paths: { '/items': { parameters: [], operations: { get: headOp } } },
    });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
    expect(restored.isEmpty).toBe(false);
    const opDiff = restored.paths[0]!.operations[0]!;
    expect(opDiff.parameters).toHaveLength(1);
    expect(opDiff.parameters[0]!.type).toBe('modified');
  });

  it('result with security scheme changes round-trips cleanly', () => {
    const base = makeSpec({
      securitySchemes: {
        ApiKey: { type: 'apiKey', name: 'X-Api-Key', in: 'header' },
      },
    });
    const head = makeSpec({ securitySchemes: {} });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
    expect(restored.securitySchemes).toHaveLength(1);
    expect(restored.securitySchemes[0]!.type).toBe('removed');
  });

  it('result with tag changes round-trips cleanly', () => {
    const base = makeSpec({
      tags: [{ name: 'users', description: 'User operations' }],
    });
    const head = makeSpec({
      tags: [
        { name: 'users', description: 'User operations' },
        { name: 'orders', description: 'Order operations' },
      ],
    });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
    expect(restored.tags).toHaveLength(1);
    expect(restored.tags[0]!.type).toBe('added');
    expect((restored.tags[0]!.after as { name: string }).name).toBe('orders');
  });

  it('result with server changes round-trips cleanly', () => {
    const base = makeSpec({ servers: [{ url: 'https://v1.api.example.com' }] });
    const head = makeSpec({ servers: [{ url: 'https://v2.api.example.com' }] });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
  });

  it('result with extension changes round-trips cleanly', () => {
    const base = makeSpec({ extensions: { 'x-internal': true } });
    const head = makeSpec({ extensions: { 'x-internal': false } });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
  });

  it('undefined optional fields are absent (not null) after round-trip', () => {
    const result = diff(makeSpec(), makeSpec());
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as DiffResult;
    // security is optional — must not appear as null in JSON
    expect(Object.prototype.hasOwnProperty.call(parsed, 'security')).toBe(false);
  });

  it('DiffItem.location survives round-trip when present', () => {
    // We inject a location into a DiffItem to prove the field round-trips.
    // (The differ does not populate location today — that requires parser
    //  integration — but the type and serialization must work correctly.)
    const item: DiffItem = {
      type: 'modified',
      path: '/info/version',
      location: { line: 5, column: 12, source: 'petstore.yaml' },
      before: '1.0.0',
      after: '2.0.0',
    };
    const restored = roundTrip(item);
    expect(restored.location).toEqual({ line: 5, column: 12, source: 'petstore.yaml' });
    expect(restored.before).toBe('1.0.0');
    expect(restored.after).toBe('2.0.0');
  });

  it('complete diff with responses and request bodies round-trips cleanly', () => {
    const makeOperation = (schemaType: string) => ({
      parameters: [{ name: 'id', in: 'path' as const, required: true }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: schemaType, properties: { name: { type: 'string' } } },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
          headers: {
            'X-Rate-Limit': { description: 'Rate limit remaining' },
          },
        },
        '404': { description: 'Not found', content: {} },
      },
    });
    const base = makeSpec({
      paths: {
        '/resources': {
          parameters: [],
          operations: { post: makeOperation('object') },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/resources': {
          parameters: [],
          operations: { post: makeOperation('string') },
        },
      },
    });
    const result = diff(base, head);
    const restored = roundTrip(result);
    expect(deepEqual(result, restored)).toBe(true);
  });
});
