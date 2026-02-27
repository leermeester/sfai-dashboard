# Add unit tests for matching engine

## Context

Part of Quality Foundation (parent). The matching engine (`matching.ts`, 377 lines) is the core of entity resolution — it determines if bank transactions map to customers and if vendor charges get categorized. Wrong matches silently corrupt margin calculations. This code has zero tests.

## Task

Write comprehensive unit tests for all exported functions in `matching.ts`: `levenshteinDistance`, `matchCustomer`, `classifyDomain`, `categorizeVendor`, `matchSheetCustomer`, and the confidence scoring internals.

## Acceptance Criteria

- [ ] `levenshteinDistance()` tested with: identical strings, empty strings, completely different strings, single character difference, unicode characters
- [ ] `matchCustomer()` tested with: exact bankName match, alias match, partial match, no match, empty customer list, Stripe payout names
- [ ] `classifyDomain()` tested with: known service domains (google.com, zoom.us → ignored), customer email domains, unknown domains
- [ ] `categorizeVendor()` tested with: labor keywords, software keywords, no match, vendor rules from DB
- [ ] `combinedConfidence()` tested with: boundary values (0, 50, 90, 95, 100), edge cases where substring match flips the weight formula
- [ ] Auto-resolve threshold boundary tested: 89% → pending, 90% → auto-resolved (or per-type thresholds if milestone 4 is done first)
- [ ] At least 20 test cases total

## Pointers

- `src/lib/matching.ts:39-56` — `levenshteinDistance()` (pure function, easy to test)
- `src/lib/matching.ts:59-67` — `levenshteinScore()` normalization
- `src/lib/matching.ts:70-100` — `tokenOverlap()`, `substringScore()`, `combinedConfidence()`
- `src/lib/matching.ts:103-170` — `matchCustomer()` — test with mock customer arrays
- `src/lib/matching.ts:240-251` — hardcoded service domain list for `classifyDomain()`
- `src/lib/matching.ts:305-312` — hardcoded keyword lists for `categorizeVendor()`
