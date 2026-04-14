/**
 * @file diff/diff-result.schema.ts
 *
 * JSON Schema (draft-07) for the {@link DiffResult} type.
 *
 * Exported as a plain JavaScript object so it can be:
 *  - Imported and used at runtime for validation (e.g. with `ajv`).
 *  - Written to disk as `.json` for documentation generators.
 *  - Embedded in OpenAPI responses that describe the REST API.
 *
 * The schema is kept in sync with `diff/types.ts` manually.  A CI check
 * (`typecheck` + schema round-trip test) ensures they do not diverge.
 */

/** JSON Schema (draft-07) describing the full {@link DiffResult} shape. */
export const DIFF_RESULT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://better-swagger-diff.dev/schemas/diff-result.json',
  title: 'DiffResult',
  description:
    'The complete, structured result of comparing two OpenAPI/Swagger specifications.',
  type: 'object',
  required: ['isEmpty', 'paths', 'webhooks', 'securitySchemes', 'tags', 'servers', 'extensions'],
  additionalProperties: false,
  properties: {
    isEmpty: {
      type: 'boolean',
      description:
        'True when no differences were detected across all categories.',
    },
    paths: {
      type: 'array',
      description: 'Path-level changes including nested operation/parameter/response diffs.',
      items: { $ref: '#/$defs/PathDiff' },
    },
    webhooks: {
      type: 'array',
      description: 'Webhook changes (OAS 3.1 only). Empty for Swagger 2.0 and OAS 3.0.',
      items: { $ref: '#/$defs/PathDiff' },
    },
    securitySchemes: {
      type: 'array',
      description: 'Changes to named security schemes.',
      items: { $ref: '#/$defs/DiffItemObject' },
    },
    security: {
      description: 'Change to global security requirements. Absent when unchanged.',
      $ref: '#/$defs/DiffItemAny',
    },
    tags: {
      type: 'array',
      description: 'Changes to top-level tags.',
      items: { $ref: '#/$defs/DiffItemObject' },
    },
    servers: {
      type: 'array',
      description: 'Changes to server definitions.',
      items: { $ref: '#/$defs/DiffItemObject' },
    },
    extensions: {
      type: 'array',
      description: 'Changes to x-* vendor extension fields at the spec root.',
      items: { $ref: '#/$defs/DiffItemAny' },
    },
  },
  $defs: {
    // -------------------------------------------------------------------------
    // DiffChangeType
    // -------------------------------------------------------------------------
    DiffChangeType: {
      type: 'string',
      enum: ['added', 'removed', 'modified'],
      description: 'Direction of a single change: added, removed, or modified.',
    },

    // -------------------------------------------------------------------------
    // SourceLocation
    // -------------------------------------------------------------------------
    SourceLocation: {
      type: 'object',
      description: 'Optional token position in the source document.',
      required: ['line', 'column'],
      additionalProperties: false,
      properties: {
        line: {
          type: 'integer',
          minimum: 1,
          description: '1-based line number in the source document.',
        },
        column: {
          type: 'integer',
          minimum: 1,
          description: '1-based column number in the source document.',
        },
        source: {
          type: 'string',
          description: 'Absolute file path or URL of the source file.',
        },
      },
    },

    // -------------------------------------------------------------------------
    // DiffItem (generic — before/after typed as any value)
    // -------------------------------------------------------------------------
    DiffItemAny: {
      type: 'object',
      description: 'A single atomic change. before/after may be any JSON value.',
      required: ['type', 'path'],
      additionalProperties: false,
      properties: {
        type: { $ref: '#/$defs/DiffChangeType' },
        path: {
          type: 'string',
          description: 'RFC 6901 JSON Pointer identifying the changed location.',
        },
        location: { $ref: '#/$defs/SourceLocation' },
        before: {
          description: 'Value in the base spec. Absent when type is "added".',
        },
        after: {
          description: 'Value in the head spec. Absent when type is "removed".',
        },
      },
    },

    // -------------------------------------------------------------------------
    // DiffItem where before/after are plain objects
    // -------------------------------------------------------------------------
    DiffItemObject: {
      type: 'object',
      description: 'A single atomic change where before/after are objects.',
      required: ['type', 'path'],
      additionalProperties: false,
      properties: {
        type: { $ref: '#/$defs/DiffChangeType' },
        path: {
          type: 'string',
          description: 'RFC 6901 JSON Pointer identifying the changed location.',
        },
        location: { $ref: '#/$defs/SourceLocation' },
        before: {
          type: 'object',
          description: 'Value in the base spec. Absent when type is "added".',
        },
        after: {
          type: 'object',
          description: 'Value in the head spec. Absent when type is "removed".',
        },
      },
    },

    // -------------------------------------------------------------------------
    // ParameterDiff
    // -------------------------------------------------------------------------
    ParameterDiff: {
      type: 'object',
      description: 'Change to a single named parameter on an operation or path item.',
      required: ['name', 'in', 'type', 'jsonPointer', 'changes'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Parameter name.' },
        in: {
          type: 'string',
          enum: ['query', 'path', 'header', 'cookie'],
          description: 'Parameter location.',
        },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: {
          type: 'string',
          description: 'JSON Pointer to this parameter in the normalised IR.',
        },
        before: {
          type: 'object',
          description: 'Full parameter from the base spec. Absent when type is "added".',
        },
        after: {
          type: 'object',
          description: 'Full parameter from the head spec. Absent when type is "removed".',
        },
        changes: {
          type: 'array',
          description: 'Field-level changes. Empty when type is not "modified".',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // MediaTypeDiff
    // -------------------------------------------------------------------------
    MediaTypeDiff: {
      type: 'object',
      description: 'Change to a single media-type entry within a request body or response.',
      required: ['mediaType', 'type', 'jsonPointer', 'schemaChanges'],
      additionalProperties: false,
      properties: {
        mediaType: { type: 'string', description: 'MIME type string, e.g. "application/json".' },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: { type: 'string' },
        before: { type: 'object' },
        after: { type: 'object' },
        schemaChanges: {
          type: 'array',
          description: 'Schema-level changes. Empty when type is not "modified".',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // RequestBodyDiff
    // -------------------------------------------------------------------------
    RequestBodyDiff: {
      type: 'object',
      description: 'Changes within an operation\'s request body.',
      required: ['content', 'extensions'],
      additionalProperties: false,
      properties: {
        required: {
          $ref: '#/$defs/DiffItemAny',
          description: 'Change to the required flag. Present only when it changed.',
        },
        description: {
          $ref: '#/$defs/DiffItemAny',
          description: 'Change to the description field. Present only when it changed.',
        },
        content: {
          type: 'array',
          items: { $ref: '#/$defs/MediaTypeDiff' },
        },
        extensions: {
          type: 'array',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // HeaderDiff
    // -------------------------------------------------------------------------
    HeaderDiff: {
      type: 'object',
      description: 'Change to a single named response header.',
      required: ['name', 'type', 'jsonPointer', 'changes'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: { type: 'string' },
        before: { type: 'object' },
        after: { type: 'object' },
        changes: {
          type: 'array',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // ResponseDiff
    // -------------------------------------------------------------------------
    ResponseDiff: {
      type: 'object',
      description: 'Change to a single HTTP response.',
      required: ['statusCode', 'type', 'jsonPointer', 'changes', 'content', 'headers'],
      additionalProperties: false,
      properties: {
        statusCode: {
          type: 'string',
          description: 'HTTP status code string, e.g. "200", "404", "default".',
        },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: { type: 'string' },
        before: { type: 'object' },
        after: { type: 'object' },
        changes: {
          type: 'array',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
        content: {
          type: 'array',
          items: { $ref: '#/$defs/MediaTypeDiff' },
        },
        headers: {
          type: 'array',
          items: { $ref: '#/$defs/HeaderDiff' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // OperationDiff
    // -------------------------------------------------------------------------
    OperationDiff: {
      type: 'object',
      description: 'Change to a single HTTP operation (method + path).',
      required: ['path', 'method', 'type', 'jsonPointer', 'changes', 'parameters', 'responses', 'extensions'],
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Path template, e.g. "/pets/{petId}".' },
        method: {
          type: 'string',
          enum: ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'],
          description: 'HTTP method in lowercase.',
        },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: { type: 'string' },
        before: { type: 'object' },
        after: { type: 'object' },
        changes: {
          type: 'array',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
        parameters: {
          type: 'array',
          items: { $ref: '#/$defs/ParameterDiff' },
        },
        requestBody: { $ref: '#/$defs/RequestBodyDiff' },
        responses: {
          type: 'array',
          items: { $ref: '#/$defs/ResponseDiff' },
        },
        security: { $ref: '#/$defs/DiffItemAny' },
        extensions: {
          type: 'array',
          items: { $ref: '#/$defs/DiffItemAny' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PathDiff
    // -------------------------------------------------------------------------
    PathDiff: {
      type: 'object',
      description: 'Change to a single path item (URL template).',
      required: ['path', 'type', 'jsonPointer', 'operations'],
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Path template, e.g. "/pets".' },
        type: { $ref: '#/$defs/DiffChangeType' },
        jsonPointer: {
          type: 'string',
          description: 'JSON Pointer to this path item, e.g. "/paths/~1pets".',
        },
        before: { type: 'object' },
        after: { type: 'object' },
        operations: {
          type: 'array',
          items: { $ref: '#/$defs/OperationDiff' },
        },
      },
    },
  },
} as const;

/** TypeScript type inferred from the JSON Schema constant above. */
export type DiffResultSchema = typeof DIFF_RESULT_SCHEMA;
