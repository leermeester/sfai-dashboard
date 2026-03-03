# Progress Log — SFAI Dashboard

> Last updated: 2026-02-26

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

### Resolution Queue System (2026-02-26)
- [x] `ResolutionItem` Prisma model with unique constraint on type + sourceEntity
- [x] Fuzzy matching engine (`src/lib/matching.ts`) — Levenshtein, token overlap, substring, combined confidence
- [x] Resolution queue CRUD (`src/lib/resolution-queue.ts`) — create, get pending, resolve with side effects
- [x] REST API endpoints: `GET /api/resolution`, `POST /api/resolution/[id]/resolve`, `GET /api/resolution/stats`
- [x] Integrated matching into Mercury sync (unmatched incoming → customer_match; outgoing auto-categorized as engineer/software/overhead)
- [x] Auto-resolution for customer_match at confidence ≥ 95%; engineer_split never auto-resolves
- [x] Dashboard UI (`/resolution`) — card-stack approval with keyboard shortcuts (y/n/s), type filter tabs, stats banner
- [x] Sidebar badge showing pending resolution count
- [x] Slack bot (`src/lib/slack.ts`) — daily digest with Block Kit interactive messages, button-click resolution
- [x] Slack API routes (`/api/slack/events`, `/api/slack/notify`) with signature verification
- [x] Cron sync triggers Slack notification when SLACK_BOT_TOKEN is configured
- [x] CLI tool (`cli/`) — `sfai status`, `sfai match`, `sfai sync` with @clack/prompts interactive UI
- [x] Voice endpoints (`/api/voice/session`, `/api/voice/respond`) — TTS prompt generation + transcript intent parsing
- [x] Updated `.env.example` with Slack env vars

### Testing Infrastructure (2026-02-26)
- [x] Vitest 2.x testing framework installed with vite-tsconfig-paths for `@/` alias resolution
- [x] `vitest.config.ts` created with node environment and `src/**/*.test.ts` include pattern
- [x] `npm test` (vitest run) and `npm run test:watch` (vitest) scripts added to package.json
- [x] Smoke test verifying framework works
- [x] 31 unit tests for matching engine (`src/lib/__tests__/matching.test.ts`)
  - matchCustomer: bankName match, alias match, fuzzy displayName, no match, empty input, Stripe payout rejection, sort order
  - classifyDomain: known emailDomain, SFAI internal, ignore domains, unknown->sales, existing mappings, empty input, domain-to-company heuristic
  - categorizeVendor: exact rule match, keyword heuristic, fallback heuristic, empty input, no match, software keyword
  - matchSheetCustomer: spreadsheetName exact, displayName exact, alias exact, fuzzy, no match, empty input
  - AUTO_RESOLVE_THRESHOLDS: all 4 type thresholds + default threshold
- [x] 28 unit tests for CSV parsing (`src/lib/__tests__/csv-parsing.test.ts`)
  - parseCsv: simple CSV, quoted commas, embedded quotes, empty cells, empty input, no trailing newline, CRLF
  - normalizeMonth: YYYY-MM passthrough, "Jan 2026", "January 2026", "Jan '26", "08/2026", bare month with defaultYear, invalid, empty, bracket annotations, single-digit month
  - parseAmount: $1,000, decimal, $1,000,000, non-numeric, empty, negative
  - parseRevenueMatrix: valid matrix, year rollover, section terminators, skip names, single-row
- [x] Exported `parseCsv`, `normalizeMonth`, `parseAmount` from `sheets.ts` (were private; now exported for testability)
- [x] GitHub Actions CI workflow (`.github/workflows/ci.yml`) — lint, typecheck, test on push/PR to main
- [x] All 60 tests passing

### Hardening & Quality (2026-02-26)

#### Operational Visibility
- [x] Structured logging utility (`src/lib/logger.ts`) — JSON logs with correlation IDs
- [x] Composite indexes on BankTransaction, ClientMeeting, ResolutionItem
- [x] Batch database writes in Mercury + Calendar sync (groups of 50)
- [x] Sentry error tracking setup (client, server, edge configs)

