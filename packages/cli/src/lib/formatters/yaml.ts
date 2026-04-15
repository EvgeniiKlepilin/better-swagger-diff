import yaml from 'js-yaml';
import type { DiffResult } from '@better-swagger-diff/core';
import type { ClassificationResult } from '../classify.js';

export function formatYaml(result: DiffResult, classification: ClassificationResult): string {
  return yaml.dump({ diffResult: result, classification }, { noRefs: true, lineWidth: 120 });
}
