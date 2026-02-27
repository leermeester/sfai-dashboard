# Build Multi-Interface Resolution Queue — Automate data triage across all sync sources

## Context

The Settings page requires manual cross-referencing of customer names across 4 systems (Sheets, Mercury, Calendar, Linear). Every mismatch must be hand-wired: bank counterparty → customer, email domain → meeting type, vendor → cost category. This creates ongoing friction for a 2-person team.

This feature introduces a shared "resolution queue" backend that auto-matches entities using fuzzy matching and LLM classification, then exposes pending decisions through 4 interfaces (dashboard UI, Slack bot, CLI, voice) so DJ/Arthur can triage from wherever is most convenient.

## Scope

- [ ] Fuzzy matching engine with confidence scoring for all entity types
- [ ] `ResolutionItem` queue model tracking unmatched entities and suggested resolutions
- [ ] Auto-resolution for high-confidence matches (>90%)
- [ ] Dashboard card-stack approval UI with keyboard shortcuts
- [ ] Slack bot with guided framework messages and inline action buttons
- [ ] CLI tool (`sfai match`) with interactive terminal prompts
- [ ] Voice API endpoints compatible with existing Whisper flow
- [ ] All 4 interfaces resolve items through the same backend

## Out of Scope

- Writing matched IDs back to source systems (Sheets, Mercury)
- Changing the existing Settings page (it remains as the full-config editor)
- Team member or cost configuration (genuinely new data, not entity resolution)
- Time allocation refinement (judgment calls, not matchable)

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Add ResolutionItem model and migration | — | XS |
| 2 | Build fuzzy matching engine | — | M |
| 3 | Build resolution queue CRUD and API | #1 | S |
| 4 | Integrate matching into sync routes | #1, #2, #3 | M |
| 5 | Build dashboard approval queue UI | #3 | M |
| 6 | Build Slack bot with guided messages | #3 | M |
| 7 | Build CLI triage tool | #3 | M |
| 8 | Build voice session endpoints | #3 | S |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days)

## Resources

- [Implementation Plan](../../.claude/plans/whimsical-enchanting-allen.md)
- Existing sync infrastructure: `src/app/api/cron/sync/route.ts`
- Mercury sync: `src/lib/mercury.ts` (matching logic at lines 87-106)
- Calendar sync: `src/lib/calendar.ts` (domain matching at lines 170-220)
- Sheets sync: `src/lib/sheets.ts` (customer matching at lines 220-230)
- Prisma schema: `prisma/schema.prisma`
