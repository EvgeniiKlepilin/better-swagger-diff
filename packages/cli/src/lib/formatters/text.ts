import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult, ClassifiedChange, Severity } from '../classify.js';
import { bold, dim, severityIcon } from '../colors.js';

export function formatText(result: DiffResult, classification: ClassificationResult): string {
  if (result.isEmpty || classification.changes.length === 0) {
    return 'No changes detected.\n';
  }

  const { changes, breaking, warnings, info } = classification;
  const total = changes.length;
  const summary = `${total} change${total !== 1 ? 's' : ''} found (${breaking.length} breaking, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}, ${info.length} info)\n`;

  const lines: string[] = [bold(summary)];

  for (const change of changes) {
    lines.push(formatLine(change));
  }

  return lines.join('\n') + '\n';
}

function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'breaking': return 'BREAKING';
    case 'warning':  return 'WARNING ';
    case 'info':     return 'INFO    ';
  }
}

function formatLine(change: ClassifiedChange): string {
  const icon = severityIcon(change.severity);
  const label = severityLabel(change.severity);
  return `${icon} ${label}  ${change.location} — ${dim(change.message)}`;
}
