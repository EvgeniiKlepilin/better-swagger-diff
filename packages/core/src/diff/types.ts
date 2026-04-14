/**
 * Types for the structural diff result produced by Story 1.3.
 *
 * Story 1.4 will add full JSDoc, a JSON Schema for DiffResult, and
 * round-trip serialization guarantees.  These types are the working
 * definitions used by the differ itself.
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

// Suppress unused-import warnings for types that appear only in JSDoc or as
// generic arguments on DiffItem.
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
// Atomic change type
// ---------------------------------------------------------------------------

export type DiffChangeType = 'added' | 'removed' | 'modified';

// ---------------------------------------------------------------------------
// Generic diff item — the lowest-level unit of change
// ---------------------------------------------------------------------------

export interface DiffItem<T = unknown> {
  type: DiffChangeType;
  /** JSON Pointer (RFC 6901) pointing to the changed location. */
  path: JsonPointer;
  /** Value in the base spec.  Undefined when type === 'added'. */
  before?: T;
  /** Value in the head spec.  Undefined when type === 'removed'. */
  after?: T;
}

// ---------------------------------------------------------------------------
// Parameter diff
// ---------------------------------------------------------------------------

export interface ParameterDiff {
  name: string;
  in: ParameterLocation;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IRParameter;
  after?: IRParameter;
  /** Field-level changes.  Populated only for type === 'modified'. */
  changes: DiffItem[];
}

// ---------------------------------------------------------------------------
// Media-type (content entry) diff
// ---------------------------------------------------------------------------

export interface MediaTypeDiff {
  mediaType: string;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IRMediaType;
  after?: IRMediaType;
  /** Schema-level changes.  Populated only for type === 'modified'. */
  schemaChanges: DiffItem[];
}

// ---------------------------------------------------------------------------
// Request body diff
// ---------------------------------------------------------------------------

export interface RequestBodyDiff {
  required?: DiffItem<boolean>;
  description?: DiffItem<string>;
  content: MediaTypeDiff[];
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Header diff
// ---------------------------------------------------------------------------

export interface HeaderDiff {
  name: string;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IRHeader;
  after?: IRHeader;
  /** Field-level changes.  Populated only for type === 'modified'. */
  changes: DiffItem[];
}

// ---------------------------------------------------------------------------
// Response diff
// ---------------------------------------------------------------------------

export interface ResponseDiff {
  statusCode: string;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IRResponse;
  after?: IRResponse;
  /** Scalar field changes (description, etc.).  Populated only for 'modified'. */
  changes: DiffItem[];
  /** Media-type diffs.  Populated only for 'modified'. */
  content: MediaTypeDiff[];
  /** Header diffs.  Populated only for 'modified'. */
  headers: HeaderDiff[];
}

// ---------------------------------------------------------------------------
// Operation diff
// ---------------------------------------------------------------------------

export interface OperationDiff {
  path: string;
  method: HttpMethod;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IROperation;
  after?: IROperation;
  /** Scalar field changes (summary, description, deprecated, tags, etc.). */
  changes: DiffItem[];
  parameters: ParameterDiff[];
  requestBody?: RequestBodyDiff;
  responses: ResponseDiff[];
  /** Operation-level security requirement changes. */
  security?: DiffItem<IRSecurityRequirement[]>;
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Path diff
// ---------------------------------------------------------------------------

export interface PathDiff {
  path: string;
  type: DiffChangeType;
  jsonPointer: JsonPointer;
  before?: IRPathItem;
  after?: IRPathItem;
  operations: OperationDiff[];
}

// ---------------------------------------------------------------------------
// Top-level DiffResult
// ---------------------------------------------------------------------------

export interface DiffResult {
  /** True when no changes were detected between base and head. */
  isEmpty: boolean;

  /** Path-level changes (includes nested operation/parameter/response diffs). */
  paths: PathDiff[];

  /** Webhook changes (OAS 3.1 only). */
  webhooks: PathDiff[];

  /** Named security scheme changes. */
  securitySchemes: DiffItem<IRSecurityScheme>[];

  /** Global security requirement changes. */
  security?: DiffItem<IRSecurityRequirement[]>;

  /** Top-level tag changes. */
  tags: DiffItem<IRTag>[];

  /** Top-level server changes. */
  servers: DiffItem<IRServer>[];

  /** Spec-level vendor extension changes. */
  extensions: DiffItem[];
}

// ---------------------------------------------------------------------------
// Diff options
// ---------------------------------------------------------------------------

export interface DiffOptions {
  /**
   * When `true` (default), changes to `x-*` extension fields are included.
   * Set to `false` to suppress all extension diffs.
   */
  includeExtensions?: boolean;
}
