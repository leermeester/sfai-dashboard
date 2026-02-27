# Fix margin and revenue accuracy — Trustworthy financial metrics

## Context

When a bank transaction is reconciled (via resolution queue or manual action), the MonthlyMargin for that month is NOT recalculated. Co-founders see stale P&L data until someone manually re-saves time allocations. Additionally, revenue snapshots can duplicate if the monthly cron runs twice, and resolution side effects span multiple tables without transaction boundaries.

## Scope

- [ ] Margins auto-recalculate after any reconciliation or resolution event
- [ ] Revenue snapshots are idempotent (safe to re-run without duplication)
- [ ] Resolution side effects are atomic (all-or-nothing via `$transaction()`)
- [ ] Mercury upsert does not overwrite manual reconciliation

## Out of Scope

- Audit trail for margin changes (separate milestone: Validated Entity Resolution)
- UI changes to display recalculation status
- Historical margin correction for already-stale data (manual re-save handles this)

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Add margin recalculation after resolution approval | — | S |
| 2 | Add margin recalculation after manual bank reconciliation | — | S |
| 3 | Make revenue snapshots idempotent via upsert | — | S |
| 4 | Wrap resolution side effects in Prisma $transaction | — | M |
| 5 | Prevent Mercury upsert from overwriting manual reconciliation | — | S |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Findings #1, #2, #6, #9
- Margin calculation: `src/app/api/settings/allocations/route.ts:32-93`
- Resolution side effects: `src/lib/resolution-queue.ts:206-339`
- Mercury sync: `src/lib/mercury.ts:67-230`
- Snapshot creation: `src/lib/sheets.ts:211-265`
