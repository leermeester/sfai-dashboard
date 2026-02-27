# Protect POST `/api/cron/snapshot` with auth check

## Context

Part of Reliable Data Pipeline (parent). The GET handler on `/api/cron/snapshot` checks `CRON_SECRET`, but the POST handler has no auth check at all. Anyone can trigger snapshot creation by calling POST directly.

## Task

Add the same `CRON_SECRET` bearer token check to the POST handler. Also add the same check to any other POST handlers in cron routes that are missing it.

## Acceptance Criteria

- [ ] `POST /api/cron/snapshot` requires `Authorization: Bearer ${CRON_SECRET}` or valid session cookie
- [ ] Unauthenticated POST returns 401
- [ ] All other cron route POST handlers also have auth checks

## Pointers

- `src/app/api/cron/snapshot/route.ts` — POST handler (lines 31+) is missing auth; GET handler (lines 6-12) has the pattern to copy
