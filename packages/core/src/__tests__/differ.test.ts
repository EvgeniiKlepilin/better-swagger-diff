/**
 * Unit tests for the structural differ (Story 1.3).
 *
 * Tests are organised per task:
 *  1.3.1  top-level diff()
 *  1.3.2  path-level diffs
 *  1.3.3  operation-level diffs
 *  1.3.4  parameter diffs
 *  1.3.5  request body diffs
 *  1.3.6  response diffs
 *  1.3.7  schema diffs
 *  1.3.8  security scheme + operation security diffs
 *  1.3.9  tag diffs
 *  1.3.10 server/basePath diffs
 *  1.3.11 x-extension diffs
 *  1.3.12 deprecated flag tracking
 */

import { describe, it, expect } from 'vitest';
import { diff } from '../diff/differ.js';
import { diffSchemas } from '../diff/diff-schema.js';
import type { IRSpec, IRSchema } from '../ir/types.js';

// ---------------------------------------------------------------------------
// Minimal spec builder
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

// ---------------------------------------------------------------------------
// 1.3.1 — top-level diff
// ---------------------------------------------------------------------------

describe('diff() — top-level (1.3.1)', () => {
  it('returns isEmpty:true for identical specs', () => {
    const spec = makeSpec();
    const result = diff(spec, spec);
    expect(result.isEmpty).toBe(true);
  });

  it('returns isEmpty:false when paths differ', () => {
    const base = makeSpec();
    const head = makeSpec({
      paths: {
        '/users': {
          parameters: [],
          operations: { get: { parameters: [], responses: {}, extensions: undefined } },
        },
      },
    });
    const result = diff(base, head);
    expect(result.isEmpty).toBe(false);
  });

  it('result has all top-level keys', () => {
    const result = diff(makeSpec(), makeSpec());
    expect(result).toHaveProperty('isEmpty');
    expect(result).toHaveProperty('paths');
    expect(result).toHaveProperty('webhooks');
    expect(result).toHaveProperty('securitySchemes');
    expect(result).toHaveProperty('tags');
    expect(result).toHaveProperty('servers');
    expect(result).toHaveProperty('extensions');
  });
});

// ---------------------------------------------------------------------------
// 1.3.2 — path-level diffs
// ---------------------------------------------------------------------------

describe('path-level diffs (1.3.2)', () => {
  it('detects added path', () => {
    const base = makeSpec({ paths: {} });
    const head = makeSpec({
      paths: {
        '/pets': { parameters: [], operations: {}, extensions: undefined },
      },
    });
    const { paths } = diff(base, head);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ path: '/pets', type: 'added' });
    expect(paths[0]!.before).toBeUndefined();
    expect(paths[0]!.after).toBeDefined();
  });

  it('detects removed path', () => {
    const base = makeSpec({
      paths: { '/pets': { parameters: [], operations: {}, extensions: undefined } },
    });
    const head = makeSpec({ paths: {} });
    const { paths } = diff(base, head);
    expect(paths[0]).toMatchObject({ path: '/pets', type: 'removed' });
    expect(paths[0]!.after).toBeUndefined();
  });

  it('detects no path change when paths are identical', () => {
    const pathItem = { parameters: [], operations: {}, extensions: undefined };
    const spec = makeSpec({ paths: { '/pets': pathItem } });
    const { paths } = diff(spec, spec);
    expect(paths).toHaveLength(0);
  });

  it('JSON pointer is correct for added path', () => {
    const base = makeSpec({ paths: {} });
    const head = makeSpec({ paths: { '/pets/{id}': { parameters: [], operations: {} } } });
    const { paths } = diff(base, head);
    expect(paths[0]!.jsonPointer).toBe('/paths/~1pets~1{id}');
  });
});

// ---------------------------------------------------------------------------
// 1.3.3 — operation-level diffs
// ---------------------------------------------------------------------------

