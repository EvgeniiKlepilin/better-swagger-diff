import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult } from '../classify.js';

export function formatJson(result: DiffResult, classification: ClassificationResult): string {
  return JSON.stringify({ diffResult: result, classification }, null, 2);
}
