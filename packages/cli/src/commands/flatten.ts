import type { Command } from 'commander';
import yaml from 'js-yaml';
import { loadSpecArg } from '../lib/load-input.js';
import { initColors } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';

export function registerFlattenCommand(program: Command): void {
  program
    .command('flatten <spec>')
    .description('Dereference all $refs and output a single-file spec')
    .action(async (spec: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        format: string;
        output?: string;
        color?: boolean;
        noColor?: boolean;
        quiet: boolean;
      }>();

      // Commander converts --no-color to color: false; normalize to noColor
      const noColor = globals.color === false ? true : globals.noColor ?? false;
      initColors(noColor);

      try {
        const parsed = await loadSpecArg(spec, { dereference: true });
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
