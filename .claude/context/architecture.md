# Architecture — SFAI Dashboard

> Last updated: 2026-02-26

## 1. Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | React (Server Components + Client) | 19.2.4 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL (Vercel Postgres) | — |
| ORM | Prisma | 6.19.2 |
| Styling | Tailwind CSS | 4.2.1 |
| UI Components | shadcn/ui (Radix primitives) | — |
| Charts | Recharts | — |
| Icons | Lucide React | — |
| Auth | bcryptjs + jose (JWT) | — |
| Validation | Zod | — |
| Deployment | Vercel | — |
| Dev server | Next.js Turbopack | — |
| Testing | Vitest | 2.x |
| CI | GitHub Actions | — |

---

## 2. Directory Structure

```
sfai-dashboard/
├── .claude/                    # AI context, skills, agents
│   ├── context/                # Spec, architecture, business, etc.
│   ├── skills/                 # Local and shared PM-OS skills
│   └── agents/                 # Agent configurations
├── prisma/
│   └── schema.prisma           # Database schema (8 models)
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # Authenticated route group
│   │   │   ├── page.tsx        # Overview
│   │   │   ├── sales/          # Sales & Revenue
│   │   │   ├── margins/        # Margin analysis
│   │   │   ├── capacity/       # Capacity planning
│   │   │   └── settings/       # Configuration
│   │   ├── login/              # Public login page
│   │   └── api/
│   │       ├── auth/           # Login/logout endpoints
│   │       ├── cron/           # Scheduled jobs (snapshot, sync)
│   │       ├── settings/       # CRUD for customers, team, allocations
│   │       ├── linear/         # Linear workload proxy
│   │       ├── mercury/        # Mercury account/txn proxy
│   │       ├── sheets/         # Google Sheets export test
│   │       ├── calendar/       # Google Calendar sync proxy
│   │       └── demand-forecast/# Demand forecast CRUD
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── layout/             # Sidebar, shell
│   │   ├── tables/             # Revenue matrix, margin, roster, txns
│   │   ├── forms/              # Config forms, sync button
│   │   └── charts/             # Capacity, margin trend, forecast accuracy
│   ├── lib/
│   │   ├── __tests__/          # Vitest unit tests
│   │   │   ├── smoke.test.ts
│   │   │   ├── matching.test.ts
│   │   │   └── csv-parsing.test.ts
│   │   ├── auth.ts             # JWT + bcrypt utilities
│   │   ├── db.ts               # Prisma singleton
│   │   ├── fetch-with-retry.ts # Retry with exponential backoff (3 retries, 15s timeout)
│   │   ├── logger.ts           # Structured JSON logging with correlation IDs
│   │   ├── cost-attribution.ts  # Engineer cost attribution engine (bank payments × ticket distribution)
│   │   ├── margins.ts          # Shared margin recalculation (uses cost-attribution)
│   │   ├── matching.ts         # Fuzzy matching engine + per-type thresholds
│   │   ├── resolution-queue.ts # Queue CRUD with transactional resolution + audit logging
│   │   ├── sheets.ts           # Google Sheets CSV fetch + parse
│   │   ├── calendar.ts         # Calendar sheet CSV fetch + meeting sync
│   │   ├── linear.ts           # Linear GraphQL client
│   │   ├── mercury.ts          # Mercury REST client
│   │   ├── slack.ts            # Slack Bot Kit messages + error alerts
│   │   ├── validations.ts      # Zod schemas for all API routes
│   │   ├── voice.ts            # Voice session TTS + intent parsing
│   │   └── utils.ts            # General utilities
│   └── types/                  # TypeScript type definitions
├── vercel.json                 # Cron job schedule
└── .env                        # Secrets (never committed)
```

---

## 3. Data Flow

### Revenue Pipeline
```
Google Sheets (manual updates)
  → CSV export (public link)
    → /api/cron/snapshot (monthly) or /api/sheets (manual)
      → parseRevenueMatrix()
        → SalesSnapshot table (customer x month x amount)
```

### Bank Reconciliation Pipeline
```
Mercury Bank API
  → /api/cron/sync (daily) or /api/mercury (manual)
    → syncTransactions()
      → Match counterparty → Customer (by bankName or aliases)
        → BankTransaction table (reconciled / unreconciled)
```

