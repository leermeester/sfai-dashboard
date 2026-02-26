# Learnings & Gotchas — SFAI Dashboard

> Last updated: 2026-02-25

## Google Sheets Integration

- Uses CSV export via public link (`/export?format=csv`) — does NOT use the Google Sheets API
- The spreadsheet must have "Anyone with the link" access enabled for CSV export to work
- Service account credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) are in `.env` but the current implementation doesn't use them — it relies on public CSV export
- Month header formats in the sheet vary: `Jan 2026`, `2026-01`, `01/2026` — all are handled by `normalizeMonth()`
- Revenue amounts may contain `$`, `€`, `£`, commas, spaces — `parseAmount()` strips these

## Mercury Bank API

- Only positive (incoming) transactions are processed for revenue reconciliation
- Customer matching is done by lowercase substring match on `counterpartyName` against `bankName` and `aliases`
- `syncTransactions()` pulls last 90 days — older transactions won't be synced
- Upsert on `mercuryId` prevents duplicates; existing manual reconciliation is preserved on re-sync

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
