# SFAI Dashboard — Architecture Audit Report

> **Date**: 2026-02-26
> **Product Stage**: Pre-PMF (core features exist, validating with 2 co-founders)
> **Customer Context**: Internal operations dashboard for SFAI Labs — capacity planning, margin calculation, revenue & pipeline overview, entity resolution queue

---

## Customer Alignment

**Customer Priorities Identified:**
1. Margin Calculation — per-customer profitability (revenue - engineering cost)
2. Revenue & Pipeline Overview — bank reconciliation, sales snapshots, forecast accuracy
3. Capacity Planning — team utilization, demand forecasts, meeting hours
4. Entity Resolution Queue — fuzzy matching unmatched entities across Mercury, Calendar, Sheets

**Product Stage**: Pre-PMF — Core capabilities are implemented and being validated with 2 co-founders. The primary risk is "the product doesn't work well enough" — specifically, data accuracy and silent corruption of derived metrics.

---

## Product Capability Gaps

| Customer Need | Current State | Gap | Effort |
|---|---|---|---|
| Accurate margin calculations | Margins computed but NOT recalculated after bank reconciliation or resolution approval | Margin drift: resolved transactions don't trigger recompute; dashboard shows stale P&L | S |
| Reliable revenue reconciliation | Auto-resolves at 90% confidence; no validation of match before DB write | False positives corrupt revenue attribution; no rollback mechanism | M |
| Trustworthy data syncs | Cron jobs fail silently; no alerting, no retry logic | Co-founders won't know data is stale until they manually check | M |
| Safe configuration changes | Hard deletes without cascade; no confirmation dialogs | Deleting a customer orphans all historical revenue/margin data permanently | S |
| Validated entity matching | Confidence thresholds are heuristic (arbitrary weights); no false positive tracking | Cannot tune matching accuracy; no evidence thresholds are correct | M |

---

## Risk Heatmap (Top 15)

| # | Finding | Risk | Blocks | Priority |
|---|---------|------|--------|----------|
| 1 | **Margins NOT recalculated after resolution/reconciliation** — `resolution/[id]/resolve/route.ts`, `mercury.ts` | Dashboard shows stale P&L; co-founders make decisions on wrong data | Margin Calculation | P1 |
| 2 | **Sheet snapshot creates duplicates on retry** — `sheets.ts:234` uses `.create()` not `.upsert()` | Monthly revenue doubles/triples if cron runs twice | Revenue Overview | P1 |
| 3 | **Auto-resolution writes to DB without validation** — `resolution-queue.ts:83-92`, 90% threshold | False match auto-reconciles bank transactions; corrupts revenue attribution | Revenue Overview | P1 |
| 4 | **Zero automated tests** — no test framework, no test files, no CI quality gates | Any code change can introduce silent data corruption; no safety net | All Priorities | P1 |
| 5 | **Hard deletes without ON DELETE CASCADE** — `settings/customers/route.ts:16-21` | Deleting customer orphans SalesSnapshot, BankTransaction, MonthlyMargin records | Revenue Overview | P2 |
| 6 | **Unatomic resolution side effects** — `resolution-queue.ts:206-339`, no `$transaction()` | Partial failure leaves DB inconsistent (e.g., alias set but transactions not reconciled) | Resolution Queue | P2 |
| 7 | **Cron jobs fail silently** — no alerting, no retry, no monitoring | Mercury/Calendar sync fails; data goes stale without co-founders knowing | Revenue, Capacity | P2 |
| 8 | **No input validation on API routes** — settings, allocations, forecasts accept raw JSON | Invalid data persists in DB; calculations fail silently downstream | All Priorities | P2 |
| 9 | **Mercury upsert can overwrite manual reconciliation** — `mercury.ts:131-140` | Re-sync silently reassigns transaction to different customer | Revenue Overview | P2 |
| 10 | **Time allocation delete-then-create** — `allocations/route.ts:9-24` | Submitting partial form permanently deletes other allocations for that month | Capacity Planning | P2 |
| 11 | **Fallback JWT secret in production** — `middleware.ts:7`, `auth.ts:6` | If `AUTH_JWT_SECRET` unset, tokens become forgeable; dashboard exposed | Security | P2 |
| 12 | **POST `/api/cron/snapshot` unprotected** — no auth check on POST handler | Anyone can trigger snapshot creation; data integrity risk | Revenue Overview | P2 |
| 13 | **SyncButton fails silently on network error** — `sync-button.tsx:10-20` | User thinks sync worked; data is actually stale | Revenue, Capacity | P3 |
| 14 | **Voice intent parsing defaults to "approve"** — `voice.ts:194` | Unrecognized voice input auto-approves resolution items | Resolution Queue | P3 |
| 15 | **No observability** — zero logging, no error tracking, no metrics, no health checks | Cannot diagnose failures; silent degradation goes undetected | Infrastructure | P3 |

