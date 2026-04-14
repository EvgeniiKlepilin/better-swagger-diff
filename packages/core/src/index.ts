// Public API for @better-swagger-diff/core
// Story 1.1 — Spec Loading & Parsing

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
