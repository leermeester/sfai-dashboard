# Add roadmap API routes and cron job

## Context

Part of roadmap-based capacity estimation (parent). With the sync orchestration built (#4), we need HTTP endpoints to serve the roadmap capacity data to the UI, trigger manual syncs, and run on a daily cron schedule.

## Task

Create three API routes: `GET /api/roadmap` (serves capacity view), `POST /api/roadmap/sync` (manual sync trigger), and `GET /api/cron/roadmap` (daily cron). Add the cron schedule to `vercel.json`. Add `/api/roadmap` to the middleware's bearer-token-allowed paths.

## Acceptance Criteria

- [ ] `GET /api/roadmap` returns the full `RoadmapCapacitySummary` JSON (customers with milestones, ticket counts, estimated hours, variance)
- [ ] `POST /api/roadmap/sync` triggers sync and returns results; optionally accepts `{ customerId }` to sync a single customer
- [ ] `GET /api/cron/roadmap` verifies `CRON_SECRET` bearer token before syncing
- [ ] Cron runs daily at 06:00 UTC (before Linear sync at 07:00 and Mercury at 08:00)
- [ ] Failed cron sends Slack error alert (when Slack is configured)
- [ ] `/api/roadmap` routes are accessible via session cookie (dashboard) and bearer token (cron/external)

## Watch Out For

- **Middleware path matching**: The middleware at `src/middleware.ts:36-43` uses `pathname.startsWith()` checks. Adding `/api/roadmap` there means both `/api/roadmap` and `/api/roadmap/sync` will match — which is correct, but verify that `POST /api/roadmap/sync` gets through.

## Pointers

- `src/app/api/cron/calendar/route.ts` — exact cron route pattern to follow (auth check, logger, try/catch, Slack alert)
- `src/middleware.ts:36-43` — bearer-token-allowed path list to extend
- `src/lib/roadmap-sync.ts` — `syncAllRoadmaps()`, `syncCustomerRoadmap()`, `computeRoadmapCapacity()` (from sub-issue #4)
- `src/lib/validations.ts` — add `roadmapSyncSchema` for POST body validation
- `vercel.json` — add cron entry after the existing ones
- `src/lib/slack.ts` — `sendErrorAlert()` for cron failure notifications