---

## Executive Summary (CEO)

**Product Readiness**: Near-Ready for internal validation use

**Status**: The dashboard successfully tracks revenue, calculates margins, plans capacity, and resolves entity mismatches across Mercury, Google Sheets, and Google Calendar. However, derived metrics (margins, cost summaries) can silently go stale after data changes, which undermines the core value proposition of accurate financial visibility.

**What's Working**:
- Revenue pipeline from Google Sheets with multi-format month parsing and customer auto-detection
- Bank reconciliation from Mercury with fuzzy matching and a resolution queue (4 interfaces: dashboard, Slack, CLI, voice)
- Capacity planning with Linear workload integration, calendar meeting tracking, and demand forecasting
- Clean, consistent UI built on shadcn/ui with keyboard shortcuts for power-user efficiency

**What's Blocking**:
1. **Blocks margin accuracy**: When a bank transaction is reconciled (manually or via resolution queue), the margin for that month is NOT recalculated. Co-founders see stale P&L data until someone manually re-saves time allocations.
2. **Blocks data trust**: Revenue snapshots can duplicate if the monthly cron runs twice (no idempotency). Auto-resolved matches at 90% confidence go straight to the database with no validation — a false match silently corrupts revenue attribution.
3. **Blocks operational confidence**: Cron syncs (Mercury, Calendar) fail silently with no alerting. There's no way to know data is stale until you manually check.

**Recommended Next Steps**:
- Fix margin recalculation triggers so P&L stays accurate after every data change (1-2 days)
- Add idempotency to revenue snapshots and validation to auto-resolution pipeline (1-2 days)
- Add basic alerting (Slack notification on sync failure) and a health check endpoint (1 day)

---

## Technical Summary (CTO)

### Architecture Risk by Layer

| Layer | Risk Level | Key Finding | Effort |
|-------|-----------|-------------|--------|
| UX/UI | Low | SyncButton fails silently; delete actions lack confirmation dialogs; `alert()` used instead of toasts | S |
| Frontend | Medium | Hard page reloads mask errors; race condition in resolution queue stats update; stale closure in keyboard handler | S |
| Backend | High | Sheet snapshots not idempotent; resolution side effects not transactional; no input validation on APIs; Mercury upsert overwrites manual reconciliation | M |
| Data | High | Margins not recalculated after resolution; two sources of truth on revenue (SalesSnapshot vs BankTransaction); hard deletes without cascade; no audit trail | M |
| DevOps | High | No CI/CD quality gates; no rollback capability; cron jobs fail silently; no health checks | M |
| Security | Medium | Fallback JWT secret; POST `/api/cron/snapshot` unprotected; `CRON_SECRET` check can be skipped if env var unset | S |
| QA | Critical | Zero test files; zero test framework; no coverage; no pre-commit hooks; no quality gates | L |
| Platform | Medium | No observability (zero logging); no caching; sequential DB writes in sync loops; sync timeouts at 10x load | M |
| AI | Medium | No LLM (rule-based matching); auto-resolve at 90% without validation; no false positive tracking; voice defaults to approve | S |

**Architecture Debt Score**: 6/10