#### Reliable Data Pipeline
- [x] Slack alerts on cron sync failure (`sendErrorAlert` in slack.ts)
- [x] Health check endpoint (`/api/health`) — DB ping + uptime
- [x] Retry logic with exponential backoff (`src/lib/fetch-with-retry.ts`) — 3 retries, 15s timeout
- [x] Zod validation on all API routes (`src/lib/validations.ts` with 11 schemas + `validateBody` helper)
- [x] Snapshot POST endpoint protected with auth
- [x] Production mandates `AUTH_JWT_SECRET` and `CRON_SECRET` (dev uses fallbacks)

#### Safe Configuration
- [x] Soft deletes for Customer and TeamMember (isActive flag instead of hard delete)
- [x] Cascade/SetNull rules on all foreign keys
- [x] Confirmation dialogs on destructive actions (AlertDialog on trash buttons)
- [x] Replaced all `window.location.reload()` with `router.refresh()`

#### Trustworthy Financials
- [x] Margin recalculation after resolution (customer_match + engineer_split)
- [x] Margin recalculation after manual bank reconciliation
- [x] Idempotent revenue snapshots via upsert (unique on customerId+month)
- [x] Transactional resolution with `$transaction` (status + side effects atomic)
- [x] Mercury sync protects manual reconciliation from overwrite

#### Validated Entity Resolution
- [x] Entity reference validation before resolution (`validateDecision`)
- [x] Per-type confidence thresholds (customer_match: 95, engineer_split: 100)
- [x] Resolution audit log (`ResolutionAuditLog` model + writes on every resolve)
- [x] Voice parser default changed from "approve" to "skip" (safety)
- [x] Aliases normalized to lowercase on save

---

### Engineer Cost Attribution (2026-02-26)
- [x] Prisma schema: `EngineerPayment` model linking BankTransaction to TeamMember with amount
- [x] Prisma schema: `EngineerCostAllocation` model for computed cost per (engineer, customer, month)
- [x] Prisma schema: `mercuryCounterparty` field on TeamMember for bank counterparty matching
- [x] `matchLaborTransactionsToEngineers()` in mercury.ts — matches outgoing labor transactions to engineers
- [x] `computeTicketDistribution()` in linear-sync.ts — monthly ticket count distribution per (engineer, customer)
- [x] Cost attribution engine (`src/lib/cost-attribution.ts`) — `recalculateCostAttribution()` combines bank payments with ticket distribution
- [x] `recalculateMargins()` updated to use EngineerCostAllocation instead of TimeAllocation
- [x] Resolution queue extended with `engineer_split` type for Upwork/bulk transaction splitting
- [x] `engineer_split` threshold set to 100 (never auto-resolves)
- [x] Zod schemas updated: teamMemberSchema, resolveDecisionSchema, resolutionQuerySchema
- [x] API routes updated: team settings, resolution resolve, cron sync
- [x] New API endpoint: `GET /api/engineer-costs?month=YYYY-MM`
- [x] Settings UI: "Mercury Counterparty" column in team config form
- [x] Resolution UI: EngineerSplitCard component with split form and validation
- [x] Resolution UI: "Engineer Splits" filter tab added
- [x] Margins page: TimeAllocationForm removed
- [x] Margins page: EngineerCostMatrix table added (engineer × customer attributed cost)
- [x] Margins page: MarginTable enhanced with expandable per-engineer drill-down
- [x] Feature spec written to `spec/SPEC.md`
- [x] Build passes with 0 TypeScript errors

---

### CLI UX Overhaul + System Learning (2026-02-26)

#### Enhanced CLI Match Command
- [x] Alternative customer picker — fuzzy search dropdown when rejecting a suggestion (no more switching to dashboard)
- [x] Batch approval mode — `sfai match --batch` groups high-confidence (≥80%) items for bulk approval
- [x] Confidence filter — `sfai match --min-confidence N` to focus on specific tiers
- [x] Rich context cards — confidence bar, transaction amounts, meeting details, vendor spend, team members
- [x] Pre-calculated engineer split suggestions — equal split and weighted-by-rate options
- [x] Progress counter — `[3/12]` per item, session summary at end
- [x] Undo tracking — session-level undo stack (API undo not yet wired)

