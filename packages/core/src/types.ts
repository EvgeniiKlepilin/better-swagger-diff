import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/** Canonical spec version tag used throughout the engine. */
export type SpecVersion = 'swagger-2.0' | 'openapi-3.0' | 'openapi-3.1';

/**
 * Metadata attached to every loaded spec alongside the document itself.
 */
export interface SpecMeta {
  /**
   * Human-readable description of where the spec came from:
   * an absolute file path, a URL string, or the literal `"raw"` for inline content.
   */
  source: string;
  /**
   * Whether all `$ref` pointers in this document have been resolved.
   * When `false`, the document retains its original `$ref` strings.
   */
  dereferenced: boolean;
}

/** A Swagger 2.0 spec that has been loaded and optionally dereferenced. */
export type Swagger2Spec = {
  version: 'swagger-2.0';
  document: OpenAPIV2.Document;
} & SpecMeta;

/** An OpenAPI 3.0.x spec that has been loaded and optionally dereferenced. */
export type OAS30Spec = {
  version: 'openapi-3.0';
  document: OpenAPIV3.Document;
} & SpecMeta;

/** An OpenAPI 3.1.x spec that has been loaded and optionally dereferenced. */
export type OAS31Spec = {
  version: 'openapi-3.1';
  document: OpenAPIV3_1.Document;
} & SpecMeta;

/** Union of all supported parsed spec shapes. */
export type ParsedSpec = Swagger2Spec | OAS30Spec | OAS31Spec;

/**
 * Options accepted by all loader functions.
 */
export interface LoadOptions {
  /**
   * HTTP request timeout in milliseconds for remote spec fetching.
   * Also applies to each request made during `$ref` resolution.
   * @default 30000
   */
  timeout?: number;

  /**
   * Additional HTTP request headers sent when fetching a remote spec.
   * Useful for passing `Authorization: Bearer <token>` to protected APIs.
   *
   * Note: these headers apply to the initial spec fetch only. For multi-file
   * specs with remote `$ref`s, the referenced files are fetched without custom
   * headers. Download multi-file specs locally if auth is required throughout.
   */
  headers?: Record<string, string>;

  /**
   * Fully resolve all `$ref` pointers in the returned document.
   * Circular references are preserved as-is rather than infinitely expanded.
   * Set to `false` to keep `$ref` strings intact (faster; lower memory).
   * @default true
   */
  dereference?: boolean;

  /**
   * Enable in-memory caching of remote spec responses.
   * Responses with an `ETag` or `Last-Modified` header will be revalidated
   * via conditional requests when the TTL expires.
   * @default true
   */
  cache?: boolean;

  /**
   * Time-to-live for cached remote specs in milliseconds.
   * After this period, the cache entry is considered stale and a conditional
   * HTTP request is issued to revalidate it.
   * @default 300000 (5 minutes)
   */
  cacheTtl?: number;
}
