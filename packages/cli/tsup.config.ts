import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    'node:fs/promises',
    'node:fs',
    'node:path',
    'node:child_process',
    'node:url',
    'node:process',
  ],
});
