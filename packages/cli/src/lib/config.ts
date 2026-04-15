// Story 2.2 — Configuration File
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import yaml from 'js-yaml';
import { isValidFormat, VALID_FORMATS } from './formatters/index.js';
import type { Format } from './formatters/index.js';

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

export interface BsdConfig {
  /** Default output format */
  format?: Format;
  /** Write output to this file by default */
  output?: string;
  /** Disable colored terminal output */
  noColor?: boolean;
  /** Suppress all non-error output */
  quiet?: boolean;
  /** Print diagnostic information to stderr */
  verbose?: boolean;
  /**
   * Glob patterns for API paths to exclude from diff.
   * Reserved for Story 6 — Rule Engine.
   */
  ignoredPaths?: string[];
  /**
   * Rule IDs to suppress.
   * Reserved for Story 6 — Rule Engine.
   */
  ignoredRules?: string[];
  /**
   * Path to a custom breaking-change rules file.
   * Reserved for Story 6 — Rule Engine.
   */
  customRules?: string;
  /**
   * Auth headers for remote spec fetching.
   * Keys are hostnames (e.g. "api.example.com"),
   * values are Authorization header values (e.g. "Bearer <token>").
   */
  auth?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const CONFIG_FILENAMES = ['bsd.config.yaml', '.bsdrc.yaml', '.bsdrc.json'] as const;

/**
 * Walk up the directory tree from `startDir` looking for a BSD config file.
 * Returns the absolute path of the first match, or `null` if none is found.
 * Search order per directory: bsd.config.yaml → .bsdrc.yaml → .bsdrc.json
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (;;) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Find and load the nearest BSD config file starting from `startDir`
 * (defaults to `process.cwd()`). Returns `null` when no config file exists.
 * Throws a descriptive error when the config is malformed or fails validation.
 */
export function loadConfig(startDir?: string): BsdConfig | null {
  const configPath = findConfigFile(startDir);
  if (!configPath) return null;

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: unknown;

  if (configPath.endsWith('.json')) {
    parsed = JSON.parse(raw) as unknown;
  } else {
    parsed = yaml.load(raw);
  }

  return validateConfig(parsed, configPath);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a parsed config object and return a typed `BsdConfig`.
 * Throws a descriptive `Error` on any schema violation.
 * `source` is used in error messages (typically the config file path).
 */
export function validateConfig(raw: unknown, source = 'config'): BsdConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `[${source}] Config must be a YAML/JSON object, got ${
        Array.isArray(raw) ? 'array' : String(raw)
      }`,
    );
  }

  const obj = raw as Record<string, unknown>;
  const cfg: BsdConfig = {};

  if ('format' in obj) {
    if (typeof obj['format'] !== 'string' || !isValidFormat(obj['format'])) {
      throw new Error(
        `[${source}] "format" must be one of: ${VALID_FORMATS.join(', ')}. Got: ${JSON.stringify(obj['format'])}`,
      );
    }
    cfg.format = obj['format'];
  }

  if ('output' in obj) {
    if (typeof obj['output'] !== 'string' || obj['output'].trim() === '') {
      throw new Error(
        `[${source}] "output" must be a non-empty string. Got: ${JSON.stringify(obj['output'])}`,
      );
    }
    cfg.output = obj['output'];
  }

  if ('noColor' in obj) {
    if (typeof obj['noColor'] !== 'boolean') {
      throw new Error(
        `[${source}] "noColor" must be a boolean. Got: ${JSON.stringify(obj['noColor'])}`,
      );
    }
    cfg.noColor = obj['noColor'];
  }

  if ('quiet' in obj) {
    if (typeof obj['quiet'] !== 'boolean') {
      throw new Error(
        `[${source}] "quiet" must be a boolean. Got: ${JSON.stringify(obj['quiet'])}`,
      );
    }
    cfg.quiet = obj['quiet'];
  }

  if ('verbose' in obj) {
    if (typeof obj['verbose'] !== 'boolean') {
      throw new Error(
        `[${source}] "verbose" must be a boolean. Got: ${JSON.stringify(obj['verbose'])}`,
      );
    }
    cfg.verbose = obj['verbose'];
  }

  if ('ignoredPaths' in obj) {
    if (
      !Array.isArray(obj['ignoredPaths']) ||
      (obj['ignoredPaths'] as unknown[]).some((p) => typeof p !== 'string')
    ) {
      throw new Error(`[${source}] "ignoredPaths" must be an array of strings.`);
    }
    cfg.ignoredPaths = obj['ignoredPaths'] as string[];
  }

  if ('ignoredRules' in obj) {
    if (
      !Array.isArray(obj['ignoredRules']) ||
      (obj['ignoredRules'] as unknown[]).some((r) => typeof r !== 'string')
    ) {
      throw new Error(`[${source}] "ignoredRules" must be an array of strings.`);
    }
    cfg.ignoredRules = obj['ignoredRules'] as string[];
  }

  if ('customRules' in obj) {
    if (typeof obj['customRules'] !== 'string' || obj['customRules'].trim() === '') {
      throw new Error(
        `[${source}] "customRules" must be a non-empty string path. Got: ${JSON.stringify(obj['customRules'])}`,
      );
    }
    cfg.customRules = obj['customRules'];
  }

  if ('auth' in obj) {
    const auth = obj['auth'];
    if (auth === null || typeof auth !== 'object' || Array.isArray(auth)) {
      throw new Error(
        `[${source}] "auth" must be an object mapping hostnames to Authorization header values.`,
      );
    }
    const authObj = auth as Record<string, unknown>;
    for (const [k, v] of Object.entries(authObj)) {
      if (typeof v !== 'string') {
        throw new Error(
          `[${source}] "auth.${k}" must be a string. Got: ${JSON.stringify(v)}`,
        );
      }
    }
    cfg.auth = authObj as Record<string, string>;
  }

  return cfg;
}

