# Add structured logging to sync operations

## Context

Part of Operational Visibility (parent). The codebase has zero log statements. When syncs fail or produce unexpected results, there's no way to diagnose what happened. Structured logging with correlation IDs enables tracing a sync operation from start to finish.

## Task

Add a lightweight structured logging utility and instrument all sync operations (Mercury, Calendar, Sheets, Resolution) with log entries for start, completion, errors, and key metrics.

## Acceptance Criteria

- [ ] A `src/lib/logger.ts` utility that outputs structured JSON logs with `timestamp`, `level`, `message`, `correlationId`, and arbitrary `data` fields
- [ ] Mercury sync logs: start, account count, transaction count, reconciled count, resolution items created, duration, errors
- [ ] Calendar sync logs: start, event count, matched meetings, unmatched domains, duration, errors
- [ ] Sheet snapshot logs: start, cell count, matched customers, unmatched names, duration, errors
- [ ] Resolution resolve logs: item ID, type, decision, side effects applied, duration
- [ ] Cron routes include a `correlationId` (UUID) that's passed to all downstream log calls for that request
- [ ] Logs are written to `console.log` (picked up by Vercel's log stream)

## Pointers

- `src/lib/mercury.ts:67-230` — `syncTransactions()` — add logging around the main loop and result
- `src/lib/calendar.ts` — `syncMeetings()` — add logging
- `src/lib/sheets.ts:211-265` — `createSnapshot()` — add logging
- `src/lib/resolution-queue.ts:138-178` — `resolveItem()` — add logging
- `src/app/api/cron/sync/route.ts` — generate correlationId, pass to sync functions
