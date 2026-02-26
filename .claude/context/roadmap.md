# Technical Roadmap — SFAI Dashboard

> Last updated: 2026-02-25

## Status Key
- **Done**: Implemented and verified
- **In Progress**: Currently being worked on
- **Planned**: Scheduled for implementation
- **Backlog**: Identified but not yet scheduled

---

## Phase 1: Foundation (Done)

| Item | Status | Notes |
|------|--------|-------|
| Project scaffolding (Next.js, Prisma, Vercel) | Done | |
| Database schema design | Done | 7 models |
| JWT authentication | Done | Password-based, 30-day sessions |
| Middleware route protection | Done | |

## Phase 2: Core Integrations (Done)

| Item | Status | Notes |
|------|--------|-------|
| Google Sheets CSV import | Done | Public link CSV export |
| Mercury bank API integration | Done | Transaction sync + auto-reconciliation |
| Linear GraphQL integration | Done | Workload aggregation |
| Vercel cron jobs | Done | Monthly snapshot, daily bank sync |

## Phase 3: Dashboard Pages (Done)

| Item | Status | Notes |
|------|--------|-------|
| Overview page with metrics | Done | |
| Sales & Revenue page | Done | Revenue matrix, unreconciled txns |
| Margins page | Done | P&L, time allocation, margin table |
| Capacity Planning page | Done | Roster, chart, demand forecast |
| Settings page | Done | Customer mapping, team config, integration status |

## Phase 4: Data Quality & Polish (Planned)

| Item | Status | Notes |
|------|--------|-------|
| Seed database with real team & customers | Planned | |
| Test integrations with production credentials | Planned | |
| Error states and loading skeletons | Planned | |
| Customer alias management improvements | Planned | Cross-system name resolution |
| Forecast accuracy tracking refinement | Planned | Compare monthly snapshots |

## Phase 5: Advanced Features (Backlog)

| Item | Status | Notes |
|------|--------|-------|
| Short-term (2-week) demand forecast | Backlog | Distinct from long-term |
| Notification / alert system | Backlog | Beyond unreconciled txn count |
| Time tracking integration or improvement | Backlog | Alternative to retrospective % |
| Customer renaming / brand change history | Backlog | |
| Export reports (PDF / CSV) | Backlog | |
| Notion sync for roadmap | Backlog | Keep roadmap in sync |

---

## Divergence Log

| Date | Item | Expected (Roadmap) | Actual (Implementation) | Justification |
|------|------|---------------------|-------------------------|---------------|
| — | — | — | — | No divergences recorded yet |

> **Requirement**: Roadmap (Notion) ↔ Figma designs ↔ Implementation must not diverge. Flag any discrepancies here.
