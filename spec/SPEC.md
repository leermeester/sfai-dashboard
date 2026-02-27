# Engineer Cost Tracking & Attribution

## Overview & Goals

Replace the manual TimeAllocation-based cost estimation with an automated system that uses actual bank transaction data and Linear ticket distribution to calculate per-engineer, per-project costs.

**User Stories:**
- As a co-founder, I want to see how much each engineer costs per project so I can calculate accurate margins
- As a co-founder, I want bank transactions automatically matched to engineers so I don't manually enter monthly costs
- As a co-founder, I want Upwork payments split across engineers through the resolution queue

**Success Criteria:**
- Engineering costs in margins are derived from actual bank payments (not manual estimates)
- Each engineer's cost is distributed across projects proportional to their Linear ticket completion
- Upwork/bulk transactions can be split across multiple engineers via the resolution queue
- Internal work (non-client tickets) is captured in an "SFAI Internal" bucket

## Core Formula

```
attributed_cost(engineer, customer, month) =
  actual_bank_payment(engineer, month) ×
  (completed_tickets(engineer, customer, month) / total_tickets(engineer, month))
```

## Technical Implementation

### Data Models (New)

**EngineerPayment** — Links a BankTransaction to a TeamMember
- `teamMemberId`, `bankTransactionId`, `amount`, `month`
- Unique: `(bankTransactionId, teamMemberId)`
- Supports splits: multiple records per transaction (for Upwork)

**EngineerCostAllocation** — Computed cost per (engineer, customer, month)
- `teamMemberId`, `customerId`, `month`, `ticketCount`, `totalTickets`, `percentage`, `attributedCost`
- Unique: `(teamMemberId, customerId, month)`

### Data Model Changes

**TeamMember** — Added `mercuryCounterparty` field for matching bank counterparty names

### Data Flow

```
Mercury sync → BankTransaction (outgoing, costCategory="labor")
  → Match counterpartyName to TeamMember.mercuryCounterparty
    → Direct match → EngineerPayment (full amount)
    → Upwork/unmatched → ResolutionItem type="engineer_split"
      → Manual split → multiple EngineerPayments

Linear sync → Completed tickets by (assignee, project, month)
  → Map project → Customer (via linearProjectId)
  → Map assignee → TeamMember (via linearUserId)
  → Unmapped projects → "SFAI Internal" pseudo-customer
  → Calculate: tickets_for_customer / total_tickets = percentage

EngineerPayment.amount × ticket percentage
  → EngineerCostAllocation per (engineer, customer, month)
    → Sum per customer → MonthlyMargin.engineeringCost
```

### API Endpoints

- `GET /api/engineer-costs?month=YYYY-MM` — Returns cost matrix and payment data
- `PUT /api/settings/team` — Extended to handle `mercuryCounterparty`
- `POST /api/resolution/[id]/resolve` — Extended to handle `engineer_split` with `engineerSplits` payload

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/cost-attribution.ts` | Core cost attribution engine |
| `src/lib/mercury.ts` | `matchLaborTransactionsToEngineers()` |
| `src/lib/linear-sync.ts` | `computeTicketDistribution()` |
| `src/lib/margins.ts` | Updated to use EngineerCostAllocation |
| `src/lib/resolution-queue.ts` | `engineer_split` type handling |

## UI/UX Design

### Settings > Team Configuration
- New "Mercury Counterparty" column — enter the exact bank counterparty name for each engineer

### Resolution Queue
- New "Engineer Splits" filter tab
- Engineer split cards show: counterparty name, total amount, transaction count
- Split form: table with engineer rows and dollar amount inputs
- Validation: splits must total exactly the transaction amount

### Margins Page (Enhanced)
1. **P&L Summary Cards** — Total Revenue, Engineering Cost, Gross Margin, Margin % (unchanged)
2. **Engineer Cost Matrix** (new) — rows=engineers, columns=customers, cells=attributed cost with row/column totals
3. **Customer Margins Table** (enhanced) — clickable rows expand to show per-engineer breakdown with ticket counts
4. **Margin Trend Chart** (unchanged)
5. **Time Allocation Form** — removed (replaced by automated cost attribution)

## Security & Privacy

- No new secrets or API keys required
- All existing auth (JWT + cron secret) applies to new endpoints
- Bank transaction amounts are sensitive — existing access controls apply

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bank transactions as sole cost source | Actual payments are more accurate than manual estimates; $0 until posted |
| Ticket count distribution (not story points) | Simpler, doesn't require consistent estimation practices |
| SFAI Internal pseudo-customer | Captures internal work cost separately from client margins |
| Resolution queue for Upwork splits | Reuses existing UI pattern; threshold=100 means never auto-resolves |
| TimeAllocation form removed | Replaced by automated ticket-based distribution |
