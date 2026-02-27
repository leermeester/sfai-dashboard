# Add health check endpoint

## Context

Part of Reliable Data Pipeline (parent). No `/api/health` endpoint exists. There's no way to verify the system is operational without manually navigating the dashboard.

## Task

Create a `GET /api/health` endpoint that checks database connectivity and returns status. This endpoint should be publicly accessible (no auth required) so it can be used by external monitoring.

## Acceptance Criteria

- [ ] `GET /api/health` returns `{ status: "ok", db: "connected", timestamp: "..." }` when healthy
- [ ] Returns `{ status: "degraded", db: "error", error: "..." }` with HTTP 503 when DB is unreachable
- [ ] Endpoint is excluded from auth middleware (add to public path list)
- [ ] Response includes `uptime` in seconds

## Pointers

- `src/middleware.ts:14-22` — public path list; add `/api/health`
- `src/lib/db.ts` — Prisma client for DB connectivity check (use `db.$queryRaw`)
