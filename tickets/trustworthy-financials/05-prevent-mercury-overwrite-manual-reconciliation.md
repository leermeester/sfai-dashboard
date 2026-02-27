# Prevent Mercury upsert from overwriting manual reconciliation

## Context

Part of Trustworthy Financials (parent). When Mercury sync runs, the upsert at `mercury.ts:131-140` will overwrite a manually reconciled transaction if the sync matches it to a different customer. There's no guard checking whether the transaction was already manually reconciled.

## Task

In the Mercury sync upsert's `update` clause, skip updating `customerId`, `isReconciled`, and `reconciledMonth` if the transaction is already reconciled. Only update these fields for transactions that haven't been reconciled yet.

## Acceptance Criteria

- [ ] A transaction manually reconciled to Customer A is NOT overwritten if Mercury sync matches it to Customer B
- [ ] Unreconciled transactions still get auto-reconciled by sync as before
- [ ] The `status` and `postedAt` fields are still updated for all transactions (these are non-destructive metadata updates)

## Pointers

- `src/lib/mercury.ts:114-142` — the incoming transaction upsert; modify the `update` clause to conditionally include reconciliation fields
- The update clause needs to check if the existing record is already reconciled. Use a raw query or fetch-then-update pattern, OR use Prisma's `updateMany` with a `where` filter on `isReconciled: false`
