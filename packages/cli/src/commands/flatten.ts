import type { Command } from 'commander';
import yaml from 'js-yaml';
import { loadSpecArg } from '../lib/load-input.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';
import { loadConfig, resolveGlobalOptions, getAuthHeaders } from '../lib/config.js';

export function registerFlattenCommand(program: Command): void {
  program
    .command('flatten <spec>')
    .description('Dereference all $refs and output a single-file spec')
    .action(async (spec: string, _opts: unknown, cmd: Command) => {
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
        const parsed = await loadSpecArg(spec, {
          dereference: true,
          headers: getAuthHeaders(spec, config),
        });
        const doc = parsed.document;

        const useYaml = globals.format === 'yaml';
        const output = useYaml
          ? yaml.dump(doc, { noRefs: true, lineWidth: 120 })
          : JSON.stringify(doc, null, 2);

        if (!globals.quiet) {
          await writeOutput(output, globals.output);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}
