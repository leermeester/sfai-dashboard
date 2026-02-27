# Add Sentry error tracking

## Context

Part of Operational Visibility (parent). Errors in cron jobs and API routes are caught and returned as HTTP 500, but nobody is notified and there's no aggregation of error patterns. Sentry provides automatic error capture, grouping, and alerting.

## Task

Install and configure `@sentry/nextjs` for the project. Capture unhandled exceptions and manually report errors in critical paths (sync failures, resolution errors).

## Acceptance Criteria

- [ ] `@sentry/nextjs` installed and configured with `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- [ ] `SENTRY_DSN` added to `.env.example`
- [ ] Unhandled exceptions in API routes are automatically captured
- [ ] Sync failures in cron routes explicitly call `Sentry.captureException(error)` with context (sync type, correlation ID)
- [ ] Resolution errors explicitly captured with context (item ID, type, decision)
- [ ] Sentry is disabled when `SENTRY_DSN` is not set (no-op in development)
- [ ] Source maps uploaded to Sentry for readable stack traces

## Pointers

- `src/app/api/cron/sync/route.ts:36-40` — catch block; add `Sentry.captureException(error)`
- `next.config.ts` — wrap with `withSentryConfig()`
- `package.json` — add `@sentry/nextjs` dependency
