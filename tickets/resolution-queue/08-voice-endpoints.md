# Build voice session endpoints

## Context

Part of the multi-interface resolution queue (parent). DJ already has a Whisper flow for speech-to-text. These endpoints provide the structured data layer: what to say to the user (TTS prompts) and how to interpret their spoken responses (intent parsing via Claude).

## Task

Create voice session endpoints that convert resolution items into natural-language prompts and parse voice responses into resolution actions. The actual STT/TTS pipeline stays in the existing Whisper setup — the dashboard just provides structured input/output.

**Session flow:**
1. `GET /api/voice/session` — returns pending items as TTS-ready prompts
2. User's Whisper flow reads prompts via TTS, captures voice response via STT
3. `POST /api/voice/respond` — takes transcribed text + item ID, uses Claude to parse intent, resolves item

## Acceptance Criteria

- [ ] `GET /api/voice/session` returns `{ items: [{ id, prompt, type, suggestedMatch }] }` where `prompt` is a natural-language sentence (e.g., "We received twelve thousand dollars from Nouri Health Inc. Should I file this under Nouri?")
- [ ] Prompts use spoken-friendly language: spell out numbers, avoid abbreviations, use conversational tone
- [ ] `POST /api/voice/respond` accepts `{ itemId, transcript }` and returns `{ resolved, action, entity? }`
- [ ] Intent parsing handles: "yes" / "yeah" / "correct" → approve, "no" / "nope" → reject, "skip" / "next" → skip, "no, it's [name]" → reject + suggest new match
- [ ] Intent parsing uses Claude to handle natural language variation (not just keyword matching)
- [ ] Session endpoint includes a summary prompt: "Good morning. You have X items to review."

## Watch Out For

- **Number formatting**: "12000" must become "twelve thousand" in prompts. Mercury amounts should be formatted as spoken currency: "$12,000" → "twelve thousand dollars".
- **Ambiguous responses**: "Nouri" could mean "yes, file it under Nouri" or "no, the customer is Nouri not Nouri Health". Claude intent parsing should use the item context to disambiguate.

## Pointers

- `src/lib/resolution-queue.ts` — `getPendingItems()` and `resolveItem()` for data access
- `src/app/api/resolution/route.ts` — existing API pattern to follow
- No TTS/STT libraries needed in the dashboard — the Whisper flow handles that externally
