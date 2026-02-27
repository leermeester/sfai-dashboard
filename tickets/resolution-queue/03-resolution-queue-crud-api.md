# Build resolution queue CRUD and API

## Context

Part of the multi-interface resolution queue (parent). This is the shared backend that all four interfaces (dashboard, Slack, CLI, voice) consume. It provides operations to create, list, resolve, and summarize resolution items.

## Task

Create `src/lib/resolution-queue.ts` with queue operations, and `src/app/api/resolution/` with REST endpoints. The queue lib handles business logic (creating items, applying resolutions to actual entities), while the API provides HTTP access for all interfaces.

## Acceptance Criteria

- [ ] `createResolutionItems(items[])` bulk-creates items, skipping duplicates (unique on type + sourceEntity)
- [ ] `getPendingItems({ type?, limit?, offset? })` returns items sorted by confidence desc (highest confidence = easiest to review first)
- [ ] `resolveItem(id, { decision, channel })` updates the item AND applies the resolution to the actual entity (e.g., sets Customer.bankName, creates DomainMapping, sets BankTransaction.costCategory)
- [ ] `getStats()` returns counts: `{ pending, autoResolved, confirmed, rejected }` grouped by type
- [ ] `GET /api/resolution?status=pending&type=customer_match&limit=10` — list items with filters
- [ ] `POST /api/resolution/[id]/resolve` — resolve an item with `{ decision, channel }` body
- [ ] `GET /api/resolution/stats` — summary counts for badge display

## Watch Out For

- **Resolution side effects**: When a customer_match is confirmed, the system should update `Customer.bankName` or add to `Customer.aliases` so the same entity auto-matches next time. This is the key feedback loop — resolve once, never ask again.
- **Race conditions**: Two interfaces resolving the same item simultaneously. Use optimistic locking — check `status === 'pending'` before resolving, return 409 if already resolved.

## Pointers

- `prisma/schema.prisma` — ResolutionItem model (from sub-issue #1)
- `src/app/api/mercury/route.ts:16-68` — existing pattern for POST route with action dispatching
- `src/app/api/settings/customers/route.ts` — existing pattern for updating Customer records
- `src/components/ui/sidebar.tsx:580-600` — SidebarMenuBadge component to display pending count
