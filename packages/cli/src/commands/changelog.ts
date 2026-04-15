import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatDiff, isValidFormat } from '../lib/formatters/index.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';

export function registerChangelogCommand(program: Command): void {
  program
    .command('changelog <base> <head>')
    .description('Generate a human-readable changelog between two specs')
    .action(async (base: string, head: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        format: string;
        output?: string;
        color?: boolean;
        noColor?: boolean;
        quiet: boolean;
        verbose: boolean;
      }>();

      // Commander converts --no-color to color: false; normalize to noColor
      const noColor = globals.color === false ? true : globals.noColor ?? false;
      initColors(noColor);

      // Default format for changelog is markdown (unlike diff which defaults to text)
      const fmt = isValidFormat(globals.format) ? globals.format : 'markdown';

      try {
        const baseSpec = await loadSpecArg(base);
        const headSpec = await loadSpecArg(head);
        const result = diff(parsedSpecToIR(baseSpec), parsedSpecToIR(headSpec));
        const classification = classifyDiff(result);

        if (!globals.quiet) {
          const output = formatDiff(result, classification, fmt);
          await writeOutput(output, globals.output);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}
