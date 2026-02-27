# Engineer Cost Tracking & Attribution

## Context

Currently, engineering costs in the margin calculation are based on a manually-entered `TeamMember.monthlyCost` multiplied by a `TimeAllocation` percentage (manual or Linear-derived). This is inaccurate: it doesn't use actual bank payments, and the time allocation is often a rough guess.

The goal is to replace this with a system that:
1. Matches Mercury bank transactions to specific engineers (actual dollars paid)
2. Uses Linear ticket completion data to distribute each engineer's cost across projects
3. Shows a per-engineer, per-project cost breakdown on the enhanced Margins page

**Core formula:** `attributed_cost(engineer, customer, month) = actual_payment(engineer, month) × (tickets_completed(engineer, customer, month) / total_tickets(engineer, month))`

## Key Decisions (from interview)

| Decision | Choice |
|----------|--------|
| Payment matching | `mercuryCounterparty` field on TeamMember for 1:1 direct transfers |
| Upwork/bulk transactions | Manual split via resolution queue (new `engineer_split` type) |
| Cost fallback | None — bank transactions only. $0 until transaction posts |
| Allocation basis | Linear completed ticket count distribution (monthly) |
| Internal work | "SFAI Internal" pseudo-customer for non-client tickets |
| UI location | Enhanced Margins page (matrix + drill-down) |
| TimeAllocation | Remove the form entirely |

---

## Implementation Plan

### Phase 1: Schema Changes
**File:** `prisma/schema.prisma`

1. Add to `TeamMember`: `mercuryCounterparty String?`
2. Add to `Customer`: `isInternal Boolean @default(false)`
3. Create `EngineerPayment` model — links a BankTransaction to a TeamMember with an amount
   - Fields: `id, teamMemberId, bankTransactionId, amount, month`
   - Unique: `(bankTransactionId, teamMemberId)`
   - Supports splits: multiple EngineerPayments per transaction (Upwork)
4. Create `EngineerCostAllocation` model — computed cost per (engineer, customer, month)
   - Fields: `id, teamMemberId, customerId, month, ticketCount, totalTickets, percentage, attributedCost`
   - Unique: `(teamMemberId, customerId, month)`
5. Add relation fields on `BankTransaction`, `TeamMember`, `Customer`
6. Run migration, seed "SFAI Internal" pseudo-customer

### Phase 2: Bank Transaction → Engineer Matching
**Files:** `src/lib/mercury.ts`, `src/app/api/cron/sync/route.ts`

1. New function `matchLaborTransactionsToEngineers(db)`:
   - Query outgoing `costCategory="labor"` transactions without EngineerPayments
   - Match `counterpartyName` against `TeamMember.mercuryCounterparty` (case-insensitive)
   - Direct match → create `EngineerPayment` (full amount)
   - No match → create `ResolutionItem` type `engineer_split` with transaction IDs and team member list in context
2. Call from `syncTransactions()` and the cron sync route

### Phase 3: Linear Ticket Distribution
**File:** `src/lib/linear-sync.ts`

1. New function `computeTicketDistribution(month)`:
   - Reuse existing Linear fetch + cache logic
   - Count completed tickets per (engineer, customer, month) — monthly granularity, no per-week
   - Map projects → customers via `Customer.linearProjectId`
   - Map assignees → team members via `TeamMember.linearUserId`
   - Unmapped project tickets → "SFAI Internal" pseudo-customer
   - Return: `{ distributions: TicketDistribution[], issueCount, unmappedCount }`

### Phase 4: Cost Attribution Engine
**New file:** `src/lib/cost-attribution.ts`

1. New function `recalculateCostAttribution(db, month)`:
   - Get ticket distributions from Phase 3
   - Get `EngineerPayment` totals per engineer for the month
   - Compute: `attributedCost = paymentTotal × (ticketCount / totalTickets)`
   - Upsert `EngineerCostAllocation` records
   - Clean up stale allocations
2. Update `src/lib/margins.ts` — `recalculateMargins()` uses `EngineerCostAllocation` sums instead of `monthlyCost × TimeAllocation %`

### Phase 5: Resolution Queue Extension
**Files:** `src/lib/resolution-queue.ts`, `src/lib/matching.ts`, `src/lib/validations.ts`

1. Add `engineer_split` to resolution types and auto-resolve thresholds (threshold=100, never auto)
2. Add `engineerSplits` field to `ResolveDecision` (array of `{ teamMemberId, amount }`)
3. New case in `applyResolution()`: create `EngineerPayment` records from split assignments
4. Update Zod schemas in `validations.ts`

### Phase 6: Settings UI — Mercury Counterparty
**Files:** `src/components/forms/team-config-form.tsx`, `src/app/api/settings/team/route.ts`, `src/app/(dashboard)/settings/page.tsx`

