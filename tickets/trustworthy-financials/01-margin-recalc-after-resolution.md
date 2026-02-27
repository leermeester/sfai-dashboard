# Add margin recalculation after resolution approval

## Context

Part of Trustworthy Financials (parent). When a resolution item of type `customer_match` is approved, bank transactions get reconciled to a customer — but MonthlyMargin is never updated. The dashboard shows stale margins until someone manually re-saves time allocations.

## Task

After `applyResolution()` completes for a `customer_match` type, call `recalculateMargins()` for every affected month. Extract the `recalculateMargins` function from the allocations route into a shared utility so it can be called from both the allocations route and the resolution resolve route.

## Acceptance Criteria

- [ ] Approving a `customer_match` resolution item triggers margin recalculation for all affected months
- [ ] The `recalculateMargins(month)` function is importable from a shared location (e.g., `src/lib/margins.ts`)
- [ ] Existing allocation save flow still works identically (calls the same extracted function)
- [ ] Vendor categorization resolutions also trigger `recalculateMonthlyCosts()` since they change cost categories

## Watch Out For

- **Multiple months affected**: A single resolution can reconcile transactions across different `reconciledMonth` values. Collect all unique months from the updated transactions and recalculate each.
- **Circular import risk**: `resolution-queue.ts` imports from `matching.ts`. The new margins utility should not import from `resolution-queue.ts`.

## Pointers

- `src/app/api/settings/allocations/route.ts:32-93` — `recalculateMargins()` function to extract
- `src/lib/resolution-queue.ts:206-268` — `applyResolution()` case `customer_match` — add recalc call after the for-loop at line 239
- `src/lib/resolution-queue.ts:289-320` — `applyResolution()` case `vendor_categorize` — add `recalculateMonthlyCosts()` call after line 305
- `src/lib/mercury.ts:232-280` — `recalculateMonthlyCosts()` — already a standalone function, can be called directly
