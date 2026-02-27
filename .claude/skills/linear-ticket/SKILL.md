---
description: Create well-structured Linear tickets with parent issues and sub-issues. Use when asked to create tickets, write issues, plan work breakdown, or prepare Linear issues.
argument-hint: [feature-description or file-path]
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion
---

# Linear Ticket Generator

Transform feature ideas into structured, actionable Linear tickets. Generates a parent issue (the feature) with decomposed sub-issues that an experienced engineer can pick up and run with.

## Philosophy

- **Respect the reader's time.** Engineers have 5-10 years of experience. Don't explain obvious things.
- **Lead with "why".** Context and motivation matter more than implementation instructions.
- **Scope ruthlessly.** Every ticket does one thing. If you're writing "and" in the title, split it.
- **Make the implicit explicit.** The value of a ticket is surfacing what ISN'T obvious: hidden coupling, data migration needs, edge cases, ordering constraints.

## Process

### Step 1: Understand the Feature

- Accept a file path argument (e.g., `/linear-ticket spec/SPEC.md`) and read it
- Accept an inline description (e.g., `/linear-ticket "Add real-time notifications"`)
- If no argument, ask the user to describe the feature

Then scan the codebase for relevant context:
- Read CLAUDE.md for architecture patterns and conventions
- Glob/Grep for related files, components, and API routes
- Identify existing patterns this feature should follow

### Step 2: Interview (2-3 rounds max)

Ask focused questions to fill gaps. Use AskUserQuestion with 3-4 questions per round.

**Good questions to ask:**
- "Who is the end user for this? What workflow does it unlock for them?"
- "I see [existing pattern]. Should this follow the same approach or is there a reason to diverge?"
- "What's the MVP scope vs. future phases? Where do you want to draw the line?"
- "Are there ordering constraints? (e.g., backend API must exist before frontend can start)"
- "Any external dependencies or blockers? (design, API access, third-party services)"

**Don't ask:**
- Tech stack questions answerable from the codebase
- Best-practice questions (assume standard practices apply)
- Questions already answered in CLAUDE.md or the spec

### Step 3: Decompose into Sub-Issues

Break the feature into sub-issues using these principles:

1. **Each sub-issue is independently deliverable** - can be PR'd and merged on its own
2. **Ordered by dependency** - earlier tickets unblock later ones
3. **Sized for 1-3 days of work** - if larger, split further
4. **Vertical slices preferred** - a thin feature end-to-end beats a complete backend with no frontend

### Step 4: Write Tickets

Generate all tickets using the templates below, then write to `tickets/[feature-slug]/` directory.

### Step 5: Review with User

Present a summary table of all tickets and ask for confirmation before finalizing.

---

## Parent Issue Template

```markdown
# [Verb] [Feature] — [User Outcome]

## Context

[2-3 sentences. What user workflow does this enable? Why now? Link to any product context.]

## Scope

[Bullet list of what this feature set delivers when ALL sub-issues are complete.]

- [ ] [Capability 1]
- [ ] [Capability 2]
- [ ] [Capability 3]

## Out of Scope

[Explicitly list what this does NOT include. Prevents scope creep.]

- [Thing that might be assumed but isn't included]
- [Future phase work]

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | [Sub-issue title] | — | S |
| 2 | [Sub-issue title] | #1 | M |
| 3 | [Sub-issue title] | #1 | M |
| 4 | [Sub-issue title] | #2, #3 | S |

Sizes: XS (<2h), S (half day), M (1-2 days), L (3+ days, consider splitting)

## Resources

- [Design / Figma](url)
- [Spec / RFC](url)
- [Relevant docs](url)
```

## Sub-Issue Template

```markdown
# [Verb] [specific deliverable]

## Context

[1-2 sentences. Why this sub-issue exists, and how it fits into the parent feature. Reference the parent issue.]

## Task

[Clear description of what needs to be built/changed. Focus on WHAT, not HOW. Trust the engineer to figure out implementation.]

## Acceptance Criteria

- [ ] [Observable, testable outcome — written as "User can..." or "System does..."]
- [ ] [Keep to 3-6 criteria. If more, the ticket is too big.]

## Watch Out For

[Only include if there are genuine gotchas. Skip this section entirely if there's nothing non-obvious.]

- **[Gotcha name]**: [Why it's surprising and what to do about it]
- **[Dependency]**: [External thing that must be true/ready for this to work]

## Pointers

[Direct links to relevant code, files, and documentation. No vague references.]

- `path/to/relevant-file.ts` — [what's in it and why it matters]
- `path/to/similar-pattern.ts` — [existing pattern to follow]
- [External doc](url) — [what to look for in it]
```

---

## Writing Guidelines

### Titles
- Start with a verb: "Add", "Implement", "Create", "Update", "Migrate"
- Be specific: "Add WebSocket connection for live notifications" not "Notification work"
- Include the user-facing outcome when possible

