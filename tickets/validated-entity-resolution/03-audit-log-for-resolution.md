# Add audit log for resolution side effects

## Context

Part of Validated Entity Resolution (parent). When `applyResolution()` runs, it mutates Customer aliases, BankTransaction reconciliation, DomainMapping, and VendorCategoryRule — but there's no record of what changed. If margins look wrong, there's no way to trace which resolution caused the data change.

## Task

Create a `ResolutionAuditLog` model that records the before/after state for every side effect applied by `applyResolution()`. Each log entry should capture what entity changed, what field changed, old value, new value, and which resolution item triggered it.

## Acceptance Criteria

- [ ] New `ResolutionAuditLog` Prisma model with fields: `id`, `resolutionItemId`, `entityType`, `entityId`, `field`, `oldValue`, `newValue`, `createdAt`
- [ ] Every `db.bankTransaction.update()` in `applyResolution()` creates an audit log entry (e.g., `{ field: "customerId", oldValue: null, newValue: "cust_123" }`)
- [ ] Every `db.customer.update()` in `applyResolution()` creates an audit log entry (e.g., `{ field: "aliases", oldValue: "[]", newValue: '["acme"]' }`)
- [ ] DomainMapping and VendorCategoryRule changes are also logged
- [ ] Auto-resolved items are also logged (same flow, just triggered by system instead of user)
- [ ] Audit logs are queryable by `resolutionItemId` for debugging

## Pointers

- `src/lib/resolution-queue.ts:206-339` — `applyResolution()` — add logging around each `db.*.update()` call
- `prisma/schema.prisma` — add `ResolutionAuditLog` model
- The audit log writes should be inside the same `$transaction()` (from Trustworthy Financials milestone) to ensure atomicity
