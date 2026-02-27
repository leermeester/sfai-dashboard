# Extend Customer model with Notion and GitHub config

## Context

Part of roadmap-based capacity estimation (parent). Each customer has their own Notion roadmap page and GitHub repo where implementation tickets live. The Customer model needs two new fields so the sync system knows where to pull data from.

## Task

Add `notionDatabaseId` and `githubRepo` to the Customer model, extend the Zod validation schema, update the customer settings API route to persist these fields, and add two new columns to the customer mapping form. Also add three new models (`RoadmapMilestone`, `TicketSnapshot`, `RoadmapSyncLog`) that the sync system will write to, and add `NOTION_API_KEY` and `GITHUB_TOKEN` to `.env.example`.

## Acceptance Criteria

- [ ] Customer model has `notionDatabaseId` (optional string) and `githubRepo` (optional string, `owner/repo` format)
- [ ] `RoadmapMilestone`, `TicketSnapshot`, and `RoadmapSyncLog` models exist with correct indexes and unique constraints
- [ ] Settings > Customers form shows "Notion DB ID" and "GitHub Repo" columns that save correctly
- [ ] `prisma db push` applies without errors
- [ ] `.env.example` includes `NOTION_API_KEY` and `GITHUB_TOKEN`

## Watch Out For

- **Customer upsert data object**: The `data` object in `src/app/api/settings/customers/route.ts:42-50` explicitly lists every field. The two new fields must be added to this object — they won't be auto-included by the spread.
- **Form state type**: The `Customer` interface in `src/components/forms/customer-mapping-form.tsx:32-42` must include the new fields, otherwise TypeScript will silently drop them from the form state.

## Pointers

- `prisma/schema.prisma:31-52` — Customer model to extend
- `src/lib/validations.ts:6-16` — `customerSchema` to extend with two new optional string fields
- `src/app/api/settings/customers/route.ts:42-50` — upsert data object that needs new fields
- `src/components/forms/customer-mapping-form.tsx:32-42` — `Customer` interface to extend
- `src/components/forms/customer-mapping-form.tsx:125-133` — TableHeader where new columns go (after "Linear Project ID")
- `src/components/forms/customer-mapping-form.tsx:180-188` — existing `linearProjectId` Input cell pattern to follow
- `.env.example` — add `NOTION_API_KEY` and `GITHUB_TOKEN` entries
