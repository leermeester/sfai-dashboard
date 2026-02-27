# Create Notion API client

## Context

Part of roadmap-based capacity estimation (parent). Each customer has a Notion database called "AI Technical Roadmap" with columns: Milestones (title), Primary Objective, Key Technical Components, Value Creation, Timeline, Notes. We need a client that queries these databases and returns parsed milestone data.

## Task

Create `src/lib/notion.ts` that queries the Notion API to fetch milestones from a database. Also create `src/lib/roadmap-config.ts` for shared constants. The client should handle pagination, parse rich text to plain text, extract timeline weeks from strings like ".5 Week" or "1.5 Weeks", and detect release groups from the Notes column.

## Acceptance Criteria

- [ ] `fetchMilestones(databaseId)` returns an array of parsed milestones with name, primaryObjective, technicalComponents, valueCreation, timelineWeeks (number), releaseGroup, notes, sortOrder
- [ ] Rich text blocks (Notion's `{ type: "text", text: { content: "..." } }` arrays) are flattened to plain strings
- [ ] Timeline parsing handles: ".5 Week", "1 Week", "1.5 Weeks", ".5-1.5 Weeks" (take the upper bound), and returns null for unparseable values
- [ ] Pagination works for databases with >100 items (Notion's page limit)
- [ ] `testNotionConnection(databaseId)` returns true/false for Settings panel integration checks
- [ ] Unit test with mocked Notion API responses covers: normal milestones, empty database, missing columns, pagination

## Watch Out For

- **Notion API auth**: Uses `Authorization: Bearer ntn_...` header plus `Notion-Version: 2022-06-28`. The integration must be shared with each customer's database in Notion — a 404 means the database hasn't been shared, not that it doesn't exist.
- **Rich text is nested**: A "Primary Objective" cell isn't a string — it's `{ rich_text: [{ type: "text", text: { content: "..." } }, ...] }`. You need to concatenate all `text.content` values in the array.
- **Timeline column type varies**: Some customers might use a "rich_text" property, others might use a "select". Handle both by checking the property type.

## Pointers

- `src/lib/fetch-with-retry.ts` — use for all Notion API calls (handles 429 rate limits)
- `src/lib/logger.ts` — `createLogger()` for structured logging, `Logger` type for function signatures
- `src/lib/mercury.ts` — reference pattern: external API client with fetchWithRetry + logger + env-based auth
- `src/lib/__tests__/` — put tests in `notion.test.ts`, follow existing test file patterns
- Notion API endpoint: `POST https://api.notion.com/v1/databases/{id}/query`
- Notion API response shape: `{ results: [{ id, properties: { "Milestones": { title: [...] }, ... } }], has_more, next_cursor }`
