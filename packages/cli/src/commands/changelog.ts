import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatDiff, isValidFormat } from '../lib/formatters/index.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';
import { loadConfig, resolveGlobalOptions, getAuthHeaders } from '../lib/config.js';

export function registerChangelogCommand(program: Command): void {
  program
    .command('changelog <base> <head>')
    .description('Generate a human-readable changelog between two specs')
    .action(async (base: string, head: string, _opts: unknown, cmd: Command) => {
      const rawGlobals = cmd.optsWithGlobals<{
        format?: string;
        output?: string;
        color?: boolean;
        noColor?: boolean;
        quiet?: boolean;
        verbose?: boolean;
      }>();

      const config = loadConfig();
      const globals = resolveGlobalOptions(rawGlobals, config);

      // changelog defaults to markdown when --format is not explicitly passed
      // and the config does not specify a format.
      const format =
        rawGlobals.format !== undefined && isValidFormat(rawGlobals.format)
          ? rawGlobals.format
          : (config?.format ?? 'markdown');

      initColors(globals.noColor);

      try {
        const baseSpec = await loadSpecArg(base, { headers: getAuthHeaders(base, config) });
        const headSpec = await loadSpecArg(head, { headers: getAuthHeaders(head, config) });
        const result = diff(parsedSpecToIR(baseSpec), parsedSpecToIR(headSpec));
        const classification = classifyDiff(result);

        if (!globals.quiet) {
          const output = formatDiff(result, classification, format);
          await writeOutput(output, globals.output);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}
