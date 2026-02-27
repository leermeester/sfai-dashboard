# Add roadmap-based capacity estimation — Forecast demand from upstream pipeline

## Context

Capacity planning currently uses a flat 40h/week per team member with manual demand forecasting. This doesn't reflect reality: the actual pipeline flows from Notion commercial roadmaps → Claude-generated specs → tickets in customer GitHub repos → Linear. Because AI handles most implementation, the real capacity proxy is **ticket count** (1 ticket = 30 min: 15 min work + 15 min debugging). We need the dashboard to look upstream — counting tickets in customer repos and reading Notion milestones — to forecast demand before work reaches Linear.

## Scope

- [ ] Customer settings extended with Notion database ID and GitHub repo
- [ ] Notion API client reads milestones from each customer's roadmap database
- [ ] GitHub API client counts ticket `.md` files in each customer's `tickets/` folder
- [ ] Daily cron syncs Notion milestones + GitHub ticket counts into dashboard DB
- [ ] New "Roadmap" tab on the Capacity page showing full-timeline capacity projection
- [ ] Forecast (ticket count × 0.5h) vs. actuals (Linear issues) with variance tracking
- [ ] Manual sync button for on-demand refresh

## Out of Scope

- Pushing tickets to Linear from the dashboard (separate workflow)
- Claude-powered hour estimation from Notion descriptions (future enhancement)
- Env var count as complexity risk signal (deferred)
- Writing back to Notion from the dashboard
- Per-milestone assignee/team-member attribution (all tickets contribute to customer-level demand)

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Extend Customer model with Notion + GitHub config | — | S |
| 2 | Create Notion API client | — | M |
| 3 | Create GitHub API client | — | M |
| 4 | Build roadmap sync orchestration | #1, #2, #3 | M |
| 5 | Add roadmap API routes and cron job | #4 | S |
| 6 | Build Roadmap Capacity tab UI | #5 | M |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Plan: `.claude/plans/mutable-nibbling-lobster.md`
- Existing capacity page: `src/app/(dashboard)/capacity/page.tsx`
- Existing sync patterns: `src/lib/mercury.ts`, `src/lib/calendar.ts`
- Existing cron pattern: `src/app/api/cron/calendar/route.ts`
- Customer mapping form: `src/components/forms/customer-mapping-form.tsx`
- Notion API docs: https://developers.notion.com/reference/post-database-query