The core application architecture (Next.js + Prisma + Vercel) is sound and appropriate for an internal Pre-PMF dashboard. The debt is concentrated in three areas: (1) data integrity — derived metrics go stale, side effects aren't transactional; (2) quality assurance — zero tests for complex business logic; (3) observability — zero logging or alerting.

---

## Product Roadmap

| Milestone | Primary Objective | Key Technical Components | Value Creation | Timeline |
|-----------|-------------------|------------------------|----------------|----------|
| **Trustworthy Financials** | Co-founders can trust the margin and revenue numbers they see | - Margin auto-recalculation after any reconciliation or resolution event<br>- Idempotent revenue snapshots (upsert on customerId+month)<br>- Transaction-wrapped resolution side effects<br>What accuracy level is acceptable for auto-resolved matches? | DJ and Arthur go from "I need to double-check the numbers" to "I trust the dashboard is current." Every margin view reflects the latest reconciliation state. | 1 Week |
| | | **Alpha Release** | Ship to co-founders for daily use. Track: do they still manually verify margins? Do they notice stale data? | |
| **Reliable Data Pipeline** | Data syncs are observable and self-healing | - Slack alerts on cron sync failure (Mercury, Calendar, Sheets)<br>- Health check endpoint (`/api/health`) checking DB + external APIs<br>- Retry logic with backoff on Mercury/Calendar sync<br>- Input validation (Zod schemas) on all API routes<br>What SLA for data freshness (e.g., max 4 hours stale)? | Co-founders go from "is the data up to date?" to receiving a Slack alert if it's not. Confidence in dashboard data without manual checking. | 1 Week |
| **Safe Configuration** | Settings changes can't accidentally destroy historical data | - Soft deletes for Customer and TeamMember (deletedAt flag)<br>- ON DELETE CASCADE/SET NULL in Prisma schema<br>- Confirmation dialogs on destructive actions in UI<br>- Replace `window.location.reload()` with `router.refresh()` | Arthur and DJ can safely edit customer/team config without fear of losing historical revenue or margin data. Settings become a low-stress activity. | 0.5 Week |
| **Validated Entity Resolution** | Resolution queue produces auditable, reversible decisions | - Validate customerId exists before applying resolution<br>- Per-type confidence thresholds (95% for revenue, 85% for domains)<br>- Audit log for all resolution side effects (before/after state)<br>- Fix voice parser default from "approve" to "skip"<br>What's the acceptable false positive rate for auto-resolution? | Co-founders go from "I hope the auto-matches are right" to being able to audit any match decision and tune thresholds based on data. | 1 Week |
| | | **Beta Release** | Track: false positive rate on auto-resolved items. Are co-founders overriding auto-decisions? How often do they use resolution queue? | |
| **Quality Foundation** | Code changes don't introduce silent regressions | - Unit tests for matching engine (Levenshtein, token overlap, confidence scoring)<br>- Unit tests for CSV parsing (sheets.ts, calendar.ts edge cases)<br>- Integration tests for resolution queue (create, resolve, side effects)<br>- GitHub Actions CI: lint + type-check + test on every push | Co-founders (as developers) go from "I hope this change doesn't break anything" to getting automated feedback on every code push. Ship faster with confidence. | 1.5 Weeks |
| **Operational Visibility** | System health is always visible without manual checking | - Structured logging (correlation IDs on sync operations)<br>- Error tracking (Sentry or similar)<br>- Composite DB indexes for common query patterns<br>- Batch DB writes in Mercury/Calendar sync loops<br>What monitoring tool preference (Sentry, LogRocket, Vercel Analytics)? | Co-founders go from "is the system working?" to having a Slack channel that proactively reports system health. Focus shifts from monitoring to building. | 1 Week |
| | | **GA Release** | Production-grade internal tool. Track: uptime, sync success rate, mean time to detect issues. | |

**Total Timeline**: ~6 weeks

---

## Layer Detail Appendix

