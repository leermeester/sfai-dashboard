# Add composite database indexes

## Context

Part of Operational Visibility (parent). Database queries use multiple conditions but only single-column indexes exist. Common query patterns (e.g., "unreconciled incoming transactions") require scanning entire tables. At scale, these queries will timeout.

## Task

Add composite indexes to the Prisma schema for the most common multi-column query patterns identified in the codebase.

## Acceptance Criteria

- [ ] `BankTransaction` composite index on `(direction, isReconciled, counterpartyName)` — used by Mercury sync unmatched query
- [ ] `BankTransaction` composite index on `(direction, costCategory)` — used by outgoing unmatched query
- [ ] `BankTransaction` composite index on `(customerId, isReconciled, reconciledMonth)` — used by margin calculation
- [ ] `ResolutionItem` index on `(status, type)` — used by getPendingItems and stats queries
- [ ] `ClientMeeting` index on `(meetingType, date)` — used by capacity page meeting queries
- [ ] Schema pushed via `prisma db push`

## Watch Out For

- **Index size**: Don't over-index. Each index adds write overhead. Only add indexes for queries that are actually slow or will be slow at 10x data.
- **Existing indexes**: Check what already exists to avoid duplicates. `BankTransaction` already has individual indexes on `customerId`, `postedAt`, `direction`, `costCategory`.

## Pointers

- `prisma/schema.prisma:92-96` — existing `BankTransaction` indexes
- `prisma/schema.prisma:211-213` — existing `ResolutionItem` indexes
- `src/lib/mercury.ts:187-197` — the unmatched queries that need composite indexes
- `src/app/api/settings/allocations/route.ts:51-57` — margin calculation query
