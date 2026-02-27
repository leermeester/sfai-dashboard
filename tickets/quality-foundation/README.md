# Build quality foundation — Automated testing and CI gates

## Context

The codebase has zero automated tests, no test framework, and no CI quality gates. Any code change can introduce silent data corruption in the matching engine, CSV parsing, or resolution queue — with no automated detection. The highest-risk untested code: matching engine (377 lines), resolution queue (340 lines), CSV parsing, and authentication.

## Scope

- [ ] Vitest test framework configured and running
- [ ] Unit tests for matching engine (Levenshtein, token overlap, confidence scoring)
- [ ] Unit tests for CSV parsing (sheets.ts, calendar.ts edge cases)
- [ ] Integration tests for resolution queue (create, resolve, side effects)
- [ ] GitHub Actions CI pipeline: lint + type-check + test on every push

## Out of Scope

- E2E tests (Playwright/Cypress)
- Coverage enforcement thresholds
- Performance/load testing
- Visual regression testing

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Set up Vitest testing framework | — | S |
| 2 | Add unit tests for matching engine | #1 | M |
| 3 | Add unit tests for CSV parsing | #1 | S |
| 4 | Add integration tests for resolution queue | #1 | M |
| 5 | Add GitHub Actions CI pipeline | #1 | S |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Finding #4
- Matching engine: `src/lib/matching.ts` (377 lines)
- CSV parsing: `src/lib/sheets.ts:23-63`, `src/lib/calendar.ts`
- Resolution queue: `src/lib/resolution-queue.ts` (340 lines)
- Auth: `src/lib/auth.ts`, `src/middleware.ts`
