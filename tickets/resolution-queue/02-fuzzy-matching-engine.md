# Build fuzzy matching engine

## Context

Part of the multi-interface resolution queue (parent). The matching engine is the brain that turns "unmatched entity X" into "suggested match Y with Z% confidence." It runs during every sync to auto-resolve obvious matches and flag ambiguous ones for human review.

## Task

Create a matching engine at `src/lib/matching.ts` that takes an unmatched entity string and a list of known entities, then returns ranked suggestions with confidence scores. Support four matching strategies per entity type, from cheap/fast to expensive/smart.

**Matching strategies by type:**

| Type | Exact Match | Fuzzy Match | LLM Fallback |
|------|------------|-------------|--------------|
| `customer_match` | bankName, aliases (case-insensitive substring) | Levenshtein on displayName, spreadsheetName | "Is 'Nouri Health Inc' the same company as 'Nouri'?" |
| `domain_classify` | Customer.emailDomain exact match | Domain-to-company-name heuristic (strip TLD, compare) | "Is 'nouri.health' likely a client domain or a generic service?" |
| `vendor_categorize` | VendorCategoryRule.vendorPattern substring | Token overlap between vendor name and rule patterns | "Is 'GUSTO INC PAYROLL' a labor cost, software cost, or other?" |
| `sheet_customer` | spreadsheetName exact, displayName exact | Levenshtein on all name fields + aliases | — |

## Acceptance Criteria

- [ ] `matchCustomer(counterpartyName, customers[])` returns `{ customerId, confidence, matchedOn }[]` sorted by confidence
- [ ] `classifyDomain(domain, customers[], existingMappings[])` returns `{ meetingType, customerId?, confidence }[]`
- [ ] `categorizeVendor(counterpartyName, rules[])` returns `{ category, ruleId?, confidence }[]`
- [ ] `matchSheetCustomer(sheetName, customers[])` returns `{ customerId, confidence, matchedOn }[]`
- [ ] Levenshtein distance normalized to 0-100 confidence scale (100 = exact, 0 = completely different)
- [ ] LLM fallback is optional and gated behind a flag (don't call Claude for every match)

## Watch Out For

- **Confidence calibration**: A Levenshtein score alone isn't enough — "Nouri" vs "Nouri Health Inc" has high edit distance but is clearly the same entity. Token overlap (how many words from A appear in B) is a better signal for company names. Use a weighted combination.
- **LLM cost**: At ~$0.01/call, matching 100 entities costs $1. Gate LLM behind a confidence threshold — only call it when fuzzy score is between 40-80 (ambiguous range).

## Pointers

- `src/lib/mercury.ts:87-106` — existing exact matching logic for bank transactions (replace with calls to this engine)
- `src/lib/calendar.ts:121-139` — existing domain-to-customer lookup (same pattern to replace)
- `src/lib/sheets.ts:220-230` — existing customer name matching for sheet rows
- No need for an external fuzzy matching library — Levenshtein + token overlap is ~30 lines of code
