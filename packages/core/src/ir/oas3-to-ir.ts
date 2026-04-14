import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
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
  IROAuthFlow,
  IRServer,
  IRTag,
  NormalizeOptions,
} from './types.js';
import { normalizeSchema } from './normalize-schema.js';

type OAS3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;
type OAS3Operation = OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
type OAS3Parameter = OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject;
type OAS3RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;
type OAS3Response = OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject;
type OAS3PathItem = OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject;
type OAS3SecurityScheme =
  | OpenAPIV3.SecuritySchemeObject
  | OpenAPIV3_1.SecuritySchemeObject;
type OAS3Header = OpenAPIV3.HeaderObject | OpenAPIV3_1.HeaderObject;
type OAS3Server = OpenAPIV3.ServerObject | OpenAPIV3_1.ServerObject;

function pickExtensions(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const exts: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (k.startsWith('x-')) exts[k] = obj[k];
  }
  return Object.keys(exts).length ? exts : undefined;
}

function normalizeServer(raw: OAS3Server): IRServer {
  const s: IRServer = { url: raw.url };
  if (raw.description !== undefined) s.description = raw.description;
  if (raw.variables) {
    s.variables = {};
    for (const [name, v] of Object.entries(raw.variables)) {
      s.variables[name] = {
        default: v.default,
        ...(v.enum?.length && { enum: v.enum }),
        ...(v.description !== undefined && { description: v.description }),
      };
    }
  }
  return s;
}

function normalizeParameter(raw: OAS3Parameter, opts: NormalizeOptions): IRParameter {
  const p = raw as unknown as Record<string, unknown>;
  const schema = raw.schema ? normalizeSchema(raw.schema as Record<string, unknown>, opts) : undefined;
  return {
    name: raw.name,
    in: raw.in as IRParameter['in'],
    required: raw.required ?? (raw.in === 'path' ? true : false),
    ...(raw.description !== undefined && { description: raw.description }),
    ...(raw.deprecated !== undefined && { deprecated: raw.deprecated }),
    ...(schema && Object.keys(schema).length ? { schema } : {}),
    ...(raw.style !== undefined && { style: raw.style }),
    ...((raw as { explode?: boolean }).explode !== undefined && {
      explode: (raw as { explode?: boolean }).explode,
    }),
    ...((raw as { allowEmptyValue?: boolean }).allowEmptyValue !== undefined && {
      allowEmptyValue: (raw as { allowEmptyValue?: boolean }).allowEmptyValue,
    }),
    ...(pickExtensions(p) ? { extensions: pickExtensions(p) } : {}),
  };
}

function normalizeMediaType(
  raw: OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject,
  opts: NormalizeOptions,
): IRMediaType {
  const m = raw as unknown as Record<string, unknown>;
  const mt: IRMediaType = {};
  if (raw.schema) mt.schema = normalizeSchema(raw.schema as Record<string, unknown>, opts);
  const exts = pickExtensions(m);
  if (exts) mt.extensions = exts;
  return mt;
}

function normalizeRequestBody(raw: OAS3RequestBody, opts: NormalizeOptions): IRRequestBody {
  const r = raw as unknown as Record<string, unknown>;
  const content: Record<string, IRMediaType> = {};
  for (const [mime, mt] of Object.entries(raw.content ?? {})) {
    content[mime] = normalizeMediaType(mt as OpenAPIV3.MediaTypeObject, opts);
  }
  return {
    required: raw.required ?? false,
    ...(raw.description !== undefined && { description: raw.description }),
    content,
    ...(pickExtensions(r) ? { extensions: pickExtensions(r) } : {}),
  };
}

function normalizeHeader(raw: OAS3Header, opts: NormalizeOptions): IRHeader {
  const h = raw as unknown as Record<string, unknown>;
  const schema = raw.schema
    ? normalizeSchema(raw.schema as Record<string, unknown>, opts)
    : undefined;
  return {
    ...(raw.description !== undefined && { description: raw.description }),
    ...((raw as { required?: boolean }).required !== undefined && {
      required: (raw as { required?: boolean }).required,
    }),
    ...(raw.deprecated !== undefined && { deprecated: raw.deprecated }),
    ...(schema && Object.keys(schema).length ? { schema } : {}),
    ...(pickExtensions(h) ? { extensions: pickExtensions(h) } : {}),
  };
}

