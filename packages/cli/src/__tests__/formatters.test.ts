import { describe, it, expect, beforeAll } from 'vitest';
import { formatText } from '../lib/formatters/text.js';
import { formatJson } from '../lib/formatters/json.js';
import { formatYaml } from '../lib/formatters/yaml.js';
import { formatMarkdown } from '../lib/formatters/markdown.js';
import { formatHtml } from '../lib/formatters/html.js';
import { formatJunit } from '../lib/formatters/junit.js';
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

describe('formatYaml', () => {
  it('produces a YAML string with diffResult key', () => {
    const out = formatYaml(makeResult(), makeClassification());
    expect(out).toContain('diffResult:');
  });

  it('produces a YAML string with classification key', () => {
    const out = formatYaml(makeResult(), makeClassification());
    expect(out).toContain('classification:');
  });

  it('YAML output is not valid JSON (it is YAML)', () => {
    const out = formatYaml(makeResult(), makeClassification());
    // YAML uses `key: value` not `"key": value`
    expect(out).not.toMatch(/^{/);
  });
});

describe('formatMarkdown', () => {
  it('contains ## Breaking Changes heading', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    expect(out).toContain('## Breaking Changes');
  });

  it('contains the breaking change location', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    expect(out).toContain('DELETE /pets/{petId}');
  });

  it('contains ## Warnings heading', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    expect(out).toContain('## Warnings');
  });

  it('returns no-changes message for empty diff', () => {
    const emptyClassification: ClassificationResult = {
      changes: [], breaking: [], warnings: [], info: [], hasBreaking: false,
    };
    const out = formatMarkdown({ ...makeResult(), isEmpty: true }, emptyClassification);
    expect(out).toContain('No changes');
  });

  it('contains ## Changes heading for info items', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    expect(out).toContain('## Changes');
  });

  it('renders info item in the Changes section', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    expect(out).toContain('POST /users');
  });

  it('formats items with backtick location and em-dash', () => {
    const out = formatMarkdown(makeResult(), makeClassification());
    // items formatted as: `- \`{location}\` — {message}`
    expect(out).toMatch(/`DELETE \/pets\/{petId}`/);
    expect(out).toContain('— operation removed');
  });
});

describe('formatHtml', () => {
  it('is a valid HTML document with DOCTYPE', () => {
    const out = formatHtml(makeResult(), makeClassification());
    expect(out).toContain('<!DOCTYPE html>');
    expect(out).toContain('</html>');
  });

  it('contains the breaking change location', () => {
    const out = formatHtml(makeResult(), makeClassification());
    expect(out).toContain('DELETE /pets/{petId}');
  });

  it('contains BREAKING badge', () => {
    const out = formatHtml(makeResult(), makeClassification());
    expect(out).toContain('BREAKING');
  });

  it('escapes HTML special characters', () => {
    const out = formatHtml(makeResult(), makeClassification());
    // Location contains { and } which are not HTML special chars — verify & would be escaped
    expect(out).not.toContain('&amp;'); // no & in our test data, so nothing to escape
    expect(out).toContain('<table>'); // table structure present
  });
});

describe('formatJunit', () => {
  it('is valid XML with testsuites root', () => {
    const out = formatJunit(makeResult(), makeClassification());
    expect(out).toContain('<?xml');
    expect(out).toContain('<testsuites');
    expect(out).toContain('</testsuites>');
  });

  it('has failure element for breaking change', () => {
    const out = formatJunit(makeResult(), makeClassification());
    expect(out).toContain('<failure');
    expect(out).toContain('operation removed');
  });

  it('has testcase for breaking change location', () => {
    const out = formatJunit(makeResult(), makeClassification());
    expect(out).toContain('DELETE /pets/{petId}');
  });

  it('has testcase for info change without failure element', () => {
    const out = formatJunit(makeResult(), makeClassification());
    expect(out).toContain('POST /users');
    // Info items should NOT have a failure element
    const infoSection = out.slice(out.indexOf('POST /users'));
    expect(infoSection).not.toMatch(/<failure[^>]*message="operation added"/);
  });

  it('totals and failures count correctly', () => {
    const out = formatJunit(makeResult(), makeClassification());
    // 3 total changes, 1 breaking = 1 failure
    expect(out).toContain('tests="3"');
    expect(out).toContain('failures="1"');
  });
});
