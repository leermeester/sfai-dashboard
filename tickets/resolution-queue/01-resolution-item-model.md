# Add ResolutionItem model and migration

## Context

Part of the multi-interface resolution queue (parent). Every other sub-issue depends on this model existing. It stores unmatched entities from sync runs with suggested resolutions, confidence scores, and resolution status.

## Task

Add a `ResolutionItem` model to the Prisma schema and run the migration. The model captures: what was unmatched (type + source entity name + context), what the system suggests (suggested match + confidence), and how it was resolved (status + channel + timestamp).

## Acceptance Criteria

- [ ] `ResolutionItem` model exists in `prisma/schema.prisma` with fields: `id`, `type` (enum: customer_match, domain_classify, vendor_categorize, sheet_customer), `status` (enum: pending, auto_resolved, confirmed, rejected), `sourceEntity` (the unmatched string), `suggestedMatch` (JSON: proposed resolution), `confidence` (0-100), `context` (JSON: extra info like amount, date, meeting count), `resolvedVia` (nullable: dashboard, voice, cli, slack), `resolvedAt` (nullable DateTime), timestamps
- [ ] Migration runs cleanly against the existing schema
- [ ] Indexes on `status` and `type` for queue queries
- [ ] Unique constraint on `type` + `sourceEntity` to prevent duplicate queue entries for the same unmatched entity

## Pointers

- `prisma/schema.prisma` — add after `ClientMeeting` model (line 195)
- Existing pattern: all models use `@id @default(cuid())` and include `createdAt`/`updatedAt`
- Run migration: `npx prisma migrate dev --name add-resolution-item`
