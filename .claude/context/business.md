# Business Context — SFAI Dashboard

> Last updated: 2026-02-25

## 1. Company Overview

**SFAI Labs** is an AI development services company. The team builds AI solutions for clients on a project basis.

### Team

| Name | Role | Type |
|------|------|------|
| Arthur | CEO / Co-founder | Permanent |
| DJ | CTO / Co-founder | Permanent |
| Nash | Best engineer | Permanent |
| Ravi | AI Engineer | Freelance |
| Jonathan | (role TBD) | Permanent |
| Michal | iOS Engineer | Freelance |
| Others | Various | Freelance |

### Tools & Systems
- **Linear**: Project management — team "SFAI Labs", one project per customer
- **Google Sheets**: Revenue tracking — customers on rows, months on columns
- **Mercury**: Business banking — used to confirm receipt of payments
- **GitHub**: Code hosting (DJ's personal GitHub, Arthur invited)

---

## 2. Dashboard Goals

The dashboard exists to solve three operational problems:

### 2.1 Capacity Planning
**Problem**: No system in place for capacity planning.
- Mix of permanent and freelance developers
- No time tracking
- Need short-term (2-week) and long-term demand forecasts
- Inputs provided manually by DJ

### 2.2 Margin Calculation
**Problem**: Hard to determine per-project profitability.
- No time tracking means exact per-engineer-per-project hours are unknown
- Solution: retrospective estimation (% of time per project per month)
- Engineering cost = sum of (team member cost x % allocated to customer)
- Margin = revenue - engineering cost

### 2.3 Revenue & Pipeline
**Problem**: Revenue data scattered across Google Sheets and bank.
- Google Sheets has forward-looking expected revenue (forecasts)
- Mercury bank confirms actual cash received
- Need monthly snapshots to track forecast accuracy
- Snapshot frequency: monthly (1st of each month)

---

## 3. Key Business Requirements

### Customer Identity
Customers have different names across systems:
- **Google Sheets**: how they appear in the revenue spreadsheet
- **Mercury**: how they appear as bank counterparty
- **Linear**: how they appear as projects
- **Email**: how they're referenced in communication
- **Colloquial**: informal names used by the team

The dashboard must map all these identities to a single customer entity. Some customers may have undergone rebranding.

### Security & Access
- **Highly sensitive** — only shared between DJ and Arthur (co-founders)
- Hosted on DJ's personal GitHub
- Google Sheets shared via personal Google accounts
- Password-protected dashboard with JWT sessions

### Data Freshness
- Revenue spreadsheet updated dynamically throughout the month
- Future numbers in the sheet = expected revenue from that customer
- Bank transactions synced daily via Mercury API
- Monthly snapshots capture point-in-time revenue forecasts

---

## 4. Stakeholders

| Person | Role | Interest |
|--------|------|----------|
| DJ (CTO) | Primary user | Capacity planning, technical oversight, margin analysis |
| Arthur (CEO) | Primary user | Revenue overview, financial health, forecasting |

---

## 5. Open Questions & Areas for Advice

- **Demand forecasting methodology**: Open to suggestions on how to structure short-term vs long-term forecasts
- **Presentation format**: Best way to present the data and accept input — open to suggestions
- **Time tracking alternative**: Retrospective % allocation is a workaround; may need refinement
- **Forecast accuracy**: How to best visualize and measure forecast drift over time
