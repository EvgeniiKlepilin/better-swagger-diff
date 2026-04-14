// Public API for @better-swagger-diff/core
// Story 1.1 — Spec Loading & Parsing
// Story 1.2 — Internal Representation & Normalizer
// Story 1.3 — Structural Differ
// Story 1.4 — Diff Result Schema

export { loadSpec, loadSpecFromString } from './loader/load-spec.js';
export { loadSpecFromGit } from './loader/load-from-git.js';
export { specCache, SpecCache } from './loader/cache.js';
export { detectVersion } from './loader/detect-version.js';
export { parseYamlOrJson } from './loader/parse-content.js';

export type {
  ParsedSpec,
  Swagger2Spec,
  OAS30Spec,
  OAS31Spec,
  SpecVersion,
  SpecMeta,
  LoadOptions,
} from './types.js';

// IR & Normalizers
export { swagger2ToIR } from './ir/swagger2-to-ir.js';
export { oas3ToIR } from './ir/oas3-to-ir.js';
export { normalizeSchema } from './ir/normalize-schema.js';
// Differ
export { diff } from './diff/differ.js';
export { diffSchemas, diffSchemaRecord } from './diff/diff-schema.js';
export { diffParameters, diffRequestBody, diffMediaTypes, diffExtensionMap } from './diff/diff-params.js';
export { diffResponses } from './diff/diff-responses.js';
export { diffOperation } from './diff/diff-operations.js';
export { diffPathMaps } from './diff/diff-paths.js';
export {
  diffTags,
  diffServers,
  diffSecuritySchemes,
  diffGlobalSecurity,
  diffSpecExtensions,
} from './diff/diff-misc.js';
export { deepEqual, appendPointer, escapePointerSegment } from './diff/utils.js';

export type {
  DiffChangeType,
  SourceLocation,
  DiffItem,
  DiffResult,
  DiffOptions,
  PathDiff,
  OperationDiff,
  ParameterDiff,
  RequestBodyDiff,
  MediaTypeDiff,
  ResponseDiff,
  HeaderDiff,
} from './diff/types.js';

// Diff Result JSON Schema (1.4.3)
export { DIFF_RESULT_SCHEMA } from './diff/diff-result.schema.js';
export type { DiffResultSchema } from './diff/diff-result.schema.js';

export type {
  IRSpec,
  IRPathItem,
  IROperation,
  IRParameter,
  ParameterLocation,
  IRRequestBody,
  IRResponse,
  IRMediaType,
  IRHeader,
  IRSchema,
  IRSecurityScheme,
  IRSecuritySchemeType,
  IROAuthFlows,
  IROAuthFlow,
  IRSecurityRequirement,
  IRServer,
  IRServerVariable,
  IRTag,
  HttpMethod,
  JsonPointer,
  NormalizeOptions,
} from './ir/types.js';
