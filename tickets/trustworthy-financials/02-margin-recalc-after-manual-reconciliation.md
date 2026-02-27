# Add margin recalculation after manual bank reconciliation

## Context

Part of Trustworthy Financials (parent). The `POST /api/mercury` endpoint allows manual reconciliation of bank transactions, but doesn't recalculate margins afterward. The reconciled transaction changes revenue attribution, but MonthlyMargin stays stale.

## Task

After a manual reconciliation action in the Mercury API route, call `recalculateMargins()` for the affected month and `recalculateMonthlyCosts()` if the cost category changed.

## Acceptance Criteria

- [ ] Manually reconciling a bank transaction via `POST /api/mercury` triggers margin recalculation for the reconciled month
- [ ] Manually categorizing an outgoing transaction triggers cost summary recalculation
- [ ] Response includes an indicator that margins were recalculated

## Pointers

- `src/app/api/mercury/route.ts` — POST handler for manual reconcile/categorize actions
- `src/lib/margins.ts` (created in sub-issue #1) — shared `recalculateMargins()` function
- `src/lib/mercury.ts:232-280` — `recalculateMonthlyCosts()`
