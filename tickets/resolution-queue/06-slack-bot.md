# Build Slack bot with guided framework messages

## Context

Part of the multi-interface resolution queue (parent). The Slack bot sends daily digests and individual resolution messages with guided thinking prompts and inline action buttons. This is the zero-context-switch interface — triage data while already in Slack.

## Task

Create a Slack bot that posts resolution items to a designated channel using Block Kit interactive messages. Each message includes a "Think:" prompt that guides the user's decision, plus action buttons to resolve inline. After each sync, the bot posts a digest of new pending items.

**Message structure (guided thinking framework):**
```
💰 Bank Transaction Match
"Nouri Health Inc" paid $12,000 on Feb 24
Suggested: Nouri (94% match)
Think: Does this company name match your customer?
[✓ Yes, it's Nouri] [✗ Different customer] [⏭ Skip]
```

## Acceptance Criteria

- [ ] Slack app created with bot token scopes: `chat:write`, `channels:read`
- [ ] `POST /api/slack/notify` sends a digest message to the configured channel with all pending items
- [ ] Each item is a separate Block Kit section with: entity name, context, suggested match, "Think:" prompt, and action buttons
- [ ] `POST /api/slack/events` handles Slack interactive payloads (button clicks)
- [ ] Clicking an action button resolves the item via `resolveItem()` and updates the message to show "Resolved ✓"
- [ ] After cron sync, if new pending items exist, the bot posts a notification
- [ ] Environment variables: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`

## Watch Out For

- **Slack signature verification**: Every incoming request from Slack must be verified using the signing secret. This prevents spoofed requests. Use the `crypto.timingSafeEqual` pattern.
- **Message update after resolution**: Slack interactive messages should be updated in-place (not deleted). Use the `response_url` from the interaction payload to replace the original message with a "Resolved" version.
- **Block Kit limits**: A single message can have max 50 blocks. If there are 20+ pending items, batch them across multiple messages or paginate.

## Pointers

- `src/app/api/cron/sync/route.ts:1-29` — cron route to extend with Slack notification trigger
- `src/app/api/mercury/route.ts` — existing API route pattern with POST action dispatching
- Slack Block Kit Builder: https://app.slack.com/block-kit-builder — for prototyping message layouts
- No Slack SDK in `package.json` yet — use raw `fetch` calls to Slack API (simpler, fewer dependencies)