function normalizeResponse(raw: OAS3Response, opts: NormalizeOptions): IRResponse {
  const r = raw as unknown as Record<string, unknown>;
  const content: Record<string, IRMediaType> = {};
  for (const [mime, mt] of Object.entries(raw.content ?? {})) {
    content[mime] = normalizeMediaType(mt as OpenAPIV3.MediaTypeObject, opts);
  }
  const headers: Record<string, IRHeader> = {};
  if (raw.headers) {
    for (const [name, hRaw] of Object.entries(raw.headers)) {
      if (hRaw && typeof hRaw === 'object' && !('$ref' in hRaw)) {
        headers[name] = normalizeHeader(hRaw as OAS3Header, opts);
      }
    }
  }
  return {
    description: raw.description,
    content,
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(pickExtensions(r) ? { extensions: pickExtensions(r) } : {}),
  };
}

/** Merge path-level params with op-level params; op-level wins on name+in collision. */
function mergeParameters(
  pathLevel: OAS3Parameter[],
  opLevel: OAS3Parameter[],
): OAS3Parameter[] {
  const key = (p: OAS3Parameter) => `${p.in}::${p.name}`;
  const opKeys = new Set(opLevel.map(key));
  return [...pathLevel.filter((p) => !opKeys.has(key(p))), ...opLevel];
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

function normalizeOperation(
  raw: OAS3Operation,
  pathParams: OAS3Parameter[],
  opts: NormalizeOptions,
): IROperation {
  const op = raw as unknown as Record<string, unknown>;
  const rawParams = (raw.parameters ?? []).filter(
    (p): p is OAS3Parameter => !('$ref' in p),
  );
  const merged = mergeParameters(pathParams, rawParams);
  const parameters = merged.map((p) => normalizeParameter(p, opts));

  const requestBody =
    raw.requestBody && !('$ref' in raw.requestBody)
      ? normalizeRequestBody(raw.requestBody as OAS3RequestBody, opts)
      : undefined;

  const responses: Record<string, IRResponse> = {};
  for (const [code, resp] of Object.entries(raw.responses ?? {})) {
    if (resp && !('$ref' in resp)) {
      responses[code] = normalizeResponse(resp as OAS3Response, opts);
    }
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

function normalizePathItem(raw: OAS3PathItem, opts: NormalizeOptions): IRPathItem {
  const pi = raw as unknown as Record<string, unknown>;
  const rawPathParams = (raw.parameters ?? []).filter(
    (p): p is OAS3Parameter => !('$ref' in p),
  );
  const parameters = rawPathParams.map((p) => normalizeParameter(p, opts));

  const operations: IRPathItem['operations'] = {};
  for (const method of HTTP_METHODS) {
    const opRaw = raw[method as keyof typeof raw] as OAS3Operation | undefined;
    if (opRaw) {
      operations[method] = normalizeOperation(opRaw, rawPathParams, opts);
    }
  }

  return {
    parameters,
    operations,
    ...(raw.summary !== undefined && { summary: raw.summary }),
    ...(raw.description !== undefined && { description: raw.description }),
    ...(pickExtensions(pi) ? { extensions: pickExtensions(pi) } : {}),
  };
}

function normalizeOAuthFlow(
  raw: {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
  },
): IROAuthFlow {
  return {
    ...(raw.authorizationUrl !== undefined && { authorizationUrl: raw.authorizationUrl }),
    ...(raw.tokenUrl !== undefined && { tokenUrl: raw.tokenUrl }),
    ...((raw as { refreshUrl?: string }).refreshUrl !== undefined && {
      refreshUrl: (raw as { refreshUrl?: string }).refreshUrl,
    }),
    scopes: (raw.scopes ?? {}) as Record<string, string>,
  };
}

function normalizeSecurityScheme(raw: OAS3SecurityScheme): IRSecurityScheme {
  const s = raw as unknown as Record<string, unknown>;
  // Use the raw string type so we can handle OAS 3.1 additions (e.g. mutualTLS)
  // that are not in the openapi-types union for this library version.
  const rawType = s['type'] as string;
  const base = {
    ...(s['description'] !== undefined && { description: s['description'] as string }),
    ...(pickExtensions(s) ? { extensions: pickExtensions(s) } : {}),
  };

  switch (rawType) {
    case 'apiKey': {
      const ak = raw as OpenAPIV3.ApiKeySecurityScheme;
      return {
        type: 'apiKey',
        name: ak.name,
        in: ak.in as 'query' | 'header' | 'cookie',
        ...base,
      };
    }
    case 'http': {
      const h = raw as OpenAPIV3.HttpSecurityScheme;
      return {
        type: 'http',
        scheme: h.scheme,
        ...(h.bearerFormat !== undefined && { bearerFormat: h.bearerFormat }),
        ...base,
      };
    }
    case 'oauth2': {
      const o = raw as OpenAPIV3.OAuth2SecurityScheme;
      const flows: IROAuthFlows = {};
      if (o.flows.implicit) flows.implicit = normalizeOAuthFlow(o.flows.implicit);
      if (o.flows.password) flows.password = normalizeOAuthFlow(o.flows.password);
      if (o.flows.clientCredentials)
        flows.clientCredentials = normalizeOAuthFlow(o.flows.clientCredentials);
      if (o.flows.authorizationCode)
        flows.authorizationCode = normalizeOAuthFlow(o.flows.authorizationCode);
      return { type: 'oauth2', flows, ...base };
    }
    case 'openIdConnect': {
      const oid = raw as OpenAPIV3.OpenIdSecurityScheme;
      return {
        type: 'openIdConnect',
        openIdConnectUrl: oid.openIdConnectUrl,
        ...base,
      };
    }
    case 'mutualTLS':
      // OAS 3.1 mutual TLS — no additional fields beyond base.
      return { type: 'mutualTLS', ...base };
    default:
      // Unknown type — preserve as-is rather than silently coercing to 'apiKey'
      // (which would produce incorrect diffs for future spec additions).
      return { type: rawType as 'apiKey', ...base };
  }
}

/** Detect source version from an OAS 3.x document's openapi field. */
function detectOAS3Version(doc: OAS3Document): 'openapi-3.0' | 'openapi-3.1' {
  const v = (doc as Record<string, unknown>)['openapi'] as string | undefined;
  return v?.startsWith('3.1') ? 'openapi-3.1' : 'openapi-3.0';
}

/** Normalise an OpenAPI 3.x (3.0 or 3.1) document into an IRSpec. */
export function oas3ToIR(doc: OAS3Document, opts: NormalizeOptions = {}): IRSpec {
  const d = doc as unknown as Record<string, unknown>;
  const sourceVersion = detectOAS3Version(doc);

  const servers: IRServer[] = (doc.servers ?? []).map(normalizeServer);
  if (!servers.length) servers.push({ url: '/' });

  // Paths
  const paths: Record<string, IRPathItem> = {};
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (pathItem && !('$ref' in pathItem)) {
      paths[path] = normalizePathItem(pathItem as OAS3PathItem, opts);
    }
  }

  // Webhooks (OAS 3.1 only)
  let webhooks: Record<string, IRPathItem> | undefined;
  const rawWebhooks = (doc as OpenAPIV3_1.Document).webhooks;
  if (rawWebhooks && Object.keys(rawWebhooks).length) {
    webhooks = {};
    for (const [name, wh] of Object.entries(rawWebhooks)) {
      if (wh && !('$ref' in wh)) {
        webhooks[name] = normalizePathItem(wh as OAS3PathItem, opts);
      }
    }
  }

  // Security schemes
  const securitySchemes: Record<string, IRSecurityScheme> = {};
  const rawSchemes = (doc as OpenAPIV3.Document).components?.securitySchemes;
  if (rawSchemes) {
    for (const [name, scheme] of Object.entries(rawSchemes)) {
      if (scheme && !('$ref' in scheme)) {
        securitySchemes[name] = normalizeSecurityScheme(scheme as OAS3SecurityScheme);
      }
    }
  }

  // Tags
  const tags: IRTag[] = (doc.tags ?? []).map((t) => {
    const tRaw = t as unknown as Record<string, unknown>;
    return {
      name: t.name,
      ...(t.description !== undefined && { description: t.description }),
      ...(pickExtensions(tRaw) ? { extensions: pickExtensions(tRaw) } : {}),
    };
  });

  const info = doc.info as unknown as Record<string, unknown>;
  const licenseRaw = doc.info.license as Record<string, unknown> | undefined;

  return {
    sourceVersion,
    info: {
      title: doc.info.title,
      version: doc.info.version,
      ...(doc.info.description !== undefined && { description: doc.info.description }),
      ...((doc.info as { termsOfService?: string }).termsOfService !== undefined && {
        termsOfService: (doc.info as { termsOfService?: string }).termsOfService,
      }),
      ...((doc.info.contact) !== undefined && {
        contact: doc.info.contact as unknown as {
          name?: string;
          url?: string;
          email?: string;
        },
      }),
      ...(licenseRaw !== undefined && {
        license: {
          name: licenseRaw['name'] as string,
          ...(licenseRaw['url'] !== undefined && { url: licenseRaw['url'] as string }),
          ...(licenseRaw['identifier'] !== undefined && {
            identifier: licenseRaw['identifier'] as string,
          }),
        },
      }),
      ...(pickExtensions(info) ? { extensions: pickExtensions(info) } : {}),
    },
    servers,
    paths,
    ...(webhooks !== undefined && { webhooks }),
    securitySchemes,
    ...(doc.security !== undefined && {
      security: doc.security as Record<string, string[]>[],
    }),
    tags,
    ...(pickExtensions(d) ? { extensions: pickExtensions(d) } : {}),
  };
}
