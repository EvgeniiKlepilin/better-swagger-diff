import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@better-swagger-diff/core', () => ({
  loadSpec: vi.fn().mockResolvedValue({ version: 'openapi-3.0', document: {}, source: 'path', dereferenced: true }),
  loadSpecFromGit: vi.fn().mockResolvedValue({ version: 'openapi-3.0', document: {}, source: 'git', dereferenced: false }),
}));

import { loadSpecArg } from '../lib/load-input.js';
import { loadSpec, loadSpecFromGit } from '@better-swagger-diff/core';

describe('loadSpecArg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls loadSpec for a plain file path', async () => {
    await loadSpecArg('./spec.yaml');
    expect(loadSpec).toHaveBeenCalledWith('./spec.yaml', {});
    expect(loadSpecFromGit).not.toHaveBeenCalled();
  });

  it('calls loadSpec for an HTTP URL', async () => {
    await loadSpecArg('https://api.example.com/spec.yaml');
    expect(loadSpec).toHaveBeenCalledWith('https://api.example.com/spec.yaml', {});
  });

  it('calls loadSpecFromGit for a git ref', async () => {
    await loadSpecArg('./my-repo@v1.0.0:api/spec.yaml');
    expect(loadSpecFromGit).toHaveBeenCalledWith('./my-repo', 'v1.0.0', 'api/spec.yaml', {});
    expect(loadSpec).not.toHaveBeenCalled();
  });

  it('passes options through to loadSpec', async () => {
    await loadSpecArg('./spec.yaml', { dereference: false });
    expect(loadSpec).toHaveBeenCalledWith('./spec.yaml', { dereference: false });
  });
});