describe('operation-level diffs (1.3.3)', () => {
  it('detects added operation', () => {
    const base = makeSpec({
      paths: { '/pets': { parameters: [], operations: {} } },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: { parameters: [], responses: { '200': { description: 'ok', content: {} } } },
          },
        },
      },
    });
    const { paths } = diff(base, head);
    expect(paths[0]!.operations[0]).toMatchObject({ method: 'get', type: 'added' });
  });

  it('detects removed operation', () => {
    const base = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: { parameters: [], responses: {} },
          },
        },
      },
    });
    const head = makeSpec({ paths: { '/pets': { parameters: [], operations: {} } } });
    const { paths } = diff(base, head);
    expect(paths[0]!.operations[0]).toMatchObject({ method: 'get', type: 'removed' });
  });

  it('detects modified operation summary', () => {
    const base = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: { summary: 'List pets', parameters: [], responses: {} },
          },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: { summary: 'Get all pets', parameters: [], responses: {} },
          },
        },
      },
    });
    const { paths } = diff(base, head);
    const opDiff = paths[0]!.operations[0]!;
    expect(opDiff.type).toBe('modified');
    const summaryChange = opDiff.changes.find((c) => c.path.endsWith('/summary'));
    expect(summaryChange).toMatchObject({ type: 'modified', before: 'List pets', after: 'Get all pets' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.4 — parameter diffs
// ---------------------------------------------------------------------------

describe('parameter diffs (1.3.4)', () => {
  it('detects added query parameter', () => {
    const base = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: { get: { parameters: [], responses: {} } },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: {
              parameters: [{ name: 'limit', in: 'query', required: false }],
              responses: {},
            },
          },
        },
      },
    });
    const opDiff = diff(base, head).paths[0]!.operations[0]!;
    expect(opDiff.parameters[0]).toMatchObject({ name: 'limit', in: 'query', type: 'added' });
  });

  it('detects removed path parameter', () => {
    const base = makeSpec({
      paths: {
        '/pets/{id}': {
          parameters: [],
          operations: {
            get: {
              parameters: [{ name: 'id', in: 'path', required: true }],
              responses: {},
            },
          },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/pets/{id}': {
          parameters: [],
          operations: { get: { parameters: [], responses: {} } },
        },
      },
    });
    const opDiff = diff(base, head).paths[0]!.operations[0]!;
    expect(opDiff.parameters[0]).toMatchObject({ name: 'id', in: 'path', type: 'removed' });
  });

  it('detects required flag change on parameter', () => {
    const makeParam = (required: boolean) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: {
                parameters: [{ name: 'tag', in: 'query', required }],
                responses: {},
              },
            },
          },
        },
      });

    const opDiff = diff(makeParam(false), makeParam(true)).paths[0]!.operations[0]!;
    const paramDiff = opDiff.parameters[0]!;
    expect(paramDiff.type).toBe('modified');
    const req = paramDiff.changes.find((c) => c.path.endsWith('/required'));
    expect(req).toMatchObject({ before: false, after: true });
  });

  it('detects schema type change on parameter', () => {
    const makeParam = (type: string) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: {
                parameters: [{ name: 'limit', in: 'query', required: false, schema: { type } }],
                responses: {},
              },
            },
          },
        },
      });

    const opDiff = diff(makeParam('integer'), makeParam('string')).paths[0]!.operations[0]!;
    const paramDiff = opDiff.parameters[0]!;
    const typeChange = paramDiff.changes.find((c) => c.path.endsWith('/type'));
    expect(typeChange).toMatchObject({ before: 'integer', after: 'string' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.5 — request body diffs
// ---------------------------------------------------------------------------

describe('request body diffs (1.3.5)', () => {
  it('detects added request body', () => {
    const base = makeSpec({
      paths: { '/pets': { parameters: [], operations: { post: { parameters: [], responses: {} } } } },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            post: {
              parameters: [],
              responses: {},
              requestBody: { required: true, content: { 'application/json': {} } },
            },
          },
        },
      },
    });
    const opDiff = diff(base, head).paths[0]!.operations[0]!;
    expect(opDiff.requestBody).toBeDefined();
    expect(opDiff.requestBody!.content[0]).toMatchObject({ type: 'added' });
  });

  it('detects request body required flag change', () => {
    const makeBody = (required: boolean) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              post: {
                parameters: [],
                responses: {},
                requestBody: { required, content: { 'application/json': {} } },
              },
            },
          },
        },
      });

    const opDiff = diff(makeBody(false), makeBody(true)).paths[0]!.operations[0]!;
    expect(opDiff.requestBody!.required).toMatchObject({ before: false, after: true });
  });

  it('detects content-type added in request body', () => {
    const makeBody = (contentTypes: string[]) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              post: {
                parameters: [],
                responses: {},
                requestBody: {
                  required: true,
                  content: Object.fromEntries(contentTypes.map((ct) => [ct, {}])),
                },
              },
            },
          },
        },
      });

    const opDiff = diff(makeBody(['application/json']), makeBody(['application/json', 'text/plain']))
      .paths[0]!.operations[0]!;
    const mtDiff = opDiff.requestBody!.content.find((c) => c.mediaType === 'text/plain');
    expect(mtDiff).toMatchObject({ type: 'added' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.6 — response diffs
// ---------------------------------------------------------------------------

describe('response diffs (1.3.6)', () => {
  it('detects added status code', () => {
    const base = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: { get: { parameters: [], responses: { '200': { description: 'ok', content: {} } } } },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: {
              parameters: [],
              responses: {
                '200': { description: 'ok', content: {} },
                '404': { description: 'not found', content: {} },
              },
            },
          },
        },
      },
    });
    const opDiff = diff(base, head).paths[0]!.operations[0]!;
    expect(opDiff.responses[0]).toMatchObject({ statusCode: '404', type: 'added' });
  });

  it('detects removed status code', () => {
    const base = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: {
            get: {
              parameters: [],
              responses: {
                '200': { description: 'ok', content: {} },
                '500': { description: 'error', content: {} },
              },
            },
          },
        },
      },
    });
    const head = makeSpec({
      paths: {
        '/pets': {
          parameters: [],
          operations: { get: { parameters: [], responses: { '200': { description: 'ok', content: {} } } } },
        },
      },
    });
    const opDiff = diff(base, head).paths[0]!.operations[0]!;
    expect(opDiff.responses[0]).toMatchObject({ statusCode: '500', type: 'removed' });
  });

  it('detects response description change', () => {
    const makeResp = (desc: string) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: { parameters: [], responses: { '200': { description: desc, content: {} } } },
            },
          },
        },
      });

    const opDiff = diff(makeResp('ok'), makeResp('Success')).paths[0]!.operations[0]!;
    const descChange = opDiff.responses[0]!.changes.find((c) => c.path.endsWith('/description'));
    expect(descChange).toMatchObject({ before: 'ok', after: 'Success' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.7 — schema diffs
// ---------------------------------------------------------------------------

describe('schema diffs (1.3.7)', () => {
  const ptr = '/test';

  it('returns empty array for identical schemas', () => {
    const schema: IRSchema = { type: 'string', minLength: 1 };
    expect(diffSchemas(schema, schema, ptr)).toHaveLength(0);
  });

  it('detects type change', () => {
    const changes = diffSchemas({ type: 'string' }, { type: 'integer' }, ptr);
    expect(changes).toContainEqual(expect.objectContaining({ path: '/test/type', before: 'string', after: 'integer' }));
  });

  it('detects enum change', () => {
    const changes = diffSchemas({ enum: ['a', 'b'] }, { enum: ['a', 'b', 'c'] }, ptr);
    expect(changes).toContainEqual(expect.objectContaining({ path: '/test/enum', type: 'modified' }));
  });

  it('detects added property', () => {
    const changes = diffSchemas(
      { type: 'object', properties: { name: { type: 'string' } } },
      { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer' } } },
      ptr,
    );
    expect(changes).toContainEqual(expect.objectContaining({ path: '/test/properties/age', type: 'added' }));
  });

  it('detects removed property', () => {
    const changes = diffSchemas(
      { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer' } } },
      { type: 'object', properties: { name: { type: 'string' } } },
      ptr,
    );
    expect(changes).toContainEqual(expect.objectContaining({ path: '/test/properties/age', type: 'removed' }));
  });

  it('detects additionalProperties boolean change', () => {
    const changes = diffSchemas({ additionalProperties: true }, { additionalProperties: false }, ptr);
    expect(changes).toContainEqual(
      expect.objectContaining({ path: '/test/additionalProperties', before: true, after: false }),
    );
  });

  it('detects additionalProperties schema change', () => {
    const changes = diffSchemas(
      { additionalProperties: { type: 'string' } },
      { additionalProperties: { type: 'integer' } },
      ptr,
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ path: '/test/additionalProperties/type', before: 'string', after: 'integer' }),
    );
  });

  it('detects nested property type change', () => {
    const changes = diffSchemas(
      { properties: { age: { type: 'string' } } },
      { properties: { age: { type: 'integer' } } },
      ptr,
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ path: '/test/properties/age/type', before: 'string', after: 'integer' }),
    );
  });

  it('returns added item when base is undefined', () => {
    const changes = diffSchemas(undefined, { type: 'string' }, ptr);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'added', path: ptr, after: { type: 'string' } });
  });

  it('returns removed item when head is undefined', () => {
    const changes = diffSchemas({ type: 'string' }, undefined, ptr);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'removed', path: ptr, before: { type: 'string' } });
  });

  it('detects exclusiveMinimum / exclusiveMaximum changes', () => {
    const changes = diffSchemas(
      { minimum: 0, exclusiveMinimum: false },
      { minimum: 0, exclusiveMinimum: true },
      ptr,
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ path: '/test/exclusiveMinimum', before: false, after: true }),
    );
  });

  it('detects allOf change', () => {
    const changes = diffSchemas(
      { allOf: [{ type: 'object' }] },
      { allOf: [{ type: 'object' }, { properties: { id: { type: 'integer' } } }] },
      ptr,
    );
    expect(changes).toContainEqual(expect.objectContaining({ path: '/test/allOf', type: 'modified' }));
  });
});

