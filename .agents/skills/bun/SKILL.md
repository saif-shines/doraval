---
name: Bun
description: Use when building, running, testing, or bundling JavaScript/TypeScript applications. Reach for Bun when you need to execute scripts, manage dependencies, run tests, or bundle code for production. Bun is a drop-in replacement for Node.js with integrated package manager, test runner, and bundler.
metadata:
    mintlify-proj: bun
    version: "1.0"
---

# Bun Skill

## Product Summary

Bun is an all-in-one JavaScript/TypeScript toolkit that replaces Node.js, npm, Jest, and esbuild. It ships as a single binary with four integrated tools: a fast runtime (powered by JavaScriptCore), a package manager, a test runner, and a bundler. Key files: `bunfig.toml` (configuration), `package.json` (dependencies and scripts), `bun.lock` (lockfile). Primary CLI commands: `bun run`, `bun install`, `bun test`, `bun build`. Bun is 4x faster than Node.js at startup and 25x faster than npm at installation. See https://bun.com/docs for complete documentation.

## When to Use

- **Running scripts**: Execute `.ts`, `.tsx`, `.js`, `.jsx` files directly without compilation overhead
- **Managing dependencies**: Install, add, remove, or update npm packages with `bun install` and `bun add`
- **Running tests**: Write Jest-compatible tests with `bun test` for unit, integration, and DOM testing
- **Bundling code**: Bundle TypeScript, JSX, CSS, and assets for browsers or servers with `bun build`
- **Building servers**: Create HTTP servers with `Bun.serve()` with built-in routing, WebSocket support, and streaming
- **Monorepo management**: Use workspaces to manage multiple packages in a single repository
- **Replacing Node.js workflows**: Drop-in replacement for existing Node.js projects with minimal changes

## Quick Reference

### Core Commands

| Command | Purpose |
|---------|---------|
| `bun run <file>` | Execute a TypeScript/JavaScript file |
| `bun run <script>` | Run a package.json script |
| `bun install` | Install all dependencies from package.json |
| `bun add <pkg>` | Add a package to dependencies |
| `bun add -d <pkg>` | Add a package to devDependencies |
| `bun remove <pkg>` | Remove a package |
| `bun test` | Run all test files matching patterns |
| `bun build <entry>` | Bundle code for production |
| `bunx <pkg>` | Execute a package without installing |

### File Patterns Recognized

- **Scripts**: `*.test.ts`, `*_test.ts`, `*.spec.ts`, `*_spec.ts`
- **Imports**: Direct imports of `.ts`, `.tsx`, `.jsx`, `.json`, `.toml`, `.yaml`, `.html` files
- **Assets**: `.css`, `.svg`, `.png`, and other unrecognized extensions treated as files

### Configuration Files

| File | Purpose |
|------|---------|
| `bunfig.toml` | Bun-specific configuration (optional) |
| `package.json` | Dependencies, scripts, workspaces |
| `tsconfig.json` | TypeScript compiler options |
| `bun.lock` | Lockfile (auto-generated, commit to version control) |

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `BUN_PORT` | Default port for `Bun.serve()` |
| `PORT` | Fallback port if `BUN_PORT` not set |
| `NODE_PORT` | Another fallback port |
| `BUN_INSTALL_GLOBAL_DIR` | Directory for global package installs |

## Decision Guidance

### When to Use `bun run` vs `bun build`

| Scenario | Use |
|----------|-----|
| Executing a script during development | `bun run` |
| Running a package.json script | `bun run <script>` |
| Creating a production bundle for browsers | `bun build --target browser` |
| Creating a production bundle for servers | `bun build --target bun` |
| Creating a standalone executable | `bun build --compile` |

### When to Use `bun install` vs `bun add`

| Scenario | Use |
|----------|-----|
| Installing all dependencies from package.json | `bun install` |
| Adding a new package to the project | `bun add <pkg>` |
| Adding a dev dependency | `bun add -d <pkg>` |
| Installing globally (system-wide) | `bun add -g <pkg>` |
| Installing from git | `bun add git@github.com:user/repo.git` |

### When to Use `--watch` vs `--hot`

| Scenario | Use |
|----------|-----|
| Re-run a script when files change | `bun run --watch <file>` |
| Hot reload with HMR for web development | `bun --hot run <file>` |
| Re-run tests when files change | `bun test --watch` |

## Workflow

