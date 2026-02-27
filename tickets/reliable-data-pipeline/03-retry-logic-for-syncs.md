# Add retry logic with backoff to Mercury and Calendar sync

## Context

Part of Reliable Data Pipeline (parent). External API calls (Mercury, Google Sheets/Calendar) have no retry logic. A single transient failure (network blip, 503, rate limit) causes the entire sync to fail, leaving data stale for 24 hours until the next cron run.

## Task

Add a retry wrapper with exponential backoff for external API calls in `mercury.ts` and `calendar.ts`. Retry up to 3 times with delays of 1s, 2s, 4s. Also add a fetch timeout of 15 seconds to prevent hanging requests.

## Acceptance Criteria

- [ ] Mercury API calls (`getAccounts`, `getTransactions`) retry up to 3 times on transient errors (5xx, network error, timeout)
- [ ] Calendar/Sheets CSV fetch retries up to 3 times on transient errors
- [ ] Retries use exponential backoff (1s, 2s, 4s)
- [ ] 4xx errors (except 429) are NOT retried (client errors indicate bad request)
- [ ] 429 (rate limit) IS retried with backoff
- [ ] Each fetch has a 15-second timeout via `AbortController`
- [ ] Total retry time doesn't exceed 30 seconds to stay within Vercel function limits

## Pointers

- `src/lib/mercury.ts:32-56` — `getAccounts()` and `getTransactions()` — wrap fetch calls
- `src/lib/sheets.ts:12-16` — CSV fetch — wrap fetch call
- `src/lib/calendar.ts` — Calendar CSV fetch — wrap fetch call
- Create a shared `src/lib/fetch-with-retry.ts` utility to avoid duplication
