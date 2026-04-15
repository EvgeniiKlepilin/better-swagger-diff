import { swagger2ToIR, oas3ToIR } from '@better-swagger-diff/core';
import type { ParsedSpec, IRSpec } from '@better-swagger-diff/core';

/**
 * Convert a loaded ParsedSpec to the version-agnostic IRSpec used by the differ.
 */
export function parsedSpecToIR(spec: ParsedSpec): IRSpec {
  switch (spec.version) {
    case 'swagger-2.0':
      return swagger2ToIR(spec.document);
    case 'openapi-3.0':
    case 'openapi-3.1':
      return oas3ToIR(spec.document);
  }
}
