# Progress Log — SFAI Dashboard

> Last updated: 2026-02-25

## Current State

**Version**: v1 (dashboard v1 — commit `fb53eae`)

The dashboard v1 is feature-complete with all core pages and integrations implemented.

---

## Completed

### Infrastructure
- [x] Next.js 16 project scaffolding with TypeScript
- [x] Prisma schema with 7 models (TeamMember, Customer, SalesSnapshot, BankTransaction, TimeAllocation, DemandForecast, MonthlyMargin)
- [x] Vercel Postgres integration
- [x] JWT-based authentication with bcrypt password
- [x] Middleware protecting all routes
- [x] Vercel cron jobs (monthly snapshot, daily Mercury sync)

### Integrations
- [x] Google Sheets CSV export + revenue matrix parser
- [x] Mercury REST API client with transaction sync + auto-reconciliation
- [x] Linear GraphQL client with workload aggregation

### Pages
- [x] Overview dashboard with metric cards and getting started guide
- [x] Sales & Revenue page with revenue matrix, unreconciled txns, forecast chart
- [x] Margins page with P&L summary, time allocation form, margin table + chart
- [x] Capacity page with team roster, capacity vs demand chart, forecast form
- [x] Settings page with customer mapping, team config, integration status

### Components
- [x] shadcn/ui component library integrated
- [x] Revenue matrix table
- [x] Margin table
- [x] Team roster table
- [x] Unreconciled transactions table
- [x] All configuration forms (customer, team, allocation, demand)
- [x] Charts (capacity, margin trend, forecast accuracy)
- [x] App sidebar navigation

---

## Just Completed (2026-02-25)

### Data Population
- [x] Database tables created via `prisma db push`
- [x] Sheet parser rewritten to handle SFAI's actual spreadsheet structure (year-less month headers, customer section detection, noise filtering)
- [x] Seed script created (`prisma/seed.ts`) — auto-discovers customers from Google Sheets and team from Linear
- [x] 24 customers seeded from Google Sheets revenue data
- [x] 10 team members seeded from Linear (SFAI team)
- [x] 85 sales snapshots created (Aug 2025 – Jun 2026; pre-August data excluded as unreliable)
- [x] 44 Mercury bank transactions synced, 10 auto-reconciled
- [x] Stripe payout detection added to `mercury.ts` — tags 11 Stripe payouts for manual reconciliation
- [x] Bank name mappings set: Omnicell→Omnicell Inc, Valencia→VALENCIA REALTY, Becht→BECHT ENGINEERIN, Alvamed→ALVAMED INC, EchoFam→VSV VENTURES, Nouri→J&B Health LLC, Yachet Master Hub→oceanfront ventures group

---

### Google Calendar Integration (2026-02-25)
- [x] Prisma schema: added `ClientMeeting` model with `meetingType` field ("client", "sales", "internal")
- [x] Prisma schema: `customerId` is nullable (null for internal/sales meetings)
- [x] Prisma schema: added `emailDomain` field to `Customer` for attendee domain matching
- [x] Prisma schema: added `externalDomains` array field for visibility
- [x] Google Apps Script (`scripts/google-apps-script-calendar.js`) — exports ALL calendar events (internal + external)
- [x] Calendar integration library (`src/lib/calendar.ts`) — categorizes meetings by type based on attendee domains
- [x] API routes: `POST /api/calendar` (manual sync), `GET /api/calendar?test=true`, `GET /api/cron/calendar`
- [x] Capacity page: tabbed meeting hours view (Client / Sales / Internal)
  - Client tab: team member × customer matrix
  - Sales tab: per-member summary (unmatched external domains = prospects)
  - Internal tab: per-member summary
- [x] `emailDomain` field added to Settings > Customers form
- [x] Calendar added to integration status panel in Settings

## In Progress

- [ ] Reconcile 11 Stripe payouts ($87.5k) via dashboard UI
- [ ] Set `monthlyCost` for 10 team members (needed for margin calculations)
- [ ] Set `role` for team members (all default to "engineer")
- [ ] Map `linearProjectId` for customers (needed for capacity planning)
- [ ] Deploy Apps Script + set `GOOGLE_CALENDAR_SHEET_ID` env var
- [ ] Set `emailDomain` for each customer in Settings

---

## Next Up

- [ ] Verify cron jobs run correctly on Vercel
- [ ] UI polish and error state handling
- [ ] Time allocation entry for margin calculations
- [ ] Demand forecast input for capacity planning

---

## Blockers

- None currently identified
