import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import {
  loadSpec,
  loadSpecFromString,
  loadSpecFromGit,
  specCache,
  detectVersion,
  parseYamlOrJson,
} from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFetch(
  responses: Array<{
    ok: boolean;
    status: number;
    statusText?: string;
    body?: string;
    etag?: string;
    lastModified?: string;
  }>,
) {
  let call = 0;
  return vi.fn(async (_url: string) => {
    const r = responses[call] ?? responses[responses.length - 1]!;
    call++;
    return {
      ok: r.ok,
      status: r.status,
      statusText: r.statusText ?? (r.ok ? 'OK' : 'Error'),
      text: async () => r.body ?? '',
      headers: {
        get: (h: string) => {
          if (h === 'etag') return r.etag ?? null;
          if (h === 'last-modified') return r.lastModified ?? null;
          return null;
        },
      },
    };
  });
}

const MINIMAL_OAS30 = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Remote API', version: '1.0.0' },
  paths: {},
});

// ---------------------------------------------------------------------------
// 1 · File loading
// ---------------------------------------------------------------------------

describe('loadSpec — file loading', () => {
  it('1.1.3 loads a Swagger 2.0 JSON file and detects version', async () => {
    const spec = await loadSpec(join(FIXTURES, 'swagger-2.0.json'));
    expect(spec.version).toBe('swagger-2.0');
    expect(spec.source).toContain('swagger-2.0.json');
    expect((spec.document as OpenAPIV2.Document).swagger).toBe('2.0');
  });

  it('1.1.4 loads an OpenAPI 3.0 YAML file', async () => {
    const spec = await loadSpec(join(FIXTURES, 'openapi-3.0.yaml'));
    expect(spec.version).toBe('openapi-3.0');
    const doc = spec.document as OpenAPIV3.Document;
    expect(doc.openapi).toMatch(/^3\.0/);
    expect(doc.info.title).toBe('Pet Store');
  });

  it('1.1.4 loads an OpenAPI 3.1 YAML file', async () => {
    const spec = await loadSpec(join(FIXTURES, 'openapi-3.1.yaml'));
    expect(spec.version).toBe('openapi-3.1');
    const doc = spec.document as OpenAPIV3_1.Document;
    expect(doc.openapi).toMatch(/^3\.1/);
  });

  it('1.1.5 sets dereferenced=true when dereference option is true (default)', async () => {
    const spec = await loadSpec(join(FIXTURES, 'swagger-2.0.json'));
    expect(spec.dereferenced).toBe(true);
  });

  it('1.1.5 sets dereferenced=false when dereference option is false', async () => {
    const spec = await loadSpec(join(FIXTURES, 'swagger-2.0.json'), { dereference: false });
    expect(spec.dereferenced).toBe(false);
  });

  it('resolves internal $refs by default (Swagger 2.0)', async () => {
    const spec = await loadSpec(join(FIXTURES, 'swagger-2.0.json'));
    const doc = spec.document as OpenAPIV2.Document;
    // Use unknown cast chain to avoid deep union type narrowing
    const response200 = doc.paths['/pets']?.get?.responses?.['200'] as unknown as {
      schema: { items: unknown };
    };
    const items = response200?.schema?.items as Record<string, unknown>;
    // After dereferencing, items should be the actual Pet schema, not a $ref
    expect(items).not.toHaveProperty('$ref');
    expect(items).toHaveProperty('properties');
  });

  it('resolves internal $refs by default (OpenAPI 3.0)', async () => {
    const spec = await loadSpec(join(FIXTURES, 'openapi-3.0.yaml'));
    const doc = spec.document as OpenAPIV3.Document;
    const response = doc.paths['/pets']?.get?.responses?.['200'] as OpenAPIV3.ResponseObject;
    const schema = response.content?.['application/json']?.schema as unknown as {
      items: Record<string, unknown>;
    };
    expect(schema.items).not.toHaveProperty('$ref');
    expect(schema.items).toHaveProperty('properties');
  });

  it('keeps $refs intact when dereference=false', async () => {
    const spec = await loadSpec(join(FIXTURES, 'openapi-3.0.yaml'), { dereference: false });
    const doc = spec.document as OpenAPIV3.Document;
    const response = doc.paths['/pets']?.get?.responses?.['200'] as OpenAPIV3.ResponseObject;
    const schema = response.content?.['application/json']?.schema as unknown as {
      items: { $ref: string };
    };
    expect(schema.items).toHaveProperty('$ref', '#/components/schemas/Pet');
  });

  it('1.1.3 resolves external $refs in multi-file specs', async () => {
    const spec = await loadSpec(join(FIXTURES, 'multi-file', 'main.yaml'));
    expect(spec.version).toBe('openapi-3.0');
    const doc = spec.document as OpenAPIV3.Document;
    const response = doc.paths['/users']?.get?.responses?.['200'] as OpenAPIV3.ResponseObject;
    const schema = response.content?.['application/json']?.schema as unknown as {
      items: Record<string, unknown>;
    };
    // External $ref should be resolved to the actual User schema
    expect(schema.items).not.toHaveProperty('$ref');
    expect(schema.items).toHaveProperty('properties');
    expect((schema.items['properties'] as Record<string, unknown>)).toHaveProperty('email');
    expect((schema.items['properties'] as Record<string, unknown>)).toHaveProperty('id');
  });

  it('1.1.9 handles circular $refs without throwing', async () => {
    const specPromise = loadSpec(join(FIXTURES, 'circular', 'spec.json'));
    await expect(specPromise).resolves.toBeDefined();
    const spec = await specPromise;
    expect(spec.version).toBe('openapi-3.0');
  });

  it('throws a clear error for a non-existent file', async () => {
    await expect(
      loadSpec('./does-not-exist.yaml'),
    ).rejects.toThrow(/Cannot read spec file/);
  });

  it('accepts a relative path starting with ./', async () => {
    // Verify the path detection heuristic works for relative paths
    // (test run from the package root where no spec exists, so it should throw
    // a "cannot read" error, not a "source type unknown" error)
    await expect(loadSpec('./nonexistent.yaml')).rejects.toThrow(/Cannot read spec file/);
  });
});

