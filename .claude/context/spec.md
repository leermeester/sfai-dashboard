# Specification — SFAI Dashboard

> Last updated: 2026-02-26

## 1. Purpose

Internal company dashboard for SFAI Labs with three core pillars:
1. **Capacity Planning** — track team utilization and forecast demand
2. **Margin Calculation** — per-customer profitability analysis
3. **Revenue & Pipeline Overview** — sales metrics, forecasts, and bank reconciliation

Access is restricted to co-founders only (Arthur, DJ).

---

## 2. Pages & Features

### 2.1 Overview (`/`)
| Feature | Status | Notes |
|---------|--------|-------|
| Monthly Revenue metric card | Implemented | Pulls from SalesSnapshot |
| Team Utilization metric card | Implemented | Based on TimeAllocation |
| Average Margin metric card | Implemented | From MonthlyMargin |
| Alerts metric card | Implemented | Unreconciled txns count |
| Getting Started checklist | Implemented | Setup guide for first run |

### 2.2 Sales & Revenue (`/sales`)
| Feature | Status | Notes |
|---------|--------|-------|
| Revenue matrix (customer x month) | Implemented | Google Sheets → SalesSnapshot |
| Unreconciled bank transactions | Implemented | Mercury → BankTransaction |
| Forecast accuracy chart | Implemented | Compares snapshots over time |
| Manual sync button | Implemented | Triggers sheet + Mercury sync |

### 2.3 Margins (`/margins`)
| Feature | Status | Notes |
|---------|--------|-------|
| Per-customer profitability table | Implemented | Revenue - engineering cost, with expandable engineer drill-down |
| P&L summary cards | Implemented | Total rev, cost, margin, margin % |
| Engineer cost matrix | Implemented | Engineer × customer attributed cost table |
| Margin trend chart | Implemented | Monthly margin over time |
| Time allocation form | Removed | Replaced by automated bank payment × Linear ticket attribution |

### 2.4 Capacity Planning (`/capacity`)
| Feature | Status | Notes |
|---------|--------|-------|
| Team roster table | Implemented | Name, role, rate, cost, active status |
| Capacity vs Demand chart | Implemented | Ticket-based (per member, stacked by customer) |
| Demand forecast form | Implemented | Ticket-based input, short-term (2 weeks) |
| Engineer throughput tracking | Implemented | ticketsPerWeek derived from billed hours + Linear completions |
| Client meeting hours table | Implemented | Team member × customer matrix from Google Calendar |
| Calendar sync button | Implemented | Manual trigger for calendar data sync |
| CLI capacity planning | Implemented | `sfai capacity` with status/plan/adjust/throughput subcommands |

### 2.5 Settings (`/settings`)
| Feature | Status | Notes |
|---------|--------|-------|
| Customer name mapping | Implemented | Maps names across Sheets, Mercury, Linear + email domain |
| Team member configuration | Implemented | Roles, rates, costs, Linear user IDs |
| Integration status panel | Implemented | Connection test for all APIs (incl. Calendar) |

---

## 3. Integrations

| System | Purpose | Method | Status |
|--------|---------|--------|--------|
| Google Sheets | Revenue data (customer x month) | CSV export via public link | Implemented |
| Mercury | Bank transactions for reconciliation | REST API (Bearer token) | Implemented |
| Linear | Team workload, project mapping | GraphQL API | Implemented |
| Google Calendar | Client meeting time tracking | Apps Script → Sheet → CSV | Implemented |
| PostgreSQL (Vercel) | Persistent storage | Prisma ORM | Implemented |

---

## 4. Automated Jobs (Vercel Cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/snapshot` | 1st of each month at 00:00 UTC | Snapshot Google Sheets revenue data |
| `/api/cron/sync` | Daily at 08:00 UTC | Sync Mercury bank transactions |
| `/api/cron/calendar` | Daily | Sync Google Calendar meetings |

---

## 5. Authentication

- Password-based login (bcrypt hash in `.env`)
- JWT session tokens (30-day expiry) stored in `sfai-session` httpOnly cookie
- Middleware protects all routes except `/login`, `/api/auth`, static assets
- Cron routes protected by `CRON_SECRET` bearer token

