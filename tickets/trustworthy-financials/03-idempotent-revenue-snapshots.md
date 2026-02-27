# Make revenue snapshots idempotent via upsert

## Context

Part of Trustworthy Financials (parent). `createSnapshot()` in `sheets.ts` uses `db.salesSnapshot.create()` in a loop. If the monthly cron runs twice (retry, duplicate trigger), revenue doubles because duplicate records are created for the same customer+month.

## Task

Replace `db.salesSnapshot.create()` with `db.salesSnapshot.upsert()` keyed on `(customerId, month)`. The latest snapshot should overwrite the previous one for the same customer+month combination.

## Acceptance Criteria

- [ ] Running `createSnapshot()` twice for the same month produces identical results (no duplicate revenue)
- [ ] A unique constraint exists on `SalesSnapshot(customerId, month)` or the upsert uses the existing `@@index([customerId, month])` effectively
- [ ] The `snapshotDate` is updated to the latest run time on upsert
- [ ] Existing snapshot data is not lost when a re-run has fewer customers (upsert only updates matches, doesn't delete missing ones)

## Watch Out For

- **Schema change needed**: `SalesSnapshot` currently has `@@index([customerId, month])` but not `@@unique([customerId, month])`. You need to add a `@@unique` constraint for Prisma's `upsert` `where` clause to work. Run `prisma db push` after the schema change.

## Pointers

- `src/lib/sheets.ts:234-241` — the `.create()` call to replace with `.upsert()`
- `prisma/schema.prisma:60-73` — `SalesSnapshot` model; add `@@unique([customerId, month])` and keep the existing `@@index`
