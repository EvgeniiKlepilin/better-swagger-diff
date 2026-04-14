/**
 * @file diff/types.ts
 *
 * Public type definitions for the structured diff result produced by the
 * `diff()` function.  These types form the stable, serializable API surface
 * of the core package — everything downstream (CLI, web app, REST API)
 * consumes this shape.
 *
 * Design constraints:
 *  - Every value must be JSON-serializable (`JSON.stringify` ↔ `JSON.parse`
 *    round-trip must be lossless).
 *  - No `Map`, `Set`, `Date`, `undefined` *values* (optional fields may be
 *    absent, which serializes as absent rather than `null`).
 *  - Generics are used only in TypeScript consumers; the JSON Schema
 *    (`diff-result.schema.ts`) uses concrete subtypes.
 */

import type {
  HttpMethod,
  IRHeader,
  IRMediaType,
  IROperation,
  IRParameter,
  IRPathItem,
  IRRequestBody,
  IRResponse,
  IRSchema,
  IRSecurityRequirement,
  IRSecurityScheme,
  IRServer,
  IRTag,
  JsonPointer,
  ParameterLocation,
} from '../ir/types.js';

// Re-export IR types that appear in DiffItem generics so consumers only need
// to import from this module.
export type {
  IRHeader,
  IRMediaType,
  IROperation,
  IRParameter,
  IRPathItem,
  IRRequestBody,
  IRResponse,
  IRSchema,
  IRSecurityRequirement,
  IRSecurityScheme,
  IRServer,
  IRTag,
};

// ---------------------------------------------------------------------------
// Change classification
// ---------------------------------------------------------------------------

/**
 * The direction of a single change:
 * - `"added"` — the item exists only in the **head** spec.
 * - `"removed"` — the item exists only in the **base** spec.
 * - `"modified"` — the item exists in both specs but differs in at least one
 *    field.
 */
export type DiffChangeType = 'added' | 'removed' | 'modified';

// ---------------------------------------------------------------------------
// Source location
// ---------------------------------------------------------------------------

/**
 * Optional position within the *source document* (before `$ref` resolution).
 *
 * Populated when the parser exposes token positions (e.g. JSON with location
 * metadata, or YAML parsed with `keepCstNodes`).  May be absent when loading
 * from a pre-parsed object or when the parser does not surface positions.
 */
export interface SourceLocation {
  /** 1-based line number in the source document. */
  line: number;
  /** 1-based column number in the source document. */
  column: number;
  /**
   * Absolute file path or URL of the source file that contains this token.
   * Useful for multi-file specs where a value originates in a referenced
   * component file rather than the root document.
   */
  source?: string;
}

// ---------------------------------------------------------------------------
// Generic diff item — the atomic unit of change
// ---------------------------------------------------------------------------

/**
 * A single, atomic change in the diff.
 *
 * @typeParam T - The TypeScript type of the changed value.  Concrete subtypes
 *   in this module pin `T` to specific IR types.
 *
 * Serialization: all fields are JSON-primitive or plain objects, so a
 * `DiffItem` is always `JSON.stringify`-safe.  Optional fields are simply
 * absent in the serialized form (never `null`).
 */
export interface DiffItem<T = unknown> {
  /**
   * Direction of the change.
   *
   * | value        | `before` | `after` |
   * |-------------|----------|---------|
   * | `"added"`   | absent   | present |
   * | `"removed"` | present  | absent  |
   * | `"modified"`| present  | present |
   */
  type: DiffChangeType;

  /**
   * [RFC 6901](https://datatracker.ietf.org/doc/html/rfc6901) JSON Pointer
   * that identifies the changed location within the **normalised IR**, e.g.
   * `"/paths/~1pets/get/parameters/0/required"`.
   *
   * Use `appendPointer` / `escapePointerSegment` from `diff/utils.ts` to
   * construct these values consistently.
   */
  path: JsonPointer;

  /**
   * Token position in the source document where this value was defined.
   *
   * `undefined` when the parser does not expose position metadata (common for
   * programmatically constructed specs or pre-resolved objects).
   */
  location?: SourceLocation;

  /**
   * The value as it appeared in the **base** (older) spec.
   * Absent when `type === "added"`.
   */
  before?: T;

  /**
   * The value as it appeared in the **head** (newer) spec.
   * Absent when `type === "removed"`.
   */
  after?: T;
}

// ---------------------------------------------------------------------------
// Parameter diff
// ---------------------------------------------------------------------------

/**
 * Records a change to a single named parameter on an operation or path item.
 *
 * When `type === "modified"`, the `changes` array enumerates which scalar
 * fields changed (e.g. `required`, `deprecated`, `schema.type`).
 */
