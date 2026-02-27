# Validate entity resolution — Auditable, reversible matching decisions

## Context

The resolution queue auto-resolves items at 90% confidence, writing directly to the database without validating that the target entity exists, without logging what changed, and without per-type threshold tuning. The voice parser defaults to "approve" on unrecognized input. There's no way to audit or reverse a bad auto-resolution.

## Scope

- [ ] Validate customerId exists before applying resolution side effects
- [ ] Per-type confidence thresholds (95% for revenue-affecting matches, 85% for domains)
- [ ] Audit log recording before/after state for every resolution side effect
- [ ] Voice parser defaults to "skip" instead of "approve" on unrecognized input
- [ ] Normalize aliases to lowercase on save

## Out of Scope

- LLM-based matching (staying rule-based)
- UI for browsing audit logs
- A/B testing framework for threshold tuning

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Validate entity references before applying resolution | — | S |
| 2 | Implement per-type confidence thresholds | — | S |
| 3 | Add audit log for resolution side effects | — | M |
| 4 | Fix voice parser default from approve to skip | — | XS |
| 5 | Normalize aliases to lowercase on save | — | XS |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- Audit Report: `AUDIT_REPORT.md` — Findings #3, #14
- Resolution side effects: `src/lib/resolution-queue.ts:206-339`
- Matching thresholds: `src/lib/matching.ts:376`
- Voice parser: `src/lib/voice.ts:149-195`
