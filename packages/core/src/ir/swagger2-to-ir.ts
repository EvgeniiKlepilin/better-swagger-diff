import type { OpenAPIV2 } from 'openapi-types';
import type {
  IRSpec,
  IRPathItem,
  IROperation,
  IRParameter,
  IRRequestBody,
  IRResponse,
  IRMediaType,
  IRHeader,
  IRSecurityScheme,
  IROAuthFlows,
  IRServer,
  IRTag,
  NormalizeOptions,
} from './types.js';
import { normalizeSchema } from './normalize-schema.js';

type ParameterLocation = 'query' | 'path' | 'header' | 'cookie';
type InBodyParameter = OpenAPIV2.Parameter & { in: 'body'; schema: Record<string, unknown> };

function pickExtensions(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const exts: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (k.startsWith('x-')) exts[k] = obj[k];
  }
  return Object.keys(exts).length ? exts : undefined;
}

/** Translate Swagger 2.0 `collectionFormat` to an OAS 3.x-style `style`. */
function collectionFormatToStyle(cf?: string): string | undefined {
  switch (cf) {
    case 'csv':
      return 'form'; // closest OAS 3 analogue for query; "simple" for path/header
    case 'ssv':
      return 'spaceDelimited';
    case 'pipes':
      return 'pipeDelimited';
    case 'multi':
      return 'form';
    default:
      return undefined;
  }
}

function normalizeParameter(
  raw: OpenAPIV2.Parameter,
  producesGlobal: string[],
  opts: NormalizeOptions,
): IRParameter {
  const p = raw as unknown as Record<string, unknown>;

  // Body parameters become request bodies; they shouldn't appear as parameters.
  // We handle them separately in normalizeOperation, but the type still goes through
  // here occasionally when building path-level parameters. Guard defensively.
  const schema =
    raw.in === 'body'
      ? normalizeSchema((raw as InBodyParameter).schema, opts)
      : raw.in !== 'body'
        ? normalizeSchema(
            {
              type: (raw as OpenAPIV2.GeneralParameterObject).type,
              format: (raw as OpenAPIV2.GeneralParameterObject).format,
              enum: (raw as OpenAPIV2.GeneralParameterObject).enum as unknown[],
              items: (raw as OpenAPIV2.GeneralParameterObject).items as unknown as Record<string, unknown>,
              default: (raw as OpenAPIV2.GeneralParameterObject).default,
              minimum: (raw as OpenAPIV2.GeneralParameterObject).minimum,
              maximum: (raw as OpenAPIV2.GeneralParameterObject).maximum,
              minLength: (raw as OpenAPIV2.GeneralParameterObject).minLength,
              maxLength: (raw as OpenAPIV2.GeneralParameterObject).maxLength,
              pattern: (raw as OpenAPIV2.GeneralParameterObject).pattern,
              minItems: (raw as OpenAPIV2.GeneralParameterObject).minItems,
              maxItems: (raw as OpenAPIV2.GeneralParameterObject).maxItems,
              uniqueItems: (raw as OpenAPIV2.GeneralParameterObject).uniqueItems,
            },
            opts,
          )
        : undefined;

  const style = collectionFormatToStyle(
    (raw as OpenAPIV2.GeneralParameterObject).collectionFormat,
  );

  return {
    name: raw.name,
    in: raw.in === 'body' ? 'query' : (raw.in as ParameterLocation),
    required: raw.required ?? false,
    ...(raw.description !== undefined && { description: raw.description }),
    ...(schema && Object.keys(schema).length ? { schema } : {}),
    ...(style ? { style } : {}),
    ...(pickExtensions(p) ? { extensions: pickExtensions(p) } : {}),
  };
}

function buildRequestBody(
  bodyParam: InBodyParameter,
  producesGlobal: string[],
  producesOp: string[] | undefined,
  opts: NormalizeOptions,
): IRRequestBody {
  const produces = producesOp ?? producesGlobal;
  const mimes = produces.length ? produces : ['application/json'];
  const schema = normalizeSchema(bodyParam.schema, opts);
  const content: Record<string, IRMediaType> = {};
  for (const mime of mimes) {
    content[mime] = { schema };
  }
  return {
    required: bodyParam.required ?? false,
    ...(bodyParam.description !== undefined && { description: bodyParam.description }),
    content,
  };
}

