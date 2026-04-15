import { describe, it, expect } from 'vitest';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import type { ParsedSpec } from '@better-swagger-diff/core';

// Minimal mock documents — parsedSpecToIR only calls swagger2ToIR/oas3ToIR
// which handle partial docs gracefully (they default missing fields).
const swagger2Doc = {
  swagger: '2.0',
  info: { title: 'T', version: '1' },
  paths: {},
} as unknown;

const oas30Doc = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {},
} as unknown;

const oas31Doc = {
  openapi: '3.1.0',
  info: { title: 'T', version: '1' },
  paths: {},
} as unknown;

describe('parsedSpecToIR', () => {
  it('converts swagger-2.0 spec', () => {
    const parsed: ParsedSpec = {
      version: 'swagger-2.0',
      document: swagger2Doc as never,
      source: 'raw',
      dereferenced: false,
    };
    const ir = parsedSpecToIR(parsed);
    expect(ir.sourceVersion).toBe('swagger-2.0');
    expect(ir.paths).toBeDefined();
  });

  it('converts openapi-3.0 spec', () => {
    const parsed: ParsedSpec = {
      version: 'openapi-3.0',
      document: oas30Doc as never,
      source: 'raw',
      dereferenced: false,
    };
    const ir = parsedSpecToIR(parsed);
    expect(ir.sourceVersion).toBe('openapi-3.0');
    expect(ir.paths).toBeDefined();
  });

  it('converts openapi-3.1 spec', () => {
    const parsed: ParsedSpec = {
      version: 'openapi-3.1',
      document: oas31Doc as never,
      source: 'raw',
      dereferenced: false,
    };
    const ir = parsedSpecToIR(parsed);
    expect(ir.sourceVersion).toBe('openapi-3.1');
    expect(ir.paths).toBeDefined();
  });
});
