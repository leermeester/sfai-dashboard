# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resources & Where to Look

| Resource | Location |
|----------|----------|
| Project specification | `.claude/context/spec.md` |
| Architecture overview | `.claude/context/architecture.md` |
| Learnings & gotchas | `.claude/context/learnings.md` |
| Progress log | `.claude/context/progress.md` |
| Operating principles | `.claude/context/principles.md` |
| Business context & roadmap | `.claude/context/business.md` |
| Figma designs | `.claude/context/figma.md` |
| API contracts | `postman/sfai-geo-blog.postman_collection.json` |
| Skills | `.claude/skills/` |
| Agents | `.claude/agents/` |
| API keys | `.env` |

## 1.1 Specification Tracking (CRITICAL)

After writing any code, immediately update all relevant files in `.claude/context/`. Each file and its purpose:

- **`spec.md`**: implementation progress, scope, and the current expected behavior
- **`architecture.md`**: all architecture decisions and rationale
- **`learnings.md`**: gotchas, patterns, constraints, tips — "things you wish you'd known at the start"
- **`progress.md`**: what was done, what's next, blockers
- **`principles.md`**: decision-making frameworks and operating principles
- **`business.md`**: business context, goals, stakeholder expectations
- **`figma.md`**: design specs, links, and design decisions
- **`roadmap.md`**: technical roadmap items and delivery status

**Note any deviations from the original spec and justify them.**

> **Hard requirement**: `spec.md` and `architecture.md` must never contradict each other.

## 1.2 Operating Principles (How to Think)

Refer to `principles.md` for decision-making frameworks. Key concept:

## 1.3 Business Context & Roadmap Sync (CRITICAL)

Refer to `business.md` for:
- Business context and goals
- Stakeholder expectations

Refer to `roadmap.md` for:
- technical roadmap against which we signed a contract.

> **Hard requirement**: Roadmap (Notion) ↔ Figma designs ↔ Implementation must not diverge. 
In general, the figma designs should follow the roadmap.
Figma designs that are outside the roadma deliverables should be flagged as such. 

### Notion Sync

The roadmap lives in Notion. Use the `/notion-sync` skill to:
- Pull latest roadmap items into `.claude/context/roadmap.md`
- Flag any divergence between roadmap and implementation
- Run daily or before starting new work

### Figma Sync

Design specs are tracked in `figma.md`. Before implementing UI:
1. Check `figma.md` for latest design links and decisions
2. Flag any implementation that deviates from designs
3. Update `figma.md` when designs change

## 1.4 Code Design Policy

- **Never create fallback methods or behavior** that are not defined in `spec.md`
- If a case isn't specified, let the code fail. **Do not invent behavior**
- **File naming**: when saving files, prefix the filename with a timestamp unless the spec explicitly says otherwise

## 1.5 Prompt-Writing Standards

Every prompt must include the following sections in this exact order:

1. **Role**
2. **Task Context**
3. **Task**
4. **Instructions**
5. **How To Think**
6. **Rules**
7. **Output Format**
8. **Examples**

**Additional rules:**
- Write as a domain expert
- Prefer structured outputs (tables, JSON, bulletproof schemas)
- Default model: `gpt-5`

## 1.6 Cybersecurity

- **Never place API keys, passwords, tokens, or secrets directly in code**
- Always load secrets from `.env` and import them at runtime
