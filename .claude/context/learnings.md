# Learnings & Gotchas — SFAI Dashboard

> Last updated: 2026-02-25

## Google Sheets Integration

- Uses CSV export via public link (`/export?format=csv`) — does NOT use the Google Sheets API
- The spreadsheet must have "Anyone with the link" access enabled for CSV export to work
- Service account credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) are in `.env` but the current implementation doesn't use them — it relies on public CSV export
- Revenue amounts may contain `$`, `€`, `£`, commas, spaces — `parseAmount()` strips these
- **Sheet structure is complex**: the CSV has description text in the first rows, a pipeline section, then the actual customer data after a "Customers" header row
- **Month headers lack years**: "Jan", "Feb", "August [1-22]" etc. — years are inferred (first pass = 2025, after December rollover = 2026)
- **Data before August 2025 is unreliable** — pre-Aug snapshots should be excluded
- **Section terminator pattern**: parsing stops when hitting "SFAI" or team section headers to avoid treating team member names as customers
- **Alvamed has two contract rows** in the sheet — both map to the same customer, revenue is additive
- **"x" in a cell means the customer contract ended** — these cells are skipped

## Mercury Bank API

- Only positive (incoming) transactions are processed for revenue reconciliation
- Customer matching is done by lowercase substring match on `counterpartyName` against `bankName` and `aliases`
- `syncTransactions()` pulls last 90 days — older transactions won't be synced
- Upsert on `mercuryId` prevents duplicates; existing manual reconciliation is preserved on re-sync
- **Stripe payouts** show as counterparty "STRIPE" — these bundle multiple customer payments and Stripe takes a fee, so amounts don't match sheet values. Tagged with `[Stripe Payout]` prefix in description for identification. Must be manually reconciled.
- **Bank name ≠ customer name**: EchoFam pays as "VSV VENTURES", Nouri as "J&B Health LLC", Yachet Master Hub as "oceanfront ventures group"
- Non-customer transactions (WOLFPACK DIGITAL, Upwork Escrow, Payment Escrow, Mercury Cashback, Savings Interest) should be left unreconciled — they're vendor payments, not customer revenue
- **Margin calculation handles Stripe gap**: `recalculateMargins()` falls back to sheet snapshot revenue when no reconciled bank payment exists for a customer-month

## Linear Integration

- Uses API key auth (not OAuth) — simpler but scoped to a single user
- Workload calculation groups active issues (started + unstarted) by assignee
- Issue estimates (`estimate` field) are used as "points" for capacity tracking

## Authentication

- Single shared password for all users (stored as bcrypt hash in `.env`)
- JWT secret in `AUTH_JWT_SECRET` with fallback `"dev-secret-change-me"` — change this in production
- Session cookie: `sfai-session`, httpOnly, 30-day expiry
- Cron routes use a separate `CRON_SECRET` bearer token

## Database

- PostgreSQL via Vercel Postgres (connection pooling URL + direct URL)
- `prisma db push` for schema changes (no migrations in this project)
- `TimeAllocation` has a unique constraint on `[teamMemberId, customerId, month]`
- `MonthlyMargin` has a unique constraint on `[customerId, month]`

## Development

- Next.js 16 with Turbopack for dev server (`next dev --turbopack`)
- `build` script runs `prisma generate` before `next build`
- shadcn/ui components in `src/components/ui/` — use `npx shadcn@latest add <component>` to add new ones

## General Patterns

- Route group `(dashboard)` wraps all authenticated pages
- API routes follow Next.js App Router convention (`route.ts` files)
- Prisma client is a singleton (see `src/lib/db.ts`)
- All external API clients have a `testConnection()` function for the integration status panel
