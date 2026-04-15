import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initColors } from '../lib/colors.js';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatDiff } from '../lib/formatters/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BASE = resolve(__dirname, 'fixtures/base.yaml');
const HEAD = resolve(__dirname, 'fixtures/head.yaml');

beforeAll(() => {
  initColors(true);
});

describe('diff pipeline (base → head)', () => {
  it('loads base spec as openapi-3.0', async () => {
    const base = await loadSpecArg(BASE);
    expect(base.version).toBe('openapi-3.0');
  });

  it('loads head spec as openapi-3.0', async () => {
    const head = await loadSpecArg(HEAD);
    expect(head.version).toBe('openapi-3.0');
  });

  it('detects changes (isEmpty: false)', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    expect(result.isEmpty).toBe(false);
  });

  it('classifies DELETE /pets/{petId} removal as breaking', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    const classification = classifyDiff(result);
    expect(classification.hasBreaking).toBe(true);
    const removedOp = classification.breaking.find((c) =>
      c.location.includes('/pets/{petId}') || c.location.includes('DELETE'),
    );
    expect(removedOp).toBeDefined();
  });

  it('classifies limit becoming required as breaking', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    const classification = classifyDiff(result);
    const becameRequired = classification.breaking.find((c) =>
      c.message.includes('required') || c.location.includes('limit'),
    );
    expect(becameRequired).toBeDefined();
  });

  it('classifies POST /users as info (added operation)', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    const classification = classifyDiff(result);
    const addedOp = classification.info.find((c) =>
      c.location.includes('/users') || c.location.includes('POST'),
    );
    expect(addedOp).toBeDefined();
  });

  it('formats as text with changes summary', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    const classification = classifyDiff(result);
    const text = formatDiff(result, classification, 'text');
    expect(text).toContain('changes found');
    expect(text).toContain('breaking');
  });

  it('formats as valid JSON', async () => {
    const base = await loadSpecArg(BASE);
    const head = await loadSpecArg(HEAD);
    const result = diff(parsedSpecToIR(base), parsedSpecToIR(head));
    const classification = classifyDiff(result);
    const json = formatDiff(result, classification, 'json');
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.classification.hasBreaking).toBe(true);
  });
});
