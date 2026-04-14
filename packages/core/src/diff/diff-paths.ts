/**
 * Differ for path maps and webhooks (tasks 1.3.2, 1.3.3).
 */

import type { HttpMethod, IRPathItem } from '../ir/types.js';
import type { OperationDiff, PathDiff } from './types.js';
import { appendPointer } from './utils.js';
import { diffOperation } from './diff-operations.js';
import { diffParameters } from './diff-params.js';

const HTTP_METHODS: HttpMethod[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/**
 * Diff two path maps (the `paths` or `webhooks` objects of an IRSpec).
 *
 * @param base               Path map from the base spec.
 * @param head               Path map from the head spec.
 * @param rootPointer        JSON Pointer root, e.g. `"/paths"` or `"/webhooks"`.
 * @param includeExtensions  Whether to include `x-*` extension diffs.
 */
export function diffPathMaps(
  base: Record<string, IRPathItem>,
  head: Record<string, IRPathItem>,
  rootPointer: string,
  includeExtensions: boolean,
): PathDiff[] {
  const diffs: PathDiff[] = [];
  const allPaths = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const pathTemplate of allPaths) {
    const bPath = base[pathTemplate];
    const hPath = head[pathTemplate];
    const ptr = appendPointer(rootPointer, pathTemplate);

    if (!bPath) {
      diffs.push({ path: pathTemplate, type: 'added', jsonPointer: ptr, before: undefined, after: hPath, operations: [] });
      continue;
    }

    if (!hPath) {
      diffs.push({ path: pathTemplate, type: 'removed', jsonPointer: ptr, before: bPath, after: undefined, operations: [] });
      continue;
    }

    // Diff operations within the path
    const operations: OperationDiff[] = [];

    for (const method of HTTP_METHODS) {
      const bOp = bPath.operations[method];
      const hOp = hPath.operations[method];
      const opPtr = appendPointer(ptr, method);

      if (!bOp && !hOp) continue;

      if (!bOp) {
        operations.push({
          path: pathTemplate,
          method,
          type: 'added',
          jsonPointer: opPtr,
          before: undefined,
          after: hOp,
          changes: [],
          parameters: [],
          responses: [],
          extensions: [],
        });
        continue;
      }

      if (!hOp) {
        operations.push({
          path: pathTemplate,
          method,
          type: 'removed',
          jsonPointer: opPtr,
          before: bOp,
          after: undefined,
          changes: [],
          parameters: [],
          responses: [],
          extensions: [],
        });
        continue;
      }

      const opDiff = diffOperation(pathTemplate, method, bOp, hOp, opPtr, includeExtensions);
      if (opDiff) operations.push(opDiff);
    }

    // Path-level parameters (inherited by all operations)
    const pathParamDiffs = diffParameters(
      bPath.parameters,
      hPath.parameters,
      appendPointer(ptr, 'parameters'),
    );

    // Represent path-level param changes as synthetic operation diffs on
    // a special "$path-params" pseudo-method isn't clean — instead we attach
    // them as changes on each affected operation.  For now we surface them as
    // a separate OperationDiff with method marker "__path__" kept in the
    // changes array.  Callers can filter this as needed.
    if (pathParamDiffs.length > 0) {
      operations.push({
        path: pathTemplate,
        method: 'get', // placeholder; callers should check jsonPointer to detect path-level entries
        type: 'modified',
        jsonPointer: appendPointer(ptr, 'parameters'),
        before: undefined,
        after: undefined,
        changes: [],
        parameters: pathParamDiffs,
        responses: [],
        extensions: [],
      });
    }

    if (operations.length > 0) {
      diffs.push({
        path: pathTemplate,
        type: 'modified',
        jsonPointer: ptr,
        before: bPath,
        after: hPath,
        operations,
      });
    }
  }

  return diffs;
}
