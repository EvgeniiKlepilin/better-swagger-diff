import { describe, it, expect } from 'vitest';
import { parseSpecArg } from '../lib/load-input.js';

describe('parseSpecArg', () => {
  it('detects a plain file path', () => {
    expect(parseSpecArg('./spec.yaml')).toEqual({ type: 'path-or-url', source: './spec.yaml' });
  });

  it('detects an absolute file path', () => {
    expect(parseSpecArg('/home/user/spec.json')).toEqual({ type: 'path-or-url', source: '/home/user/spec.json' });
  });

  it('detects a plain HTTP URL', () => {
    expect(parseSpecArg('https://api.example.com/spec.yaml')).toEqual({
      type: 'path-or-url',
      source: 'https://api.example.com/spec.yaml',
    });
  });

  it('detects a GitHub URL with git ref', () => {
    expect(parseSpecArg('https://github.com/org/repo@main:openapi.yaml')).toEqual({
      type: 'git',
      repo: 'https://github.com/org/repo',
      ref: 'main',
      filePath: 'openapi.yaml',
    });
  });

  it('detects a local path with git ref', () => {
    expect(parseSpecArg('./my-repo@v1.0.0:api/spec.yaml')).toEqual({
      type: 'git',
      repo: './my-repo',
      ref: 'v1.0.0',
      filePath: 'api/spec.yaml',
    });
  });

  it('detects an SSH git URL with ref', () => {
    expect(parseSpecArg('git@github.com:org/repo@main:spec.yaml')).toEqual({
      type: 'git',
      repo: 'git@github.com:org/repo',
      ref: 'main',
      filePath: 'spec.yaml',
    });
  });
});
