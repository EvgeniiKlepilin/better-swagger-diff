# MASTER PRD — Better Swagger Diff

**Version:** 1.0  
**Date:** 2026-04-13  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Competitive Analysis](#3-competitive-analysis)
4. [Where We Win](#4-where-we-win)
5. [Product Vision & Goals](#5-product-vision--goals)
6. [Target Users](#6-target-users)
7. [Technical Architecture](#7-technical-architecture)
8. [Epics, Stories & Tasks](#8-epics-stories--tasks)
   - [Epic 1 — Core Diff Engine](#epic-1--core-diff-engine)
   - [Epic 2 — CLI Tool](#epic-2--cli-tool)
   - [Epic 3 — Web Application](#epic-3--web-application)
   - [Epic 4 — REST API Server](#epic-4--rest-api-server)
   - [Epic 5 — CI/CD Integrations](#epic-5--cicd-integrations)
   - [Epic 6 — Breaking Change Rule Engine](#epic-6--breaking-change-rule-engine)
   - [Epic 7 — Reports & Output Formats](#epic-7--reports--output-formats)
   - [Epic 8 — Developer Experience & Ecosystem](#epic-8--developer-experience--ecosystem)
   - [Epic 9 — SaaS & Team Features (Post-MVP)](#epic-9--saas--team-features-post-mvp)
9. [Phased Roadmap](#9-phased-roadmap)
10. [Success Metrics](#10-success-metrics)
11. [Out of Scope (v1)](#11-out-of-scope-v1)

---

## 1. Executive Summary

**Better Swagger Diff** is an open-source tool that compares Swagger (2.0) and OpenAPI (3.0, 3.1) specifications to identify structural and semantic differences — with a particular focus on breaking-change detection. It ships as a **CLI**, a **web application**, and an embeddable **JavaScript/TypeScript library**, covering all the use cases the existing ecosystem addresses while fixing the gaps each existing tool leaves open.

---

## 2. Problem Statement

API teams need to:
- Catch breaking changes *before* they reach consumers.
- Generate human-readable changelogs automatically.
- Integrate diff checks into CI/CD pipelines with zero friction.
- Share diff reports with non-technical stakeholders.

The tools that exist today each solve *part* of this problem but fail on at least one axis:

| Gap | Impact |
|---|---|
| No tool offers a web UI for interactive, visual comparison | Non-CLI users (PMs, tech writers, QA) are excluded |
| All existing tools are single-language libraries (Java, Ruby, Go) | JS/TS ecosystem lacks a native solution |
| Incomplete or absent OpenAPI 3.1 support | Teams on the latest spec revision are blocked |
| Poor external `$ref` resolution | Real-world specs (multi-file) break parsers |
| No team/collaboration features anywhere | Diff reviews are copy-pasted into Slack/Confluence |
| No hosted SaaS option | Self-hosting requirement slows adoption |

---

## 3. Competitive Analysis

### 3.1 Tool Inventory

| Tool | Language | Stars | Spec Support | Output Formats | Web UI | Status |
|---|---|---|---|---|---|---|
| [Sayi/swagger-diff](https://github.com/Sayi/swagger-diff) | Java | 292 | Swagger 1.x, 2.0 | HTML, Markdown | No | **Dead** (last release 2020) |
| [civisanalytics/swagger-diff](https://github.com/civisanalytics/swagger-diff) | Ruby | 271 | Swagger 2.0 | Text, RSpec | No | Stale (2023) |
| [Atlassian/openapi-diff](https://bitbucket.org/atlassian/openapi-diff) | Java | N/A | OpenAPI 3.0 | JSON, Text | No | Unmaintained |
| [OpenAPITools/openapi-diff](https://github.com/OpenAPITools/openapi-diff) | Java | 1.1k | OpenAPI 3.0 only | HTML, MD, AsciiDoc, JSON | No | Active |
| [oasdiff/oasdiff](https://github.com/oasdiff/oasdiff) | Go | 1.2k | OpenAPI 3.x | YAML, JSON, MD, HTML, JUnit, GHA | No | Very active |

### 3.2 Feature Matrix

| Feature | Sayi | Civis | OpenAPITools | oasdiff | **Better Swagger Diff** |
|---|---|---|---|---|---|
| Swagger 2.0 | ✅ | ✅ | ❌ | ⚠️ partial | ✅ |
| OpenAPI 3.0 | ❌ | ❌ | ✅ | ✅ | ✅ |
| OpenAPI 3.1 | ❌ | ❌ | ❌ | ⚠️ partial | ✅ |
| Breaking change detection | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| External `$ref` resolution | ❌ | ❌ | ❌ broken | ✅ | ✅ |
| Multi-file spec support | ❌ | ❌ | ❌ | ✅ | ✅ |
| Web UI | ❌ | ❌ | ❌ | ❌ | ✅ |
| Shareable diff reports | ❌ | ❌ | ❌ | ❌ | ✅ |
| REST API | ❌ | ❌ | ❌ | ❌ | ✅ |
| JS/TS library | ❌ | ❌ | ❌ | ❌ | ✅ |
| Custom breaking-change rules | ❌ | ❌ | ⚠️ via SPI | ⚠️ limited | ✅ |
| Git-aware diff (branch/commit) | ❌ | ❌ | ❌ | ✅ | ✅ |
| GitHub Action | ❌ | ❌ | ❌ | ✅ | ✅ |
| Team collaboration | ❌ | ❌ | ❌ | ❌ | ✅ (post-MVP) |
| SaaS hosted option | ❌ | ❌ | ❌ | ❌ | ✅ (post-MVP) |

### 3.3 Common Bugs in Existing Tools (to avoid)

- **Enum renames misclassified** as additions (OpenAPITools/openapi-diff #828)
- **allOf → array type** change crashes the engine (OpenAPITools/openapi-diff #887)
- **`exclusiveMinimum`/`exclusiveMaximum`** not handled (oasdiff)
- **Cross-version comparison** (3.0.1 vs 3.1.0) incorrectly flags unchanged operations (OpenAPITools/openapi-diff #858)
- **External `$ref`** invalid-ref errors (OpenAPITools/openapi-diff #810)
- **Query-param-to-array** false-positive breaking change (oasdiff)
- **Detected changes not rendered** in HTML/Markdown (OpenAPITools/openapi-diff #857, #872)

---

## 4. Where We Win

### 4.1 The only tool with a real web UI
Every competitor is CLI/library only. A browser-based diff tool unlocks:
- PMs and tech writers who never touch a terminal
- Paste-and-compare workflows (no install required)
- Visual side-by-side diffs with syntax highlighting
- One-click shareable report URLs

### 4.2 Native TypeScript/JavaScript library
The JS/TS ecosystem (the largest by developer count) has no native diff library. Existing tools require shelling out to Java/Go or calling a Docker container. A proper npm package with full TypeScript types changes this.

### 4.3 Full OpenAPI 3.1 support from day one
No existing tool has complete 3.1 support. OpenAPI 3.1 reached wide adoption in 2024-2025. Being spec-complete from day one is a strong differentiator.

### 4.4 Unified Swagger 2.0 + OpenAPI 3.x support with cross-version diffing
OpenAPITools dropped Swagger 2.0; Sayi/swagger-diff never got to 3.x. Being able to diff a Swagger 2.0 spec against an OpenAPI 3.0 spec (migration scenario) is uniquely valuable.

### 4.5 Correct external `$ref` resolution
Multi-file specs are the real-world standard. Proper recursive external `$ref` resolution with cycle detection eliminates the most common class of parser failures.

### 4.6 REST API for language-agnostic integration
A self-hostable HTTP server lets Python, PHP, .NET, and any other language ecosystem integrate without a native library.

### 4.7 Custom rule engine (configurable breaking changes)
Different organizations define "breaking" differently. Allowing teams to add/remove/override rules via a config file is a meaningful upgrade over hardcoded rule sets.

---

## 5. Product Vision & Goals

**Vision:** Be the definitive open-source API diff tool — the one engineers reach for regardless of their language ecosystem, and the one teams use to build shared understanding of API changes.

**v1 Goals (CLI + Core Engine):**
- Comprehensive, correct diff of Swagger 2.0 / OpenAPI 3.0 / 3.1 specs
- Best-in-class breaking change detection with zero false positives on common patterns
- Multiple output formats consumable by humans and machines
- Ship as an npm package and standalone binary

**v2 Goals (Web App):**
- Browser-based comparison with interactive diff UI
- Shareable report links
- Self-hostable Docker image

**v3 Goals (Ecosystem + SaaS):**
- GitHub Action, GitLab CI template, pre-commit hook
- Team features: comments, saved diffs, org dashboards
- Hosted SaaS at betterdiff.dev (or similar)

---

## 6. Target Users

| Persona | Need | How We Serve Them |
|---|---|---|
| **Backend API developer** | Catch breaking changes in PR review | CLI + GitHub Action + VS Code extension |
| **API platform team** | Enforce API governance in CI/CD | Custom rule engine + exit codes + JUnit output |
| **Tech writer / API docs author** | Generate human-readable changelogs | Markdown/HTML output, web UI |
| **QA / Integration engineer** | Verify a new API version is backward-compatible | Web UI paste-and-compare |
| **Engineering manager / PM** | Understand API change risk at a glance | Web UI with severity summary dashboard |
| **Open-source / SDK maintainer** | Automate changelog generation | REST API + library |

---

## 7. Technical Architecture

### 7.1 Language & Runtime

**Core engine + CLI:** TypeScript, compiled to both Node.js (CJS/ESM) and native binaries via Bun or `pkg`.

**Rationale:**
- Single language for engine, CLI, and web app — no FFI, no subprocess calls
- Ships as an npm package (`better-swagger-diff`) natively usable by the JS ecosystem
- Bun enables single-file binary distribution (no Node.js install required)
- Engine logic runs identically in Node.js and the browser (web app reuses it directly)

### 7.2 Package Structure (Monorepo)

```
better-swagger-diff/
├── packages/
│   ├── core/           # Diff engine, parser, rule engine (pure TS, no Node deps)
│   ├── cli/            # Commander.js CLI, wraps core
│   ├── server/         # Express/Fastify REST API server
│   └── web/            # Next.js web application
├── integrations/
│   ├── github-action/
│   └── pre-commit/
└── docs/
```

### 7.3 Core Engine Pipeline

```
Input (file path | URL | string | git ref)
  → Loader (fetch + cache)
  → Parser (swagger-parser / openapi-parser with full $ref resolution)
  → Normalizer (Swagger 2.0 → internal IR; OpenAPI 3.x → internal IR)
  → Differ (structural diff against internal IR)
  → Rule Engine (classify changes by type and breaking severity)
  → Formatter (text | JSON | YAML | Markdown | HTML | JUnit)
  → Output
```

### 7.4 Internal Representation (IR)

Design a version-agnostic Intermediate Representation so Swagger 2.0 and OpenAPI 3.x are comparable against each other. The normalizer maps both formats to this IR before diffing.

### 7.5 Web App Architecture

- **Next.js 15 (App Router)** with React 19
- **Monaco Editor** for spec editing in the browser
- Engine imported directly as a module (no server roundtrip for basic diffs)
- Optional server-side diff for large specs via `/api/diff`
- Report permalinks stored in URL-encoded state (no backend required for sharing small specs) or short-link service for large specs

---

## 8. Epics, Stories & Tasks

---

### Epic 1 — Core Diff Engine

**Goal:** Produce a correct, complete structural diff between two OpenAPI/Swagger specs as a structured data model. This is the foundation everything else builds on.

---

#### Story 1.1 — Spec Loading & Parsing

As a developer using the library, I want to load a spec from a file path, a URL, or a raw string, so that the engine can handle any real-world input.

**Tasks:**
- [x] **1.1.1** Set up monorepo with pnpm workspaces and Turborepo
- [x] **1.1.2** Scaffold `packages/core` with TypeScript strict config and Vitest
- [x] **1.1.3** Implement `loadSpec(source: string | URL | RawString): Promise<ParsedSpec>` using `@apidevtools/swagger-parser` for full `$ref` resolution (internal + external + circular)
- [x] **1.1.4** Support JSON and YAML input transparently
- [x] **1.1.5** Detect spec version (Swagger 2.0 / OAS 3.0 / OAS 3.1) from `swagger`/`openapi` fields
- [x] **1.1.6** Implement remote URL fetching with configurable timeout and auth headers
- [x] **1.1.7** Implement `loadSpecFromGit(repo: string, ref: string, path: string)` for git-aware loading
- [x] **1.1.8** Add caching layer for remote specs (ETag + TTL)
- [x] **1.1.9** Write unit tests covering JSON, YAML, local file, HTTP URL, multi-file `$ref` chains, circular refs

---

#### Story 1.2 — Internal Representation & Normalizer

As the diff engine, I need a single version-agnostic IR so I can compare Swagger 2.0 against OpenAPI 3.1 without separate code paths.

**Tasks:**
- [x] **1.2.1** Define `IRSpec` TypeScript type: paths, operations, parameters, request bodies, responses, schemas, security schemes, tags, servers
- [x] **1.2.2** Implement `swagger2ToIR(spec): IRSpec` normalizer (Swagger 2.0 → IR)
- [x] **1.2.3** Implement `oas3ToIR(spec): IRSpec` normalizer (OpenAPI 3.x → IR)
- [x] **1.2.4** Handle OAS 3.1 additions: `webhooks`, `$schema`, JSON Schema draft 2020-12 keywords (`unevaluatedProperties`, `prefixItems`, `$dynamicRef`, etc.)
- [x] **1.2.5** Handle `allOf` / `oneOf` / `anyOf` flattening for schema comparison (optional flag; keep raw form available)
- [x] **1.2.6** Normalize path parameters: treat `{id}` and `{userId}` in same position as the same parameter for comparison
- [x] **1.2.7** Write snapshot tests for normalizer output on a large set of real-world specs

---

#### Story 1.3 — Structural Differ

As a developer, I want the engine to produce a detailed, typed diff object enumerating every addition, removal, and modification in the spec.

**Tasks:**
- [x] **1.3.1** Implement `diff(base: IRSpec, head: IRSpec): DiffResult` — top-level differ
- [x] **1.3.2** Path-level diff: added paths, removed paths, modified paths
- [x] **1.3.3** Operation-level diff: added/removed/modified operations per path (per HTTP method)
- [x] **1.3.4** Parameter diff: added/removed/modified parameters (query, path, header, cookie) including `required`, `type`, `schema`, `default`, `enum`
- [x] **1.3.5** Request body diff: content type changes, schema changes, `required` flag changes
- [x] **1.3.6** Response diff: added/removed/modified status codes, headers, and response schemas
- [x] **1.3.7** Schema diff: deep recursive comparison of JSON Schema objects (type, format, properties, items, additionalProperties, enum, minimum, maximum, exclusiveMinimum, exclusiveMaximum, pattern, minLength, maxLength, nullable, readOnly, writeOnly, deprecated)
- [x] **1.3.8** Security scheme diff: added/removed/modified security schemes and operation-level security requirements
- [x] **1.3.9** Tag diff: added/removed/modified tags
- [x] **1.3.10** Server/basePath diff: server URL changes
- [x] **1.3.11** `x-` extension diff: track vendor extension changes (configurable: include/exclude)
- [x] **1.3.12** `deprecated` flag tracking: flag newly deprecated endpoints
- [x] **1.3.13** Write property-based tests using `fast-check` for diff symmetry and idempotency

---

#### Story 1.4 — Diff Result Schema

As an integrator, I want the diff result to be a well-typed, serializable data structure so I can process it programmatically.

**Tasks:**
- [x] **1.4.1** Define `DiffResult` TypeScript type with full JSDoc
- [x] **1.4.2** Each diff item carries: `type` (added|removed|modified), `path` (JSON Pointer), `location` (source line/col when available), `before`, `after`
- [x] **1.4.3** Generate JSON Schema for `DiffResult` for documentation and validation
- [x] **1.4.4** Ensure `DiffResult` is round-trip serializable (JSON.stringify ↔ parse)

---

### Epic 2 — CLI Tool

**Goal:** Provide a best-in-class command-line interface that integrates into any developer workflow.

---

#### Story 2.1 — CLI Scaffolding & Core Commands

As a developer, I want to run `bsd diff old.yaml new.yaml` and get a diff in my terminal.

**Tasks:**
- [ ] **2.1.1** Scaffold `packages/cli` with Commander.js, pointing at `core` package
- [ ] **2.1.2** Implement `bsd diff <base> <head>` command (file paths, URLs, git refs `repo@branch:path`)
- [ ] **2.1.3** Implement `bsd breaking <base> <head>` — exit 1 if breaking changes found, 0 if clean (CI-friendly)
- [ ] **2.1.4** Implement `bsd changelog <base> <head>` — human-readable changelog output
- [ ] **2.1.5** Implement `bsd validate <spec>` — validate a single spec for well-formedness
- [ ] **2.1.6** Implement `bsd flatten <spec>` — dereference all `$ref`s and output a single-file spec
- [ ] **2.1.7** Global flags: `--format <text|json|yaml|markdown|html|junit>`, `--output <file>`, `--config <file>`, `--no-color`, `--quiet`, `--verbose`
- [ ] **2.1.8** Colored terminal output with severity icons (🔴 breaking, 🟡 warning, 🟢 info) — degraded gracefully with `--no-color`

---

#### Story 2.2 — Configuration File

As a team, I want a `.bsdrc` or `bsd.config.yaml` file to define org-wide settings so I don't repeat flags on every invocation.

**Tasks:**
- [ ] **2.2.1** Implement config file loading: look for `bsd.config.yaml` / `.bsdrc.yaml` / `.bsdrc.json` up the directory tree
- [ ] **2.2.2** Config schema: spec version hints, ignored paths (glob), ignored rules (list), custom rules (file path), format defaults, auth headers for remote specs
- [ ] **2.2.3** `bsd init` command to scaffold a config file interactively
- [ ] **2.2.4** Config validation with clear error messages on malformed config

---

#### Story 2.3 — Binary Distribution

As a developer, I want to install `bsd` with a single command on macOS, Linux, and Windows without installing Node.js.

**Tasks:**
- [ ] **2.3.1** Build standalone binaries using Bun's `bun build --compile` for macOS arm64, macOS x64, Linux x64, Linux arm64, Windows x64
- [ ] **2.3.2** Publish binaries as GitHub Release assets on every tag
- [ ] **2.3.3** Write install script (`curl -fsSL https://bsd.sh | sh`) that detects platform and downloads the correct binary
- [ ] **2.3.4** Publish npm package `better-swagger-diff` with the CLI as `bin` entry (Node.js fallback)
- [ ] **2.3.5** Homebrew formula (`brew install better-swagger-diff`)
- [ ] **2.3.6** Scoop manifest for Windows

---

#### Story 2.4 — CLI UX Polish

**Tasks:**
- [ ] **2.4.1** `--watch` mode: re-run diff on file change (useful during local spec editing)
- [ ] **2.4.2** Progress spinner for remote spec fetching
- [ ] **2.4.3** `bsd diff --summary` for a one-line count: `3 breaking, 5 non-breaking, 2 deprecated`
- [ ] **2.4.4** Interactable `--interactive` TUI mode (using `ink` or `blessed`) for browsing large diffs
- [ ] **2.4.5** Shell autocomplete generation for bash, zsh, fish (`bsd completion bash`)

---

### Epic 3 — Web Application

**Goal:** A browser-based tool that lets any user compare two specs visually without installing anything.

---

#### Story 3.1 — Core Web UI

As a non-CLI user, I want to paste two specs into a browser and see a visual diff immediately.

**Tasks:**
- [ ] **3.1.1** Scaffold `packages/web` as a Next.js 15 app (App Router, TypeScript)
- [ ] **3.1.2** Home page: two panes with Monaco Editor, "Compare" button, format selector (JSON/YAML)
- [ ] **3.1.3** Import `core` package and run diff entirely client-side (no server roundtrip for small specs)
- [ ] **3.1.4** Implement server-side diff API route (`POST /api/diff`) for large specs exceeding browser memory limits
- [ ] **3.1.5** Loading state with progress indicator during diff computation
- [ ] **3.1.6** Error state with human-friendly parse error messages (highlight the line in the editor)

---

#### Story 3.2 — Diff Results View

As a user, I want to explore the diff results interactively, filter by severity, and drill down into individual changes.

**Tasks:**
- [ ] **3.2.1** Summary bar: counts by severity (breaking / non-breaking / deprecated / info)
- [ ] **3.2.2** Results list grouped by: endpoint path → HTTP method → change type
- [ ] **3.2.3** Expand/collapse each change to see before/after values with syntax highlighting
- [ ] **3.2.4** Severity filter: show all / breaking only / non-breaking / deprecated
- [ ] **3.2.5** Search/filter bar: filter changes by path or keyword
- [ ] **3.2.6** Visual diff for schema changes (tree diff, not just text)
- [ ] **3.2.7** "Breaking changes" alert banner at the top if any exist
- [ ] **3.2.8** Copy-to-clipboard button per change item
- [ ] **3.2.9** Dark mode support

---

#### Story 3.3 — Spec Input Options

As a user, I want multiple ways to input specs beyond pasting raw text.

**Tasks:**
- [ ] **3.3.1** File upload (drag-and-drop or click-to-browse) for both panes
- [ ] **3.3.2** URL input: fetch spec from a public URL client-side (CORS-permitting) or via server proxy
- [ ] **3.3.3** Sample specs: "Load example" button with curated pairs (petstore 2.0 vs 3.0, etc.)
- [ ] **3.3.4** URL-encoded state: spec content encoded in URL fragment so the current comparison is bookmarkable (for small specs)
- [ ] **3.3.5** Short-link generation via `/api/share` that stores the diff server-side and returns a slug

---

#### Story 3.4 — Report Page

As a user, I want a clean, printable diff report page I can share with stakeholders.

**Tasks:**
- [ ] **3.4.1** `/report/[slug]` page rendering a saved diff result
- [ ] **3.4.2** Print-optimized CSS (`@media print`)
- [ ] **3.4.3** "Download as HTML" button generating a self-contained single-file report
- [ ] **3.4.4** "Download as Markdown" button
- [ ] **3.4.5** "Download as JSON" button (raw `DiffResult`)
- [ ] **3.4.6** Open Graph meta tags for social sharing previews

---

#### Story 3.5 — Web App Infrastructure

**Tasks:**
- [ ] **3.5.1** Deploy to Vercel (or self-hostable via Docker)
- [ ] **3.5.2** Dockerfile for self-hosted deployment
- [ ] **3.5.3** Environment config: `MAX_SPEC_SIZE_MB`, `SHARE_STORAGE` (filesystem | S3 | KV)
- [ ] **3.5.4** Rate limiting on `/api/diff` and `/api/share` endpoints
- [ ] **3.5.5** CORS configuration for the REST API

---

### Epic 4 — REST API Server

**Goal:** A self-hostable HTTP API that language-agnostic integrations can call.

---

#### Story 4.1 — API Endpoints

As a backend developer in any language, I want to POST two specs to an endpoint and receive a structured diff response.

**Tasks:**
- [ ] **4.1.1** `POST /api/v1/diff` — accepts `{ base: string|url, head: string|url, options: DiffOptions }`, returns `DiffResult`
- [ ] **4.1.2** `POST /api/v1/breaking` — same input, returns `{ breaking: boolean, changes: BreakingChange[] }`
- [ ] **4.1.3** `POST /api/v1/changelog` — returns a formatted changelog string in requested format
- [ ] **4.1.4** `POST /api/v1/validate` — validates a single spec, returns parse errors
- [ ] **4.1.5** `GET /api/v1/health` — liveness probe
- [ ] **4.1.6** OpenAPI spec for the REST API itself (dogfooding)
- [ ] **4.1.7** Request size limit enforcement and clear 413 error responses

---

#### Story 4.2 — API DX

**Tasks:**
- [ ] **4.2.1** Auto-generated API docs at `/api/docs` (Scalar or Swagger UI)
- [ ] **4.2.2** SDK generation: publish auto-generated TypeScript client as `@better-swagger-diff/client`
- [ ] **4.2.3** Python SDK generation (openapi-generator or handcrafted)
- [ ] **4.2.4** API key auth (optional; disabled in self-hosted mode by default)

---

### Epic 5 — CI/CD Integrations

**Goal:** Zero-friction integration into every major CI/CD system.

---

#### Story 5.1 — GitHub Action

As a team, I want a GitHub Action that comments a diff summary on PRs when the OpenAPI spec changes.

**Tasks:**
- [ ] **5.1.1** Scaffold `integrations/github-action` with `action.yml`
- [ ] **5.1.2** Action inputs: `base-spec`, `head-spec`, `fail-on-breaking` (bool), `format`, `comment-on-pr` (bool)
- [ ] **5.1.3** Auto-detect changed spec files using git diff when no explicit paths provided
- [ ] **5.1.4** Post PR comment with Markdown diff summary (collapsible sections per endpoint)
- [ ] **5.1.5** Publish action to GitHub Marketplace
- [ ] **5.1.6** Write E2E test workflow using `act`

---

#### Story 5.2 — GitLab CI & Other CI Systems

**Tasks:**
- [ ] **5.2.1** GitLab CI component (`integrations/gitlab-ci/component.yml`) with the same capability as the GitHub Action
- [ ] **5.2.2** CircleCI orb definition
- [ ] **5.2.3** Bitbucket Pipelines pipe definition
- [ ] **5.2.4** Pre-commit hook (`integrations/pre-commit/hooks.yaml`) for local enforcement

---

#### Story 5.3 — JUnit & Test Reporter Integration

**Tasks:**
- [ ] **5.3.1** `--format junit` produces JUnit XML with one test case per breaking change (fail) / non-breaking (pass)
- [ ] **5.3.2** Ensure output is compatible with GitHub Actions test reporter, GitLab test reports, and CircleCI test summaries
- [ ] **5.3.3** GitHub Actions annotation output (`::error file=...::`) for inline PR review comments

---

### Epic 6 — Breaking Change Rule Engine

**Goal:** A comprehensive, configurable set of breaking change rules — more complete and correct than any existing tool.

---

#### Story 6.1 — Built-in Rule Set

As a developer, I want the engine to catch all standard categories of breaking changes automatically.

**Breaking Change Categories:**

**Tasks:**
- [ ] **6.1.1** Removed path
- [ ] **6.1.2** Removed HTTP method from existing path
- [ ] **6.1.3** New required request parameter (query/path/header/cookie)
- [ ] **6.1.4** Existing optional parameter becomes required
- [ ] **6.1.5** Parameter type narrowing (e.g., `string` → `integer`)
- [ ] **6.1.6** Parameter format change (e.g., `int32` → `int64`)
- [ ] **6.1.7** Required request body added
- [ ] **6.1.8** Required property added to request body schema
- [ ] **6.1.9** Request body content type removed
- [ ] **6.1.10** Response status code removed
- [ ] **6.1.11** Response property removed from response schema
- [ ] **6.1.12** Response property type change
- [ ] **6.1.13** Response content type removed
- [ ] **6.1.14** Enum value removed from request parameter or request body
- [ ] **6.1.15** New enum constraint added to previously unconstrained field (request side)
- [ ] **6.1.16** Maximum value decreased / Minimum value increased (request schema)
- [ ] **6.1.17** maxLength decreased / minLength increased (request schema)
- [ ] **6.1.18** Security scheme removed
- [ ] **6.1.19** Operation security requirement added or made more restrictive
- [ ] **6.1.20** `nullable: false` added to previously nullable field (response)
- [ ] **6.1.21** `additionalProperties: false` added to previously open schema (response)
- [ ] **6.1.22** `readOnly` flag added to previously writable field
- [ ] **6.1.23** Path parameter rename (different name in same position)
- [ ] **6.1.24** `exclusiveMinimum` / `exclusiveMaximum` changes (including OAS 3.1 boolean→number form)

**Non-Breaking / Informational Change Categories:**
- [ ] **6.1.25** New optional parameter added
- [ ] **6.1.26** New response property added (additive)
- [ ] **6.1.27** New enum value added to response schema
- [ ] **6.1.28** New path or operation added
- [ ] **6.1.29** `deprecated: true` set on an operation or parameter
- [ ] **6.1.30** Description or summary changed
- [ ] **6.1.31** Example changed
- [ ] **6.1.32** `x-` extension changed

---

#### Story 6.2 — Rule Configuration

As a platform team, I want to turn specific rules on/off or change their severity so the tool matches our internal API governance policy.

**Tasks:**
- [ ] **6.2.1** Every rule has a stable string ID (e.g., `required-parameter-added`, `response-property-removed`)
- [ ] **6.2.2** Config file supports: disable rule by ID, change severity (breaking → warning → info), add path glob exceptions
- [ ] **6.2.3** `bsd rules list` — prints all rules with IDs, descriptions, and default severities
- [ ] **6.2.4** `bsd rules docs` — opens rule documentation in browser

---

#### Story 6.3 — Custom Rules

As an API governance team, I want to write custom breaking-change rules in JavaScript/TypeScript.

**Tasks:**
- [ ] **6.3.1** Define `CustomRule` interface: `{ id, description, check(base, head, change): RuleViolation | null }`
- [ ] **6.3.2** Config file `customRules` field: array of file paths to custom rule modules
- [ ] **6.3.3** Custom rule hot-loading in `--watch` mode
- [ ] **6.3.4** Write example custom rules in the docs: "all endpoints must have a `x-owner` extension", "breaking changes require a `x-migration-guide` field"

---

### Epic 7 — Reports & Output Formats

**Goal:** Every output format is complete, correct, and immediately usable.

---

#### Story 7.1 — Text Output

**Tasks:**
- [ ] **7.1.1** Default terminal output: grouped by path, colored by severity, compact format
- [ ] **7.1.2** `--verbose` terminal output: full before/after values for every change
- [ ] **7.1.3** `--summary` one-liner: `Found 3 breaking, 5 non-breaking changes`

---

#### Story 7.2 — Markdown Output

**Tasks:**
- [ ] **7.2.1** Markdown output: H2 per endpoint, table of changes with severity badges
- [ ] **7.2.2** GitHub-flavored Markdown (GFM) variant for PR comments (collapsible `<details>` sections)
- [ ] **7.2.3** Ensure Markdown renders correctly in GitHub, GitLab, Confluence, and Notion

---

#### Story 7.3 — HTML Report

**Tasks:**
- [ ] **7.3.1** Self-contained single-file HTML (all CSS/JS inlined) — no CDN dependencies, works offline
- [ ] **7.3.2** Severity-color-coded change list with expandable details
- [ ] **7.3.3** Summary dashboard at the top (counts per severity)
- [ ] **7.3.4** Search/filter functionality (pure vanilla JS, no framework)
- [ ] **7.3.5** Print-optimized CSS

---

#### Story 7.4 — Structured Data Formats

**Tasks:**
- [ ] **7.4.1** JSON output: full `DiffResult` serialized
- [ ] **7.4.2** YAML output: same as JSON but YAML
- [ ] **7.4.3** JUnit XML output (see Epic 5)
- [ ] **7.4.4** OpenAPI Overlay format output — generate an overlay document representing the diff (requested by openapi-diff community)

---

### Epic 8 — Developer Experience & Ecosystem

**Goal:** Make contributing and integrating as frictionless as possible for the open-source community.

---

#### Story 8.1 — npm Package & Public API

**Tasks:**
- [ ] **8.1.1** Publish `better-swagger-diff` to npm (CommonJS + ESM dual build)
- [ ] **8.1.2** Publish `@better-swagger-diff/core` as a tree-shakeable ESM package
- [ ] **8.1.3** Full TypeScript types exported, no `any` in public API
- [ ] **8.1.4** Zero-runtime-dependency target for `core` package (or minimal, well-audited deps)
- [ ] **8.1.5** Browser bundle (`dist/browser.js`) built with Rollup for use via CDN script tag

---

#### Story 8.2 — Documentation Site

**Tasks:**
- [ ] **8.2.1** Docs site at `/docs` (or separate domain) using Astro Starlight or Docusaurus
- [ ] **8.2.2** Getting started guide (< 5 minutes to first diff)
- [ ] **8.2.3** CLI reference (auto-generated from Commander.js schema)
- [ ] **8.2.4** API reference (auto-generated from TypeScript types via TypeDoc)
- [ ] **8.2.5** Rule reference: one page per built-in rule with example specs showing before/after
- [ ] **8.2.6** Migration guide from each competing tool
- [ ] **8.2.7** Cookbook: common recipes (CI setup, custom rules, cross-version migration diff)

---

#### Story 8.3 — Testing & Quality

**Tasks:**
- [ ] **8.3.1** Unit test coverage ≥ 90% for `core` package
- [ ] **8.3.2** Integration tests against a corpus of 20+ real-world public OpenAPI specs
- [ ] **8.3.3** Regression test suite: every bug from competing tools recreated as a failing → passing test
- [ ] **8.3.4** Performance benchmark: diff of a 10,000-operation spec in < 2 seconds
- [ ] **8.3.5** Fuzz testing for the parser layer (random valid/invalid YAML/JSON input)
- [ ] **8.3.6** Visual regression tests for HTML output and web UI (Playwright)

---

#### Story 8.4 — Open Source Health

**Tasks:**
- [ ] **8.4.1** `CONTRIBUTING.md` with dev setup, architecture overview, and PR checklist
- [ ] **8.4.2** Issue templates: bug report, feature request, new breaking-change rule
- [ ] **8.4.3** Release automation: Changesets for versioning, auto-generated GitHub Release notes
- [ ] **8.4.4** CI: lint + typecheck + test on every PR (GitHub Actions)
- [ ] **8.4.5** Semantic versioning with a clear compatibility policy for the public API

---

### Epic 9 — SaaS & Team Features (Post-MVP)

**Goal:** A hosted, multi-user version of the tool that teams pay for to unlock collaboration and governance features.

---

#### Story 9.1 — User Accounts & Organizations

**Tasks:**
- [ ] **9.1.1** Auth: GitHub OAuth + email/password (Clerk or Auth.js)
- [ ] **9.1.2** Organizations with member management and roles (owner / admin / member)
- [ ] **9.1.3** API keys for org-level CI/CD integration

---

#### Story 9.2 — Saved Diffs & History

**Tasks:**
- [ ] **9.2.1** Save a diff with a name and tags
- [ ] **9.2.2** Diff history view per project/spec pair
- [ ] **9.2.3** Subscribe to a spec URL — periodic re-check and notify on changes

---

#### Story 9.3 — Collaboration

**Tasks:**
- [ ] **9.3.1** Inline comments on individual diff items
- [ ] **9.3.2** Resolve / acknowledge breaking changes with a note
- [ ] **9.3.3** Shared diff links with optional password protection
- [ ] **9.3.4** Email and Slack notifications on new breaking changes

---

#### Story 9.4 — API Governance Dashboard

**Tasks:**
- [ ] **9.4.1** Per-project dashboard: breaking change count over time, API version trend
- [ ] **9.4.2** Webhook support: POST to custom URL on breaking change detected
- [ ] **9.4.3** Policy enforcement: block CI if breaking changes are unacknowledged

---

## 9. Phased Roadmap

### Phase 1 — Foundation (Months 1–2)
**Deliverable: Core engine + CLI v1.0.0 on npm**

| Epic | Stories |
|---|---|
| Epic 1 — Core Diff Engine | 1.1, 1.2, 1.3, 1.4 (all stories) |
| Epic 2 — CLI Tool | 2.1, 2.2, 2.3 |
| Epic 6 — Rule Engine | 6.1, 6.2 |
| Epic 7 — Formats | 7.1, 7.2, 7.3, 7.4 |
| Epic 8 — DX | 8.1, 8.3, 8.4 |

**Milestone criteria:**
- `bsd diff old.yaml new.yaml` works correctly on all real-world spec samples
- All 32 breaking-change rules implemented and tested
- Binaries available for all platforms
- Published to npm

---

### Phase 2 — Web App (Months 3–4)
**Deliverable: betterdiff.dev (or self-hosted) web UI v1.0.0**

| Epic | Stories |
|---|---|
| Epic 3 — Web Application | 3.1, 3.2, 3.3, 3.4, 3.5 |
| Epic 4 — REST API | 4.1, 4.2 |
| Epic 2 — CLI | 2.4 (polish) |
| Epic 6 — Rule Engine | 6.3 (custom rules) |

**Milestone criteria:**
- Web UI live and publicly accessible
- Server-side diff API functional
- Self-hostable Docker image published

---

### Phase 3 — Ecosystem (Months 5–6)
**Deliverable: First-class CI/CD integrations and documentation**

| Epic | Stories |
|---|---|
| Epic 5 — CI/CD | 5.1, 5.2, 5.3 |
| Epic 8 — DX | 8.2 (docs site) |

**Milestone criteria:**
- GitHub Action published to Marketplace
- Docs site live with full CLI and API reference
- Rule reference complete (one page per rule)

---

### Phase 4 — SaaS (Months 7–12)
**Deliverable: Hosted team product with collaboration features**

| Epic | Stories |
|---|---|
| Epic 9 — SaaS | 9.1, 9.2, 9.3, 9.4 |

**Milestone criteria:**
- User auth and org management live
- Saved diff history functional
- Slack notifications working
- At least one paying team using the governance dashboard

---

## 10. Success Metrics

| Metric | Phase 1 Target | Phase 3 Target | Phase 4 Target |
|---|---|---|---|
| GitHub stars | 200 | 1,000 | 3,000 |
| npm weekly downloads | 500 | 5,000 | 20,000 |
| Web app monthly active users | — | 1,000 | 10,000 |
| CLI bugs filed | < 10 critical | 0 critical open | 0 critical open |
| Rule false-positive rate | < 1% | < 0.1% | < 0.1% |
| Time to first diff (web) | — | < 10 seconds | < 5 seconds |
| GitHub Action installs | — | 100 repos | 1,000 repos |

---

## 11. Out of Scope (v1)

- **AsyncAPI / GraphQL / gRPC diff** — follow-on product, separate parser pipeline
- **Auto-migration code generation** — suggest code changes to fix breaking changes in consumer SDKs
- **AI-generated changelog summaries** — LLM-based summarization of diffs (Phase 4 exploration)
- **Spec linting / style enforcement** — separate from diffing; better served by Spectral
- **Visual API designer** — out of scope; focus is diff, not authoring
- **RAML / API Blueprint support** — too niche; JSON/YAML only
