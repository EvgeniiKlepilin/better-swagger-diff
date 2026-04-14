import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  // Ensure Node built-ins are marked as external
  external: ['node:fs/promises', 'node:path', 'node:child_process', 'node:url'],
});
