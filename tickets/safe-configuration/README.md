# Make configuration changes safe — Prevent accidental data loss

## Context

Deleting a customer or team member is a hard delete that orphans all related records (SalesSnapshot, BankTransaction, MonthlyMargin, TimeAllocation). There are no confirmation dialogs on destructive actions, and forms reload the entire page after saves, masking errors and losing browser state.

## Scope

- [ ] Soft deletes for Customer and TeamMember (set `isActive: false` instead of hard delete)
- [ ] ON DELETE CASCADE or SET NULL on foreign key relationships
- [ ] Confirmation dialogs on delete actions in settings forms
- [ ] Replace `window.location.reload()` with `router.refresh()` across all forms

## Out of Scope

- Undo/restore UI for soft-deleted records
- Audit trail for settings changes (separate milestone)
- Settings page redesign

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Implement soft deletes for Customer and TeamMember | — | S |
| 2 | Add cascade delete rules to Prisma schema | #1 | S |
| 3 | Add confirmation dialogs for destructive actions | — | S |
| 4 | Replace window.location.reload with router.refresh | — | S |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Findings #5, #13
- Customer delete: `src/app/api/settings/customers/route.ts:16-21`
- Team delete: `src/app/api/settings/team/route.ts`
- Prisma schema: `prisma/schema.prisma`
