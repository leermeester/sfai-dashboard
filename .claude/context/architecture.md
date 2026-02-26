# Architecture — SFAI Dashboard

> Last updated: 2026-02-25

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

---

## 2. Directory Structure

```
sfai-dashboard/
├── .claude/                    # AI context, skills, agents
│   ├── context/                # Spec, architecture, business, etc.
│   ├── skills/                 # Local and shared PM-OS skills
│   └── agents/                 # Agent configurations
├── prisma/
│   └── schema.prisma           # Database schema (7 models)
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
│   │       └── demand-forecast/# Demand forecast CRUD
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── layout/             # Sidebar, shell
│   │   ├── tables/             # Revenue matrix, margin, roster, txns
│   │   ├── forms/              # Config forms, sync button
│   │   └── charts/             # Capacity, margin trend, forecast accuracy
│   ├── lib/
│   │   ├── auth.ts             # JWT + bcrypt utilities
│   │   ├── db.ts               # Prisma singleton
│   │   ├── sheets.ts           # Google Sheets CSV fetch + parse
│   │   ├── linear.ts           # Linear GraphQL client
│   │   ├── mercury.ts          # Mercury REST client
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

### Capacity Pipeline
```
Linear GraphQL API
  → /api/linear
    → getWorkload() groups issues by assignee
      → Display in capacity chart

Manual input (Settings)
  → TeamMember, TimeAllocation, DemandForecast
    → Capacity vs Demand visualization
```

### Margin Calculation
```
SalesSnapshot (revenue)
  + TimeAllocation (% time per customer per month)
    + TeamMember (monthlyCost / hourlyRate)
      → MonthlyMargin (revenue - engineeringCost = margin)
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
- `parseRevenueMatrix()` extracts customer x month grid
- Month formats supported: `YYYY-MM`, `Jan 2026`, `MM/YYYY`

### Mercury (`src/lib/mercury.ts`)
- REST API at `https://api.mercury.com/api/v1`
- Bearer token auth
- `syncTransactions()` pulls last 90 days, matches counterparty to customers
- Auto-reconciles on name match

### Linear (`src/lib/linear.ts`)
- GraphQL API at `https://api.linear.app/graphql`
- Queries: teams, projects, active issues, team members, workload
- `getWorkload()` aggregates issues/points/projects by assignee

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| CSV export instead of Sheets API | Simpler auth (public link), no OAuth needed |
| Monthly snapshots via cron | Enables forecast accuracy comparison over time |
| % time allocation (not hours) | Easier retrospective estimate without time tracking |
| Customer alias system | Same customer has different names in Sheets, Mercury, Linear |
| Single password auth | Only 2 users (co-founders); simple and secure enough |
| Vercel Postgres | Zero-config with Vercel deployment |
| Server Components by default | Reduces client JS; data fetching at component level |
