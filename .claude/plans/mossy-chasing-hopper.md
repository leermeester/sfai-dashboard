# Plan: Match publishedAt Dates to Go-Live Dates

## Problem

All 30 roundup articles show `publishedAt: "2026-02-05"` (creation date). Articles going live on Feb 8 still say "Feb 5" on the blog. Need each article's `publishedAt` to match its `scheduledAt` date.

## Fix

Write a one-time script that reads each roundup article's `meta.json`, extracts the date from `scheduledAt`, and updates `publishedAt` in both `meta.json` and `index.mdx` frontmatter.

For each article:
- Read `scheduledAt` from `meta.json` (e.g., `"2026-02-08T09:00:00.000Z"`)
- Extract date portion → `"2026-02-08"`
- Update `meta.json`: set `publishedAt` to `"2026-02-08"`
- Update `index.mdx`: replace `publishedAt: "2026-02-05"` and `updatedAt: "2026-02-05"` with the new date

Also fix the Phased Content Release workflow: add `permissions: contents: write` to `.github/workflows/phased-release.yml`.

## Files Modified

| File | Change |
|------|--------|
| 30 × roundup `meta.json` | `publishedAt` set to date from `scheduledAt` |
| 30 × roundup `index.mdx` | Frontmatter `publishedAt` + `updatedAt` set to date from `scheduledAt` |
| `.github/workflows/phased-release.yml` | Add `permissions: contents: write` |

## Verification

1. Spot-check a few meta.json + index.mdx files to confirm dates match
2. `npm run prebuild` — verify build passes
3. Push, wait for next cron deploy, confirm new articles show correct date on the blog