---

### 2.6 Resolution Queue (`/resolution`)
| Feature | Status | Notes |
|---------|--------|-------|
| Card-stack approval UI | Implemented | Review suggested matches one-by-one |
| Keyboard shortcuts (y/n/s) | Implemented | Approve, reject, skip |
| Type filter tabs | Implemented | All / Unmatched Income / Engineer Splits (simplified from 5 types to 2) |
| Stats banner | Implemented | Pending, auto-resolved, confirmed counts |
| Sidebar badge | Implemented | Shows pending count |
| Slack bot integration | Implemented | Daily digest + inline action buttons |
| CLI tool (`sfai match`) | Implemented | Interactive triage with batch mode, alternative picker, rich context, undo |
| CLI health (`sfai health`) | Implemented | Reconciliation completeness, confidence distribution, actionable nudges |
| CLI proposals (`sfai proposals`) | Implemented | Review auto-generated rule proposals |
| CLI rules (`sfai rules`) | Implemented | List, audit, deactivate matching rules |
| Voice endpoints | Implemented | TTS prompts + intent parsing for Whisper |
| Proposal engine | Implemented | Generates alias + suppression proposals from resolution decisions |
| System learning | Implemented | Alias and suppression proposals only (vendor/domain removed) |

**Resolution types (simplified):**
- `customer_match` — Unmatched incoming bank transactions → match to customer
- `engineer_split` — Multi-engineer platform payments (Upwork/Deel) → split across team members

**Removed types (handled automatically):**
- ~~`vendor_categorize`~~ — Outgoing txns now auto-categorized: engineer (team member match) / software (known list) / overhead (everything else)
- ~~`domain_classify`~~ — Users classify domains in Settings > Domains
- ~~`sheet_customer`~~ — Users fix sheet name mismatches in Settings > Customers

---

## 6. Data Model Summary

| Model | Purpose |
|-------|---------|
| `TeamMember` | Staff: name, role, rate, cost, Linear user ID, Mercury counterparty (soft delete via isActive) |
| `Customer` | Clients with name mappings (display, sheets, bank, linear, aliases) (soft delete via isActive) |
| `SalesSnapshot` | Monthly revenue snapshots from Google Sheets (unique on customerId+month) |
| `BankTransaction` | Mercury transactions with reconciliation status |
| `TimeAllocation` | % of team member time per customer per month |
| `DemandForecast` | Tickets needed per customer per week (weekStart-based) |
| `EngineerThroughput` | Monthly billed hours + completed tickets per engineer (for throughput rate) |
| `MonthlyMargin` | Computed: revenue, cost, margin per customer per month |
| `ClientMeeting` | Calendar meetings mapped to customer × team member |
| `ResolutionItem` | Entity resolution queue: unmatched entities with suggested matches and resolution status |
| `ResolutionAuditLog` | Audit trail for resolution decisions (entity, field, old/new values) |
| `DomainMapping` | Maps email domains to meeting types and customers |
| `EngineerPayment` | Links bank transactions to team members with attributed amount |
| `EngineerCostAllocation` | Computed: per-engineer cost attribution per customer per month |
| `VendorCategoryRule` | Maps vendor patterns to cost categories |
| `SystemProposal` | Staged rule proposals generated by the proposal engine (pending → approved/rejected) |
| `SystemRule` | Active matching rules with type, source, hit count, and governance tracking |

---

## 7. Open / Not Yet Implemented

- [ ] Monthly sales forecast snapshots for accuracy tracking (cron runs monthly, but comparison UI is basic)
- [ ] Short-term (2-week) vs long-term demand forecast differentiation in UI
- [x] ~~Retrospective mechanism for time allocation~~ (replaced by automated engineer cost attribution from bank transactions × Linear tickets)
- [ ] Seed "SFAI Internal" pseudo-customer for internal ticket cost tracking
- [x] ~~Customer alias file linking names across email, spreadsheet, bank, Linear, colloquial usage~~ (replaced by Resolution Queue)
- [x] ~~Notifications / alerts system beyond unreconciled transaction count~~ (Slack bot + resolution queue badge)
