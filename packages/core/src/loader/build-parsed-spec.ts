import type {
  ParsedSpec,
  SpecVersion,
  Swagger2Spec,
  OAS30Spec,
  OAS31Spec,
} from '../types.js';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/**
 * Assemble a typed {@link ParsedSpec} from its components.
 * The overloads ensure the returned document type matches the version tag.
 */
export function buildParsedSpec(
  version: SpecVersion,
  document: unknown,
  source: string,
  dereferenced: boolean,
): ParsedSpec {
  const meta = { source, dereferenced };

  if (version === 'swagger-2.0') {
    return {
      version,
      document: document as OpenAPIV2.Document,
      ...meta,
    } satisfies Swagger2Spec;
  }

  if (version === 'openapi-3.0') {
    return {
      version,
      document: document as OpenAPIV3.Document,
      ...meta,
    } satisfies OAS30Spec;
  }

  return {
    version: 'openapi-3.1',
    document: document as OpenAPIV3_1.Document,
    ...meta,
  } satisfies OAS31Spec;
}
