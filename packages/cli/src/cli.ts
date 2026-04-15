// Story 2.1 — CLI Scaffolding & Core Commands
import { Command } from 'commander';
import { registerDiffCommand } from './commands/diff.js';
import { registerBreakingCommand } from './commands/breaking.js';
import { registerChangelogCommand } from './commands/changelog.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerFlattenCommand } from './commands/flatten.js';
import { registerInitCommand } from './commands/init.js';

const program = new Command()
  .name('bsd')
  .description('Better Swagger Diff — compare OpenAPI/Swagger specifications')
  .version('0.1.0');

// Global flags (Story 2.1.7)
// NOTE: --format has no default here; resolveGlobalOptions() applies it from
// config or hardcoded default so we can distinguish "user passed text" from
// "nothing was passed".
program
  .option('--format <fmt>', 'output format: text|json|yaml|markdown|html|junit')
  .option('--output <file>', 'write output to file instead of stdout')
  .option('--config <file>', 'config file path (reserved — currently unused, config auto-discovered)')
  .option('--no-color', 'disable colored output and emoji icons')
  .option('--quiet', 'suppress all non-error output')
  .option('--verbose', 'print additional diagnostic information to stderr');

registerDiffCommand(program);
registerBreakingCommand(program);
registerChangelogCommand(program);
registerValidateCommand(program);
registerFlattenCommand(program);
registerInitCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
