---
description: Interactively refine a feature prompt into a comprehensive implementation plan, spec, and architecture document.
argument-hint: [file-or-prompt] [optional context]
allowed-tools: Read, Edit, Write, Glob, Grep, AskUserQuestion
---

# In-Depth Feature Interview & Spec Generation

Conduct a thorough, consultative interview to transform rough feature ideas into complete, production-ready specifications, spec, and architecture document. Ask thought-provoking questions about technical implementation, UI/UX, tradeoffs, security, and edge cases - then write a comprehensive spec to `spec/SPEC.md` (the main project specification file).

## Process

1. **Parse initial context**
   - Accept file path argument (e.g., `/interview-me docs/draft.md`) and read it
   - Accept inline prompt (e.g., `/interview-me "Add user analytics dashboard"`)
   - If no argument, ask user to describe the feature as first question

2. **Conduct deep-dive interview**
   - Ask 3-4 thoughtful questions per round using AskUserQuestion
   - Use consultative tone - like a senior engineer reviewing architecture
   - Focus on tradeoffs, architecture decisions, user experience considerations
   - Continue interviewing until all aspects are thoroughly explored

3. **Build spec incrementally** (internal state)
   - Accumulate answers into structured spec sections
   - User can request "show me the spec" to see current draft
   - Do NOT show draft after every round (avoid clutter)

4. **Propose completion**
   - After each round, assess if spec is complete
   - When ready, propose: "I think we've covered everything. Ready to finalize?"
   - User must confirm before writing spec

5. **Write final spec**
   - Use Write tool to create/update `spec/SPEC.md` (main project spec file)
   - Follow structured template (see below)
   - Confirm completion with user

## Spec Template Structure

```markdown
# [Feature Name]

## Overview & Goals
- High-level description
- User stories ("As a [role], I want [goal] so that [benefit]")
- Success criteria (measurable outcomes)

## Technical Implementation
- Architecture & data flow
- Database schema / data models
- API endpoints & integrations
- Libraries & dependencies
- Performance considerations

## UI/UX Design
- User flows & navigation
- Component hierarchy
- Accessibility requirements
- Responsive design considerations
- Interactive states & feedback

## Security & Privacy
- Authentication & authorization
- Data protection & validation
- Permissions & access control
- Security edge cases
```

## Question Guidelines

**What to ask:**
- Architecture tradeoffs: "How should this scale if 10,000 users access it simultaneously?"
- Edge cases: "What happens if a user has no data yet? Multiple concurrent sessions?"
- Integration points: "Should this integrate with existing [X] system? What data flows between them?"
- User experience: "How should users discover this feature? What happens on first use vs. returning users?"
- Data modeling: "What relationships exist between entities? How should deletions cascade?"
- Performance: "Should this be real-time or can it tolerate 5-minute delays? What's cached?"

**What to AVOID:**
- ❌ Yes/no questions about best practices (assume error handling, loading states, etc.)
- ❌ Tech stack basics if evident from codebase (don't ask "React or Vue?" in a Next.js project)
- ❌ Style preferences (colors, fonts, spacing) unless critical to feature identity
- ❌ Patterns already established in CLAUDE.md or codebase conventions

**Context awareness:**
- Read CLAUDE.md to understand project patterns (don't ask about what's already documented)
- Infer tech stack from existing files (check package.json, imports, etc.)
- Reference existing similar features ("I see you have a booking system - should this follow the same auth pattern?")

## Interview Cadence

- **3-4 questions per round** (balanced depth)
- Group related questions by theme (e.g., all data model questions together)
- After user answers, immediately ask next round - keep momentum
- Propose completion only when genuinely comprehensive (don't rush)

## Rules

- NEVER ask obvious questions - always add nuance and context
- ALWAYS read referenced files before asking questions
- ALWAYS check CLAUDE.md for established patterns
- ONLY propose completion when spec would be implementable without follow-up questions
- NEVER show spec draft unless user explicitly requests it
- ALWAYS write final spec to `spec/SPEC.md` (main project spec, not inline or skill-specific file)
- UPDATE `spec/ARCHITECTURE.md` if architectural decisions are made during the interview

## Start

Parse the provided argument (file path or inline prompt), read any referenced files, understand the codebase context, then begin the interview with your first round of 3-4 deep, non-obvious questions.

$ARGUMENTS
