# Implement per-type confidence thresholds

## Context

Part of Validated Entity Resolution (parent). All resolution types use the same 90% auto-resolve threshold. But `customer_match` errors directly affect revenue attribution (high impact), while `domain_classify` errors only affect meeting categorization (low impact). Different types should have different thresholds.

## Task

Replace the single `AUTO_RESOLVE_THRESHOLD = 90` constant with a per-type threshold map. Revenue-affecting types should require higher confidence; low-impact types can be more permissive.

## Acceptance Criteria

- [ ] `customer_match` auto-resolves at 95% (revenue impact — high bar)
- [ ] `sheet_customer` auto-resolves at 90% (revenue impact — moderate bar)
- [ ] `domain_classify` auto-resolves at 85% (low impact — permissive)
- [ ] `vendor_categorize` auto-resolves at 80% (cost categorization — permissive)
- [ ] Thresholds are defined in a single config object in `matching.ts`
- [ ] `createResolutionItems()` uses the type-specific threshold instead of the global one

## Pointers

- `src/lib/matching.ts:376` — `AUTO_RESOLVE_THRESHOLD = 90` — replace with a map
- `src/lib/resolution-queue.ts:55` — `item.confidence >= AUTO_RESOLVE_THRESHOLD` — change to use type-specific threshold
