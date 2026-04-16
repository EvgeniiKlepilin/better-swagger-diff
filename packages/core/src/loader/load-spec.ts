import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';
import type { ParsedSpec, LoadOptions } from '../types.js';
import { parseYamlOrJson } from './parse-content.js';
import { detectVersion } from './detect-version.js';
import { fetchRemote } from './fetch-remote.js';
import { buildParsedSpec } from './build-parsed-spec.js';

/**
 * Load an OpenAPI or Swagger spec from a **file path** or **URL**.
 *
 * Source type is auto-detected:
 * - Strings starting with `http://` or `https://` → remote fetch
 * - `URL` objects → remote fetch
 * - Strings starting with `/`, `./`, `../`, or a Windows drive letter → file path
 *
 * For raw JSON/YAML string content, use {@link loadSpecFromString} instead.
 *
 * **Auth headers and remote `$ref` resolution:** When `headers` are supplied and
 * `dereference: true`, the root document is fetched with your custom headers via
 * the caching layer.  External `$ref`s that point to *other* authenticated URLs
 * are resolved by passing the pre-parsed root document to swagger-parser, which
 * resolves remaining refs relative to the original URL.  If those referenced URLs
 * also require auth headers, resolution will fail — split such specs into a single
 * fully-dereferenced document first, or use {@link loadSpecFromString} with a
 * pre-fetched payload.
 *
 * @param source  Absolute/relative file path, HTTP/S URL string, or `URL` object.
 * @param options  {@link LoadOptions}
 */
export async function loadSpec(
  source: string | URL,
  options: LoadOptions = {},
): Promise<ParsedSpec> {
  const sourceStr = source instanceof URL ? source.toString() : source;

  if (source instanceof URL || isHttpUrl(sourceStr)) {
    return loadFromUrl(sourceStr, options);
  }

  if (isFilePath(sourceStr)) {
    return loadFromFile(sourceStr, options);
  }

  // Fallback: treat as raw content (e.g. user passed a YAML string).
  return loadSpecFromString(sourceStr, options);
}

/**
 * Load a spec from a raw JSON or YAML **string**.
 *
 * External `$ref`s will be resolved relative to `process.cwd()` when
 * `dereference: true`. For multi-file specs with relative external refs,
 * save the content to a file and use {@link loadSpec} with the file path instead.
 *
 * @param content  Raw JSON or YAML string.
 * @param options  {@link LoadOptions}
 */
export async function loadSpecFromString(
  content: string,
  options: LoadOptions = {},
): Promise<ParsedSpec> {
  const { dereference = true } = options;

  const raw = parseYamlOrJson(content);
  const version = detectVersion(raw);

  let document: unknown;
  if (dereference) {
    try {
      document = await SwaggerParser.dereference(raw as OpenAPI.Document);
    } catch (err) {
      throw new Error(
        `Failed to resolve $refs in spec: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  } else {
    document = raw;
  }

  return buildParsedSpec(version, document, 'raw', dereference);
}

// ---------------------------------------------------------------------------
// Internal loaders
// ---------------------------------------------------------------------------

async function loadFromFile(
  filePath: string,
  options: LoadOptions,
): Promise<ParsedSpec> {
  const { dereference = true } = options;
  const absPath = resolve(filePath);

  // Read the file to detect the version without relying on swagger-parser's
  // internal parsing (allows us to surface cleaner errors).
  const content = await readFile(absPath, 'utf-8').catch((err: unknown) => {
    throw new Error(
      `Cannot read spec file "${absPath}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  });

  const raw = parseYamlOrJson(content);
  const version = detectVersion(raw);

  let document: unknown;
  if (dereference) {
    try {
      // Pass the absolute path so swagger-parser can resolve relative external $refs
      // relative to the file's directory.
      document = await SwaggerParser.dereference(absPath);
    } catch (err) {
      throw new Error(
        `Failed to resolve $refs in "${absPath}": ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  } else {
    document = raw;
  }

  return buildParsedSpec(version, document, absPath, dereference);
}

async function loadFromUrl(
  url: string,
  options: LoadOptions,
): Promise<ParsedSpec> {
  const { dereference = true } = options;

  // Fetch via our caching layer so that custom auth headers, timeout, and
  // ETag-based caching are all applied to the root document.
  const content = await fetchRemote(url, options);
  const raw = parseYamlOrJson(content);
  const version = detectVersion(raw);

  let document: unknown;
  if (dereference) {
    try {
      // Pass the pre-parsed object (not the URL string) so swagger-parser
      // uses the document we already fetched with auth headers rather than
      // issuing a second unauthenticated request for the root.  The `url` is
      // provided as the `baseUrl` argument so that relative $refs within the
      // document are resolved against the original remote URL.
      //
      // TODO: external $refs that point to other auth-protected URLs will still
      // fail because swagger-parser's http resolver does not receive our custom
      // headers.  For such specs, pre-dereference using a tool that supports
      // auth and then call loadSpecFromString() on the result.
      document = await SwaggerParser.dereference(url, raw as OpenAPI.Document, {});
    } catch (err) {
      throw new Error(
        `Failed to resolve $refs from "${url}": ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  } else {
    document = raw;
  }

  return buildParsedSpec(version, document, url, dereference);
}

// ---------------------------------------------------------------------------
// Source type detection helpers
// ---------------------------------------------------------------------------

function isHttpUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

function isFilePath(source: string): boolean {
  return (
    source.startsWith('/') ||
    source.startsWith('./') ||
    source.startsWith('../') ||
    // Windows absolute paths: C:\... or C:/...
    /^[a-zA-Z]:[/\\]/.test(source) ||
    // Bare relative paths without explicit ./ prefix (e.g. "packages/foo/bar.yaml").
    // Excludes raw YAML/JSON content strings (which contain newlines or are pure JSON objects).
    (!source.includes('\n') && (source.includes('/') || /\.(ya?ml|json)$/i.test(source)))
  );
}