function normalizeResponse(
  raw: OpenAPIV2.Response,
  producesGlobal: string[],
  producesOp: string[] | undefined,
  opts: NormalizeOptions,
): IRResponse {
  const r = raw as unknown as Record<string, unknown>;
  const produces = producesOp ?? producesGlobal;
  const mimes = produces.length ? produces : ['application/json'];
  const content: Record<string, IRMediaType> = {};

  const responseSchema = (raw as OpenAPIV2.Response & { schema?: Record<string, unknown> }).schema;
  if (responseSchema) {
    const schema = normalizeSchema(responseSchema, opts);
    for (const mime of mimes) {
      content[mime] = { schema };
    }
  }

  const headers: Record<string, IRHeader> = {};
  if ((raw as { headers?: Record<string, unknown> }).headers) {
    for (const [name, hRaw] of Object.entries(
      (raw as { headers: Record<string, unknown> }).headers,
    )) {
      const h = hRaw as Record<string, unknown>;
      headers[name] = {
        ...(h['description'] !== undefined && { description: h['description'] as string }),
        schema: normalizeSchema(h as Record<string, unknown>, opts),
        ...(pickExtensions(h) ? { extensions: pickExtensions(h) } : {}),
      };
    }
  }

  return {
    description: (raw as { description: string }).description ?? '',
    content,
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(pickExtensions(r) ? { extensions: pickExtensions(r) } : {}),
  };
}

function normalizeOperation(
  raw: OpenAPIV2.OperationObject,
  pathParams: OpenAPIV2.Parameter[],
  producesGlobal: string[],
  consumesGlobal: string[],
  opts: NormalizeOptions,
): IROperation {
  const op = raw as unknown as Record<string, unknown>;
  const rawParams = (raw.parameters ?? []) as OpenAPIV2.Parameter[];

  // Separate body param from everything else
  const bodyParam = rawParams.find((p) => p.in === 'body') as
    | InBodyParameter
    | undefined;
  const nonBodyParams = rawParams.filter((p) => p.in !== 'body');

  // Path-level params are overridden by op-level params with the same name+in
  const mergedParams = mergeParameters(pathParams.filter((p) => p.in !== 'body'), nonBodyParams);
  const parameters = mergedParams.map((p) => normalizeParameter(p, producesGlobal, opts));

  const requestBody = bodyParam
    ? buildRequestBody(bodyParam, consumesGlobal, raw.consumes, opts)
    : undefined;

  const responses: Record<string, IRResponse> = {};
  for (const [code, resp] of Object.entries(raw.responses ?? {})) {
    responses[code] = normalizeResponse(resp as OpenAPIV2.Response, producesGlobal, raw.produces, opts);
  }

  return {
    ...(raw.operationId !== undefined && { operationId: raw.operationId }),
    ...(raw.summary !== undefined && { summary: raw.summary }),
    ...(raw.description !== undefined && { description: raw.description }),
    ...(raw.deprecated !== undefined && { deprecated: raw.deprecated }),
    ...(raw.tags?.length && { tags: raw.tags }),
    parameters,
    ...(requestBody !== undefined && { requestBody }),
    responses,
    ...(raw.security !== undefined && {
      security: raw.security as Record<string, string[]>[],
    }),
    ...(pickExtensions(op) ? { extensions: pickExtensions(op) } : {}),
  };
}

