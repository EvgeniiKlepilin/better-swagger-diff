import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatText } from '../lib/formatters/text.js';
import { formatJson } from '../lib/formatters/json.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';
import { loadConfig, resolveGlobalOptions, getAuthHeaders } from '../lib/config.js';

export function registerBreakingCommand(program: Command): void {
  program
    .command('breaking <base> <head>')
    .description('Check for breaking changes — exits with code 1 if any are found')
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
      initColors(globals.noColor);

      try {
        const baseSpec = await loadSpecArg(base, { headers: getAuthHeaders(base, config) });
        const headSpec = await loadSpecArg(head, { headers: getAuthHeaders(head, config) });
        const result = diff(parsedSpecToIR(baseSpec), parsedSpecToIR(headSpec));
        const classification = classifyDiff(result);

        if (!globals.quiet) {
          const breakingOnly = { ...result, isEmpty: classification.breaking.length === 0 };
          const breakingClassification = {
            ...classification,
            changes: classification.breaking,
            warnings: [],
            info: [],
          };

          const output =
            globals.format === 'json'
              ? formatJson(breakingOnly, breakingClassification)
              : formatText(breakingOnly, breakingClassification);

          await writeOutput(output, globals.output);
        }

        if (classification.hasBreaking) {
          process.exit(1);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}