1. Add "Mercury Counterparty" column to team config table
2. Persist through existing PUT endpoint

### Phase 7: Resolution Queue UI — Engineer Split Card
**New file:** `src/components/resolution/engineer-split-card.tsx`

1. Shows counterparty name, total amount, transaction count
2. Table with engineer rows and dollar amount inputs
3. Validation: splits must sum to transaction total (±$0.01)
4. "Save Split" resolves with `engineerSplits` payload
5. Integrate into existing resolution queue page (add filter tab + card delegation)

**Modified:** `src/app/(dashboard)/resolution/resolution-queue.tsx`, `src/components/resolution/resolution-card.tsx`, `src/app/(dashboard)/resolution/page.tsx`

### Phase 8: Enhanced Margins Page
**Modified:** `src/app/(dashboard)/margins/page.tsx`, `src/components/tables/margin-table.tsx`
**New files:** `src/components/tables/engineer-cost-matrix.tsx`, `src/components/tables/customer-engineer-breakdown.tsx`

1. **Remove** TimeAllocationForm from margins page
2. **Add** engineer × customer cost matrix table (rows=engineers, cols=customers, cells=attributed cost, with row/column totals)
3. **Add** expandable rows in margin table — clicking a customer shows per-engineer P&L cards with:
   - Engineer name, total monthly payment, % allocated here, attributed cost, ticket count
   - Cost split across ALL clients (not just this one)
   - Links to Linear tickets
4. **New API endpoint** `GET /api/engineer-costs?month=YYYY-MM` for the matrix data

### Phase 9: Migration & Cleanup
1. Deploy schema changes (additive, non-breaking)
2. Run `matchLaborTransactionsToEngineers()` for existing transactions
3. Run `recalculateCostAttribution()` for recent months
4. Remove TimeAllocation form from UI
5. Later cleanup PR: deprecate `TimeAllocation` model, remove `/api/settings/allocations`, remove `time-allocation-form.tsx`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/cost-attribution.ts` | Core cost attribution engine |
| `src/app/api/engineer-costs/route.ts` | API endpoint for cost matrix data |
| `src/components/tables/engineer-cost-matrix.tsx` | Engineer × Customer cost matrix |
| `src/components/tables/customer-engineer-breakdown.tsx` | Per-customer engineer drill-down |
| `src/components/resolution/engineer-split-card.tsx` | Upwork split dialog |
| `src/lib/__tests__/cost-attribution.test.ts` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | New models + fields |
| `src/lib/mercury.ts` | Add `matchLaborTransactionsToEngineers()` |
| `src/lib/linear-sync.ts` | Add `computeTicketDistribution()` |
| `src/lib/margins.ts` | Use EngineerCostAllocation instead of TimeAllocation |
| `src/lib/resolution-queue.ts` | Handle `engineer_split` type |
| `src/lib/matching.ts` | Add threshold for `engineer_split` |
| `src/lib/validations.ts` | Extend schemas |
| `src/app/api/settings/team/route.ts` | Handle `mercuryCounterparty` |
| `src/app/api/cron/sync/route.ts` | Add engineer matching step |
| `src/app/api/resolution/[id]/resolve/route.ts` | Handle `engineer_split` resolution |
| `src/components/forms/team-config-form.tsx` | Add Mercury Counterparty column |
| `src/components/resolution/resolution-card.tsx` | Delegate to split card |
| `src/app/(dashboard)/resolution/resolution-queue.tsx` | Add filter tab |
| `src/app/(dashboard)/resolution/page.tsx` | Fetch team members |
| `src/app/(dashboard)/margins/page.tsx` | Replace TimeAllocation with cost matrix |
| `src/components/tables/margin-table.tsx` | Add expandable engineer breakdown |
| `src/app/(dashboard)/settings/page.tsx` | Pass `mercuryCounterparty` |

## Verification

1. **Schema**: `npx prisma migrate dev` succeeds, `npx prisma generate` produces correct types
2. **Unit tests**: Cost attribution math, ticket distribution, edge cases (no payment = $0, no tickets, zero-division)
3. **Integration**: Mercury sync creates EngineerPayments for matched transactions, queues Upwork for resolution
4. **Manual QA**:
   - Settings: Mercury Counterparty column saves
   - Resolution queue: Engineer Split cards work with amount validation
   - Margins page: Cost matrix renders, expandable rows show engineer breakdown
   - P&L numbers = sum of EngineerCostAllocation.attributedCost
   - No-payment engineer = $0 (no fallback)
   - Internal tickets → "SFAI Internal" bucket
5. **Build**: `npm run build` succeeds with no type errors