export interface ParameterDiff {
  /** Parameter name as declared in the spec. */
  name: string;
  /** Parameter location: `"query"`, `"path"`, `"header"`, or `"cookie"`. */
  in: ParameterLocation;
  /** Whether this parameter was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this parameter in the normalised IR. */
  jsonPointer: JsonPointer;
  /** Full parameter value from the base spec. Absent when `type === "added"`. */
  before?: IRParameter;
  /** Full parameter value from the head spec. Absent when `type === "removed"`. */
  after?: IRParameter;
  /**
   * Field-level changes within a modified parameter.
   * Empty when `type !== "modified"`.
   */
  changes: DiffItem[];
}

// ---------------------------------------------------------------------------
// Media-type (content entry) diff
// ---------------------------------------------------------------------------

/**
 * Records a change to a single media-type entry within a request body or
 * response (e.g. `"application/json"`).
 */
export interface MediaTypeDiff {
  /** MIME type string, e.g. `"application/json"`. */
  mediaType: string;
  /** Whether this media-type was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this content entry in the normalised IR. */
  jsonPointer: JsonPointer;
  /** Media-type value from the base spec. Absent when `type === "added"`. */
  before?: IRMediaType;
  /** Media-type value from the head spec. Absent when `type === "removed"`. */
  after?: IRMediaType;
  /**
   * Schema-level changes within a modified media type.
   * Empty when `type !== "modified"`.
   */
  schemaChanges: DiffItem[];
}

// ---------------------------------------------------------------------------
// Request body diff
// ---------------------------------------------------------------------------

/**
 * Records changes within a single operation's request body.
 *
 * All fields are optional — only the sub-objects that actually changed are
 * present.  An entirely absent `requestBody` on an `OperationDiff` means no
 * request body changes were detected.
 */
export interface RequestBodyDiff {
  /**
   * Change to the `required` flag of the request body.
   * Present only when the flag changed.
   */
  required?: DiffItem<boolean>;
  /**
   * Change to the `description` field of the request body.
   * Present only when the description changed.
   */
  description?: DiffItem<string>;
  /**
   * Changes to individual media-type entries in `content`.
   * Empty array when no content entries changed.
   */
  content: MediaTypeDiff[];
  /**
   * Changes to `x-*` vendor extension fields on the request body.
   * Empty array when extensions did not change or extension diffing is
   * disabled via {@link DiffOptions.includeExtensions}.
   */
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Header diff
// ---------------------------------------------------------------------------

/**
 * Records a change to a single named response header.
 */
export interface HeaderDiff {
  /** Header name (case-insensitive by HTTP spec, stored as-declared). */
  name: string;
  /** Whether this header was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this header in the normalised IR. */
  jsonPointer: JsonPointer;
  /** Header value from the base spec. Absent when `type === "added"`. */
  before?: IRHeader;
  /** Header value from the head spec. Absent when `type === "removed"`. */
  after?: IRHeader;
  /**
   * Field-level changes within a modified header.
   * Empty when `type !== "modified"`.
   */
  changes: DiffItem[];
}

// ---------------------------------------------------------------------------
// Response diff
// ---------------------------------------------------------------------------

/**
 * Records changes to a single HTTP response (identified by status code).
 */
export interface ResponseDiff {
  /**
   * HTTP status code string, e.g. `"200"`, `"404"`, `"default"`.
   * The `"default"` sentinel follows the OpenAPI specification.
   */
  statusCode: string;
  /** Whether this response was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this response in the normalised IR. */
  jsonPointer: JsonPointer;
  /** Response value from the base spec. Absent when `type === "added"`. */
  before?: IRResponse;
  /** Response value from the head spec. Absent when `type === "removed"`. */
  after?: IRResponse;
  /**
   * Scalar field changes (e.g. `description`).
   * Empty when `type !== "modified"`.
   */
  changes: DiffItem[];
  /**
   * Changes to individual media-type entries in the response `content`.
   * Empty when `type !== "modified"`.
   */
  content: MediaTypeDiff[];
  /**
   * Changes to named headers on this response.
   * Empty when `type !== "modified"`.
   */
  headers: HeaderDiff[];
}

// ---------------------------------------------------------------------------
// Operation diff
// ---------------------------------------------------------------------------

/**
 * Records changes to a single HTTP operation (method + path combination).
 */
export interface OperationDiff {
  /**
   * Path template as declared in the spec, e.g. `"/pets/{petId}"`.
   * Matches the key in `IRSpec.paths`.
   */
  path: string;
  /** HTTP method in lowercase, e.g. `"get"`, `"post"`. */
  method: HttpMethod;
  /** Whether this operation was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this operation in the normalised IR. */
  jsonPointer: JsonPointer;
  /** Full operation value from the base spec. Absent when `type === "added"`. */
  before?: IROperation;
  /** Full operation value from the head spec. Absent when `type === "removed"`. */
  after?: IROperation;
  /**
   * Scalar field changes: `summary`, `description`, `deprecated`, `tags`,
   * `operationId`.  Empty when `type !== "modified"`.
   */
  changes: DiffItem[];
  /**
   * Parameter-level changes (query, path, header, cookie).
   * Empty when no parameters changed.
   */
  parameters: ParameterDiff[];
  /**
   * Request body changes.
   * `undefined` when the request body did not change.
   */
  requestBody?: RequestBodyDiff;
  /**
   * Response-level changes.
   * Empty when no responses changed.
   */
  responses: ResponseDiff[];
  /**
   * Change to operation-level security requirements.
   * `undefined` when security requirements did not change.
   */
  security?: DiffItem<IRSecurityRequirement[]>;
  /**
   * Changes to `x-*` vendor extension fields on this operation.
   * Empty array when extensions did not change or extension diffing is
   * disabled via {@link DiffOptions.includeExtensions}.
   */
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Path diff
// ---------------------------------------------------------------------------

/**
 * Records changes to a single path item (URL template).
 *
 * A path item is the container for one or more operations.  A `PathDiff` with
 * `type === "added"` means the entire path is new; `type === "removed"` means
 * the path was deleted; `type === "modified"` means at least one operation
 * within it changed.
 */
export interface PathDiff {
  /**
   * Path template, e.g. `"/pets"` or `"/pets/{petId}"`.
   * Matches the key in `IRSpec.paths` or `IRSpec.webhooks`.
   */
  path: string;
  /** Whether this path was added, removed, or modified. */
  type: DiffChangeType;
  /** JSON Pointer to this path item in the normalised IR, e.g. `"/paths/~1pets"`. */
  jsonPointer: JsonPointer;
  /** Path item value from the base spec. Absent when `type === "added"`. */
  before?: IRPathItem;
  /** Path item value from the head spec. Absent when `type === "removed"`. */
  after?: IRPathItem;
  /**
   * Operation-level changes within this path.
   * Populated even when `type === "added"` or `"removed"` to list every
   * operation that was implicitly gained or lost.
   */
  operations: OperationDiff[];
}

// ---------------------------------------------------------------------------
// Top-level DiffResult
// ---------------------------------------------------------------------------

/**
 * The complete, structured result of comparing two OpenAPI/Swagger specs.
 *
 * This is the primary output of `diff(base, head)`.  It is:
 *  - **Typed** — every field has a known TypeScript type.
 *  - **Serializable** — `JSON.stringify(result)` produces valid JSON that can
 *    be round-tripped with `JSON.parse` without loss.
 *  - **Documented** — a JSON Schema is exported from `diff/diff-result.schema.ts`
 *    for documentation generation and runtime validation.
 *
 * @example
 * ```ts
 * import { diff, swagger2ToIR, oas3ToIR } from '@better-swagger-diff/core';
 *
 * const result = diff(swagger2ToIR(base), oas3ToIR(head));
 * if (!result.isEmpty) {
 *   console.log(JSON.stringify(result, null, 2));
 * }
 * ```
 */
export interface DiffResult {
  /**
   * Convenience flag: `true` when no differences were detected across all
   * categories.  Equivalent to checking that every array is empty and every
   * optional field is absent.
   */
  isEmpty: boolean;

