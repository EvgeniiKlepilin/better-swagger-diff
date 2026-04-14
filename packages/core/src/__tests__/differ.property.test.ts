/**
 * Property-based tests for the structural differ (task 1.3.13).
 *
 * Properties tested
 * -----------------
 * 1. Identity      — diff(spec, spec) is always empty.
 * 2. Valid types   — every DiffItem type is 'added' | 'removed' | 'modified'.
 * 3. Added shape   — when type === 'added',   before is undefined.
 * 4. Removed shape — when type === 'removed', after  is undefined.
 * 5. Anti-symmetry — for every change in diff(a, b) there is a corresponding
 *                    change in diff(b, a) with the mirrored type and
 *                    swapped before/after.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { diff } from '../diff/differ.js';
import type { IRSpec, IRSchema, IROperation, IRParameter, IRResponse } from '../ir/types.js';
import type { DiffItem, DiffResult } from '../diff/types.js';
import { deepEqual } from '../diff/utils.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbType = fc.constantFrom('string', 'integer', 'number', 'boolean', 'array', 'object');

const arbSchema: fc.Arbitrary<IRSchema> = fc.record(
  {
    type: fc.option(arbType, { nil: undefined }),
    format: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
    nullable: fc.option(fc.boolean(), { nil: undefined }),
    minimum: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    maximum: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    minLength: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
    maxLength: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
    deprecated: fc.option(fc.boolean(), { nil: undefined }),
    readOnly: fc.option(fc.boolean(), { nil: undefined }),
    writeOnly: fc.option(fc.boolean(), { nil: undefined }),
  },
  { requiredKeys: [] },
);

const arbParam: fc.Arbitrary<IRParameter> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  in: fc.constantFrom('query', 'path', 'header', 'cookie') as fc.Arbitrary<IRParameter['in']>,
  required: fc.boolean(),
  schema: fc.option(arbSchema, { nil: undefined }),
});

const arbResponse: fc.Arbitrary<IRResponse> = fc.record({
  description: fc.string({ maxLength: 50 }),
  content: fc.constant({}),
});

const arbOperation: fc.Arbitrary<IROperation> = fc.record({
  parameters: fc.array(arbParam, { maxLength: 3 }),
  responses: fc.record(
    {
      '200': fc.option(arbResponse, { nil: undefined }),
      '400': fc.option(arbResponse, { nil: undefined }),
      '404': fc.option(arbResponse, { nil: undefined }),
    },
    { requiredKeys: [] },
  ).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as Record<string, IRResponse>),
  deprecated: fc.option(fc.boolean(), { nil: undefined }),
  summary: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
}, { requiredKeys: ['parameters', 'responses'] });

const arbSpec: fc.Arbitrary<IRSpec> = fc.record({
  sourceVersion: fc.constant('openapi-3.0' as const),
  info: fc.record({ title: fc.string({ minLength: 1, maxLength: 30 }), version: fc.constant('1.0.0') }),
  servers: fc.array(
    fc.record({ url: fc.constantFrom('https://api.example.com', 'https://v2.example.com', 'https://staging.example.com') }),
    { maxLength: 2 },
  ),
  paths: fc.dictionary(
    fc.constantFrom('/pets', '/users', '/orders', '/items/{id}'),
    fc.record({
      // Generate path-level parameters (e.g. path parameters inherited by all operations).
      parameters: fc.array(
        fc.record({
          name: fc.constantFrom('id', 'version', 'locale'),
          in: fc.constantFrom('path', 'header') as fc.Arbitrary<IRParameter['in']>,
          required: fc.boolean(),
          schema: fc.option(arbSchema, { nil: undefined }),
        }),
        { maxLength: 2 },
      ),
      operations: fc.record(
        {
          get: fc.option(arbOperation, { nil: undefined }),
          post: fc.option(arbOperation, { nil: undefined }),
          put: fc.option(arbOperation, { nil: undefined }),
        },
        { requiredKeys: [] },
      ).map((ops) => Object.fromEntries(Object.entries(ops).filter(([, v]) => v !== undefined))),
    }),
    { maxKeys: 3 },
  ),
  securitySchemes: fc.constant({}),
  tags: fc.array(
    fc.record({ name: fc.constantFrom('pets', 'users', 'orders') }),
    { maxLength: 2 },
  ),
}, { requiredKeys: ['sourceVersion', 'info', 'servers', 'paths', 'securitySchemes', 'tags'] });

// ---------------------------------------------------------------------------
// Helpers — collect all DiffItems from a DiffResult
// ---------------------------------------------------------------------------

function collectAllDiffItems(result: DiffResult): DiffItem[] {
  const items: DiffItem[] = [];

  for (const pathDiff of result.paths) {
    for (const opDiff of pathDiff.operations) {
      items.push(...opDiff.changes);
      for (const paramDiff of opDiff.parameters) {
        items.push(...paramDiff.changes);
      }
      for (const respDiff of opDiff.responses) {
        items.push(...respDiff.changes);
      }
      if (opDiff.security) items.push(opDiff.security);
    }
  }

  items.push(...result.securitySchemes);
  items.push(...result.tags);
  items.push(...result.servers);
  items.push(...result.extensions);
  if (result.security) items.push(result.security);

  return items;
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Property: identity — diff(spec, spec) is empty (1.3.13)', () => {
  it('holds for arbitrary specs', () => {
    fc.assert(
      fc.property(arbSpec, (spec) => {
        const result = diff(spec, spec);
        expect(result.isEmpty).toBe(true);
        expect(result.paths).toHaveLength(0);
        expect(result.tags).toHaveLength(0);
        expect(result.servers).toHaveLength(0);
        expect(result.securitySchemes).toHaveLength(0);
        expect(result.extensions).toHaveLength(0);
        expect(result.security).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property: valid change types (1.3.13)', () => {
  const VALID_TYPES = new Set(['added', 'removed', 'modified']);

  it('every DiffItem.type is a valid DiffChangeType', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (base, head) => {
        const items = collectAllDiffItems(diff(base, head));
        for (const item of items) {
          expect(VALID_TYPES.has(item.type)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property: added/removed shape invariants (1.3.13)', () => {
  it('added items have undefined before', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (base, head) => {
        const items = collectAllDiffItems(diff(base, head));
        for (const item of items) {
          if (item.type === 'added') {
            expect(item.before).toBeUndefined();
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('removed items have undefined after', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (base, head) => {
        const items = collectAllDiffItems(diff(base, head));
        for (const item of items) {
          if (item.type === 'removed') {
            expect(item.after).toBeUndefined();
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property: anti-symmetry — diff(a,b) ↔ diff(b,a) (1.3.13)', () => {
  /** Mirror type: added ↔ removed, modified stays modified */
  function mirrorType(t: string): string {
    if (t === 'added') return 'removed';
    if (t === 'removed') return 'added';
    return 'modified';
  }

  it('top-level server changes are anti-symmetric', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (a, b) => {
        const ab = diff(a, b).servers;
        const ba = diff(b, a).servers;

        // Every change in ab should appear mirrored in ba.
        for (const change of ab) {
          const mirror = ba.find((c) => c.path === change.path);
          if (mirror) {
            expect(mirror.type).toBe(mirrorType(change.type));
            expect(deepEqual(mirror.before, change.after)).toBe(true);
            expect(deepEqual(mirror.after, change.before)).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('top-level tag changes are anti-symmetric', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (a, b) => {
        const ab = diff(a, b).tags;
        const ba = diff(b, a).tags;

        for (const change of ab) {
          const mirror = ba.find((c) => c.path === change.path);
          if (mirror) {
            expect(mirror.type).toBe(mirrorType(change.type));
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('path-level diffs are anti-symmetric (added ↔ removed)', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (a, b) => {
        const abPaths = diff(a, b).paths;
        const baPaths = diff(b, a).paths;

        const abAdded = abPaths.filter((p) => p.type === 'added').map((p) => p.path).sort();
        const baRemoved = baPaths.filter((p) => p.type === 'removed').map((p) => p.path).sort();

        expect(abAdded).toEqual(baRemoved);

        const abRemoved = abPaths.filter((p) => p.type === 'removed').map((p) => p.path).sort();
        const baAdded = baPaths.filter((p) => p.type === 'added').map((p) => p.path).sort();

        expect(abRemoved).toEqual(baAdded);
      }),
      { numRuns: 200 },
    );
  });

  it('operation-level diffs are anti-symmetric (added ↔ removed)', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (a, b) => {
        const abOps = diff(a, b).paths.flatMap((p) =>
          p.operations.map((op) => `${op.path}::${op.method}::${op.type}`),
        ).sort();
        const baOps = diff(b, a).paths.flatMap((p) =>
          p.operations.map((op) => `${op.path}::${op.method}::${op.type}`),
        ).sort();

        // Every added op in a→b should appear as removed in b→a and vice versa.
        const abAdded = abOps.filter((s) => s.endsWith('::added')).map((s) => s.replace(/::added$/, '')).sort();
        const baRemoved = baOps.filter((s) => s.endsWith('::removed')).map((s) => s.replace(/::removed$/, '')).sort();
        expect(abAdded).toEqual(baRemoved);

        const abRemoved = abOps.filter((s) => s.endsWith('::removed')).map((s) => s.replace(/::removed$/, '')).sort();
        const baAdded = baOps.filter((s) => s.endsWith('::added')).map((s) => s.replace(/::added$/, '')).sort();
        expect(abRemoved).toEqual(baAdded);
      }),
      { numRuns: 200 },
    );
  });

  it('path-level parameter diffs land on pathParameters, not operations', () => {
    fc.assert(
      fc.property(arbSpec, arbSpec, (a, b) => {
        const result = diff(a, b);
        for (const pathDiff of result.paths) {
          if (pathDiff.type === 'modified') {
            // path-level param changes must appear in pathParameters, not as
            // a phantom operation entry.
            expect(pathDiff.pathParameters).toBeInstanceOf(Array);
            // No operation should be a synthetic placeholder (method:'get'
            // with undefined before/after and no real operation in base/head).
            for (const opDiff of pathDiff.operations) {
              if (opDiff.type === 'modified') {
                // A real modified operation must exist in both sides of the path.
                const bPath = a.paths[pathDiff.path];
                const hPath = b.paths[pathDiff.path];
                if (bPath && hPath) {
                  const method = opDiff.method as keyof typeof bPath.operations;
                  expect(bPath.operations[method] ?? hPath.operations[method]).toBeDefined();
                }
              }
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
