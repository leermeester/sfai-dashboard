# Add cascade delete rules to Prisma schema

## Context

Part of Safe Configuration (parent). Even with soft deletes, the foreign key relationships have no ON DELETE behavior defined. If a hard delete ever happens (direct DB query, migration), dependent records become orphaned, causing query failures and data inconsistency.

## Task

Add `onDelete` rules to all foreign key relationships in the Prisma schema. Use `Cascade` for data that's meaningless without its parent (snapshots, margins) and `SetNull` for optional relationships (meetings, transactions).

## Acceptance Criteria

- [ ] `SalesSnapshot.customer` → `onDelete: Cascade` (snapshots are meaningless without customer)
- [ ] `MonthlyMargin.customer` → `onDelete: Cascade`
- [ ] `TimeAllocation.customer` → `onDelete: Cascade`
- [ ] `TimeAllocation.teamMember` → `onDelete: Cascade`
- [ ] `DemandForecast.customer` → `onDelete: Cascade`
- [ ] `BankTransaction.customer` → `onDelete: SetNull` (transactions exist independently; just lose the link)
- [ ] `ClientMeeting.customer` → `onDelete: SetNull` (meetings exist independently)
- [ ] `DomainMapping.customer` → `onDelete: SetNull`
- [ ] Schema change applied via `prisma db push`

## Watch Out For

- **Data validation**: Before pushing, verify no orphaned records exist in the database. Run a quick query to check for `BankTransaction` with `customerId` values that don't exist in `Customer`.

## Pointers

- `prisma/schema.prisma:63` — `SalesSnapshot.customer` relation (add `onDelete: Cascade`)
- `prisma/schema.prisma:79` — `BankTransaction.customer` relation (add `onDelete: SetNull`)
- `prisma/schema.prisma:119-121` — `TimeAllocation` relations
- `prisma/schema.prisma:145` — `MonthlyMargin.customer` relation
