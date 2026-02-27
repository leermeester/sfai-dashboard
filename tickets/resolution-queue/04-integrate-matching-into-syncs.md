# Integrate matching engine into sync routes

## Context

Part of the multi-interface resolution queue (parent). This connects the matching engine (#2) and queue (#3) to the existing sync infrastructure. After each sync, unmatched entities are automatically run through the matching engine and piped into the resolution queue.

## Task

Modify the three sync flows (Mercury, Calendar, Sheets) to create resolution items for unmatched entities after each sync. High-confidence matches (>90%) should be auto-resolved. The cron sync route should trigger resolution creation as a final step.

**Integration points:**

1. **Mercury sync** (`src/lib/mercury.ts:syncTransactions`): After the transaction loop, collect all unmatched incoming transactions (no `matchedCustomerId`) and unmatched outgoing transactions (no `costCategory`). Run through matching engine. Create resolution items.

2. **Calendar sync** (`src/lib/calendar.ts:syncMeetings`): The `unmatchedDomains` set at line 154 already collects unmatched domains. After the event loop, run each through `classifyDomain()`. Create resolution items.

3. **Sheets sync** (`src/lib/sheets.ts:createSnapshot`): The `unmatched` array at line 217 already collects unmatched customer names. Run each through `matchSheetCustomer()`. Create resolution items.

## Acceptance Criteria

- [ ] After Mercury sync, unmatched incoming transactions appear as `customer_match` resolution items with suggestions
- [ ] After Mercury sync, uncategorized outgoing transactions appear as `vendor_categorize` resolution items with suggestions
- [ ] After Calendar sync, unmatched domains appear as `domain_classify` resolution items with suggestions
- [ ] After Sheets sync, unmatched customer names appear as `sheet_customer` resolution items with suggestions
- [ ] High-confidence matches (>90%) are auto-resolved and applied immediately (same as manual resolution)
- [ ] Existing sync behavior is unchanged — resolution items are created in addition to, not instead of, the existing flow
- [ ] Cron sync at `src/app/api/cron/sync/route.ts` returns resolution stats in its response

## Watch Out For

- **Idempotency**: Running sync twice should not create duplicate resolution items. The unique constraint on `type + sourceEntity` handles this, but the sync should use upsert-like logic (skip if item already exists with same sourceEntity).
- **Auto-resolution feedback**: When an item is auto-resolved, it must update the actual entity (Customer.bankName, DomainMapping, etc.) just like manual resolution. Otherwise the same entity will be unmatched again on next sync.

## Pointers

- `src/lib/mercury.ts:83-106` — incoming transaction matching loop (line 92: customer iteration, line 91: the `matchedCustomerId` variable)
- `src/lib/mercury.ts:148-156` — outgoing transaction vendor rule matching
- `src/lib/calendar.ts:154` — `unmatchedDomains` set declaration
- `src/lib/calendar.ts:211-217` — where unmatched domains are collected
- `src/lib/sheets.ts:217-229` — unmatched customer name collection
- `src/app/api/cron/sync/route.ts:1-29` — cron orchestrator to extend
