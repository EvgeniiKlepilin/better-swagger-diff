import { execFileSync } from 'node:child_process';
import type { ParsedSpec, LoadOptions } from '../types.js';
import { parseYamlOrJson } from './parse-content.js';
import { detectVersion } from './detect-version.js';
import { buildParsedSpec } from './build-parsed-spec.js';
import { fetchRemote } from './fetch-remote.js';

/**
 * Load an OpenAPI/Swagger spec from a specific git ref.
 *
 * Supported `repo` values:
 * - **Local path** (e.g. `/path/to/repo` or `./my-api`) — uses `git show`.
 * - **GitHub URL** (e.g. `https://github.com/org/repo` or `git@github.com:org/repo.git`)
 *   — fetches via `raw.githubusercontent.com` (no local clone required; no auth unless
 *   `options.headers` contains an `Authorization` header).
 * - **GitLab URL** — fetches via the GitLab raw content URL.
 *
 * @param repo   Local directory path or remote repository URL.
 * @param ref    Git ref: branch name, tag, or full commit SHA.
 * @param filePath  Path to the spec file relative to the repository root (leading `/` is stripped).
 * @param options  Standard {@link LoadOptions}.
 *
 * @throws {Error} if the ref or file path does not exist, or if the repo
 *   type cannot be determined.
 */
export async function loadSpecFromGit(
  repo: string,
  ref: string,
  filePath: string,
  options: LoadOptions = {},
): Promise<ParsedSpec> {
  const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const source = `git:${repo}@${ref}:${normalizedPath}`;

  // --- Remote repository: GitHub ---
  if (isGitHubUrl(repo)) {
    const rawUrl = githubRawUrl(repo, ref, normalizedPath);
    const content = await fetchRemote(rawUrl, options);
    const raw = parseYamlOrJson(content);
    const version = detectVersion(raw);
    return buildParsedSpec(version, raw, source, false);
  }

  // --- Remote repository: GitLab ---
  if (isGitLabUrl(repo)) {
    const rawUrl = gitlabRawUrl(repo, ref, normalizedPath);
    const content = await fetchRemote(rawUrl, options);
    const raw = parseYamlOrJson(content);
    const version = detectVersion(raw);
    return buildParsedSpec(version, raw, source, false);
  }

  // --- Local repository ---
  let content: string;
  try {
    content = execFileSync(
      'git',
      ['-C', repo, 'show', `${ref}:${normalizedPath}`],
      {
        encoding: 'utf-8',
        timeout: 10_000,
        // Suppress git's own stderr so the error we throw is the only output.
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load spec from git.\n` +
      `  repo: ${repo}\n` +
      `  ref:  ${ref}\n` +
      `  path: ${normalizedPath}\n\n` +
      `Verify that the repository path is correct, the ref exists, and the ` +
      `file is present at that ref.\n\nOriginal error: ${detail}`,
      { cause: err },
    );
  }

  const raw = parseYamlOrJson(content);
  const version = detectVersion(raw);
  // For local git content we have no base path for external $refs, so we
  // skip dereference here and return the raw parsed object. Callers that need
  // full resolution can write the content to a temp file and use loadSpec().
  return buildParsedSpec(version, raw, source, false);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isGitHubUrl(repo: string): boolean {
  return repo.includes('github.com');
}

function isGitLabUrl(repo: string): boolean {
  return repo.includes('gitlab.com');
}

/**
 * Convert a GitHub repository URL (HTTPS or SSH) to a raw content URL.
 *
 * Examples:
 *   https://github.com/org/repo        → https://raw.githubusercontent.com/org/repo/{ref}/{path}
 *   git@github.com:org/repo.git        → same
 */
function githubRawUrl(repo: string, ref: string, filePath: string): string {
  const match = repo.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (!match || !match[1]) {
    throw new Error(`Cannot parse GitHub repository URL: "${repo}"`);
  }
  return `https://raw.githubusercontent.com/${match[1]}/${ref}/${filePath}`;
}

/**
 * Convert a GitLab repository URL to a raw content URL.
 */
function gitlabRawUrl(repo: string, ref: string, filePath: string): string {
  const match = repo.match(/gitlab\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (!match || !match[1]) {
    throw new Error(`Cannot parse GitLab repository URL: "${repo}"`);
  }
  return `https://gitlab.com/${match[1]}/-/raw/${ref}/${filePath}`;
}