### Context Section
- Answer: "If I knew nothing about this project, what's the minimum I need to understand WHY this ticket exists?"
- Reference the user workflow, not just the technical need
- 2-3 sentences max. Link out to specs/RFCs for deeper context.

### Task Section
- Describe the **what**, not the **how**
- If there's a genuinely non-obvious implementation approach, mention it in "Watch Out For" instead
- Use concrete nouns: "the booking confirmation email" not "the relevant notification"

### Acceptance Criteria
- Write as observable outcomes, not implementation steps
- Bad: "Use React Query for data fetching" (implementation detail)
- Good: "Booking list updates within 2 seconds of a new booking being created" (observable)
- Include the key edge case: "Works when user has zero bookings (empty state shown)"
- 3-6 criteria. More means the ticket is too large.

### Watch Out For
- Only include genuine surprises. Things a senior engineer wouldn't anticipate.
- Good: "The `users` table has soft deletes — filter on `deleted_at IS NULL` or you'll get ghost records"
- Bad: "Make sure to handle errors" (obvious, skip it)
- Include ordering/timing constraints: "Must be deployed after migration #123 runs"

### Pointers
- Link directly to files and line numbers, not just directories
- Reference existing patterns: "Follow the same approach as `booking-widget.tsx:45-80`"
- Include external links only if the engineer genuinely needs them (API docs, design files)

---

## Output Structure

Write tickets to:

```
tickets/
└── [feature-slug]/
    ├── README.md              # Parent issue (copy to Linear as Epic/Project)
    ├── 01-[sub-issue-slug].md # Sub-issue 1
    ├── 02-[sub-issue-slug].md # Sub-issue 2
    └── 03-[sub-issue-slug].md # Sub-issue 3
```

---

## Example

### Input
> "We need to add email notifications when an expert session is booked"

### Output — Parent Issue

```markdown
# Add booking email notifications — Confirm sessions for both parties

## Context

When a student books an expert session, neither party gets a confirmation email. Students are
unsure if their booking went through, and experts miss sessions because they didn't know about
them. This adds transactional emails for booking confirmation and updates.

## Scope

- [ ] Confirmation email sent to student on successful booking
- [ ] Notification email sent to expert on new booking
- [ ] Cancellation email sent to both parties when a booking is cancelled
- [ ] Email templates with booking details (date, time, expert name, topic)

## Out of Scope

- Reminder emails (separate feature, uses cron — see existing reminder system)
- SMS/push notifications
- Email preference settings / unsubscribe

## Sub-Issues

| # | Title | Depends On | Est. |
|---|-------|-----------|------|
| 1 | Create booking email templates | — | S |
| 2 | Send confirmation email on booking creation | #1 | M |
| 3 | Send notification email to expert on new booking | #1 | M |
| 4 | Send cancellation emails to both parties | #1 | S |

## Resources

- Existing reminder emails: `lib/email/templates/booking-reminder.tsx`
- Resend client: `lib/email/resend.ts`
- Booking creation flow: `app/api/bookings/route.ts`
```

### Output — Sub-Issue #2

```markdown
# Send confirmation email on booking creation

## Context

Part of booking email notifications (parent). After a student successfully creates a booking,
they should receive a confirmation email with session details.

## Task

Hook into the booking creation flow to send a confirmation email to the student after a
booking is persisted. Use the existing Resend email client and the template from sub-issue #1.

## Acceptance Criteria

- [ ] Student receives confirmation email within 30s of booking creation
- [ ] Email contains: expert name, date/time (in student's timezone), topic, and a link to the booking
- [ ] Booking creation still succeeds if email sending fails (fire-and-forget, log the error)
- [ ] No duplicate emails on page refresh or retry

## Watch Out For

- **Timezone display**: Bookings are stored in UTC. The email must show the student's local timezone. The student's timezone is available in their profile (`users.timezone`), but ~15% of users haven't set it — default to the expert's timezone with a note.
- **Resend rate limits**: Resend free tier = 100 emails/day. If we're close, this will silently fail. Check current usage in Resend dashboard.

## Pointers

- `app/api/bookings/route.ts:48-62` — where bookings are created (add email send after L62)
- `lib/email/resend.ts` — existing Resend client, follow the `sendReminderEmail` pattern
- `lib/email/templates/booking-reminder.tsx` — reference for React Email template structure
```

---

## Rules

- NEVER write implementation instructions disguised as acceptance criteria
- NEVER include "Watch Out For" sections with obvious advice — only genuine gotchas
- ALWAYS scan the codebase before writing tickets (find real file paths, real patterns)
- ALWAYS number sub-issues to show ordering and dependency
- ALWAYS include file paths with line numbers in Pointers, not vague references
- KEEP parent issues to one screen of text. Keep sub-issues to two screens max.
- SKIP optional sections if they'd be empty (e.g., no Watch Out For if there are no gotchas)

## Start

Parse the provided argument (file path or inline description), scan the codebase for context, then begin the interview to understand scope and constraints before generating tickets.

$ARGUMENTS
