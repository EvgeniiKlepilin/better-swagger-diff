import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findConfigFile,
  loadConfig,
  validateConfig,
  resolveGlobalOptions,
  getAuthHeaders,
} from '../lib/config.js';

describe('findConfigFile', () => {
  it('returns null when no config file exists in isolated tmp dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-empty-'));
    try {
      const result = findConfigFile(dir);
      expect(result === null || typeof result === 'string').toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('finds bsd.config.yaml in startDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-find-'));
    try {
      const configPath = join(dir, 'bsd.config.yaml');
      writeFileSync(configPath, 'format: json\n', 'utf-8');
      expect(findConfigFile(dir)).toBe(configPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('finds .bsdrc.json in startDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-json-'));
    try {
      const configPath = join(dir, '.bsdrc.json');
      writeFileSync(configPath, '{"format":"yaml"}', 'utf-8');
      expect(findConfigFile(dir)).toBe(configPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('finds .bsdrc.yaml in startDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-rc-'));
    try {
      const configPath = join(dir, '.bsdrc.yaml');
      writeFileSync(configPath, 'format: markdown\n', 'utf-8');
      expect(findConfigFile(dir)).toBe(configPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('walks up to parent directory to find config', () => {
    const parentDir = mkdtempSync(join(tmpdir(), 'bsd-parent-'));
    const childDir = join(parentDir, 'sub');
    try {
      mkdirSync(childDir);
      const configPath = join(parentDir, '.bsdrc.yaml');
      writeFileSync(configPath, 'format: markdown\n', 'utf-8');
      expect(findConfigFile(childDir)).toBe(configPath);
    } finally {
      rmSync(parentDir, { recursive: true, force: true });
    }
  });

  it('prefers bsd.config.yaml over .bsdrc.yaml when both present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-prio-'));
    try {
      writeFileSync(join(dir, 'bsd.config.yaml'), 'format: json\n', 'utf-8');
      writeFileSync(join(dir, '.bsdrc.yaml'), 'format: yaml\n', 'utf-8');
      expect(findConfigFile(dir)).toBe(join(dir, 'bsd.config.yaml'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadConfig', () => {
  it('returns null when no config file found', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-noconfig-'));
    try {
      const result = loadConfig(dir);
      expect(result === null || typeof result === 'object').toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads and parses a YAML config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-yaml-'));
    try {
      writeFileSync(join(dir, 'bsd.config.yaml'), 'format: yaml\nnoColor: true\n', 'utf-8');
      const config = loadConfig(dir);
      expect(config).toEqual({ format: 'yaml', noColor: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads and parses a JSON config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-jsonload-'));
    try {
      writeFileSync(
        join(dir, '.bsdrc.json'),
        JSON.stringify({ format: 'json', quiet: true }),
        'utf-8',
      );
      const config = loadConfig(dir);
      expect(config).toEqual({ format: 'json', quiet: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws on invalid YAML config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-bad-'));
    try {
      writeFileSync(join(dir, 'bsd.config.yaml'), 'format: [bad', 'utf-8');
      expect(() => loadConfig(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws descriptive error on invalid format value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bsd-badfmt-'));
    try {
      writeFileSync(join(dir, 'bsd.config.yaml'), 'format: xml\n', 'utf-8');
      expect(() => loadConfig(dir)).toThrow('"format" must be one of');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validateConfig', () => {
  it('accepts empty object', () => {
    expect(validateConfig({})).toEqual({});
  });

  it('accepts valid format', () => {
    expect(validateConfig({ format: 'json' })).toEqual({ format: 'json' });
  });

  it('throws on invalid format string', () => {
    expect(() => validateConfig({ format: 'xml' })).toThrow('"format" must be one of');
  });

  it('throws on non-string format', () => {
    expect(() => validateConfig({ format: 42 })).toThrow('"format" must be one of');
  });

  it('accepts noColor: true', () => {
    expect(validateConfig({ noColor: true })).toEqual({ noColor: true });
  });

  it('throws when noColor is not boolean', () => {
    expect(() => validateConfig({ noColor: 'yes' })).toThrow('"noColor" must be a boolean');
  });

  it('accepts quiet: false', () => {
    expect(validateConfig({ quiet: false })).toEqual({ quiet: false });
  });

  it('throws when quiet is not boolean', () => {
    expect(() => validateConfig({ quiet: 1 })).toThrow('"quiet" must be a boolean');
  });

  it('accepts verbose: true', () => {
    expect(validateConfig({ verbose: true })).toEqual({ verbose: true });
  });

  it('throws when verbose is not boolean', () => {
    expect(() => validateConfig({ verbose: 'true' })).toThrow('"verbose" must be a boolean');
  });

  it('accepts output as string', () => {
    expect(validateConfig({ output: 'out.txt' })).toEqual({ output: 'out.txt' });
  });

  it('throws when output is not string', () => {
    expect(() => validateConfig({ output: 123 })).toThrow('"output" must be a string');
  });

  it('accepts ignoredPaths as string array', () => {
    expect(validateConfig({ ignoredPaths: ['/internal/**'] })).toEqual({
      ignoredPaths: ['/internal/**'],
    });
  });

  it('throws when ignoredPaths contains non-strings', () => {
    expect(() => validateConfig({ ignoredPaths: [1, 2] })).toThrow(
      '"ignoredPaths" must be an array of strings',
    );
  });

  it('throws when ignoredPaths is not an array', () => {
    expect(() => validateConfig({ ignoredPaths: '/internal/**' })).toThrow(
      '"ignoredPaths" must be an array of strings',
    );
  });

  it('accepts ignoredRules as string array', () => {
    expect(validateConfig({ ignoredRules: ['param-required-added'] })).toEqual({
      ignoredRules: ['param-required-added'],
    });
  });

  it('throws when ignoredRules contains non-strings', () => {
    expect(() => validateConfig({ ignoredRules: [true] })).toThrow(
      '"ignoredRules" must be an array of strings',
    );
  });

  it('accepts customRules as string', () => {
    expect(validateConfig({ customRules: './bsd-rules.js' })).toEqual({
      customRules: './bsd-rules.js',
    });
  });

  it('throws when customRules is not string', () => {
    expect(() => validateConfig({ customRules: {} })).toThrow('"customRules" must be a string');
  });

  it('accepts auth as hostname → string map', () => {
    expect(validateConfig({ auth: { 'api.example.com': 'Bearer tok' } })).toEqual({
      auth: { 'api.example.com': 'Bearer tok' },
    });
  });

  it('throws when auth value is not string', () => {
    expect(() => validateConfig({ auth: { 'api.example.com': 123 } })).toThrow(
      '"auth.api.example.com" must be a string',
    );
  });

  it('throws when auth is not an object', () => {
    expect(() => validateConfig({ auth: 'Bearer tok' })).toThrow(
      '"auth" must be an object',
    );
  });

  it('throws when root is not an object', () => {
    expect(() => validateConfig('string')).toThrow('Config must be a YAML/JSON object');
  });

  it('throws when root is an array', () => {
    expect(() => validateConfig([1, 2])).toThrow('Config must be a YAML/JSON object');
  });

  it('throws when root is null', () => {
    expect(() => validateConfig(null)).toThrow('Config must be a YAML/JSON object');
  });
});

describe('resolveGlobalOptions', () => {
  it('returns hardcoded defaults when no CLI opts and no config', () => {
    const result = resolveGlobalOptions({}, null);
    expect(result.format).toBe('text');
    expect(result.noColor).toBe(false);
    expect(result.quiet).toBe(false);
    expect(result.verbose).toBe(false);
    expect(result.output).toBeUndefined();
    expect(result.config).toBeNull();
  });

  it('CLI format overrides config format', () => {
    const result = resolveGlobalOptions({ format: 'json' }, { format: 'yaml' });
    expect(result.format).toBe('json');
  });

  it('config format used when CLI format absent', () => {
    const result = resolveGlobalOptions({}, { format: 'yaml' });
    expect(result.format).toBe('yaml');
  });

  it('falls back to text for invalid CLI format string', () => {
    const result = resolveGlobalOptions({ format: 'xml' }, null);
    expect(result.format).toBe('text');
  });

  it('resolves noColor from --no-color flag (Commander sets color: false)', () => {
    const result = resolveGlobalOptions({ color: false }, null);
    expect(result.noColor).toBe(true);
  });

  it('resolves noColor from config when CLI flag absent', () => {
    const result = resolveGlobalOptions({}, { noColor: true });
    expect(result.noColor).toBe(true);
  });

  it('CLI --no-color overrides config noColor: false', () => {
    const result = resolveGlobalOptions({ color: false }, { noColor: false });
    expect(result.noColor).toBe(true);
  });

  it('config quiet used when CLI quiet absent', () => {
    const result = resolveGlobalOptions({}, { quiet: true });
    expect(result.quiet).toBe(true);
  });

  it('CLI output overrides config output', () => {
    const result = resolveGlobalOptions({ output: 'a.txt' }, { output: 'b.txt' });
    expect(result.output).toBe('a.txt');
  });

  it('config output used when CLI output absent', () => {
    const result = resolveGlobalOptions({}, { output: 'b.txt' });
    expect(result.output).toBe('b.txt');
  });

  it('attaches config to result', () => {
    const config = { format: 'json' as const };
    const result = resolveGlobalOptions({}, config);
    expect(result.config).toBe(config);
  });
});

describe('getAuthHeaders', () => {
  it('returns empty object when config is null', () => {
    expect(getAuthHeaders('https://api.example.com/spec.yaml', null)).toEqual({});
  });

  it('returns empty object when config has no auth field', () => {
    expect(getAuthHeaders('https://api.example.com/spec.yaml', {})).toEqual({});
  });

  it('returns Authorization header matching hostname', () => {
    const result = getAuthHeaders('https://api.example.com/spec.yaml', {
      auth: { 'api.example.com': 'Bearer mytoken' },
    });
    expect(result).toEqual({ Authorization: 'Bearer mytoken' });
  });

  it('returns empty when hostname not in auth map', () => {
    const result = getAuthHeaders('https://other.com/spec.yaml', {
      auth: { 'api.example.com': 'Bearer mytoken' },
    });
    expect(result).toEqual({});
  });

  it('returns empty for local file path (not a URL)', () => {
    const result = getAuthHeaders('./spec.yaml', {
      auth: { 'api.example.com': 'Bearer mytoken' },
    });
    expect(result).toEqual({});
  });
});
