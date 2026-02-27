# Wrap resolution side effects in Prisma $transaction

## Context

Part of Trustworthy Financials (parent). `applyResolution()` in `resolution-queue.ts` performs multiple sequential database writes without a transaction boundary. If any step fails midway (e.g., customer alias update succeeds but bank transaction update fails), the database is left in an inconsistent state with no rollback.

## Task

Wrap the entire `applyResolution()` function body in a `db.$transaction()` call so all side effects are atomic. Also wrap the `resolveItem()` function's status update + side effect application in a single transaction.

## Acceptance Criteria

- [ ] `applyResolution()` runs all DB writes within a single Prisma interactive transaction
- [ ] If any write fails, all writes in that resolution are rolled back
- [ ] The `resolveItem()` status update (`resolutionItem.update`) and `applyResolution()` run in the same transaction
- [ ] Auto-resolution in `createResolutionItems()` also uses transactions for the upsert + side effect pair

## Watch Out For

- **Interactive transactions**: Use `db.$transaction(async (tx) => { ... })` and pass `tx` instead of `db` to all queries inside. This requires changing the `db` parameter type throughout.
- **Transaction timeout**: Prisma interactive transactions default to 5 seconds. The `customer_match` case can update many transactions. Consider setting `timeout: 10000` in the transaction options.
- **Error handling in createResolutionItems**: Line 97 catches errors as "unique constraint violation" — make sure the transaction doesn't mask real errors vs. duplicate-skip logic.

## Pointers

- `src/lib/resolution-queue.ts:206-339` — `applyResolution()` — wrap entire switch body in `$transaction`
- `src/lib/resolution-queue.ts:138-178` — `resolveItem()` — wrap lines 158-174 in `$transaction`
- `src/lib/resolution-queue.ts:54-101` — `createResolutionItems()` — wrap lines 58-93 (upsert + auto-resolve) in `$transaction`
- [Prisma interactive transactions docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#interactive-transactions)
