# Create GitHub API client

## Context

Part of roadmap-based capacity estimation (parent). Each customer has a GitHub repo with tickets in `tickets/<milestone-slug>/<nn>-<name>.md` format. We need a client that reads the repo's file tree and counts ticket files per milestone folder.

## Task

Create `src/lib/github.ts` that uses the GitHub API to count `.md` files in each customer repo's `tickets/` directory. The client should use the Git Trees API for efficiency (single call to get the full tree) and group results by milestone folder.

## Acceptance Criteria

- [ ] `fetchTicketCounts(repo)` returns an array of `{ milestoneFolder, ticketCount, ticketFiles }` for each folder under `tickets/`
- [ ] Only `.md` files are counted (not directories or other file types)
- [ ] `README.md` files in milestone folders are excluded from the ticket count (they're parent issues, not individual tickets)
- [ ] Repos with no `tickets/` directory return an empty array (not an error)
- [ ] `testGithubConnection(repo)` returns true/false for Settings panel integration checks
- [ ] Unit test with mocked GitHub API responses covers: normal repo, empty tickets dir, no tickets dir, truncated tree

## Watch Out For

- **Git Trees API truncation**: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` truncates at ~100k entries. If `response.truncated === true`, fall back to `GET /repos/{owner}/{repo}/contents/tickets` and iterate per-folder.
- **Branch default**: Use the repo's default branch (available from `GET /repos/{owner}/{repo}` → `default_branch`), not hardcoded "main" — some repos use "master" or custom branch names.
- **Rate limits**: GitHub returns 403 (not 429) when rate-limited. Check `X-RateLimit-Remaining` header. The `fetchWithRetry` handles 429 and 5xx but not 403 — add a check for rate-limit 403s.

## Pointers

- `src/lib/fetch-with-retry.ts` — use for all GitHub API calls
- `src/lib/logger.ts` — structured logging
- `src/lib/notion.ts` — sibling API client (same structural pattern)
- GitHub Trees API: `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
- Response shape: `{ tree: [{ path: "tickets/milestone/01-ticket.md", type: "blob" }, ...], truncated: boolean }`
- Auth header: `Authorization: Bearer ghp_...` from `process.env.GITHUB_TOKEN`
