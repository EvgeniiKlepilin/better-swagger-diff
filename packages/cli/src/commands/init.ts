// Story 2.2.3 — bsd init command
import type { Command } from 'commander';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { isValidFormat } from '../lib/formatters/index.js';

/**
 * Generate the content of a starter `.bsdrc.yaml` config file.
 * Pure function — no I/O, easy to test.
 */
export function generateConfigTemplate(options: {
  format?: string;
  noColor?: boolean;
}): string {
  const format = options.format ?? 'text';
  const noColor = options.noColor ?? false;

  return [
    '# Better Swagger Diff — configuration file',
    '# Run "bsd --help" for full CLI reference.',
    '',
    '# Default output format: text | json | yaml | markdown | html | junit',
    `format: ${format}`,
    '',
    '# Disable colored terminal output (useful in CI)',
    `noColor: ${noColor}`,
    '',
    '# Suppress all non-error output',
    'quiet: false',
    '',
    '# Print diagnostic information to stderr',
    'verbose: false',
    '',
    '# ── Reserved for Story 6 — Rule Engine ────────────────────────────────',
    '',
    '# Glob patterns for API paths to exclude from diff',
    '# ignoredPaths:',
    '#   - /internal/**',
    '#   - /health',
    '',
    '# Rule IDs to suppress',
    '# ignoredRules:',
    '#   - param-required-added',
    '',
    '# Path to a custom breaking-change rules file',
    '# customRules: ./bsd-rules.js',
    '',
    '# ── Auth headers for remote spec fetching ──────────────────────────────',
    '# Keys are hostnames; values are Authorization header values.',
    '# auth:',
    '#   api.example.com: "Bearer <token>"',
    '',
  ].join('\n');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold a .bsdrc.yaml configuration file in the current directory')
    .action(async (_opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ quiet?: boolean }>();
      const configPath = join(process.cwd(), '.bsdrc.yaml');

      if (existsSync(configPath)) {
        process.stderr.write(
          `Config file already exists: ${configPath}\nDelete it first or edit it manually.\n`,
        );
        process.exit(1);
      }

      const rl = createInterface({ input, output });
      try {
        const rawFormat = await rl.question(
          'Default output format? (text|json|yaml|markdown|html|junit) [text]: ',
        );
        const trimmed = rawFormat.trim();
        const format = trimmed !== '' && isValidFormat(trimmed) ? trimmed : 'text';

        const rawNoColor = await rl.question('Disable colors by default? (y/N) [N]: ');
        const noColor = rawNoColor.trim().toLowerCase() === 'y';

        const template = generateConfigTemplate({ format, noColor });
        writeFileSync(configPath, template, 'utf-8');

        if (!globals.quiet) {
          process.stdout.write(`Created ${configPath}\n`);
        }
      } finally {
        rl.close();
      }
    });
}
