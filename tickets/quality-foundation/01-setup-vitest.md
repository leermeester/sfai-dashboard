# Set up Vitest testing framework

## Context

Part of Quality Foundation (parent). No test framework exists. Vitest is the recommended choice for Next.js projects — it's fast, has native TypeScript support, and integrates with the existing Vite/Turbopack toolchain.

## Task

Install Vitest, configure it for the project, add a `test` script to `package.json`, and create a smoke test that verifies the setup works.

## Acceptance Criteria

- [ ] `vitest` installed as dev dependency
- [ ] `vitest.config.ts` configured with path aliases matching `tsconfig.json` (e.g., `@/` → `src/`)
- [ ] `npm test` runs vitest
- [ ] A smoke test file (`src/lib/__tests__/smoke.test.ts`) passes: `expect(1 + 1).toBe(2)`
- [ ] Tests can import from `@/lib/*` using the same path aliases as the app

## Watch Out For

- **Path aliases**: `tsconfig.json` uses `"@/*": ["./src/*"]`. Vitest needs this configured via `vite-tsconfig-paths` or manual `resolve.alias` in `vitest.config.ts`.

## Pointers

- `tsconfig.json` — path alias configuration
- `package.json:6` — add `"test": "vitest run"` and `"test:watch": "vitest"` scripts
