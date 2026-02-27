# Shared Claude Skills

This directory contains Claude Code skills that are **shared across multiple repos**. It is synced with [SFAI-Labs/claude-shared](https://github.com/SFAI-Labs/claude-shared) using git subtree.

## Quick Overview

```
.claude/skills/
  shared/        <-- THIS DIRECTORY. Synced with the shared repo. Don't put repo-specific stuff here.
    my-skill/
      SKILL.md
    another-skill/
      SKILL.md
  local/         <-- Repo-specific skills go here. Not synced anywhere.
    my-local-skill/
      SKILL.md
```

Claude Code automatically discovers all skills under `.claude/skills/` by scanning for `SKILL.md` files. You don't need to register or configure anything -- just drop a folder with a `SKILL.md` and Claude picks it up.

## How to Add a New Shared Skill (Step by Step)

### 1. Make sure you have the latest shared skills

Before making changes, always pull the latest version so you don't run into conflicts:

```bash
git subtree pull --prefix=.claude/skills/shared skills-repo main --squash
```

### 2. Create a folder for your skill

Pick a short, descriptive name. Create the folder inside `.claude/skills/shared/`:

```bash
mkdir -p .claude/skills/shared/my-new-skill
```

### 3. Write the SKILL.md file

Every skill needs a `SKILL.md` file. This is what Claude reads. Create `.claude/skills/shared/my-new-skill/SKILL.md` with this structure:

```yaml
---
name: my-new-skill
description: Use when [describe the trigger]. Provides [what it does].
allowed-tools: Read, Grep, Glob  # Optional. Omit this line to allow all tools.
---

Your instructions for Claude go here.

Be specific. Write it like you're explaining to a colleague what to do.
Include step-by-step processes, code examples, or templates.
```

**The `description` field is the most important part.** Claude uses it to decide when to activate the skill. If the description is vague, Claude will never use it.

Bad: `description: Helps with testing`
Good: `description: Use when writing or reviewing unit tests for Python code. Provides pytest patterns, fixture templates, and assertion best practices.`

### 4. (Optional) Add supporting files

You can include helper files alongside `SKILL.md`. Claude loads them on demand when they're relevant:

```
.claude/skills/shared/my-new-skill/
  SKILL.md              # Required -- always loaded
  templates/
    example.py          # Loaded when Claude needs it
  examples/
    sample-output.json  # Loaded when Claude needs it
```

Reference these files explicitly in your `SKILL.md` so Claude knows they exist, e.g.:
> "See `templates/example.py` for the recommended structure."

### 5. Commit your changes in this repo

```bash
git add .claude/skills/shared/my-new-skill/
git commit -m "Add my-new-skill shared skill"
```

### 6. Push the skill to the shared repo

This sends your new skill to the shared repo so other repos can pull it:

```bash
git subtree push --prefix=.claude/skills/shared skills-repo main
```

### 7. Verify

- Ask Claude: *"What skills are available?"* -- your new skill should appear.
- Check the [shared repo on GitHub](https://github.com/SFAI-Labs/claude-shared) -- your skill folder should be there.

## How to Get the Latest Shared Skills

If someone else added skills to the shared repo and you want to pull them into your repo:

```bash
git subtree pull --prefix=.claude/skills/shared skills-repo main --squash
```

**Important:** your working tree must be clean (no uncommitted changes). Commit or stash your work first.

## First-Time Setup (for New Repos)

If you're adding shared skills to a repo that doesn't have them yet:

```bash
# 1. Your repo must have at least one commit already
git log --oneline  # verify you see commits

# 2. Add the shared repo as a remote
git remote add skills-repo https://github.com/SFAI-Labs/claude-shared.git
git fetch skills-repo

# 3. Pull the shared skills into .claude/skills/shared/
git subtree add --prefix=.claude/skills/shared skills-repo main --squash

# 4. Create the local skills directory
mkdir -p .claude/skills/local
touch .claude/skills/local/.gitkeep
git add .claude/skills/local/.gitkeep
git commit -m "Add local skills directory"
```

## Common Mistakes

| Problem | Cause | Fix |
|---|---|---|
| `fatal: working tree has modifications` | Uncommitted changes | `git add . && git commit` first |
| `fatal: ambiguous argument 'HEAD'` | Repo has no commits yet | Make an initial commit first |
| Skill not being discovered by Claude | Vague `description` in SKILL.md | Rewrite description to say **when** and **what** |
| Editing a shared skill for one repo | Should be a local skill | Move it to `.claude/skills/local/` instead |

## Guidelines

- **One skill per directory** -- keep skills focused and single-purpose.
- **Write clear descriptions** -- this is how Claude discovers your skill. Be specific.
- **Always pull before you push** -- avoids conflicts with other people's changes.
- **Don't put repo-specific skills here** -- use `.claude/skills/local/` for those.
- **Test your skill** -- after adding it, ask Claude to use it and verify it works.
