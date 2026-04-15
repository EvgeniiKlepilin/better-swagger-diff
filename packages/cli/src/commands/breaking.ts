import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatText } from '../lib/formatters/text.js';
import { formatJson } from '../lib/formatters/json.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';
import { isValidFormat } from '../lib/formatters/index.js';

export function registerBreakingCommand(program: Command): void {
  program
    .command('breaking <base> <head>')
    .description('Check for breaking changes — exits with code 1 if any are found')
    .action(async (base: string, head: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        format: string;
        output?: string;
        noColor: boolean;
        quiet: boolean;
        verbose: boolean;
      }>();

      initColors(globals.noColor);

      try {
        const baseSpec = await loadSpecArg(base);
        const headSpec = await loadSpecArg(head);
        const result = diff(parsedSpecToIR(baseSpec), parsedSpecToIR(headSpec));
        const classification = classifyDiff(result);

        if (!globals.quiet) {
          // Only show breaking changes (not warnings/info)
          const breakingOnly = {
            ...result,
            isEmpty: classification.breaking.length === 0,
          };
          const breakingClassification = {
            ...classification,
            changes: classification.breaking,
            warnings: [],
            info: [],
          };

          const fmt = isValidFormat(globals.format) ? globals.format : 'text';
          const output =
            fmt === 'json'
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
