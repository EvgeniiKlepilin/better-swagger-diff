// Public API for @better-swagger-diff/core
// Story 1.1 — Spec Loading & Parsing
// Story 1.2 — Internal Representation & Normalizer

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