#### New CLI Commands
- [x] `sfai health` — reconciliation completeness by month ($), pending queue size, confidence distribution, actionable nudges
- [x] `sfai proposals` — review and approve/reject auto-generated rule proposals
- [x] `sfai rules` — list active rules, `--stats` for usage stats, `--review` for interactive audit + deactivation

#### System Learning (Proposal Engine)
- [x] `SystemProposal` and `SystemRule` Prisma models
- [x] Proposal engine (`src/lib/proposal-engine.ts`) generates proposals after every resolution:
  - Alias proposals from customer_match confirmations
  - Suppression proposals from rejected matches (negative feedback)
- [x] Integrated into resolution-queue.ts (non-blocking, best-effort)
- [x] Proposal approval applies side effects (creates aliases, vendor rules, domain mappings)

#### API Endpoints
- [x] `GET /api/settings/customers` — customer list for CLI alternative picker
- [x] `GET /api/resolution/health` — rich health data (reconciliation completeness, confidence distribution, unreconciled amounts)
- [x] `GET /api/proposals` — list proposals by status
- [x] `POST /api/proposals/[id]/resolve` — approve/reject proposals with side effects
- [x] `GET /api/rules` — list active system rules
- [x] `PATCH /api/rules/[id]` — deactivate rules

#### Enhanced Sync Command
- [x] Proactive nudge after sync — shows pending count + suggests `sfai match --batch` when high-confidence items exist

---

### Resolution System Simplification (2026-02-26)

Reduced resolution queue from 5 types to 2 (`customer_match`, `engineer_split`). Outgoing transactions are now auto-categorized during Mercury sync without creating resolution items.

**Key insight**: Per-customer margin calculation (`revenue - engineeringCost`) never used vendor categorization data — only `EngineerPayment` records. Vendor resolution was producing data only used in P&L summary cards, not margins.

#### Changes
- [x] `mercury.ts` — Direct engineer matching during sync via `TeamMember.mercuryCounterparty`; `KNOWN_SOFTWARE` constant for software detection; everything else → "overhead"; `EngineerPayment` created directly during sync
- [x] `resolution-queue.ts` — Removed `domain_classify`, `vendor_categorize`, `sheet_customer` types and their `applyResolution` cases
- [x] `matching.ts` — Removed `classifyDomain()`, `categorizeVendor()`, `matchSheetCustomer()` functions; simplified thresholds
- [x] `proposal-engine.ts` — Removed `proposeVendorPattern()` and `proposeDomainMapping()` generators
- [x] `sheets.ts` — Unmatched names logged only (Settings > Customers to fix)
- [x] `calendar.ts` — Unmatched domains logged only (Settings > Domains to fix)
- [x] Resolution UI — Tabs reduced to All / Unmatched Income / Engineer Splits
- [x] `resolution-card.tsx` — Simplified to customer_match only (removed domain/vendor selectors)
- [x] `resolve/route.ts` — Removed `vendor_categorize` recalculation branch
- [x] `backfill/route.ts` — Only backfills `customer_match` items now
- [x] `validations.ts` — Updated resolution type enums; removed `meetingType`, `category` fields
- [x] Settings page — Removed "Cost Categories" tab
- [x] `slack.ts`, `voice.ts`, `cli/commands/match.ts` — Removed old type handling
- [x] Data migration script created: `prisma/migrate-resolution-simplify.ts`

#### Unchanged (already correct)
- `cost-attribution.ts` — Only uses `EngineerPayment` + Linear tickets
- `margins.ts` — Only uses `revenue - engineeringCost`
- Prisma schema — No model changes needed

---

### CLI Capacity Planning (2026-02-26)

Schema migration: replaced `DemandForecast.month + forecastType` with `weekStart: DateTime` + `source` field. Supports rolling 4-week horizon.

