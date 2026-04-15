import type { Command } from 'commander';
import { loadSpecArg } from '../lib/load-input.js';
import { initColors, bold, green, red } from '../lib/colors.js';
import { writeOutput } from '../lib/output.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate <spec>')
    .description('Validate a spec file for well-formedness and $ref resolution')
    .action(async (spec: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        output?: string;
        noColor: boolean;
        quiet: boolean;
      }>();

      initColors(globals.noColor);

      try {
        const parsed = await loadSpecArg(spec);

        if (!globals.quiet) {
          const msg = `${green('✓')} ${bold(spec)} is valid (${parsed.version})\n`;
          await writeOutput(msg, globals.output);
        }
      } catch (err) {
        const msg = `${red('✗')} Validation failed: ${err instanceof Error ? err.message : String(err)}\n`;
        process.stderr.write(msg);
        process.exit(1);
      }
    });
}
