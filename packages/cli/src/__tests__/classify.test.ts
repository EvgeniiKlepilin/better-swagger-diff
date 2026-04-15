import { describe, it, expect } from 'vitest';
import { classifyDiff } from '../lib/classify.js';
import type { DiffResult, PathDiff, OperationDiff, ParameterDiff, ResponseDiff } from '@better-swagger-diff/core';

function makeEmptyResult(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    isEmpty: true,
    paths: [],
    webhooks: [],
    securitySchemes: [],
    tags: [],
    servers: [],
    extensions: [],
    ...overrides,
  };
}

function makeRemovedOperation(path: string, method: string): PathDiff {
  const op: OperationDiff = {
    path,
    method: method as never,
    type: 'removed',
    jsonPointer: `/paths/${path.replace(/\//g, '~1')}/${method}`,
    changes: [],
    parameters: [],
    responses: [],
    extensions: [],
  };
  return {
    path,
    type: 'modified',
    jsonPointer: `/paths/${path.replace(/\//g, '~1')}`,
    pathParameters: [],
    operations: [op],
  };
}

function makeAddedRequiredParam(path: string, method: string): PathDiff {
  const param: ParameterDiff = {
    name: 'x-required-new',
    in: 'query',
    type: 'added',
    jsonPointer: `/paths/${path.replace(/\//g, '~1')}/${method}/parameters/x-required-new`,
    changes: [],
    after: { name: 'x-required-new', in: 'query', required: true, schema: { type: 'string' } },
  };
  const op: OperationDiff = {
    path,
    method: method as never,
    type: 'modified',
    jsonPointer: `/paths/${path.replace(/\//g, '~1')}/${method}`,
    changes: [],
    parameters: [param],
    responses: [],
    extensions: [],
  };
  return {
    path,
    type: 'modified',
    jsonPointer: `/paths/${path.replace(/\//g, '~1')}`,
    pathParameters: [],
    operations: [op],
  };
}

describe('classifyDiff', () => {
  it('returns empty result for no changes', () => {
    const result = classifyDiff(makeEmptyResult());
    expect(result.hasBreaking).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('flags removed operation as breaking', () => {
    const result = classifyDiff(
      makeEmptyResult({ paths: [makeRemovedOperation('/pets', 'delete')], isEmpty: false }),
    );
    expect(result.hasBreaking).toBe(true);
    expect(result.breaking).toHaveLength(1);
    expect(result.breaking[0]?.severity).toBe('breaking');
    expect(result.breaking[0]?.message).toContain('removed');
  });

  it('flags added required parameter as breaking', () => {
    const result = classifyDiff(
      makeEmptyResult({ paths: [makeAddedRequiredParam('/pets', 'get')], isEmpty: false }),
    );
    expect(result.hasBreaking).toBe(true);
    expect(result.breaking[0]?.severity).toBe('breaking');
  });

  it('flags removed path as breaking', () => {
    const pathDiff: PathDiff = {
      path: '/pets',
      type: 'removed',
      jsonPointer: '/paths/~1pets',
      pathParameters: [],
      operations: [],
    };
    const result = classifyDiff(makeEmptyResult({ paths: [pathDiff], isEmpty: false }));
    expect(result.hasBreaking).toBe(true);
  });

  it('flags added path as info', () => {
    const pathDiff: PathDiff = {
      path: '/users',
      type: 'added',
      jsonPointer: '/paths/~1users',
      pathParameters: [],
      operations: [],
    };
    const result = classifyDiff(makeEmptyResult({ paths: [pathDiff], isEmpty: false }));
    expect(result.hasBreaking).toBe(false);
    expect(result.info).toHaveLength(1);
    expect(result.info[0]?.severity).toBe('info');
  });

  it('flags removed response as warning', () => {
    const resp: ResponseDiff = {
      statusCode: '200',
      type: 'removed',
      jsonPointer: '/paths/~1pets/get/responses/200',
      changes: [],
      content: [],
      headers: [],
      before: { description: 'OK', content: {}, headers: {}, extensions: undefined },
    };
    const op: OperationDiff = {
      path: '/pets',
      method: 'get',
      type: 'modified',
      jsonPointer: '/paths/~1pets/get',
      changes: [],
      parameters: [],
      responses: [resp],
      extensions: [],
    };
    const pathDiff: PathDiff = {
      path: '/pets',
      type: 'modified',
      jsonPointer: '/paths/~1pets',
      pathParameters: [],
      operations: [op],
    };
    const result = classifyDiff(makeEmptyResult({ paths: [pathDiff], isEmpty: false }));
    expect(result.hasBreaking).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.severity).toBe('warning');
  });

  it('flags newly deprecated operation as warning', () => {
    const op: OperationDiff = {
      path: '/pets',
      method: 'get',
      type: 'modified',
      jsonPointer: '/paths/~1pets/get',
      changes: [
        {
          type: 'modified',
          path: '/paths/~1pets/get/deprecated',
          before: false,
          after: true,
        },
      ],
      parameters: [],
      responses: [],
      extensions: [],
    };
    const pathDiff: PathDiff = {
      path: '/pets',
      type: 'modified',
      jsonPointer: '/paths/~1pets',
      pathParameters: [],
      operations: [op],
    };
    const result = classifyDiff(makeEmptyResult({ paths: [pathDiff], isEmpty: false }));
    expect(result.hasBreaking).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toBe('operation deprecated');
  });

  it('flags parameter that became required as breaking', () => {
    const param: ParameterDiff = {
      name: 'filter',
      in: 'query',
      type: 'modified',
      jsonPointer: '/paths/~1pets/get/parameters/filter',
      changes: [],
      before: { name: 'filter', in: 'query', required: false, schema: { type: 'string' } },
      after: { name: 'filter', in: 'query', required: true, schema: { type: 'string' } },
    };
    const op: OperationDiff = {
      path: '/pets',
      method: 'get',
      type: 'modified',
      jsonPointer: '/paths/~1pets/get',
      changes: [],
      parameters: [param],
      responses: [],
      extensions: [],
    };
    const pathDiff: PathDiff = {
      path: '/pets',
      type: 'modified',
      jsonPointer: '/paths/~1pets',
      pathParameters: [],
      operations: [op],
    };
    const result = classifyDiff(makeEmptyResult({ paths: [pathDiff], isEmpty: false }));
    expect(result.hasBreaking).toBe(true);
    expect(result.breaking[0]?.message).toBe('parameter became required');
  });
});
