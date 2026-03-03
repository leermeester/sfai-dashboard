# Operating Principles — SFAI Dashboard

> Last updated: 2026-02-25

## 1. Decision Framework

When making technical or product decisions, apply this priority order:

1. **Security first** — This dashboard contains sensitive financial data. Never expose secrets, always validate auth, minimize attack surface.
2. **Correctness over speed** — Financial data must be accurate. Prefer explicit failures over silent fallbacks.
3. **Simplicity over abstraction** — Two co-founders are the only users. Don't over-engineer. A working simple solution beats an elegant complex one.
4. **Specification compliance** — Follow `spec.md`. If a case isn't specified, let the code fail. Do not invent behavior.

## 2. Code Principles

### No Invented Behavior
- Never create fallback methods not defined in `spec.md`
- If requirements are ambiguous, flag it — don't guess
- Unhandled cases should fail loudly, not silently return defaults

### Security Hygiene
- All secrets loaded from `.env` at runtime
- Never log, commit, or expose API keys, passwords, or tokens
- Auth on every route via middleware — no exceptions

### Data Integrity
- Customer identity mapping is critical — the same customer has different names in Sheets, Mercury, Linear
- Revenue snapshots are immutable once created (append-only)
- Bank reconciliation preserves manual overrides on re-sync

### Minimal Dependencies
- Prefer built-in Next.js/React capabilities over adding libraries
- shadcn/ui for components (copy-paste, not a dependency)
- No state management library — server components + React state suffice

## 3. Communication Principles

### Between Co-founders
- Dashboard is the single source of truth for financial metrics
- All data should be self-explanatory without external context
- Alerts should surface only actionable items

### In Documentation
- Keep context files (`spec.md`, `architecture.md`, etc.) up to date after every change
- `spec.md` and `architecture.md` must never contradict each other
- Document deviations from the original plan with justification

## 4. Prompt-Writing Standards

When writing prompts (for AI integrations or tooling):

1. **Role** — Who is the AI acting as
2. **Task Context** — Background information
3. **Task** — What to do
4. **Instructions** — How to do it
5. **How To Think** — Decision framework
6. **Rules** — Constraints
7. **Output Format** — Expected structure
8. **Examples** — Concrete samples
