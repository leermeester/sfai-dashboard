# Build Roadmap Capacity tab UI

## Context

Part of roadmap-based capacity estimation (parent). With the API serving roadmap capacity data (#5), we need a new "Roadmap" tab on the Capacity page that shows the full-timeline view: milestones per customer from Notion, ticket counts from GitHub, estimated hours (tickets × 0.5h), and variance against Linear actuals.

## Task

Add a top-level Tabs wrapper to the Capacity page with two tabs: "Weekly" (existing content) and "Roadmap" (new). Build the roadmap tab as a Server Component that fetches data from `GET /api/roadmap` and renders per-customer collapsible sections grouped by release, with a summary row at the top. Add a manual sync button.

## Acceptance Criteria

- [ ] Capacity page has "Weekly" and "Roadmap" tabs; "Weekly" contains all existing content unchanged
- [ ] Roadmap tab shows summary cards: Total Planned Hours, Completed Hours, Remaining Hours, Weeks of Work
- [ ] Per-customer sections are collapsible, showing milestones grouped by release group
- [ ] Each milestone row shows: name, timeline (weeks), ticket count, estimated hours (tickets × 0.5h), Linear actuals count
- [ ] Unmatched ticket folders (no Notion milestone) appear in a separate "Unmatched" section per customer
- [ ] Manual "Sync Roadmap" button triggers `POST /api/roadmap/sync` and refreshes the page
- [ ] Customers with no `notionDatabaseId` or `githubRepo` show "Not configured" instead of empty data

## Watch Out For

- **Tabs component is already used**: The capacity page already uses `Tabs` for meeting hours and demand forecast (nested). Adding a page-level Tabs wrapper means Tabs-within-Tabs. Use distinct `defaultValue` props and ensure the outer tabs wrapper uses a different styling/size to visually distinguish from inner tabs.
- **Server Component data fetching**: The existing capacity page is an `async function` Server Component that queries the DB directly. The roadmap tab should follow the same pattern — query `RoadmapMilestone` and `TicketSnapshot` directly via Prisma, not via a fetch to `/api/roadmap`. Reserve the API route for cron and external access.

## Pointers

- `src/app/(dashboard)/capacity/page.tsx` — main page to modify; wrap existing JSX in TabsContent
- `src/app/(dashboard)/capacity/page.tsx:10` — already imports `Tabs, TabsContent, TabsList, TabsTrigger`
- `src/components/forms/sync-button.tsx` — pattern for the manual sync button (client component with loading state)
- `src/components/tables/margin-table.tsx` — reference for collapsible per-customer sections (if applicable)
- `src/lib/roadmap-sync.ts` — `computeRoadmapCapacity()` for the data shape
- `src/lib/roadmap-config.ts` — `HOURS_PER_TICKET = 0.5`
- shadcn/ui `Collapsible` or `Accordion` component for per-customer sections
