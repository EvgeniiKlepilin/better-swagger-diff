import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult } from '../classify.js';
import { formatText } from './text.js';
import { formatJson } from './json.js';
import { formatYaml } from './yaml.js';
import { formatMarkdown } from './markdown.js';
import { formatHtml } from './html.js';
import { formatJunit } from './junit.js';

export type Format = 'text' | 'json' | 'yaml' | 'markdown' | 'html' | 'junit';

export const VALID_FORMATS: Format[] = ['text', 'json', 'yaml', 'markdown', 'html', 'junit'];

export function isValidFormat(s: string): s is Format {
  return VALID_FORMATS.includes(s as Format);
}

/**
 * Format a DiffResult using the requested output format.
 */
export function formatDiff(
  result: DiffResult,
  classification: ClassificationResult,
  format: Format,
): string {
  switch (format) {
    case 'text':     return formatText(result, classification);
    case 'json':     return formatJson(result, classification);
    case 'yaml':     return formatYaml(result, classification);
    case 'markdown': return formatMarkdown(result, classification);
    case 'html':     return formatHtml(result, classification);
    case 'junit':    return formatJunit(result, classification);
  }
}
