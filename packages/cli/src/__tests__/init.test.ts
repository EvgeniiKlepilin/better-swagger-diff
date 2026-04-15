import { describe, it, expect } from 'vitest';
import { generateConfigTemplate } from '../commands/init.js';

describe('generateConfigTemplate', () => {
  it('includes format: text by default', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('format: text');
  });

  it('uses provided format', () => {
    const t = generateConfigTemplate({ format: 'json' });
    expect(t).toContain('format: json');
  });

  it('sets noColor: false by default', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('noColor: false');
  });

  it('sets noColor: true when requested', () => {
    const t = generateConfigTemplate({ noColor: true });
    expect(t).toContain('noColor: true');
  });

  it('includes commented ignoredPaths example', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('# ignoredPaths:');
  });

  it('includes commented ignoredRules example', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('# ignoredRules:');
  });

  it('includes commented customRules example', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('# customRules:');
  });

  it('includes commented auth example', () => {
    const t = generateConfigTemplate({});
    expect(t).toContain('# auth:');
  });

  it('is valid YAML that js-yaml can parse', async () => {
    const { load } = await import('js-yaml');
    const t = generateConfigTemplate({ format: 'markdown', noColor: true });
    expect(() => load(t)).not.toThrow();
    const parsed = load(t) as Record<string, unknown>;
    expect(parsed['format']).toBe('markdown');
    expect(parsed['noColor']).toBe(true);
  });
});
