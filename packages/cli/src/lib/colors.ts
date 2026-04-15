import chalk from 'chalk';
import type { Severity } from './classify.js';

/** Global no-color flag. Set via initColors() before rendering. */
let _noColor = false;

/**
 * Initialize color settings.
 * Call once at CLI startup with the resolved --no-color flag value.
 * Also checks the NO_COLOR environment variable (https://no-color.org/).
 */
export function initColors(noColor: boolean): void {
  _noColor = noColor || !!process.env['NO_COLOR'];
  if (_noColor) {
    chalk.level = 0;
  }
}

export function red(s: string): string {
  return _noColor ? s : chalk.red(s);
}

export function yellow(s: string): string {
  return _noColor ? s : chalk.yellow(s);
}

export function green(s: string): string {
  return _noColor ? s : chalk.green(s);
}

export function bold(s: string): string {
  return _noColor ? s : chalk.bold(s);
}

export function dim(s: string): string {
  return _noColor ? s : chalk.dim(s);
}

/**
 * Returns a severity icon.
 * Emoji icons when color is enabled; ASCII fallbacks when --no-color.
 */
export function severityIcon(severity: Severity): string {
  if (_noColor) {
    return severity === 'breaking' ? '[!]' : severity === 'warning' ? '[~]' : '[ ]';
  }
  return severity === 'breaking' ? '🔴' : severity === 'warning' ? '🟡' : '🟢';
}
