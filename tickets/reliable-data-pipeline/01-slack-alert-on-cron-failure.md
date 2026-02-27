# Add Slack notification on cron sync failure

## Context

Part of Reliable Data Pipeline (parent). Cron jobs currently catch errors and return HTTP 500, but nobody is notified. Co-founders don't know data is stale until they manually check the dashboard.

## Task

When any cron sync fails (Mercury, Calendar, Snapshot), send a Slack alert to the configured channel with the error details. The existing `sendDailyDigest` pattern in the sync route shows how to conditionally use Slack — follow the same pattern but for error notifications.

## Acceptance Criteria

- [ ] Failed Mercury sync sends a Slack message with error details and timestamp
- [ ] Failed Calendar sync sends a Slack message with error details and timestamp
- [ ] Failed Snapshot creation sends a Slack message with error details and timestamp
- [ ] Alert message includes which sync failed, the error message, and a timestamp
- [ ] Slack notification failure does not mask the original sync error (error is still returned in HTTP response)

## Pointers

- `src/app/api/cron/sync/route.ts:36-40` — catch block where error alert should be sent
- `src/app/api/cron/snapshot/route.ts` — similar catch block
- `src/app/api/cron/calendar/route.ts` — similar catch block
- `src/lib/slack.ts` — existing Slack client; add a `sendErrorAlert(error, context)` function
