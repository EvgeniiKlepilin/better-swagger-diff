import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { parsedSpecToIR } from '../lib/spec-to-ir.js';
import { diff } from '@better-swagger-diff/core';
import { classifyDiff } from '../lib/classify.js';
import { formatDiff } from '../lib/formatters/index.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';
import { loadConfig, resolveGlobalOptions, getAuthHeaders } from '../lib/config.js';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <base> <head>')
    .description('Compare two OpenAPI/Swagger specs and show all changes')
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
        if (globals.verbose) {
          process.stderr.write(`Loading base spec: ${base}\n`);
          process.stderr.write(`Loading head spec: ${head}\n`);
        }

        const baseSpec = await loadSpecArg(base, { headers: getAuthHeaders(base, config) });
        const headSpec = await loadSpecArg(head, { headers: getAuthHeaders(head, config) });

        const baseIR = parsedSpecToIR(baseSpec);
        const headIR = parsedSpecToIR(headSpec);
        const result = diff(baseIR, headIR);
        const classification = classifyDiff(result);

        if (!globals.quiet) {
          const output = formatDiff(result, classification, globals.format);
          await writeOutput(output, globals.output);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}
