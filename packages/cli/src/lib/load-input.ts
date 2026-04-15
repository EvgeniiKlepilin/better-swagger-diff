import { loadSpec, loadSpecFromGit } from '@better-swagger-diff/core';
import type { ParsedSpec, LoadOptions } from '@better-swagger-diff/core';

export type SpecArg =
  | { type: 'path-or-url'; source: string }
  | { type: 'git'; repo: string; ref: string; filePath: string };

/**
 * Parse a CLI spec argument into a structured descriptor.
 *
 * Git ref detection uses the LAST `@` in the string to split
 * `<repo>@<ref>:<path>`.
 *
 * Supported formats:
 * - `./spec.yaml`                               — local file
 * - `https://api.example.com/spec.yaml`         — HTTP URL (no git ref)
 * - `https://github.com/org/repo@main:spec.yaml`— git ref (HTTPS remote)
 * - `./my-repo@v1.0:api/spec.yaml`             — git ref (local repo)
 * - `git@github.com:org/repo@main:spec.yaml`   — git ref (SSH remote)
 */
export function parseSpecArg(arg: string): SpecArg {
  const atIdx = arg.lastIndexOf('@');
  if (atIdx !== -1) {
    const afterAt = arg.slice(atIdx + 1);
    const colonIdx = afterAt.indexOf(':');
    if (colonIdx !== -1) {
      const repo = arg.slice(0, atIdx);
      const ref = afterAt.slice(0, colonIdx);
      const filePath = afterAt.slice(colonIdx + 1);
      if (repo && ref && filePath) {
        return { type: 'git', repo, ref, filePath };
      }
    }
  }
  return { type: 'path-or-url', source: arg };
}

/**
 * Load a ParsedSpec from a CLI spec argument string.
 */
export async function loadSpecArg(arg: string, options: LoadOptions = {}): Promise<ParsedSpec> {
  const parsed = parseSpecArg(arg);
  if (parsed.type === 'git') {
    return loadSpecFromGit(parsed.repo, parsed.ref, parsed.filePath, options);
  }
  return loadSpec(parsed.source, options);
}
