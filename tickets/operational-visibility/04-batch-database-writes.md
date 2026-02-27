# Batch database writes in sync loops

## Context

Part of Operational Visibility (parent). Mercury sync and Calendar sync process records one-at-a-time in sequential loops. Each record requires a separate DB round-trip. At 500 transactions, this takes 50+ sequential upserts and can timeout on Vercel's 60-second function limit.

## Task

Replace sequential `db.*.upsert()` / `db.*.create()` loops with batched operations using Prisma's `createMany`, `$transaction`, or parallel Promise patterns where safe.

## Acceptance Criteria

- [ ] Mercury sync upserts bank transactions in batches (e.g., `db.$transaction()` with batches of 50)
- [ ] Calendar sync upserts meetings in batches instead of one-at-a-time
- [ ] Resolution item creation uses `createMany` where possible (with `skipDuplicates: true`)
- [ ] Sync completes within 30 seconds for 500 records (down from 50+ seconds sequential)
- [ ] Error handling still identifies which specific record failed (don't lose error granularity)

## Watch Out For

- **Upsert vs createMany**: `createMany` doesn't support `skipDuplicates` for upserts. For Mercury transactions (which need upsert), batch them in a `$transaction()` array of individual upserts. For new resolution items, `createMany({ skipDuplicates: true })` works if the unique constraint handles it.
- **Matching logic between upserts**: Mercury sync does customer matching per-transaction before upserting. The matching still needs to happen per-record, but the DB writes can be batched.
- **Transaction size**: Don't put 500 operations in a single transaction — it holds a DB lock too long. Batch in groups of 50.

## Pointers

- `src/lib/mercury.ts:83-180` — sequential upsert loop; batch the `db.bankTransaction.upsert()` calls
- `src/lib/calendar.ts` — sequential event upsert loop; batch the `db.clientMeeting.upsert()` calls
- `src/lib/resolution-queue.ts:54-101` — sequential `db.resolutionItem.upsert()` loop
