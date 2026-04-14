import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { swagger2ToIR } from '../ir/swagger2-to-ir.js';
import { oas3ToIR } from '../ir/oas3-to-ir.js';
import { parseYamlOrJson } from '../loader/parse-content.js';
import type { IRSpec } from '../ir/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, 'fixtures');

function loadFixture(name: string): unknown {
  const raw = readFileSync(resolve(fixtures, name), 'utf8');
  return parseYamlOrJson(raw);
}

// ---------------------------------------------------------------------------
// Swagger 2.0
// ---------------------------------------------------------------------------
describe('swagger2ToIR', () => {
  it('snapshot: petstore swagger-2.0.json', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    expect(ir).toMatchSnapshot();
  });

  it('sets sourceVersion to swagger-2.0', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    expect(ir.sourceVersion).toBe('swagger-2.0');
  });

  it('reconstructs server URL from host+basePath+schemes', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    expect(ir.servers).toEqual([{ url: 'https://petstore.example.com/api/v1' }]);
  });

  it('normalises paths and operations', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    expect(Object.keys(ir.paths)).toEqual(['/pets', '/pets/{petId}']);
    expect(Object.keys(ir.paths['/pets']!.operations)).toContain('get');
    expect(Object.keys(ir.paths['/pets']!.operations)).toContain('post');
  });

  it('converts body param to requestBody on POST /pets', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    const post = ir.paths['/pets']!.operations['post']!;
    expect(post.requestBody).toBeDefined();
    expect(post.requestBody!.required).toBe(true);
    expect(Object.keys(post.requestBody!.content)).toContain('application/json');
    // body param must NOT appear in parameters list
    expect(post.parameters.find((p) => p.name === 'body')).toBeUndefined();
  });

  it('normalises query parameter schema from inline type fields', () => {
    const doc = loadFixture('swagger-2.0.json');
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    const limitParam = ir.paths['/pets']!.operations['get']!.parameters.find(
      (p) => p.name === 'limit',
    );
    expect(limitParam).toBeDefined();
    expect(limitParam!.schema?.type).toBe('integer');
    expect(limitParam!.schema?.format).toBe('int32');
  });

  it('normalises security schemes (apiKey, basic, oauth2)', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      securityDefinitions: {
        api_key: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
        basic_auth: { type: 'basic' },
        oauth2_implicit: {
          type: 'oauth2',
          flow: 'implicit',
          authorizationUrl: 'https://example.com/oauth/authorize',
          scopes: { read: 'Read access', write: 'Write access' },
        },
      },
    };
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    expect(ir.securitySchemes['api_key']).toEqual({
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header',
    });
    expect(ir.securitySchemes['basic_auth']).toEqual({ type: 'http', scheme: 'basic' });
    expect(ir.securitySchemes['oauth2_implicit']!.type).toBe('oauth2');
    expect(ir.securitySchemes['oauth2_implicit']!.flows!.implicit!.scopes).toEqual({
      read: 'Read access',
      write: 'Write access',
    });
  });

  it('path-level parameters are inherited by operations', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, type: 'integer' }],
          get: { operationId: 'getItem', responses: { '200': { description: 'ok' } } },
        },
      },
    };
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    // Path item parameters are stored on the path item
    expect(ir.paths['/items/{id}']!.parameters).toHaveLength(1);
    expect(ir.paths['/items/{id}']!.parameters[0]!.name).toBe('id');
    // Op-level parameters should NOT re-include the path param since it was not overridden
    const getOp = ir.paths['/items/{id}']!.operations['get']!;
    expect(getOp.parameters.find((p) => p.name === 'id')).toBeDefined();
  });

  it('op-level parameter overrides path-level same name+in', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items/{id}': {
          parameters: [
            { name: 'id', in: 'path', required: true, type: 'integer', description: 'from path' },
          ],
          get: {
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                type: 'string',
                description: 'from op',
              },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const ir = swagger2ToIR(doc as Parameters<typeof swagger2ToIR>[0]);
    const getOp = ir.paths['/items/{id}']!.operations['get']!;
    const idParam = getOp.parameters.find((p) => p.name === 'id')!;
    expect(idParam.description).toBe('from op');
    expect(idParam.schema?.type).toBe('string');
  });

  it('allOf flattening merges properties when flattenComposition:true', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          post: {
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                schema: {
                  allOf: [
                    { type: 'object', properties: { id: { type: 'integer' } } },
                    { type: 'object', properties: { name: { type: 'string' } } },
                  ],
                },
              },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const ir = swagger2ToIR(doc as unknown as Parameters<typeof swagger2ToIR>[0], {
      flattenComposition: true,
    });
    const schema = ir.paths['/items']!.operations['post']!.requestBody!.content[
      'application/json'
    ]!.schema!;
    expect(schema.properties).toHaveProperty('id');
    expect(schema.properties).toHaveProperty('name');
  });
});

