# claude-shared

Shared Claude Code configuration — skills, context templates, and project scaffolding. Synced across repos using [git subtree](https://www.atlassian.com/git/tutorials/git-subtree).

## Repo Structure

The repo root mirrors what goes into a consumer's `.claude/` directory:

```
repo root/
  CLAUDE.md              # Template CLAUDE.md (customize per project)
  README.md              # This file
  context/               # Template context files (customize per project)
    architecture.md
    business.md
    figma.md
    learnings.md
    principles.md
    progress.md
    roadmap.md
    spec.md
  local-skills/          # Placeholder for project-specific skills (not synced)
  skills/                # Shared skills (contribute here)
    PM-OS/
    document-codebase/
    excalidraw/
    interview-me/
    knowledge-work-plugins/
    linear-ticket/
```

### What's what

| Directory | Purpose | Sync behavior |
|---|---|---|
| `skills/` | Shared skills used across projects | Pull updates freely. Contribute via fork + PR. |
| `context/` | Template context files | Pull once, then customize locally. Don't push customizations back. |
| `CLAUDE.md` | Template project config | Pull once, then customize locally. Don't push customizations back. |
| `local-skills/` | Empty placeholder | For project-specific skills that aren't shared. |

## First-Time Setup (New Repo)

If your repo doesn't have a `.claude/` directory yet:

```bash
# 1. Your repo must have at least one commit
git log --oneline  # verify you see commits

# 2. Add the shared repo as a remote
git remote add skills-repo https://github.com/SFAI-Labs/claude-shared.git
git fetch skills-repo

# 3. Pull the entire shared config into .claude/
git subtree add --prefix=.claude skills-repo main --squash
```

This gives you:
```
your-repo/
  .claude/
    CLAUDE.md              # Template — edit for your project
    context/               # Templates — edit for your project
      architecture.md
      business.md
      ...
    local-skills/          # Add project-specific skills here
    skills/                # Shared skills (auto-discovered by Claude)
      PM-OS/
      excalidraw/
      ...
    README.md
```

After setup, customize `.claude/CLAUDE.md` and `.claude/context/` files for your project. These are yours now — future pulls will merge, not overwrite.

## Pulling Updates

To get the latest shared skills and template updates:

```bash
git subtree pull --prefix=.claude skills-repo main --squash
```

> **Important:** Your working tree must be clean. Commit or stash first.

If you've customized `CLAUDE.md` or `context/` files, git will merge the upstream template changes with your local modifications. Resolve any merge conflicts as you normally would.

## Contributing Shared Skills

Skills are the shared, bidirectional part of this repo. To contribute:

1. **Fork** [SFAI-Labs/claude-shared](https://github.com/SFAI-Labs/claude-shared) on GitHub
2. **Clone your fork** and create a branch
3. **Add or edit** skills under `skills/`
4. **Push** to your fork and **open a PR** to upstream

### Creating a new skill

```bash
mkdir -p skills/my-new-skill
```

Create `skills/my-new-skill/SKILL.md`:

```yaml
---
name: my-new-skill
description: Use when [describe the trigger]. Provides [what it does].
---

Your instructions for Claude go here.
Be specific. Write it like you're explaining to a colleague what to do.
```

The `description` field is critical — Claude uses it to decide when to activate the skill.

**Bad:** `description: Helps with testing`
**Good:** `description: Use when writing or reviewing unit tests for Python code. Provides pytest patterns, fixture templates, and assertion best practices.`

### Adding supporting files

```
skills/my-new-skill/
  SKILL.md              # Required
  templates/            # Optional — loaded on demand
    example.py
  examples/
    sample-output.json
```

Reference these files in your `SKILL.md` so Claude knows they exist.

## Push Protection

**Do NOT use `git subtree push` from a consumer repo.** This would push all your customized config (CLAUDE.md, context files, local skills) back to the shared repo.

Instead, always contribute via fork + PR. This ensures:
- Template files (CLAUDE.md, context/) can only be changed via reviewed PRs
- Skills get proper review before merging
- Project-specific customizations stay local

## Migrating from the Old Setup

> **If you previously set up the subtree with `--prefix=.claude/skills/shared`, this section is for you.**

### What changed

| | Old | New |
|---|---|---|
| Repo structure | Skills flat at root (`PM-OS/`, `excalidraw/`, ...) | Full `.claude/` template (`skills/`, `context/`, `CLAUDE.md`, ...) |
| Subtree prefix | `--prefix=.claude/skills/shared` | `--prefix=.claude` |
| Skill discovery path | `.claude/skills/shared/PM-OS/SKILL.md` | `.claude/skills/PM-OS/SKILL.md` |
| What you get | Skills only | Skills + context templates + CLAUDE.md template |

### Will it break?

**Yes**, if you `git subtree pull` with the old prefix after the repo restructure. The old prefix (`--prefix=.claude/skills/shared`) expects skills at the repo root. The new structure has them under `skills/`, so you'd get nested paths like `.claude/skills/shared/skills/PM-OS/` — Claude won't discover these.

### Migration steps

```bash
# 1. Make sure your working tree is clean
git status  # no uncommitted changes

# 2. Back up your customized .claude/ files
cp -r .claude /tmp/claude-backup

# 3. Remove the old subtree
git rm -r .claude/skills/shared
git commit -m "Remove old shared skills subtree"

# 4. Remove the rest of .claude/ from git tracking
#    (so we can re-add it as a subtree)
git rm -r .claude
git commit -m "Remove .claude for subtree restructure"

# 5. Add the new subtree
git subtree add --prefix=.claude skills-repo main --squash

# 6. Restore your customized files on top
cp /tmp/claude-backup/CLAUDE.md .claude/CLAUDE.md
cp -r /tmp/claude-backup/context/* .claude/context/

# Restore any other project-specific directories you had:
# cp -r /tmp/claude-backup/agents .claude/agents
# cp -r /tmp/claude-backup/plans .claude/plans
# etc.

# 7. Move local skills from old location to new
#    Old: .claude/skills/local/  →  New: .claude/local-skills/
cp -r /tmp/claude-backup/skills/local/* .claude/local-skills/ 2>/dev/null

# 8. Commit the restored customizations
git add .claude/
git commit -m "Restore project-specific Claude config after subtree migration"
```

### After migration

- Skills are now at `.claude/skills/PM-OS/SKILL.md` (one level less nesting)
- Pull updates with: `git subtree pull --prefix=.claude skills-repo main --squash`
- Contribute skills via fork + PR (not `git subtree push`)
- Your customized CLAUDE.md and context files are preserved

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| `fatal: working tree has modifications` | Uncommitted changes | `git add . && git commit` first |
| `fatal: ambiguous argument 'HEAD'` | Repo has no commits | Make an initial commit first |
| Skill not discovered by Claude | Vague `description` in SKILL.md | Rewrite description to say **when** and **what** |
| Merge conflict on `CLAUDE.md` after pull | Template updated upstream + local customizations | Resolve conflict — keep your customizations, merge useful template changes |
| `git subtree push` pushed my custom config | Used push instead of fork + PR | Revert the push. Always use fork + PR to contribute. |

## Guidelines

- **One skill per directory** — keep skills focused and single-purpose.
- **Write clear descriptions** — this is how Claude discovers your skill.
- **Never `git subtree push` from a consumer repo** — use fork + PR instead.
- **Customize templates freely** — CLAUDE.md and context/ are meant to be modified per project.
- **Don't put project-specific skills in `skills/`** — use `local-skills/` for those.
- **Test your skill** — after adding it, ask Claude *"What skills are available?"* and verify.