#### New Files
- [x] `src/lib/capacity-config.ts` — Constants: DEFAULT_WEEKLY_HOURS (40), DEFAULT_TICKETS_PER_WEEK (5)
- [x] `src/lib/capacity.ts` — Week utilities, throughput computation, Linear demand estimation (<30d filter), ticket-based status/plan
- [x] `src/app/api/capacity/status/route.ts` — GET team utilization + flagged issues for current week
- [x] `src/app/api/capacity/plan/route.ts` — GET last-week accuracy + auto-filled plan from Linear + throughput data
- [x] `src/app/api/capacity/forecast/route.ts` — PUT upsert forecasts with weekStart + ticketsNeeded
- [x] `src/app/api/capacity/confirm-week/route.ts` — POST batch-save a week's plan (ticketsNeeded + hoursNeeded)
- [x] `src/app/api/capacity/throughput/route.ts` — GET/PUT engineer throughput rates (billed hours + completed tickets)
- [x] `cli/commands/capacity.ts` — CLI command with 4 modes: status, plan, detail, throughput

#### Modified Files
- [x] `prisma/schema.prisma` — DemandForecast: weekStart + ticketsNeeded + source; new EngineerThroughput model; TeamMember.weeklyHours
- [x] `src/middleware.ts` — Added `/api/capacity` and `/api/settings` to bearer-token-allowed paths
- [x] `src/lib/validations.ts` — Added capacityForecastSchema (with ticketsNeeded), confirmWeekPayloadSchema
- [x] `cli/sfai.ts` — Registered `capacity` command
- [x] `src/app/(dashboard)/capacity/page.tsx` — Adapted to ticket-based display
- [x] `src/components/forms/demand-forecast-form.tsx` — Changed from hours to tickets
- [x] `src/components/charts/capacity-chart.tsx` — Ticket-based chart (removed hours unit, capacity reference line)
- [x] `src/app/api/demand-forecast/route.ts` — Legacy adapter converting forecastType to weekStart
- [x] `src/app/api/cron/forecast-rollover/route.ts` — Simplified to clean up old forecasts
- [x] `src/app/(dashboard)/page.tsx` — Updated forecast query to use weekStart

#### Ticket-Based Capacity Model
Capacity is measured in **tickets/week** with individual throughput rates:
- `ticketsPerWeek = completedTicketsLastMonth / (billedHoursLastMonth / weeklyHours)`
- Demand scoped to tickets created within last 30 days (filters out stale backlog)
- `EngineerThroughput` model stores monthly billed hours + auto-computed Linear ticket counts
- Fallback: DEFAULT_TICKETS_PER_WEEK (5) when no throughput data exists

#### CLI UX (`sfai capacity`)
- Status view: ticket-based utilization (assigned tickets / ticketsPerWeek capacity) + weeks of work queued
- Plan flow: auto-filled from Linear open tickets (<30d), shows throughput context per engineer
- Adjust flow: ticket input with review step (Save/Start over/Cancel), remove option
- Throughput subcommand: view/update billed hours per month, see computed rates
- Mid-week updates: always editable, no revision tracking

---

## In Progress

- [ ] Run data migration (`npx tsx prisma/migrate-resolution-simplify.ts`)
- [ ] Reconcile 11 Stripe payouts ($87.5k) via dashboard UI
- [ ] Set `mercuryCounterparty` for team members in Settings (needed for engineer cost matching)
- [ ] Create "SFAI Internal" pseudo-customer for internal ticket cost tracking
- [ ] Set `role` for team members (all default to "engineer")
- [ ] Map `linearProjectId` for customers (needed for capacity planning)
- [ ] Deploy Apps Script + set `GOOGLE_CALENDAR_SHEET_ID` env var
- [ ] Set `emailDomain` for each customer in Settings

---

## Next Up

- [ ] Configure Slack app and set SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_CHANNEL_ID
- [ ] Test resolution queue end-to-end: trigger sync → review items → verify side effects
- [ ] Verify cron jobs run correctly on Vercel
- [ ] Integrate suppression rules into matching engine (check SystemRule before suggesting)
- [ ] Confidence threshold proposals — track auto-resolve accuracy over time
- [ ] Edge case detection during sync (multi-match conflicts, revenue discrepancies)
- [ ] UI polish and error state handling

---

## Blockers

- None currently identified
