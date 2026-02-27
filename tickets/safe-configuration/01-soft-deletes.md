# Implement soft deletes for Customer and TeamMember

## Context

Part of Safe Configuration (parent). When customers or team members are removed via Settings, they're hard-deleted. This permanently destroys all historical revenue, margin, and allocation data tied to that entity.

## Task

Replace hard deletes with soft deletes. Instead of `db.customer.delete()`, set `isActive: false`. Update all queries that list customers/team members to filter on `isActive: true`. Both models already have an `isActive` field — it just isn't used for soft deletion.

## Acceptance Criteria

- [ ] `PUT /api/settings/customers` sets `isActive: false` on removed customers instead of deleting them
- [ ] `PUT /api/settings/team` sets `isActive: false` on removed team members instead of deleting them
- [ ] All customer/team member queries across the app filter on `isActive: true` (dashboard, margins, capacity, settings, resolution)
- [ ] Soft-deleted entities don't appear in dropdown selectors or mapping forms
- [ ] Historical data (SalesSnapshot, MonthlyMargin, TimeAllocation) for soft-deleted entities remains intact and queryable

## Watch Out For

- **`isActive` already exists** on both `Customer` (schema.prisma:37) and `TeamMember` (schema.prisma:18) with `@default(true)`. No schema migration needed.
- **Revenue matrix**: Soft-deleted customers should still show in historical margin tables but not in active customer lists for new allocations.

## Pointers

- `src/app/api/settings/customers/route.ts:16-21` — hard delete loop to replace
- `src/app/api/settings/team/route.ts` — hard delete loop to replace
- `prisma/schema.prisma:18,37` — `isActive` fields already defined
- Search for `db.customer.findMany()` and `db.teamMember.findMany()` across the codebase — all need `where: { isActive: true }` added