### Capacity Pipeline (Ticket-Based)
```
Engineer Throughput:
  EngineerThroughput (manual billed hours + auto Linear ticket count per month)
    → ticketsPerWeek = completedTickets / (billedHours / weeklyHours)
    → Per-engineer capacity rate

Demand Estimation:
  Linear GraphQL API
    → getActiveIssues() — started + unstarted tickets
      → Filter: created within last 30 days (excludes stale backlog)
        → Group by customer (via project mapping)
          → Ticket counts per customer (no hours conversion)

Capacity Status:
  assignedTickets (from DemandForecast) / ticketsPerWeek = utilization
  weeksOfWork = assignedTickets / ticketsPerWeek

API Routes:
  GET /api/capacity/status — per-engineer utilization + flagged issues
  GET /api/capacity/plan — auto-filled plan from Linear + throughput rates
  PUT /api/capacity/forecast — upsert ticket forecasts
  POST /api/capacity/confirm-week — batch-save confirmed plan
  GET/PUT /api/capacity/throughput — engineer throughput rates + billed hours

CLI: sfai capacity [status|plan|detail|throughput]
Dashboard: /capacity page with ticket-based chart + forecast form
```

### Calendar / Meeting Pipeline
```
Google Calendar (DJ + Arthur)
  → Google Apps Script (daily trigger)
    → Google Sheet (calendar events with attendee emails)
      → /api/cron/calendar (daily) or /api/calendar (manual)
        → syncMeetings() matches attendee email domains → Customer.emailDomain
          → ClientMeeting table (team member × customer × duration)
```

### Margin Calculation (Engineer Cost Attribution)
```
Mercury sync → BankTransaction (outgoing)
  → Direct match: counterpartyName → TeamMember.mercuryCounterparty → costCategory="engineer"
  → Known software list → costCategory="software"
  → Everything else → costCategory="overhead"
  → Direct engineer matches create EngineerPayment records immediately during sync
  → Multi-engineer platforms (Upwork/Deel) → engineer_split resolution item → manual split

Linear sync → Completed tickets by (assignee, project, month)
  → TicketDistribution (% of tickets per engineer per customer)

EngineerPayment.amount × TicketDistribution.percentage
  → EngineerCostAllocation (attributed cost per engineer per customer per month)
    → Sum per customer → MonthlyMargin.engineeringCost

SalesSnapshot / BankTransaction (revenue)
  - engineeringCost = margin
```

---

## 4. Authentication Architecture

```
Login Form → POST /api/auth → bcrypt.compare(password, hash)
  → Success: Set JWT in httpOnly cookie (sfai-session, 30d expiry)
  → Failure: 401

Middleware (every request):
  /login, /api/auth, /_next → pass through
  /api/cron/* → verify CRON_SECRET bearer token
  Everything else → verify JWT from sfai-session cookie
    → Invalid/missing → redirect to /login
```

---

## 5. External API Clients

### Google Sheets (`src/lib/sheets.ts`)
- Fetches CSV export via public URL (requires "Anyone with link" access)
- Custom CSV parser handles quoted fields
- `parseRevenueMatrix()` finds the "Customers" section header, then extracts customer x month revenue grid
- Month headers support: `YYYY-MM`, `Jan 2026`, `MM/YYYY`, and bare month names (year inferred from position, rolling over after December)
- Section terminators ("SFAI", "Product Engineers", etc.) stop parsing to avoid picking up team capacity data as customers

### Mercury (`src/lib/mercury.ts`)
- REST API at `https://api.mercury.com/api/v1`
- Bearer token auth
- `syncTransactions()` pulls last 90 days, matches counterparty to customers
- Auto-reconciles on name match

### Google Calendar (`src/lib/calendar.ts`)
- Reads ALL calendar events from a Google Sheet populated by Apps Script
- Same CSV export pattern as `sheets.ts` (public link, no OAuth)
- `syncMeetings()` categorizes each meeting:
  - **client** — external domain matches `Customer.emailDomain`
  - **sales** — external attendees present but no customer match (prospects)
  - **internal** — all attendees are @sfaiconsultants.com
- Creates one `ClientMeeting` per (event, team member) pair
- Team members matched by `TeamMember.email`
- Returns unmatched domains and per-type counts for visibility

### Linear (`src/lib/linear.ts`)
- GraphQL API at `https://api.linear.app/graphql`
- Queries: teams, projects, active issues, team members, workload
- `getWorkload()` aggregates issues/points/projects by assignee

---

## 7. Resolution Queue System

### Architecture
Mercury sync pipes unmatched **incoming** transactions through the matching engine and resolution queue. Outgoing transactions are auto-categorized (engineer/software/overhead) without resolution items. Only two resolution types remain: `customer_match` and `engineer_split`.

