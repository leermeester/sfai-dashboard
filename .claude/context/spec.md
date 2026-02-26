# Specification — SFAI Dashboard

> Last updated: 2026-02-25

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
| Per-customer profitability table | Implemented | Revenue - engineering cost |
| P&L summary cards | Implemented | Total rev, cost, margin, margin % |
| Time allocation form | Implemented | Retrospective % allocation per team member |
| Margin trend chart | Implemented | Monthly margin over time |

### 2.4 Capacity Planning (`/capacity`)
| Feature | Status | Notes |
|---------|--------|-------|
| Team roster table | Implemented | Name, role, rate, cost, active status |
| Capacity vs Demand chart | Implemented | Allocated hours per member |
| Demand forecast form | Implemented | Short-term (2 weeks) and long-term forecasts |
| Client meeting hours table | Implemented | Team member × customer matrix from Google Calendar |
| Calendar sync button | Implemented | Manual trigger for calendar data sync |

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

## 6. Data Model Summary

| Model | Purpose |
|-------|---------|
| `TeamMember` | Staff: name, role, rate, cost, Linear user ID |
| `Customer` | Clients with name mappings (display, sheets, bank, linear, aliases) |
| `SalesSnapshot` | Monthly revenue snapshots from Google Sheets |
| `BankTransaction` | Mercury transactions with reconciliation status |
| `TimeAllocation` | % of team member time per customer per month |
| `DemandForecast` | Hours needed per customer (short-term / long-term) |
| `MonthlyMargin` | Computed: revenue, cost, margin per customer per month |
| `ClientMeeting` | Calendar meetings mapped to customer × team member |

---

## 7. Open / Not Yet Implemented

- [ ] Monthly sales forecast snapshots for accuracy tracking (cron runs monthly, but comparison UI is basic)
- [ ] Customer alias file linking names across email, spreadsheet, bank, Linear, colloquial usage
- [ ] Retrospective mechanism for time allocation (currently manual form only)
- [ ] Short-term (2-week) vs long-term demand forecast differentiation in UI
- [ ] Notifications / alerts system beyond unreconciled transaction count
