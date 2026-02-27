# Add GitHub Actions CI pipeline

## Context

Part of Quality Foundation (parent). No CI pipeline exists. Code is pushed directly to main and deployed via Vercel without any automated checks. A developer could push breaking changes (TypeScript errors, lint violations, test failures) and break production immediately.

## Task

Create a GitHub Actions workflow that runs lint, type-check, and tests on every push and pull request. The workflow should block merges if any check fails.

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` runs on push to `main` and on all pull requests
- [ ] Pipeline runs three steps: `npm run lint`, `npx tsc --noEmit`, `npm test`
- [ ] Pipeline uses Node 18 (matching `.nvmrc`)
- [ ] Pipeline caches `node_modules` for faster runs
- [ ] Failed pipeline blocks PR merges (configure branch protection rule)
- [ ] Pipeline completes in under 3 minutes

## Watch Out For

- **Prisma generate**: The build requires `prisma generate` to create the client types. Add this as a setup step before type-checking.
- **Test database**: If integration tests (sub-issue #4) require a database, the CI pipeline needs a PostgreSQL service container or the tests need to be split into unit (no DB) and integration (with DB).

## Pointers

- `.nvmrc` — Node version: `18`
- `package.json:7` — build script includes `prisma generate`
- `package.json:9` — lint script: `next lint`