### Data Flow
```
Mercury Sync (incoming transactions)
  → Matching Engine (src/lib/matching.ts)
    → Levenshtein + token overlap + substring matching
      → Confidence scoring (0-100)
  → Resolution Queue (src/lib/resolution-queue.ts)
    → Auto-resolve customer_match if confidence ≥ 95%
    → engineer_split never auto-resolves (threshold: 100)
    → Queue pending items for human review
  → 4 Interfaces:
    ├─ Dashboard UI (/resolution) — card-stack approval
    ├─ Slack Bot (/api/slack/*) — guided messages with inline buttons
    ├─ CLI (cli/sfai.ts) — interactive terminal triage
    └─ Voice (/api/voice/*) — TTS prompts + intent parsing
  → Side Effects:
    → customer_match confirmed: updates Customer.bankName, reconciles BankTransaction
    → engineer_split resolved: creates EngineerPayment records
    → Feedback loop: resolved entities auto-match on next sync

Mercury Sync (outgoing transactions — no resolution items)
  → Direct match: counterpartyName → TeamMember.mercuryCounterparty → "engineer"
  → KNOWN_SOFTWARE list match → "software"
  → Everything else → "overhead"
```

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/matching.ts` | Fuzzy matching engine (Levenshtein, token overlap, substring) |
| `src/lib/resolution-queue.ts` | Queue CRUD: create, get pending, resolve with side effects + proposal generation |
| `src/lib/proposal-engine.ts` | Generates staged rule proposals from resolution decisions |
| `src/lib/slack.ts` | Slack Block Kit message builders + interaction handler |
| `src/lib/voice.ts` | Voice session prompts + transcript intent parsing |
| `src/app/api/resolution/` | REST endpoints: list, resolve, stats, health |
| `src/app/api/proposals/` | REST endpoints: list proposals, approve/reject |
| `src/app/api/rules/` | REST endpoints: list active rules, deactivate |
| `src/app/api/slack/` | Slack event handler + notification trigger |
| `src/app/api/voice/` | Voice session + response endpoints |
| `cli/` | Standalone CLI package (`sfai status/match/sync/health/proposals/rules`) |

### System Learning (Proposal Engine)
```
Resolution Decision (confirmed/rejected)
  → Proposal Engine (src/lib/proposal-engine.ts)
    → Generate staged proposals (non-blocking, best-effort):
      ├─ Alias proposals (customer_match → add counterparty as alias)
      └─ Suppression proposals (rejected → never suggest this match again)
    → SystemProposal table (status: pending)
  → User reviews via CLI (`sfai proposals`) or API
    → Approved → SystemRule created + side effects applied
    → Rejected → discarded
```

### Rule Governance
```
SystemRule table tracks all active rules:
  - type: alias, suppression
  - source: proposal-approved, user-created, seed-data
  - hitCount: how often the rule fires during matching
  - lastHitAt: when it last fired

CLI commands:
  - `sfai rules` — list all active rules grouped by type
  - `sfai rules --stats` — usage statistics, never-used rules
  - `sfai rules --review` — interactive audit + deactivate stale rules
```

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| CSV export instead of Sheets API | Simpler auth (public link), no OAuth needed |
| Monthly snapshots via cron | Enables forecast accuracy comparison over time |
| Bank payment × ticket distribution | Actual payments matched to engineers, distributed by Linear ticket completion |
| Customer alias system | Same customer has different names in Sheets, Mercury, Linear |
| Single password auth | Only 2 users (co-founders); simple and secure enough |
| Vercel Postgres | Zero-config with Vercel deployment |
| Server Components by default | Reduces client JS; data fetching at component level |
| Vitest for testing | Fast, native TypeScript, Vite ecosystem aligns with project tooling |
| Export private utils for testability | `parseCsv`, `normalizeMonth`, `parseAmount` exported from sheets.ts so unit tests can cover them directly |
| Soft deletes over hard deletes | Preserves referential integrity; cascade rules handle FKs |
| Zod validation at API boundary | Catches malformed payloads before DB operations; schemas in shared `validations.ts` |
| Structured JSON logging | Enables grep/jq filtering in production; correlation IDs trace requests across sync operations |
| Retry with exponential backoff | Handles transient 5xx/429 from Mercury, Sheets, Calendar APIs; 3 retries max |
| Batched DB writes (groups of 50) | Reduces transaction overhead in Mercury/Calendar sync (hundreds of upserts) |
| Per-type confidence thresholds | Different entity types have different false-positive risk profiles |
| Transactional resolution | Status update + side effects (bankName, domainMapping, etc.) are atomic via `$transaction` |
| router.refresh over page reload | Preserves React state, avoids full page flash |
| AlertDialog for destructive actions | Prevents accidental deletion of customers, team members, vendor rules |
