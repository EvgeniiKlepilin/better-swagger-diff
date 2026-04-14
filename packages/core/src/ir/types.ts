/**
 * Version-agnostic Internal Representation (IR) for OpenAPI/Swagger specs.
 *
 * Both Swagger 2.0 and OpenAPI 3.x are normalised into this shape before
 * diffing, so the differ never has to know which source format it came from.
 */

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** A JSON Pointer string, e.g. "/paths/~1pets/get/parameters/0" */
export type JsonPointer = string;

/** HTTP methods we track in operations. */
export type HttpMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace';

/** Where a parameter lives. */
export type ParameterLocation = 'query' | 'path' | 'header' | 'cookie';

// ---------------------------------------------------------------------------
// IR Schema
// ---------------------------------------------------------------------------

/**
 * Version-agnostic representation of a JSON Schema–like object.
 *
 * We keep only the fields that matter for diffing. Vendor extensions and
 * unknown fields are stashed in `extensions` to avoid silent data loss.
 *
 * OAS 3.1 fields (JSON Schema draft 2020-12) are optional and only populated
 * when the source spec declares `openapi: "3.1.x"`.
 */
export interface IRSchema {
  // Core type system
  type?: string | string[]; // string[] for OAS 3.1 type unions (e.g. ["string","null"])
  format?: string;
  nullable?: boolean; // OAS 3.0 only; OAS 3.1 uses type:["T","null"]
  enum?: unknown[];
  const?: unknown; // OAS 3.1 / JSON Schema 2020-12

  // Object keywords
  properties?: Record<string, IRSchema>;
  additionalProperties?: boolean | IRSchema;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  unevaluatedProperties?: boolean | IRSchema; // OAS 3.1

  // Array keywords
  items?: IRSchema | IRSchema[]; // IRSchema[] only in OAS 3.1 (tuple validation)
  prefixItems?: IRSchema[]; // OAS 3.1
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // String keywords
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  contentMediaType?: string; // OAS 3.1

  // Numeric keywords
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean; // boolean in OAS 3.0, number in OAS 3.1
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Composition
  allOf?: IRSchema[];
  oneOf?: IRSchema[];
  anyOf?: IRSchema[];
  not?: IRSchema;
  $dynamicRef?: string; // OAS 3.1
  $ref?: string; // kept when dereference:false

  // Metadata
  title?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown[]; // OAS 3.1 (JSON Schema 2020-12)
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  $schema?: string; // OAS 3.1

  /** Any `x-*` extension fields on this schema. */
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Parameter
// ---------------------------------------------------------------------------

export interface IRParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  description?: string;
  deprecated?: boolean;
  schema?: IRSchema;
  /** Serialisation style (OAS 3.x). Swagger 2 `collectionFormat` is translated. */
  style?: string;
  explode?: boolean;
  allowEmptyValue?: boolean;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Request Body
// ---------------------------------------------------------------------------

export interface IRMediaType {
  schema?: IRSchema;
  /** Any additional media-type fields we don't model individually. */
  extensions?: Record<string, unknown>;
}

export interface IRRequestBody {
  required: boolean;
  description?: string;
  /** Keyed by MIME type, e.g. "application/json". */
  content: Record<string, IRMediaType>;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Response
// ---------------------------------------------------------------------------

export interface IRResponse {
  description: string;
  /** Keyed by MIME type. Empty for responses with no body. */
  content: Record<string, IRMediaType>;
  headers?: Record<string, IRHeader>;
  extensions?: Record<string, unknown>;
}

export interface IRHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: IRSchema;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Operation
// ---------------------------------------------------------------------------

export interface IROperation {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters: IRParameter[];
  requestBody?: IRRequestBody;
  /** Keyed by HTTP status code string, e.g. "200", "default". */
  responses: Record<string, IRResponse>;
  security?: IRSecurityRequirement[];
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Path Item
// ---------------------------------------------------------------------------

export interface IRPathItem {
  /** Parameters declared at path level (inherited by all operations). */
  parameters: IRParameter[];
  operations: Partial<Record<HttpMethod, IROperation>>;
  summary?: string;
  description?: string;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Security Scheme
// ---------------------------------------------------------------------------

export type IRSecuritySchemeType =
  | 'apiKey'
  | 'http'
  | 'oauth2'
  | 'openIdConnect'
  | 'mutualTLS'; // OAS 3.1 (openapi-types does not model this natively)

export interface IRSecurityScheme {
  type: IRSecuritySchemeType;
  description?: string;
  /** apiKey */
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  /** http */
  scheme?: string;
  bearerFormat?: string;
  /** oauth2 */
  flows?: IROAuthFlows;
  /** openIdConnect */
  openIdConnectUrl?: string;
  extensions?: Record<string, unknown>;
}

export interface IROAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface IROAuthFlows {
  implicit?: IROAuthFlow;
  password?: IROAuthFlow;
  clientCredentials?: IROAuthFlow;
  authorizationCode?: IROAuthFlow;
}

/** Maps security scheme names to required scopes. */
export type IRSecurityRequirement = Record<string, string[]>;

// ---------------------------------------------------------------------------
// IR Tag
// ---------------------------------------------------------------------------

export interface IRTag {
  name: string;
  description?: string;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IR Server
// ---------------------------------------------------------------------------

export interface IRServer {
  url: string;
  description?: string;
  /** OAS 3.x server variables. */
  variables?: Record<string, IRServerVariable>;
}

export interface IRServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// IRSpec — top-level
// ---------------------------------------------------------------------------

export interface IRSpec {
  /** Source version of the original document, preserved for diagnostics. */
  sourceVersion: 'swagger-2.0' | 'openapi-3.0' | 'openapi-3.1';

  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string; identifier?: string };
    extensions?: Record<string, unknown>;
  };

  /** HTTP(S) base servers derived from `servers[]` (OAS 3.x) or `host`+`basePath`+`schemes` (Swagger 2.0). */
  servers: IRServer[];

  /** Normalised paths. Keys are OpenAPI path templates, e.g. "/pets/{petId}". */
  paths: Record<string, IRPathItem>;

  /**
   * OAS 3.1 webhooks.
   * Absent (undefined) for Swagger 2.0 and OAS 3.0 documents.
   */
  webhooks?: Record<string, IRPathItem>;

  /** Named security schemes from `securityDefinitions` / `components.securitySchemes`. */
  securitySchemes: Record<string, IRSecurityScheme>;

  /** Global security requirements. */
  security?: IRSecurityRequirement[];

  tags: IRTag[];

  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Normalizer options
// ---------------------------------------------------------------------------

export interface NormalizeOptions {
  /**
   * When `true`, `allOf` / `oneOf` / `anyOf` arrays are recursively merged
   * into a single flat `IRSchema` for easier field-level comparison.
   * The raw composition keywords are still present on the returned schema
   * under `allOf` / `oneOf` / `anyOf` so callers can distinguish.
   *
   * When `false` (default), schemas are returned as-is.
   */
  flattenComposition?: boolean;
}
