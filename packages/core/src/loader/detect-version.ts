import type { SpecVersion } from '../types.js';

/**
 * Detect the spec version from a parsed (but not yet validated) document.
 *
 * Rules:
 * - `swagger` field starting with `"2"` → Swagger 2.0
 * - `openapi` field starting with `"3.0"` → OpenAPI 3.0.x
 * - `openapi` field starting with `"3.1"` → OpenAPI 3.1.x
 *
 * @throws {Error} if neither `swagger` nor `openapi` is present, or if the
 *   version string is not one we support.
 */
export function detectVersion(document: unknown): SpecVersion {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error(
      'Cannot detect spec version: document is not an object. ' +
      'Make sure the file contains a valid Swagger/OpenAPI specification.',
    );
  }

  const doc = document as Record<string, unknown>;

  if (typeof doc['swagger'] === 'string') {
    if (doc['swagger'].startsWith('2')) {
      return 'swagger-2.0';
    }
    throw new Error(
      `Unsupported Swagger version: "${doc['swagger']}". Only Swagger 2.0 is supported.`,
    );
  }

  if (typeof doc['openapi'] === 'string') {
    if (doc['openapi'].startsWith('3.0')) {
      return 'openapi-3.0';
    }
    if (doc['openapi'].startsWith('3.1')) {
      return 'openapi-3.1';
    }
    throw new Error(
      `Unsupported OpenAPI version: "${doc['openapi']}". ` +
      'Supported versions: OpenAPI 3.0.x, 3.1.x.',
    );
  }

  throw new Error(
    'Cannot detect spec version: missing "swagger" or "openapi" field. ' +
    'Make sure the document is a valid Swagger 2.0 or OpenAPI 3.x specification.',
  );
}
