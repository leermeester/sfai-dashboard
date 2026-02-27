# Build CLI triage tool

## Context

Part of the multi-interface resolution queue (parent). The CLI tool provides a fast, scriptable terminal interface for resolving items. Designed for technical users who want to triage without opening a browser.

## Task

Create a `cli/` directory with an `sfai` CLI tool built on `@clack/prompts` for interactive UI. The CLI calls the dashboard's `/api/resolution` endpoints over HTTP. Three commands: `status` (summary), `match` (interactive triage), `sync` (trigger all syncs).

**Commands:**
- `sfai status` — show pending counts by type
- `sfai match [--type customer|domain|vendor|sheet]` — interactive resolution session
- `sfai sync` — trigger cron sync endpoint

## Acceptance Criteria

- [ ] `cli/package.json` with standalone package, `@clack/prompts` dependency, and `bin` entry for `sfai`
- [ ] `sfai status` displays: total pending, breakdown by type, last sync timestamp
- [ ] `sfai match` presents items one-by-one with `@clack/prompts` select UI: Accept suggestion / Pick different / Create new / Skip
- [ ] `sfai match --type domain` filters to only domain classification items
- [ ] `sfai sync` triggers `GET /api/cron/sync` and displays results
- [ ] CLI reads dashboard URL from `SFAI_DASHBOARD_URL` env var (default: `http://localhost:3000`)
- [ ] `npx sfai` works from the monorepo root

## Pointers

- `package.json` — current project root, CLI will be a sibling package in `cli/`
- `src/app/api/resolution/route.ts` — API endpoints the CLI will call
- `src/app/api/cron/sync/route.ts` — sync endpoint the CLI triggers
- `@clack/prompts` docs: https://github.com/bombshell-dev/clack — `select`, `confirm`, `spinner` are the key primitives
