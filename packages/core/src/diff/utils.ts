/**
 * Low-level utilities for the differ.
 */

/**
 * Escape a single JSON Pointer segment per RFC 6901.
 * `~` → `~0`, `/` → `~1`.
 */
export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Append one or more *unescaped* segments to an existing JSON Pointer string.
 *
 * @example
 * appendPointer('/paths', '/pets')          // → '/paths/~1pets'
 * appendPointer('/paths/~1pets', 'get')     // → '/paths/~1pets/get'
 * appendPointer('', 'securitySchemes')      // → '/securitySchemes'
 */
export function appendPointer(base: string, ...segments: string[]): string {
  return base + '/' + segments.map(escapePointerSegment).join('/');
}

/**
 * Deep equality for plain JSON-serializable values.
 * Uses strict (`===`) comparison for primitives and recursion for arrays/objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, (b as unknown[])[i]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(objA[key], objB[key]));
}