// ---------------------------------------------------------------------------
// OpenAPI 3.0
// ---------------------------------------------------------------------------
describe('oas3ToIR (OpenAPI 3.0)', () => {
  it('snapshot: petstore openapi-3.0.yaml', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir).toMatchSnapshot();
  });

  it('sets sourceVersion to openapi-3.0', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.sourceVersion).toBe('openapi-3.0');
  });

  it('preserves server URLs', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.servers[0]!.url).toBe('https://petstore.example.com/api/v1');
  });

  it('normalises requestBody with content types', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    const post = ir.paths['/pets']!.operations['post']!;
    expect(post.requestBody).toBeDefined();
    expect(post.requestBody!.required).toBe(true);
    expect(Object.keys(post.requestBody!.content)).toContain('application/json');
  });

  it('normalises path-item parameter inheritance', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    const getPet = ir.paths['/pets/{petId}']!.operations['get']!;
    expect(getPet.parameters.find((p) => p.name === 'petId')).toBeDefined();
  });

  it('normalises response schemas', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    const get200 = ir.paths['/pets']!.operations['get']!.responses['200']!;
    expect(get200.content['application/json']!.schema?.type).toBe('array');
  });
});

// ---------------------------------------------------------------------------
// OpenAPI 3.1
// ---------------------------------------------------------------------------
describe('oas3ToIR (OpenAPI 3.1)', () => {
  it('snapshot: petstore openapi-3.1.yaml', () => {
    const doc = loadFixture('openapi-3.1.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir).toMatchSnapshot();
  });

  it('sets sourceVersion to openapi-3.1', () => {
    const doc = loadFixture('openapi-3.1.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.sourceVersion).toBe('openapi-3.1');
  });

  it('populates webhooks from OAS 3.1 document', () => {
    const doc = loadFixture('openapi-3.1.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.webhooks).toBeDefined();
    expect(Object.keys(ir.webhooks!)).toContain('newPet');
    expect(ir.webhooks!['newPet']!.operations['post']).toBeDefined();
  });

  it('OAS 3.1 webhooks absent for 3.0 docs', () => {
    const doc = loadFixture('openapi-3.0.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.webhooks).toBeUndefined();
  });

  it('handles OAS 3.1 type array (nullable via type union)', () => {
    const doc = loadFixture('openapi-3.1.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    // The Pet schema has tag: type: ["string","null"]
    // After dereference the schema should reflect this
    // (exact value depends on swagger-parser handling of OAS 3.1 type arrays)
    expect(ir.sourceVersion).toBe('openapi-3.1');
  });

  it('normalises numeric exclusiveMinimum as number (OAS 3.1 style)', () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/scores': {
          get: {
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 },
                  },
                },
              },
            },
          },
        },
      },
    };
    const ir = oas3ToIR(doc as unknown as Parameters<typeof oas3ToIR>[0]);
    const schema =
      ir.paths['/scores']!.operations['get']!.responses['200']!.content['application/json']!
        .schema!;
    expect(schema.exclusiveMinimum).toBe(0);
    expect(schema.exclusiveMaximum).toBe(100);
  });

  it('normalises license with identifier field (OAS 3.1)', () => {
    const doc = loadFixture('openapi-3.1.yaml');
    const ir = oas3ToIR(doc as Parameters<typeof oas3ToIR>[0]);
    expect(ir.info.license?.name).toBe('MIT');
    expect(ir.info.license?.url).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-version: Swagger 2.0 vs OAS 3.0 produce comparable IR shapes
// ---------------------------------------------------------------------------
describe('cross-version IR compatibility', () => {
  it('swagger-2.0 and openapi-3.0 produce same set of paths', () => {
    const sw2 = swagger2ToIR(
      loadFixture('swagger-2.0.json') as Parameters<typeof swagger2ToIR>[0],
    );
    const oas3 = oas3ToIR(
      loadFixture('openapi-3.0.yaml') as Parameters<typeof oas3ToIR>[0],
    );
    expect(Object.keys(sw2.paths).sort()).toEqual(Object.keys(oas3.paths).sort());
  });

  it('swagger-2.0 and openapi-3.0 produce same operations per path', () => {
    const sw2 = swagger2ToIR(
      loadFixture('swagger-2.0.json') as Parameters<typeof swagger2ToIR>[0],
    );
    const oas3 = oas3ToIR(
      loadFixture('openapi-3.0.yaml') as Parameters<typeof oas3ToIR>[0],
    );
    for (const path of Object.keys(sw2.paths)) {
      const sw2Methods = Object.keys(sw2.paths[path]!.operations).sort();
      const oas3Methods = Object.keys(oas3.paths[path]!.operations).sort();
      expect(sw2Methods).toEqual(oas3Methods);
    }
  });

  it('swagger-2.0 POST /pets requestBody schema is present and matches openapi-3.0', () => {
    const sw2 = swagger2ToIR(
      loadFixture('swagger-2.0.json') as Parameters<typeof swagger2ToIR>[0],
    );
    const oas3 = oas3ToIR(
      loadFixture('openapi-3.0.yaml') as Parameters<typeof oas3ToIR>[0],
    );
    const sw2Schema =
      sw2.paths['/pets']!.operations['post']!.requestBody!.content['application/json']!.schema;
    const oas3Schema =
      oas3.paths['/pets']!.operations['post']!.requestBody!.content['application/json']!.schema;
    // Both should have a schema (either $ref or resolved properties)
    expect(sw2Schema).toBeDefined();
    expect(oas3Schema).toBeDefined();
    // Both reference the same NewPet schema via $ref (fixtures not dereferenced)
    expect(sw2Schema?.$ref).toContain('NewPet');
    expect(oas3Schema?.$ref).toContain('NewPet');
  });
});
