import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatDiff, isValidFormat } from '../lib/formatters/index.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <base> <head>')
    .description('Compare two OpenAPI/Swagger specs and show all changes')
    .action(async (base: string, head: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        format: string;
        output?: string;
        noColor: boolean;
        quiet: boolean;
        verbose: boolean;
      }>();

      initColors(globals.noColor);

      const format = isValidFormat(globals.format) ? globals.format : 'text';
      if (!isValidFormat(globals.format)) {
        process.stderr.write(`Unknown format "${globals.format}", defaulting to text.\n`);
      }

      try {
        if (globals.verbose) {
          process.stderr.write(`Loading base spec: ${base}\n`);
          process.stderr.write(`Loading head spec: ${head}\n`);
        }
        const baseSpec = await loadSpecArg(base);
        const headSpec = await loadSpecArg(head);

        const baseIR = parsedSpecToIR(baseSpec);
        const headIR = parsedSpecToIR(headSpec);
        const result = diff(baseIR, headIR);
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