  /**
   * Path-level changes including all nested operation, parameter, and response
   * diffs.  Entries appear in the order paths are encountered while comparing
   * the two specs.
   */
  paths: PathDiff[];

  /**
   * Webhook changes (OAS 3.1 only).  Follows the same `PathDiff` structure as
   * `paths`.  Always an empty array for Swagger 2.0 and OAS 3.0 specs.
   */
  webhooks: PathDiff[];

  /**
   * Changes to named security schemes in
   * `securityDefinitions` (Swagger 2.0) / `components.securitySchemes` (OAS 3.x).
   */
  securitySchemes: DiffItem<IRSecurityScheme>[];

  /**
   * Change to the top-level `security` array (global security requirements).
   * `undefined` when the global security requirements did not change.
   */
  security?: DiffItem<IRSecurityRequirement[]>;

  /**
   * Changes to top-level tags.
   */
  tags: DiffItem<IRTag>[];

  /**
   * Changes to top-level server definitions (`servers[]` in OAS 3.x,
   * `host`/`basePath`/`schemes` in Swagger 2.0).
   */
  servers: DiffItem<IRServer>[];

  /**
   * Changes to `x-*` vendor extension fields at the spec root.
   * Empty array when extensions did not change or extension diffing is
   * disabled via {@link DiffOptions.includeExtensions}.
   */
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Diff options
// ---------------------------------------------------------------------------

/**
 * Options that control the behaviour of the `diff()` function.
 */
export interface DiffOptions {
  /**
   * When `true` (default), changes to `x-*` extension fields are included in
   * the result.  Set to `false` to suppress all vendor extension diffs across
   * every level of the result tree.
   */
  includeExtensions?: boolean;
}
