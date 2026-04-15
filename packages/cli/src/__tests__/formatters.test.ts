import { describe, it, expect, beforeAll } from 'vitest';
import { formatText } from '../lib/formatters/text.js';
import { formatJson } from '../lib/formatters/json.js';
import { initColors } from '../lib/colors.js';
import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult } from '../lib/classify.js';

beforeAll(() => {
  initColors(true); // no color in tests — use ASCII mode
});

function makeResult(): DiffResult {
  return {
    isEmpty: false,
    paths: [],
    webhooks: [],
    securitySchemes: [],
    tags: [],
    servers: [],
    extensions: [],
  };
}

function makeClassification(): ClassificationResult {
  return {
    changes: [
      { severity: 'breaking', message: 'operation removed', location: 'DELETE /pets/{petId}', jsonPointer: '/paths/~1pets~1{petId}/delete' },
      { severity: 'warning', message: 'response status code removed', location: 'GET /pets — response 200', jsonPointer: '/paths/~1pets/get/responses/200' },
      { severity: 'info', message: 'operation added', location: 'POST /users', jsonPointer: '/paths/~1users/post' },
    ],
    breaking: [{ severity: 'breaking', message: 'operation removed', location: 'DELETE /pets/{petId}', jsonPointer: '/paths/~1pets~1{petId}/delete' }],
    warnings: [{ severity: 'warning', message: 'response status code removed', location: 'GET /pets — response 200', jsonPointer: '/paths/~1pets/get/responses/200' }],
    info: [{ severity: 'info', message: 'operation added', location: 'POST /users', jsonPointer: '/paths/~1users/post' }],
    hasBreaking: true,
  };
}

describe('formatText', () => {
  it('shows summary line with counts', () => {
    const out = formatText(makeResult(), makeClassification());
    expect(out).toContain('3 changes');
    expect(out).toContain('1 breaking');
  });

  it('shows [!] prefix for breaking change (no-color mode)', () => {
    const out = formatText(makeResult(), makeClassification());
    expect(out).toContain('[!]');
    expect(out).toContain('BREAKING');
  });

  it('shows [~] prefix for warning (no-color mode)', () => {
    const out = formatText(makeResult(), makeClassification());
    expect(out).toContain('[~]');
    expect(out).toContain('WARNING');
  });

  it('shows no changes message for empty diff', () => {
    const emptyClassification: ClassificationResult = {
      changes: [], breaking: [], warnings: [], info: [], hasBreaking: false,
    };
    const out = formatText({ ...makeResult(), isEmpty: true }, emptyClassification);
    expect(out).toContain('No changes');
  });
});

describe('formatJson', () => {
  it('produces valid JSON', () => {
    const out = formatJson(makeResult(), makeClassification());
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('includes diffResult and classification keys', () => {
    const parsed = JSON.parse(formatJson(makeResult(), makeClassification()));
    expect(parsed).toHaveProperty('diffResult');
    expect(parsed).toHaveProperty('classification');
  });

  it('classification in JSON contains the breaking change', () => {
    const parsed = JSON.parse(formatJson(makeResult(), makeClassification()));
    expect(parsed.classification.hasBreaking).toBe(true);
    expect(parsed.classification.breaking).toHaveLength(1);
  });
});