// ---------------------------------------------------------------------------
// 1.3.8 — security scheme + operation security diffs
// ---------------------------------------------------------------------------

describe('security scheme diffs (1.3.8)', () => {
  it('detects added security scheme', () => {
    const base = makeSpec({ securitySchemes: {} });
    const head = makeSpec({
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    });
    const { securitySchemes } = diff(base, head);
    expect(securitySchemes[0]).toMatchObject({ type: 'added', path: '/securitySchemes/bearerAuth' });
  });

  it('detects removed security scheme', () => {
    const base = makeSpec({
      securitySchemes: { apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' } },
    });
    const head = makeSpec({ securitySchemes: {} });
    const { securitySchemes } = diff(base, head);
    expect(securitySchemes[0]).toMatchObject({ type: 'removed' });
  });

  it('detects modified security scheme', () => {
    const base = makeSpec({ securitySchemes: { apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' } } });
    const head = makeSpec({ securitySchemes: { apiKey: { type: 'apiKey', name: 'X-Token', in: 'header' } } });
    const { securitySchemes } = diff(base, head);
    expect(securitySchemes[0]).toMatchObject({ type: 'modified' });
  });

  it('detects global security change', () => {
    const base = makeSpec({ security: [{ apiKey: [] }] });
    const head = makeSpec({ security: [{ apiKey: [] }, { bearerAuth: [] }] });
    const { security } = diff(base, head);
    expect(security).toMatchObject({ type: 'modified', path: '/security' });
  });

  it('detects operation-level security change', () => {
    const makeOpSecurity = (sec: unknown) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: { parameters: [], responses: {}, security: sec as any },
            },
          },
        },
      });

    const opDiff = diff(makeOpSecurity([{ apiKey: [] }]), makeOpSecurity([])).paths[0]!.operations[0]!;
    expect(opDiff.security).toMatchObject({ type: 'modified' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.9 — tag diffs
// ---------------------------------------------------------------------------

describe('tag diffs (1.3.9)', () => {
  it('detects added tag', () => {
    const base = makeSpec({ tags: [] });
    const head = makeSpec({ tags: [{ name: 'pets' }] });
    const { tags } = diff(base, head);
    expect(tags[0]).toMatchObject({ type: 'added', after: { name: 'pets' } });
  });

  it('detects removed tag', () => {
    const base = makeSpec({ tags: [{ name: 'pets' }] });
    const head = makeSpec({ tags: [] });
    const { tags } = diff(base, head);
    expect(tags[0]).toMatchObject({ type: 'removed', before: { name: 'pets' } });
  });

  it('detects modified tag description', () => {
    const base = makeSpec({ tags: [{ name: 'pets', description: 'Pet endpoints' }] });
    const head = makeSpec({ tags: [{ name: 'pets', description: 'Endpoints for pets' }] });
    const { tags } = diff(base, head);
    expect(tags[0]).toMatchObject({ type: 'modified' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.10 — server / basePath diffs
// ---------------------------------------------------------------------------

describe('server diffs (1.3.10)', () => {
  it('detects added server', () => {
    const base = makeSpec({ servers: [{ url: 'https://api.example.com' }] });
    const head = makeSpec({
      servers: [{ url: 'https://api.example.com' }, { url: 'https://staging.example.com' }],
    });
    const { servers } = diff(base, head);
    expect(servers[0]).toMatchObject({ type: 'added', after: { url: 'https://staging.example.com' } });
  });

  it('detects removed server', () => {
    const base = makeSpec({ servers: [{ url: 'https://v1.example.com' }, { url: 'https://v2.example.com' }] });
    const head = makeSpec({ servers: [{ url: 'https://v2.example.com' }] });
    const { servers } = diff(base, head);
    expect(servers[0]).toMatchObject({ type: 'removed' });
  });

  it('detects server description change', () => {
    const base = makeSpec({ servers: [{ url: 'https://api.example.com', description: 'Prod' }] });
    const head = makeSpec({ servers: [{ url: 'https://api.example.com', description: 'Production' }] });
    const { servers } = diff(base, head);
    expect(servers[0]).toMatchObject({ type: 'modified' });
  });
});

// ---------------------------------------------------------------------------
// 1.3.11 — vendor extension diffs
// ---------------------------------------------------------------------------

describe('vendor extension diffs (1.3.11)', () => {
  it('detects added x- extension at spec level', () => {
    const base = makeSpec({ extensions: {} });
    const head = makeSpec({ extensions: { 'x-internal': true } });
    const { extensions } = diff(base, head);
    expect(extensions[0]).toMatchObject({ type: 'added', path: '/extensions/x-internal' });
  });

  it('detects removed x- extension at spec level', () => {
    const base = makeSpec({ extensions: { 'x-internal': true } });
    const head = makeSpec({ extensions: {} });
    const { extensions } = diff(base, head);
    expect(extensions[0]).toMatchObject({ type: 'removed' });
  });

  it('suppresses extension diffs when includeExtensions:false', () => {
    const base = makeSpec({ extensions: { 'x-foo': 1 } });
    const head = makeSpec({ extensions: { 'x-foo': 2 } });
    const { extensions } = diff(base, head, { includeExtensions: false });
    expect(extensions).toHaveLength(0);
  });

  it('includes extension diffs by default', () => {
    const base = makeSpec({ extensions: { 'x-foo': 1 } });
    const head = makeSpec({ extensions: { 'x-foo': 2 } });
    const { extensions } = diff(base, head);
    expect(extensions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 1.3.12 — deprecated flag tracking
// ---------------------------------------------------------------------------

describe('deprecated flag tracking (1.3.12)', () => {
  it('detects operation newly deprecated', () => {
    const make = (deprecated: boolean) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: { parameters: [], responses: {}, deprecated },
            },
          },
        },
      });

    const opDiff = diff(make(false), make(true)).paths[0]!.operations[0]!;
    const depChange = opDiff.changes.find((c) => c.path.endsWith('/deprecated'));
    expect(depChange).toMatchObject({ before: false, after: true });
  });

  it('detects parameter deprecated change', () => {
    const make = (deprecated: boolean) =>
      makeSpec({
        paths: {
          '/pets': {
            parameters: [],
            operations: {
              get: {
                parameters: [{ name: 'limit', in: 'query', required: false, deprecated }],
                responses: {},
              },
            },
          },
        },
      });

    const opDiff = diff(make(false), make(true)).paths[0]!.operations[0]!;
    const paramDiff = opDiff.parameters[0]!;
    const depChange = paramDiff.changes.find((c) => c.path.endsWith('/deprecated'));
    expect(depChange).toMatchObject({ before: false, after: true });
  });

  it('detects schema-level deprecated change', () => {
    const changes = diffSchemas({ deprecated: false }, { deprecated: true }, '/s');
    expect(changes).toContainEqual(expect.objectContaining({ path: '/s/deprecated', before: false, after: true }));
  });
});
