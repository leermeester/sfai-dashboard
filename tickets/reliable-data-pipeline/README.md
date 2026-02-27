# Build reliable data pipeline — Observable, self-healing syncs

## Context

Cron jobs (Mercury, Calendar, Sheets) fail silently with no alerting, retry, or monitoring. Co-founders can't tell if data is stale without manually checking. API routes accept raw JSON without validation, allowing invalid data to persist and silently corrupt downstream calculations.

## Scope

- [ ] Slack alerts sent when any cron sync fails
- [ ] Health check endpoint verifying DB and external API connectivity
- [ ] Retry logic with backoff on Mercury and Calendar sync
- [ ] Zod input validation on all API routes
- [ ] Auth protection on POST `/api/cron/snapshot`

## Out of Scope

- Structured logging / error tracking (separate milestone: Operational Visibility)
- Circuit breaker patterns for external APIs
- Queue-based async processing

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Add Slack notification on cron sync failure | — | S |
| 2 | Add health check endpoint | — | XS |
| 3 | Add retry logic with backoff to Mercury and Calendar sync | — | M |
| 4 | Add Zod schema validation to all API routes | — | M |
| 5 | Protect POST `/api/cron/snapshot` with auth check | — | XS |
| 6 | Mandate AUTH_JWT_SECRET and CRON_SECRET (remove fallbacks) | — | XS |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Findings #7, #8, #11, #12
- Cron sync route: `src/app/api/cron/sync/route.ts`
- Snapshot route: `src/app/api/cron/snapshot/route.ts`
- Auth middleware: `src/middleware.ts`
- Slack client: `src/lib/slack.ts`
