# Normalize aliases to lowercase on save

## Context

Part of Validated Entity Resolution (parent). When `applyResolution()` saves a new alias to `Customer.aliases`, it stores the original case (e.g., "VSV Ventures"). The matching logic lowercases both sides for comparison, but aliases accumulate in mixed case, making them harder to audit and potentially causing subtle matching issues.

## Task

Normalize all aliases to lowercase before saving to the database. Also normalize `bankName` on save.

## Acceptance Criteria

- [ ] New aliases added via `applyResolution()` are lowercased before saving
- [ ] `bankName` set via `applyResolution()` is lowercased before saving
- [ ] Existing aliases are not affected (no migration of existing data needed, but a one-time normalization script would be nice)
- [ ] Matching logic continues to work correctly (it already lowercases for comparison)

## Pointers

- `src/lib/resolution-queue.ts:247-263` — alias save logic; `sourceEntity` is saved as-is (line 257, 261)
- `src/lib/mercury.ts:93-106` — matching logic already lowercases for comparison
