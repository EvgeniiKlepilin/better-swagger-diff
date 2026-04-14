# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Better Swagger Diff** compares Swagger 2.0 and OpenAPI 3.0/3.1 specifications to detect structural and semantic differences, with a focus on breaking-change detection. It targets the JS/TS ecosystem and ships as a library, CLI, web app, and REST API.

The full product roadmap is in `MASTER_PRD.md`. Implementation is story-driven — each story maps to a comment in the source (e.g. `// Story 1.4 — Diff Result Schema`).

## Monorepo Structure

- **Tooling:** pnpm workspaces + Turborepo (`turbo.json`)
- **Packages:** `packages/core` — the only package so far (`@better-swagger-diff/core`)
- Future packages (per PRD): `packages/cli`, `packages/web`, `packages/api`, `packages/rule-engine`

## Commands

All commands are run from the repo root via Turborepo:

```bash
pnpm build          # build all packages (tsup)
pnpm test           # run all tests (vitest run)
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # lint all packages
pnpm clean          # remove all dist/ directories
```

Within `packages/core` directly:

```bash
pnpm test           # vitest run (single pass)
pnpm test:watch     # vitest (watch mode)
```

Run a single test file:

```bash
cd packages/core && pnpm exec vitest run src/__tests__/differ.test.ts
```

## Core Package Architecture (`packages/core`)

The pipeline is: **load → normalise → diff → result**.

### `src/loader/`
Loads specs from file paths, URLs, git refs, or raw strings. Uses `@apidevtools/swagger-parser` for `$ref` resolution and dereferencing. `cache.ts` provides an in-memory `SpecCache`. `detect-version.ts` identifies Swagger 2.0 vs OAS 3.0 vs OAS 3.1.

### `src/ir/`
Internal Representation (IR) — the version-agnostic data model every spec is normalised into before diffing. `swagger2-to-ir.ts` and `oas3-to-ir.ts` each translate their respective format into `IRSpec`. `normalize-schema.ts` handles optional schema flattening (`allOf`/`anyOf`/`oneOf`).

Key type: `IRSpec` (in `ir/types.ts`) is the single type the differ operates on regardless of source format.

### `src/diff/`
Structured differ that compares two `IRSpec` objects and returns a `DiffResult`.

- `differ.ts` — top-level `diff(base, head, options?)` entry point
- `diff-paths.ts` → `diff-operations.ts` → `diff-params.ts` / `diff-responses.ts` / `diff-schema.ts` — hierarchical diffing following the spec tree
- `diff-misc.ts` — tags, servers, security schemes, global security, spec extensions
- `types.ts` — all diff output types (`DiffResult`, `PathDiff`, `OperationDiff`, etc.)
- `diff-result.schema.ts` — JSON Schema for `DiffResult` (runtime validation / docs generation)
- `utils.ts` — `deepEqual`, `appendPointer`, `escapePointerSegment`

### Key design constraints for `diff/types.ts`
All values must be JSON-serializable (`JSON.stringify` ↔ `JSON.parse` round-trip lossless). No `Map`, `Set`, `Date`, or `undefined` values — absent optional fields serialize as absent.

## TypeScript Configuration

`tsconfig.base.json` at root; each package extends it. Key flags: `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: Bundler`. Packages are ESM-first (`"type": "module"`) with dual CJS/ESM output via tsup.
