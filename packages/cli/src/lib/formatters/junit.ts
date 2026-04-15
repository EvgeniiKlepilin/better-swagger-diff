import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult, ClassifiedChange } from '../classify.js';

export function formatJunit(_result: DiffResult, classification: ClassificationResult): string {
  const { changes, breaking, warnings, info } = classification;
  const total = changes.length;
  const failures = breaking.length;

  const breakingSuite = testSuite('breaking-changes', breaking, true);
  const warningSuite = testSuite('warnings', warnings, false);
  const infoSuite = testSuite('info', info, false);

  const suites = [breakingSuite, warningSuite, infoSuite].filter(Boolean).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="API Diff" tests="${total}" failures="${failures}">
${suites}
</testsuites>`;
}

function testSuite(name: string, changes: ClassifiedChange[], isFailure: boolean): string {
  if (changes.length === 0) return '';
  const failures = isFailure ? changes.length : 0;
  const cases = changes.map((c) => testCase(c, isFailure)).join('\n');
  return `  <testsuite name="${escXml(name)}" tests="${changes.length}" failures="${failures}" errors="0">
${cases}
  </testsuite>`;
}

function testCase(change: ClassifiedChange, isFailure: boolean): string {
  if (isFailure) {
    return `    <testcase name="${escXml(change.location)}">
      <failure message="${escXml(change.message)}" type="${change.severity}"/>
    </testcase>`;
  }
  return `    <testcase name="${escXml(change.location)} — ${escXml(change.message)}"/>`;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
