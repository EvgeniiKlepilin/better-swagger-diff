import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult, ClassifiedChange } from '../classify.js';

export function formatMarkdown(result: DiffResult, classification: ClassificationResult): string {
  if (result.isEmpty || classification.changes.length === 0) {
    return '# API Changelog\n\nNo changes detected.\n';
  }

  const lines: string[] = ['# API Changelog', ''];

  if (classification.breaking.length > 0) {
    lines.push('## Breaking Changes', '');
    for (const c of classification.breaking) {
      lines.push(formatMdItem(c));
    }
    lines.push('');
  }

  if (classification.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const c of classification.warnings) {
      lines.push(formatMdItem(c));
    }
    lines.push('');
  }

  if (classification.info.length > 0) {
    lines.push('## Changes', '');
    for (const c of classification.info) {
      lines.push(formatMdItem(c));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatMdItem(change: ClassifiedChange): string {
  return `- \`${change.location}\` — ${change.message}`;
}
