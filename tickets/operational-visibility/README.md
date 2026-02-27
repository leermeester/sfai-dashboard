# Build operational visibility — Logging, monitoring, and performance

## Context

The system has zero observability: no logging, no error tracking, no metrics, no health checks. When syncs fail or data goes stale, co-founders don't know until they manually check. Database queries lack composite indexes for common query patterns, and sync operations use sequential writes that will timeout at scale.

## Scope

- [ ] Structured logging with correlation IDs on sync operations
- [ ] Error tracking integration (Sentry)
- [ ] Composite database indexes for common query patterns
- [ ] Batch database writes in Mercury and Calendar sync loops

## Out of Scope

- Full APM/distributed tracing (OpenTelemetry)
- Custom metrics dashboard
- Queue-based async processing
- Performance profiling

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Add structured logging to sync operations | — | M |
| 2 | Add Sentry error tracking | — | S |
| 3 | Add composite database indexes | — | S |
| 4 | Batch database writes in sync loops | — | M |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Finding #15
- Mercury sync: `src/lib/mercury.ts:67-230`
- Calendar sync: `src/lib/calendar.ts`
- Prisma schema: `prisma/schema.prisma`