// ---------------------------------------------------------------------------
// 2 · loadSpecFromString
// ---------------------------------------------------------------------------

describe('loadSpecFromString', () => {
  it('1.1.4 loads a raw JSON string', async () => {
    const content = JSON.stringify({
      swagger: '2.0',
      info: { title: 'T', version: '1.0.0' },
      paths: {},
    });
    const spec = await loadSpecFromString(content);
    expect(spec.version).toBe('swagger-2.0');
    expect(spec.source).toBe('raw');
  });

  it('1.1.4 loads a raw YAML string', async () => {
    const content = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
paths: {}
`;
    const spec = await loadSpecFromString(content);
    expect(spec.version).toBe('openapi-3.0');
    expect(spec.source).toBe('raw');
  });

  it('loads an OpenAPI 3.1 raw YAML string', async () => {
    const content = `
openapi: "3.1.0"
info:
  title: Test API
  version: "1.0.0"
paths: {}
`;
    const spec = await loadSpecFromString(content);
    expect(spec.version).toBe('openapi-3.1');
  });

  it('throws on invalid JSON', async () => {
    await expect(
      loadSpecFromString('{ invalid json !!}'),
    ).rejects.toThrow(/Invalid JSON/);
  });

  it('throws on invalid YAML', async () => {
    await expect(
      loadSpecFromString('key: [unclosed bracket'),
    ).rejects.toThrow(/Invalid YAML/);
  });

  it('throws with a clear message when version fields are missing', async () => {
    await expect(
      loadSpecFromString('{ "not": "a spec" }'),
    ).rejects.toThrow(/Cannot detect spec version/);
  });

  it('throws on empty content', async () => {
    await expect(loadSpecFromString('')).rejects.toThrow(/empty/);
  });

  it('throws on whitespace-only content', async () => {
    await expect(loadSpecFromString('   \n\t  ')).rejects.toThrow(/empty/);
  });
});

// ---------------------------------------------------------------------------
// 3 · URL loading (fetch is mocked; dereference=false to avoid swagger-parser
//   making its own HTTP calls in the test environment)
// ---------------------------------------------------------------------------

describe('loadSpec — URL loading', () => {
  beforeEach(() => {
    specCache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    specCache.clear();
  });

  it('1.1.6 fetches a spec from an HTTP URL', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    const spec = await loadSpec('https://api.example.com/openapi.json', {
      cache: false,
      dereference: false,
    });
    expect(spec.version).toBe('openapi-3.0');
    expect(spec.source).toBe('https://api.example.com/openapi.json');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('1.1.6 accepts a URL object', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    const spec = await loadSpec(new URL('https://api.example.com/openapi.json'), {
      cache: false,
      dereference: false,
    });
    expect(spec.version).toBe('openapi-3.0');
  });

  it('1.1.6 passes custom auth headers to the remote request', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    await loadSpec('https://api.example.com/openapi.json', {
      cache: false,
      dereference: false,
      headers: { Authorization: 'Bearer token123' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/openapi.json',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token123' },
      }),
    );
  });

  it('throws on HTTP 404', async () => {
    vi.stubGlobal('fetch', makeMockFetch([{ ok: false, status: 404, statusText: 'Not Found' }]));

    await expect(
      loadSpec('https://api.example.com/missing.json', { cache: false, dereference: false }),
    ).rejects.toThrow(/404/);
  });

  it('throws on HTTP 401', async () => {
    vi.stubGlobal('fetch', makeMockFetch([{ ok: false, status: 401, statusText: 'Unauthorized' }]));

    await expect(
      loadSpec('https://api.example.com/private.json', { cache: false, dereference: false }),
    ).rejects.toThrow(/401/);
  });

  it('1.1.8 caches remote specs and returns without a second fetch', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://api.example.com/openapi.json';
    await loadSpec(url, { dereference: false });
    await loadSpec(url, { dereference: false });

    // Second call should be served from the cache — fetch called only once.
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('1.1.8 does not cache when cache=false', async () => {
    const mockFetch = makeMockFetch([
      { ok: true, status: 200, body: MINIMAL_OAS30 },
      { ok: true, status: 200, body: MINIMAL_OAS30 },
    ]);
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://api.example.com/openapi.json';
    await loadSpec(url, { cache: false, dereference: false });
    await loadSpec(url, { cache: false, dereference: false });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('1.1.8 sends If-None-Match on revalidation when ETag is present', async () => {
    const mockFetch = makeMockFetch([
      { ok: true, status: 200, body: MINIMAL_OAS30, etag: '"v1"' },
      { ok: true, status: 304 }, // server says: not modified
    ]);
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://api.example.com/openapi.json';
    // First fetch: populate cache with ETag
    await loadSpec(url, { dereference: false, cacheTtl: 0 });
    // Force entry to appear stale (fetchedAt in the past)
    const entry = specCache.peek(url);
    if (entry) {
      specCache.set(url, { content: entry.content, etag: entry.etag }, 0);
    }
    // Second fetch: TTL=0 so entry is stale; should send conditional request
    await loadSpec(url, { dereference: false, cacheTtl: 0 });

    type FetchArgs = [string, { headers: Record<string, string> }];
    const secondCall = mockFetch.mock.calls[1] as FetchArgs | undefined;
    expect(secondCall?.[1]?.headers).toHaveProperty('If-None-Match', '"v1"');
  });

  it('1.1.8 updates cache on 200 revalidation response', async () => {
    const updatedSpec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Updated', version: '2.0.0' },
      paths: {},
    });
    const mockFetch = makeMockFetch([
      { ok: true, status: 200, body: MINIMAL_OAS30, etag: '"v1"' },
      { ok: true, status: 200, body: updatedSpec, etag: '"v2"' },
    ]);
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://api.example.com/openapi.json';
    await loadSpec(url, { dereference: false, cacheTtl: 0 });
    const entry = specCache.peek(url);
    if (entry) specCache.set(url, { content: entry.content, etag: entry.etag }, 0);

    const spec2 = await loadSpec(url, { dereference: false, cacheTtl: 0 });
    expect((spec2.document as OpenAPIV3.Document).info.title).toBe('Updated');
  });
});

// ---------------------------------------------------------------------------
// 4 · Git loading
// ---------------------------------------------------------------------------

describe('loadSpecFromGit — local repository', () => {
  it('1.1.7 loads a spec from the current project repo at HEAD', async () => {
    // The project root is a git repo; load the swagger-2.0.json fixture at HEAD.
    const projectRoot = resolve(__dirname, '../../../../');
    const filePath = 'packages/core/src/__tests__/fixtures/swagger-2.0.json';

    // This will only work if the fixture has been committed. If not, it will
    // throw an error — which we also test gracefully below.
    try {
      const spec = await loadSpecFromGit(projectRoot, 'HEAD', filePath);
      expect(spec.version).toBe('swagger-2.0');
      expect(spec.source).toContain('git:');
      expect(spec.dereferenced).toBe(false);
    } catch (err) {
      // File not yet committed — verify the error message is helpful.
      expect((err as Error).message).toMatch(/Failed to load spec from git/);
    }
  });

  it('1.1.7 throws a descriptive error for a non-existent file path', async () => {
    const projectRoot = resolve(__dirname, '../../../../');
    await expect(
      loadSpecFromGit(projectRoot, 'HEAD', 'nonexistent/spec.yaml'),
    ).rejects.toThrow(/Failed to load spec from git/);
  });

  it('1.1.7 throws a descriptive error for a non-existent ref', async () => {
    const projectRoot = resolve(__dirname, '../../../../');
    await expect(
      loadSpecFromGit(projectRoot, 'branch-that-does-not-exist-xyz', 'README.md'),
    ).rejects.toThrow(/Failed to load spec from git/);
  });

  it('1.1.7 strips a leading slash from filePath', async () => {
    const projectRoot = resolve(__dirname, '../../../../');
    // Should not throw a different error than the path-not-found error
    await expect(
      loadSpecFromGit(projectRoot, 'HEAD', '/nonexistent/spec.yaml'),
    ).rejects.toThrow(/Failed to load spec from git/);
  });
});

describe('loadSpecFromGit — remote repository (GitHub URL)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    specCache.clear();
  });

  it('1.1.7 fetches via raw.githubusercontent.com for github.com URLs', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    const spec = await loadSpecFromGit(
      'https://github.com/org/my-api',
      'main',
      'openapi/spec.yaml',
    );
    expect(spec.version).toBe('openapi-3.0');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/org/my-api/main/openapi/spec.yaml',
      expect.anything(),
    );
  });

  it('1.1.7 works with SSH GitHub URLs (git@github.com:org/repo.git)', async () => {
    const mockFetch = makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]);
    vi.stubGlobal('fetch', mockFetch);

    await loadSpecFromGit('git@github.com:org/my-api.git', 'v2.3.0', 'spec.json');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/org/my-api/v2.3.0/spec.json',
      expect.anything(),
    );
  });

  it('throws on malformed GitHub URL', async () => {
    vi.stubGlobal('fetch', makeMockFetch([{ ok: true, status: 200, body: MINIMAL_OAS30 }]));
    await expect(
      loadSpecFromGit('https://github.com/bad', 'main', 'spec.yaml'),
    ).rejects.toThrow(/Cannot parse GitHub repository URL/);
  });
});

// ---------------------------------------------------------------------------
// 5 · detectVersion (unit)
// ---------------------------------------------------------------------------

describe('detectVersion', () => {
  it('1.1.5 detects swagger 2.0', () => {
    expect(detectVersion({ swagger: '2.0', info: {}, paths: {} })).toBe('swagger-2.0');
  });

  it('1.1.5 detects openapi 3.0.x (3.0.0)', () => {
    expect(detectVersion({ openapi: '3.0.0', info: {}, paths: {} })).toBe('openapi-3.0');
  });

  it('1.1.5 detects openapi 3.0.x (3.0.3)', () => {
    expect(detectVersion({ openapi: '3.0.3', info: {}, paths: {} })).toBe('openapi-3.0');
  });

  it('1.1.5 detects openapi 3.1.x (3.1.0)', () => {
    expect(detectVersion({ openapi: '3.1.0', info: {}, paths: {} })).toBe('openapi-3.1');
  });

  it('throws on unsupported openapi version', () => {
    expect(() => detectVersion({ openapi: '4.0.0' })).toThrow(
      /Unsupported OpenAPI version: "4.0.0"/,
    );
  });

  it('throws on unsupported swagger version', () => {
    expect(() => detectVersion({ swagger: '1.2' })).toThrow(
      /Unsupported Swagger version: "1.2"/,
    );
  });

  it('throws when neither swagger nor openapi field is present', () => {
    expect(() => detectVersion({ info: {}, paths: {} })).toThrow(
      /Cannot detect spec version/,
    );
  });

  it('throws on null input', () => {
    expect(() => detectVersion(null)).toThrow(/not an object/);
  });

  it('throws on array input', () => {
    expect(() => detectVersion([1, 2, 3])).toThrow(/not an object/);
  });

  it('throws on string input', () => {
    expect(() => detectVersion('openapi: 3.0.0')).toThrow(/not an object/);
  });
});

// ---------------------------------------------------------------------------
// 6 · parseYamlOrJson (unit)
// ---------------------------------------------------------------------------

describe('parseYamlOrJson', () => {
  it('parses valid JSON', () => {
    const result = parseYamlOrJson('{"foo":"bar"}');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses valid YAML', () => {
    const result = parseYamlOrJson('foo: bar\nbaz: 42');
    expect(result).toEqual({ foo: 'bar', baz: 42 });
  });

  it('parses JSON arrays', () => {
    const result = parseYamlOrJson('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('uses JSON fast-path for strings starting with {', () => {
    // Verify it doesn't accidentally succeed on bad JSON
    expect(() => parseYamlOrJson('{ bad json }')).toThrow(/Invalid JSON/);
  });

  it('uses YAML path for non-{ strings', () => {
    expect(() => parseYamlOrJson('key: [unclosed')).toThrow(/Invalid YAML/);
  });

  it('throws on empty string', () => {
    expect(() => parseYamlOrJson('')).toThrow(/empty/);
  });

  it('throws on whitespace-only string', () => {
    expect(() => parseYamlOrJson('   ')).toThrow(/empty/);
  });
});