// ---------------------------------------------------------------------------
// Option resolution
// ---------------------------------------------------------------------------

export interface ResolvedGlobalOptions {
  format: Format;
  output?: string;
  noColor: boolean;
  quiet: boolean;
  verbose: boolean;
  config: BsdConfig | null;
}

/**
 * Merge raw Commander globals with config-file defaults.
 * CLI flags always win over config values; config values win over hardcoded defaults.
 *
 * Commander converts `--no-color` to `{ color: false }`. Pass the raw globals
 * directly from `cmd.optsWithGlobals()` without pre-processing.
 */
export function resolveGlobalOptions(
  rawGlobals: {
    format?: string;
    output?: string;
    color?: boolean;
    noColor?: boolean;
    quiet?: boolean;
    verbose?: boolean;
  },
  config: BsdConfig | null,
): ResolvedGlobalOptions {
  // --no-color sets color: false in Commander; --noColor is a fallback path
  const noColor =
    rawGlobals.color === false ? true : (rawGlobals.noColor ?? config?.noColor ?? false);

  // Invalid --format values silently fall back to config/default. Commander
  // does not enumerate valid choices for --format, so this soft-fallback is
  // intentional. A future story can add Commander's .choices() for hard rejection.
  const rawFormat = rawGlobals.format;
  const format: Format =
    rawFormat !== undefined && isValidFormat(rawFormat)
      ? rawFormat
      : (config?.format ?? 'text');

  return {
    format,
    output: rawGlobals.output ?? config?.output,
    noColor,
    quiet: rawGlobals.quiet ?? config?.quiet ?? false,
    verbose: rawGlobals.verbose ?? config?.verbose ?? false,
    config,
  };
}

// ---------------------------------------------------------------------------
// Auth header utility
// ---------------------------------------------------------------------------

/**
 * Extract `Authorization` headers for a given URL from the config's `auth` map.
 * Matches by hostname only. Returns `{}` for local file paths or unknown hosts.
 */
export function getAuthHeaders(
  url: string,
  config: BsdConfig | null,
): Record<string, string> {
  if (!config?.auth) return {};
  try {
    const { hostname } = new URL(url);
    const token = config.auth[hostname];
    if (token !== undefined) return { Authorization: token };
  } catch {
    // Not a valid URL (local file path) — no auth headers needed
  }
  return {};
}
