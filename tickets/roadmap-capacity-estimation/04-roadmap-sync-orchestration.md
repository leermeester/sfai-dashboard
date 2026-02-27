# Build roadmap sync orchestration

## Context

Part of roadmap-based capacity estimation (parent). With the Notion and GitHub clients built (sub-issues #2 and #3) and the data models in place (#1), we need the orchestration layer that ties them together: sync Notion milestones + GitHub ticket counts into the DB, match ticket folders to milestones, and compute the aggregate roadmap capacity view.

## Task

Create `src/lib/roadmap-sync.ts` with functions to sync a single customer's roadmap data, sync all customers, match ticket folders to Notion milestones by name similarity, and compute the aggregate capacity view. The capacity model is: **1 ticket = 0.5 hours** (configured in `src/lib/roadmap-config.ts`). Forecast = ticket count × 0.5h. Actuals = Linear issues from existing `LinearSyncCache`.

## Acceptance Criteria

- [ ] `syncCustomerRoadmap(customerId)` fetches Notion milestones + GitHub tickets and upserts into `RoadmapMilestone` and `TicketSnapshot` tables
- [ ] `syncAllRoadmaps()` syncs all active customers that have both `notionDatabaseId` and `githubRepo` set
- [ ] Milestones no longer present in Notion are deleted from the DB on sync
- [ ] Ticket folders are matched to milestones by normalized name similarity (lowercase, strip special chars, token overlap ≥ 0.6)
- [ ] Unmatched folders are stored with `milestoneId: null` (shown separately in UI)
- [ ] `computeRoadmapCapacity()` returns per-customer view with milestones, ticket counts, estimated hours, and variance vs Linear actuals
- [ ] Every sync writes a `RoadmapSyncLog` entry (success or error, with duration)
- [ ] Errors for individual customers don't abort the full sync (fail-soft, log-and-continue)

## Watch Out For

- **Notion API key is shared**: All customer databases are accessed with the same `NOTION_API_KEY`. If one database returns 404 (not shared with integration), log an error and skip — don't abort other customers.
- **Serial, not parallel**: Sync customers sequentially to respect Notion and GitHub rate limits. The cron runs daily so latency isn't critical.
- **Linear actuals are coarse**: Linear issues are tracked at the customer project level (via `Customer.linearProjectId`), not at the milestone level. The "Done" column in the UI will show total completed issues for that customer, not per-milestone.

## Pointers

- `src/lib/notion.ts` — `fetchMilestones(databaseId)` (from sub-issue #2)
- `src/lib/github.ts` — `fetchTicketCounts(repo)` (from sub-issue #3)
- `src/lib/roadmap-config.ts` — `HOURS_PER_TICKET = 0.5`, `FOLDER_MATCH_THRESHOLD = 0.6`
- `src/lib/matching.ts` — existing fuzzy matching utilities; the `tokenOverlap()` function (around line 50-70) can be reused for folder-to-milestone name matching
- `src/lib/linear-sync.ts` — reference for how Linear issue counts are cached and queried
- `src/lib/db.ts` — Prisma client singleton
- `prisma/schema.prisma` — `RoadmapMilestone`, `TicketSnapshot`, `RoadmapSyncLog` models (from sub-issue #1)
