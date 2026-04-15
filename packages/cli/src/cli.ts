// Story 2.1 — CLI Scaffolding & Core Commands
import { Command } from 'commander';
import { registerDiffCommand } from './commands/diff.js';
import { registerBreakingCommand } from './commands/breaking.js';
import { registerChangelogCommand } from './commands/changelog.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerFlattenCommand } from './commands/flatten.js';

const program = new Command()
  .name('bsd')
  .description('Better Swagger Diff — compare OpenAPI/Swagger specifications')
  .version('0.1.0');

// Global flags (Story 2.1.7)
program
  .option('--format <fmt>', 'output format: text|json|yaml|markdown|html|junit', 'text')
  .option('--output <file>', 'write output to file instead of stdout')
  .option('--config <file>', 'config file path (full support in Story 2.2)')
  .option('--no-color', 'disable colored output and emoji icons')
  .option('--quiet', 'suppress all non-error output')
  .option('--verbose', 'print additional diagnostic information to stderr');

registerDiffCommand(program);
registerBreakingCommand(program);
registerChangelogCommand(program);
registerValidateCommand(program);
registerFlattenCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
