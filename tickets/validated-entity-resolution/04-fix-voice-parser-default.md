# Fix voice parser default from approve to skip

## Context

Part of Validated Entity Resolution (parent). `parseVoiceResponse()` defaults to `{ action: "approve" }` when it can't parse the transcript. This means any unrecognized voice input auto-approves the resolution item — the opposite of safe behavior.

## Task

Change the default fallback from `"approve"` to `"skip"` so unrecognized input queues the item for later review instead of auto-approving it.

## Acceptance Criteria

- [ ] Unrecognized voice input returns `{ action: "skip" }` instead of `{ action: "approve" }`
- [ ] All explicit affirmative patterns still return `{ action: "approve" }` (no regression)
- [ ] All explicit negative patterns still return `{ action: "reject" }` (no regression)

## Pointers

- `src/lib/voice.ts:193-194` — change `return { action: "approve" }` to `return { action: "skip" }`
