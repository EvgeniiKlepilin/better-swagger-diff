import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult, ClassifiedChange, Severity } from '../classify.js';

const SEVERITY_COLOR: Record<Severity, string> = {
  breaking: '#c0392b',
  warning: '#e67e22',
  info: '#27ae60',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  breaking: 'BREAKING',
  warning: 'WARNING',
  info: 'INFO',
};

export function formatHtml(_result: DiffResult, classification: ClassificationResult): string {
  const { changes } = classification;

  const rows = changes.length === 0
    ? '<tr><td colspan="3">No changes detected.</td></tr>'
    : changes.map(rowHtml).join('\n');

  const summary = changes.length === 0
    ? 'No changes detected.'
    : `${changes.length} change${changes.length !== 1 ? 's' : ''}: ${classification.breaking.length} breaking, ${classification.warnings.length} warnings, ${classification.info.length} info`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>API Diff Report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
  h1 { font-size: 1.5rem; }
  .summary { margin-bottom: 1rem; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f5f5f5; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; color: #fff; font-size: 0.75rem; font-weight: bold; }
</style>
</head>
<body>
<h1>API Diff Report</h1>
<p class="summary">${escHtml(summary)}</p>
<table>
<thead><tr><th>Severity</th><th>Location</th><th>Change</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
}

function rowHtml(change: ClassifiedChange): string {
  const color = SEVERITY_COLOR[change.severity];
  const label = SEVERITY_LABEL[change.severity];
  return `<tr>
  <td><span class="badge" style="background:${color}">${label}</span></td>
  <td>${escHtml(change.location)}</td>
  <td>${escHtml(change.message)}</td>
</tr>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