### UX/UI Layer
The dashboard has solid UX fundamentals: loading states with spinners, skeleton loaders, empty state messaging, and keyboard shortcuts for the resolution queue. The design system (shadcn/ui + Tailwind) provides visual consistency. Key gaps: SyncButton fails silently on network errors (no error toast), delete actions in settings forms lack confirmation dialogs, and several places use `alert()` instead of inline feedback. Icon-only buttons lack `aria-label` attributes (accessibility gap). Overall: good for Pre-PMF, minor polish needed.

### Frontend Layer
State management is sound — React Server Components for data fetching, useState for form-local state. Main issues: (1) `window.location.reload()` after form saves masks errors and loses browser state; should use `router.refresh()`. (2) Race condition in resolution queue when rapidly approving items — stats update is async and can lag. (3) Stale closure in keyboard handler's useEffect (missing deps). (4) Chart components use `any` types (eslint-disable for Recharts). (5) Silent error swallowing in sidebar badge fetch (`.catch(() => {})`).

### Backend Layer
Business logic is mostly in API route handlers (acceptable for this scale). Critical issues: (1) `sheets.ts:createSnapshot()` uses `.create()` not `.upsert()` — running twice doubles revenue. (2) Resolution side effects span multiple tables without `$transaction()` — partial failure corrupts state. (3) No input validation (Zod) on any API route. (4) Mercury upsert can overwrite manual reconciliation on re-sync. (5) Time allocation endpoint deletes all entries for a month before creating new ones — partial form submission permanently loses data. (6) Voice intent parser defaults to "approve" on unrecognized input.

### Data Layer
The biggest risk is **silent drift of derived data**. MonthlyMargin is derived from SalesSnapshot + TimeAllocation + TeamMember costs, but is only recalculated when allocations are manually saved. Bank transaction reconciliation (via resolution queue or manual action) does NOT trigger margin recompute. Revenue has two sources of truth: SalesSnapshot (Sheets) and BankTransaction (Mercury), with a fallback hierarchy that can mask inconsistencies. Hard deletes on Customer/TeamMember leave orphaned records in dependent tables (no CASCADE). No audit trail for data changes. Prisma uses `db push` (no migration history, no rollback).

### DevOps Layer
Deployment is Vercel auto-deploy with no quality gates — no tests, no lint checks, no build verification before production. Rollback is manual (redeploy previous commit in Vercel dashboard). Database schema changes via `prisma db push` are irreversible. Cron jobs (Mercury sync, Calendar sync, Snapshots) fail silently with no retry, no alerting, no health checks. No infrastructure as code. Environment parity between dev and prod is not guaranteed. Acceptable for 2-person Pre-PMF but would be critical risk at team scale.

### Security Layer
Authentication is implemented correctly (bcrypt + JWT + httpOnly cookies). Main gaps: (1) Fallback JWT secret `"dev-secret-change-me"` if `AUTH_JWT_SECRET` not set — tokens become forgeable. (2) `CRON_SECRET` check is skipped if env var is undefined — cron endpoints become unprotected. (3) `POST /api/cron/snapshot` has no auth check (only GET does). (4) No CORS or security headers configured (acceptable for internal tool). No SQL injection risk (Prisma ORM). No hardcoded secrets. Slack signature verification is correctly implemented.

### QA Layer
Zero test coverage across the entire codebase. No test framework installed (no Jest, Vitest, Playwright). No CI/CD quality gates. No pre-commit hooks. The highest-risk untested code: matching engine (377 lines of Levenshtein/token overlap/substring scoring), resolution queue (340 lines of CRUD + side effects), CSV parsing (sheets.ts, calendar.ts), and authentication (auth.ts, middleware.ts). For a Pre-PMF internal tool, this is a calculated risk — but it means any code change can silently corrupt financial data with no automated detection.

### Platform Layer
No observability: zero logging, no error tracking, no metrics, no health checks. Performance is adequate at current scale (~50 transactions/day) but would timeout at 10x: Mercury sync does sequential DB upserts per transaction, calendar sync does N+1 queries per event, resolution backfill does full table scans with Levenshtein distance on every pair. No caching strategy — matching recalculates on every sync. Missing composite indexes for common query patterns. Connection pool limits not configured (Vercel Postgres defaults). No backpressure or rate limiting on external API calls.

