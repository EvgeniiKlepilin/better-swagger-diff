// Story 2.3.4 — smoke test for the npm shim package (packages/npm/bin/bsd.js)
// Spawns the shim as a subprocess and verifies it delegates to the CLI correctly.
// Requires `pnpm build` to have run first (dist/index.js must exist).
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = resolve(__dirname, '../../dist/index.js');
const SHIM = resolve(__dirname, '../../../npm/bin/bsd.js');

const built = existsSync(DIST);

describe.skipIf(!built)('npm shim (packages/npm/bin/bsd.js)', () => {
  it('delegates --version to the CLI', () => {
    const result = spawnSync(process.execPath, [SHIM, '--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.status).toBe(0);
    // version output is a semver string like "0.1.0"
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('delegates --help to the CLI without error', () => {
    const result = spawnSync(process.execPath, [SHIM, '--help'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('bsd');
  });

  it('produces same --version output as the direct CLI binary', () => {
    const direct = spawnSync(process.execPath, [DIST, '--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    const shim = spawnSync(process.execPath, [SHIM, '--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(shim.stdout.trim()).toBe(direct.stdout.trim());
  });
});
