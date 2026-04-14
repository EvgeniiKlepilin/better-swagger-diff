export { diff } from './differ.js';
export { diffSchemas, diffSchemaRecord } from './diff-schema.js';
export { diffParameters, diffRequestBody, diffMediaTypes, diffExtensionMap } from './diff-params.js';
export { diffResponses } from './diff-responses.js';
export { diffOperation } from './diff-operations.js';
export { diffPathMaps } from './diff-paths.js';
export { diffTags, diffServers, diffSecuritySchemes, diffGlobalSecurity, diffSpecExtensions } from './diff-misc.js';
export { deepEqual, appendPointer, escapePointerSegment } from './utils.js';

export type {
  DiffChangeType,
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
} from './types.js';