### AI Layer
No LLM integrations — the system is entirely rule-based using fuzzy string matching (Levenshtein distance, token overlap, substring matching). This means zero AI cost, zero latency from API calls, zero hallucination risk. However: auto-resolution at 90% confidence writes directly to the database without validation, with no rollback mechanism and no audit trail. The 90% threshold is heuristic (arbitrary weights: 30/30/40 for Levenshtein/token/substring) with no validation data or false positive tracking. Voice intent parsing uses hardcoded regex patterns and defaults to "approve" on unrecognized input. Recommendation: keep rule-based approach but add validation, logging, and per-type thresholds.

---

## Full Findings (Beyond Top 15)

| # | Layer | Finding | Risk | Priority |
|---|-------|---------|------|----------|
| 16 | Frontend | Race condition in resolution queue stats update during rapid keyboard approval | Stats show wrong pending count momentarily | P3 |
| 17 | Frontend | Stale closure in resolution keyboard handler (missing deps in useEffect) | Rapid keyboard input could send stale payloads | P3 |
| 18 | Frontend | Untyped Recharts chart props (`any` types with eslint-disable) | TypeScript won't catch Recharts interface changes | P3 |
| 19 | Backend | No optimistic locking on resolution items — concurrent approvals possible | Two users could resolve same item; last-write-wins | P3 |
| 20 | Backend | Slack message update can fail silently after resolution | User thinks resolved; Slack message not updated | P3 |
| 21 | Backend | Voice response parsing is brittle (regex-only, no NLU) | Voice interface is not production-ready | P3 |
| 22 | Backend | Cron auth check redundant (both middleware and route check CRON_SECRET) | Confusion about where auth is enforced | P3 |
| 23 | Backend | Alias case normalization inconsistent — aliases stored in original case | Matching degrades over time as aliases accumulate | P3 |
| 24 | Data | No audit log for data changes (who reconciled, when, why) | Cannot trace margin changes or debug data issues | P3 |
| 25 | Data | LinearSyncCache stores raw JSON, still recomputes allocations on every request | Unnecessary CPU on cache hit | P3 |
| 26 | DevOps | No environment parity (dev uses Turbopack, prod uses Vercel runtime) | Features working locally could fail in production | P3 |
| 27 | DevOps | Node 18 pinned in .nvmrc — no control over Vercel base image | Vulnerabilities in Node 18 require Vercel to update | P3 |
| 28 | Security | No security headers (CSP, HSTS, X-Frame-Options) | Acceptable for internal tool; critical if public-facing | P3 |
| 29 | Security | Error messages expose internal details (String(error)) | Information leakage if ever public-facing | P3 |
| 30 | Security | No automated dependency scanning (no Dependabot, Snyk) | New vulnerabilities go undetected | P3 |
| 31 | Platform | Full CSV loaded into memory before parsing — OOM risk on large sheets | Serverless function crashes on 100K+ row sheets | P3 |
| 32 | Platform | No composite DB indexes for common multi-column queries | Full table scans at scale; query performance degrades | P3 |
| 33 | Platform | No circuit breaker on external APIs (Mercury, Linear, Google) | Cascading failures if external service is down | P3 |
| 34 | UX/UI | Icon-only buttons lack aria-label (accessibility WCAG violation) | Screen readers can't announce button purpose | P3 |
| 35 | UX/UI | `alert()` used for sync feedback instead of toast/inline message | Blocks UI; jarring UX | P3 |
| 36 | UX/UI | Dark mode color contrast may not meet WCAG AA standard | Users with low vision may struggle in dark mode | P3 |
| 37 | AI | No false positive tracking on auto-resolved items | Cannot measure or improve matching accuracy | P3 |
| 38 | AI | Hardcoded keyword lists for vendor categorization scattered in code | Changing rules requires code edit + deploy | P3 |
| 39 | AI | Confidence weights (30/30/40) are arbitrary with no validation data | No evidence that threshold produces acceptable accuracy | P3 |

---

*Generated by Claude Code architecture audit on 2026-02-26*