/** Override path-level params with op-level params that share name+in. */
function mergeParameters(
  pathLevel: OpenAPIV2.Parameter[],
  opLevel: OpenAPIV2.Parameter[],
): OpenAPIV2.Parameter[] {
  const key = (p: OpenAPIV2.Parameter) => `${p.in}::${p.name}`;
  const opKeys = new Set(opLevel.map(key));
  return [...pathLevel.filter((p) => !opKeys.has(key(p))), ...opLevel];
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'] as const;

function normalizePathItem(
  path: string,
  raw: OpenAPIV2.PathItemObject,
  producesGlobal: string[],
  consumesGlobal: string[],
  opts: NormalizeOptions,
): IRPathItem {
  const pi = raw as unknown as Record<string, unknown>;
  const rawPathParams = (raw.parameters ?? []) as OpenAPIV2.Parameter[];

  const parameters = rawPathParams
    .filter((p) => p.in !== 'body')
    .map((p) => normalizeParameter(p, producesGlobal, opts));

  const operations: IRPathItem['operations'] = {};
  for (const method of HTTP_METHODS) {
    const opRaw = raw[method] as OpenAPIV2.OperationObject | undefined;
    if (opRaw) {
      operations[method] = normalizeOperation(opRaw, rawPathParams, producesGlobal, consumesGlobal, opts);
    }
  }

  return {
    parameters,
    operations,
    ...(pickExtensions(pi) ? { extensions: pickExtensions(pi) } : {}),
  };
}

function normalizeSecurityScheme(
  raw: OpenAPIV2.SecuritySchemeObject,
): IRSecurityScheme {
  const s = raw as unknown as Record<string, unknown>;
  const base = {
    ...(s['description'] !== undefined && { description: s['description'] as string }),
    ...(pickExtensions(s) ? { extensions: pickExtensions(s) } : {}),
  };

  switch (raw.type) {
    case 'apiKey':
      return {
        type: 'apiKey',
        name: raw.name,
        in: raw.in as 'query' | 'header',
        ...base,
      };
    case 'basic':
      return { type: 'http', scheme: 'basic', ...base };
    case 'oauth2': {
      const flows: IROAuthFlows = {};
      const flow = (raw as OpenAPIV2.SecuritySchemeOauth2).flow;
      const scopes = (raw as OpenAPIV2.SecuritySchemeOauth2).scopes as Record<string, string>;
      const authUrl = (raw as { authorizationUrl?: string }).authorizationUrl;
      const tokenUrl = (raw as { tokenUrl?: string }).tokenUrl;
      if (flow === 'implicit') {
        flows.implicit = { authorizationUrl: authUrl ?? '', scopes };
      } else if (flow === 'password') {
        flows.password = { tokenUrl: tokenUrl ?? '', scopes };
      } else if (flow === 'application') {
        flows.clientCredentials = { tokenUrl: tokenUrl ?? '', scopes };
      } else if (flow === 'accessCode') {
        flows.authorizationCode = {
          authorizationUrl: authUrl ?? '',
          tokenUrl: tokenUrl ?? '',
          scopes,
        };
      }
      return { type: 'oauth2', flows, ...base };
    }
    default:
      return { type: 'apiKey', ...base };
  }
}

/** Normalise a Swagger 2.0 document into an IRSpec. */
export function swagger2ToIR(doc: OpenAPIV2.Document, opts: NormalizeOptions = {}): IRSpec {
  const d = doc as unknown as Record<string, unknown>;

  // Servers: reconstruct from host + basePath + schemes
  const host = (doc.host ?? 'localhost') as string;
  const basePath = (doc.basePath ?? '/') as string;
  const schemes = ((doc as { schemes?: string[] }).schemes ?? ['https']) as string[];
  const servers: IRServer[] = schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath === '/' ? '' : basePath}`,
  }));

  // Paths
  const paths: Record<string, IRPathItem> = {};
  const producesGlobal = ((doc as { produces?: string[] }).produces ?? []) as string[];
  const consumesGlobal = ((doc as { consumes?: string[] }).consumes ?? []) as string[];
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    paths[path] = normalizePathItem(
      path,
      pathItem as OpenAPIV2.PathItemObject,
      producesGlobal,
      consumesGlobal,
      opts,
    );
  }

  // Security schemes
  const securitySchemes: Record<string, IRSecurityScheme> = {};
  for (const [name, scheme] of Object.entries(
    (doc as { securityDefinitions?: Record<string, OpenAPIV2.SecuritySchemeObject> })
      .securityDefinitions ?? {},
  )) {
    securitySchemes[name] = normalizeSecurityScheme(scheme);
  }

  // Tags
  const tags = ((doc as { tags?: Array<{ name: string; description?: string } & Record<string, unknown>> }).tags ?? []).map(
    (t) => ({
      name: t.name,
      ...(t.description !== undefined && { description: t.description }),
      ...(pickExtensions(t) ? { extensions: pickExtensions(t) } : {}),
    }),
  );

  const info = doc.info as unknown as Record<string, unknown>;

  return {
    sourceVersion: 'swagger-2.0',
    info: {
      title: doc.info.title,
      version: doc.info.version,
      ...(doc.info.description !== undefined && { description: doc.info.description }),
      ...(doc.info.termsOfService !== undefined && { termsOfService: doc.info.termsOfService }),
      ...(doc.info.contact !== undefined && {
        contact: doc.info.contact as { name?: string; url?: string; email?: string },
      }),
      ...(doc.info.license !== undefined && {
        license: doc.info.license as { name: string; url?: string },
      }),
      ...(pickExtensions(info) ? { extensions: pickExtensions(info) } : {}),
    },
    servers,
    paths,
    securitySchemes,
    ...(doc.security !== undefined && {
      security: doc.security as Record<string, string[]>[],
    }),
    tags,
    ...(pickExtensions(d) ? { extensions: pickExtensions(d) } : {}),
  };
}
