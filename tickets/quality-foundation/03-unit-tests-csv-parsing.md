# Add unit tests for CSV parsing

## Context

Part of Quality Foundation (parent). `parseCsv()` and `parseRevenueMatrix()` in `sheets.ts` handle arbitrary Google Sheets CSV data. Malformed CSV (missing columns, unmatched quotes, empty cells) could cause silent data loss or incorrect revenue numbers. This code has zero tests.

## Task

Write unit tests for `parseCsv()`, `parseRevenueMatrix()`, `normalizeMonth()`, and `parseAmount()` covering normal cases and edge cases.

## Acceptance Criteria

- [ ] `parseCsv()` tested with: simple CSV, quoted fields, embedded commas, embedded newlines, double quotes, empty cells, empty file, no trailing newline
- [ ] `parseRevenueMatrix()` tested with: valid matrix, missing "Customers" header, section terminators stop parsing, skip names (Total, Pipeline), year rollover in month headers
- [ ] `normalizeMonth()` tested with: "YYYY-MM", "Jan 2026", "January 2026", "Jan '26", "08/2026", bare "Jan" with default year, invalid strings return null
- [ ] `parseAmount()` tested with: "$1,000", "1000.50", "$1,000,000", "x" (returns null), "" (returns null), negative numbers
- [ ] At least 15 test cases total

## Watch Out For

- **Export visibility**: `parseCsv`, `normalizeMonth`, and `parseAmount` are not currently exported. You'll need to either export them or test them indirectly through `parseRevenueMatrix()` and `getSheetData()`.

## Pointers

- `src/lib/sheets.ts:23-63` — `parseCsv()` — char-by-char parser
- `src/lib/sheets.ts:65-147` — `parseRevenueMatrix()` — matrix extraction
- `src/lib/sheets.ts:149-193` — `normalizeMonth()` — month header parsing
- `src/lib/sheets.ts:195-200` — `parseAmount()` — currency string parsing
