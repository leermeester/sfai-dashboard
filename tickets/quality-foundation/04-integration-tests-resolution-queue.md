# Add integration tests for resolution queue

## Context

Part of Quality Foundation (parent). The resolution queue (`resolution-queue.ts`, 340 lines) handles entity resolution with database side effects. It's the riskiest code path — auto-resolved items mutate bank transactions, customer aliases, domain mappings, and vendor rules. Zero tests exist.

## Task

Write integration tests for `createResolutionItems()`, `resolveItem()`, and `applyResolution()` using a test database. These tests should verify that side effects are applied correctly and that edge cases (duplicate items, already-resolved items, invalid IDs) are handled.

## Acceptance Criteria

- [ ] `createResolutionItems()` tested: creates pending items, auto-resolves at threshold, skips duplicates, returns correct counts
- [ ] `resolveItem()` tested: approve sets status to confirmed + applies side effects, reject sets status to rejected + no side effects, skip returns without changes, already-resolved throws error
- [ ] `applyResolution()` `customer_match` tested: bank transactions updated with customerId, customer alias added, no double-alias
- [ ] `applyResolution()` `domain_classify` tested: DomainMapping created/updated
- [ ] `applyResolution()` `vendor_categorize` tested: transactions categorized, VendorCategoryRule created
- [ ] Concurrent resolution tested: two resolveItem calls on same item — second should fail gracefully
- [ ] At least 12 test cases total

## Watch Out For

- **Database setup**: Integration tests need a real (or test) Prisma database. Use `prisma db push` against a test database, or use Vitest's `beforeAll` to set up test data and `afterAll` to clean up. Consider a separate `DATABASE_URL_TEST` env var.
- **Transaction cleanup**: Each test should clean up its own data to avoid test interference. Use Prisma interactive transactions with rollback, or delete test records in `afterEach`.

## Pointers

- `src/lib/resolution-queue.ts:46-104` — `createResolutionItems()` — test auto-resolve + skip logic
- `src/lib/resolution-queue.ts:138-178` — `resolveItem()` — test status transitions
- `src/lib/resolution-queue.ts:206-339` — `applyResolution()` — test each case branch
- `src/lib/db.ts` — Prisma client; tests should import this