### 1. Initialize a Project
```bash
bun init my-app
cd my-app
```
Choose a template: Blank, React, or Library. This creates `package.json`, `tsconfig.json`, and a starter file.

### 2. Install Dependencies
```bash
bun install
```
Reads `package.json`, downloads packages, and creates `bun.lock`. Runs lifecycle scripts for trusted dependencies only.

### 3. Add New Packages
```bash
bun add react
bun add -d @types/react
```
Updates `package.json` and `bun.lock`. Use `-d` for dev dependencies, `--optional` for optional, `--peer` for peer.

### 4. Run Scripts
```bash
bun run dev
bun run build
bun run test
```
Executes scripts defined in `package.json`. Bun respects lifecycle hooks (`pre<script>`, `post<script>`).

### 5. Write and Run Tests
```bash
# Create a test file
echo 'import { test, expect } from "bun:test"; test("math", () => expect(2+2).toBe(4));' > math.test.ts

# Run tests
bun test
bun test --watch
bun test --coverage
```

### 6. Build for Production
```bash
bun build ./src/index.tsx --outdir ./dist
bun build ./src/index.tsx --outfile ./app --compile
```
Bundles code, handles TypeScript/JSX transpilation, tree-shakes dead code, minifies if requested.

### 7. Create an HTTP Server
```typescript
const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () => new Response("Hello"),
    "/api/users/:id": req => new Response(`User ${req.params.id}`),
  },
});
console.log(`Server at ${server.url}`);
```
Run with `bun run server.ts`. Supports routing, WebSockets, streaming, and TLS.

## Common Gotchas

- **Lifecycle scripts security**: Bun does not run `postinstall` scripts by default. Add packages to `trustedDependencies` in `package.json` to allow them.
- **Node.js shebang in scripts**: Scripts with `#!/usr/bin/env node` will run with Node.js by default. Use `bun run --bun <script>` to force Bun execution.
- **TypeScript errors in Bun global**: Install `@types/bun` and add `"lib": ["ESNext"]` to `tsconfig.json` to fix type errors.
- **Watch mode flag placement**: Put Bun flags immediately after `bun`, not at the end: `bun --watch run dev` ✓, `bun run dev --watch` ✗
- **Lockfile format**: Bun v1.2+ uses text-based `bun.lock` by default. Older projects may have binary `bun.lockb`; migrate with `bun install --save-text-lockfile`.
- **Module resolution**: Bun supports both ESM and CommonJS. Use `"type": "module"` in `package.json` for ESM-first projects.
- **Phantom dependencies**: With `linker: "isolated"` (default for workspaces), packages can only access declared dependencies. Avoid relying on transitive dependencies.
- **Test discovery**: Tests must match patterns like `*.test.ts` or `*.spec.ts`. Files in `node_modules` are skipped automatically.
- **Bundler output**: Without `--outdir`, `bun build` returns artifacts in memory; use `--outdir` to write to disk.
- **Environment variables**: Bun auto-loads `.env` files. Disable with `env = false` in `bunfig.toml` if needed.

## Verification Checklist

Before submitting work with Bun:

- [ ] Run `bun install` to verify dependencies resolve without errors
- [ ] Run `bun test` to ensure all tests pass
- [ ] Run `bun run build` (or equivalent) to verify the build succeeds
- [ ] Check `bun.lock` is committed to version control (for reproducible installs)
- [ ] Verify `bunfig.toml` settings match project requirements (if used)
- [ ] Test with `bun run <script>` to ensure scripts execute correctly
- [ ] For servers: verify `Bun.serve()` listens on the correct port and routes work
- [ ] For bundled code: check output files exist in `--outdir` and have expected content
- [ ] Confirm no lifecycle scripts are silently skipped (check `trustedDependencies`)
- [ ] Validate TypeScript/JSX transpilation by checking bundled output

## Resources

- **Comprehensive navigation**: https://bun.com/docs/llms.txt — Full page-by-page index of all Bun documentation
- **Runtime documentation**: https://bun.com/docs/runtime — Execute files, manage environment, use built-in APIs
- **Package manager**: https://bun.com/docs/pm/cli/install — Install, add, remove, and manage dependencies
- **Bundler**: https://bun.com/docs/bundler — Bundle TypeScript, JSX, CSS for browsers and servers
- **Test runner**: https://bun.com/docs/test — Write and run Jest-compatible tests with snapshots and mocking

---

> For additional documentation and navigation, see: https://bun.com/docs/llms.txt