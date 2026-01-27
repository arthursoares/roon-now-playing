---
task: stage-changes
chatmode: committer
tools: [bash, read]
---

# Task: Stage Changes

> **Purpose:** Add files to staging area for commit
> **Chatmode:** Committer
> **When:** After review, before commit

## Steps

1. **Review changes** - Understand what will be staged
2. **Select files** - Choose appropriate files
3. **Stage** - Add to staging area
4. **Verify** - Confirm staging is correct

## Commands

```bash
# Stage specific file
git add path/to/file.ts

# Stage all changes
git add .

# Stage interactively (by hunk)
git add -p

# Stage all tracked files (not new files)
git add -u

# Unstage file
git restore --staged path/to/file.ts

# Unstage all
git restore --staged .
```

## Staging Guidelines

### DO Stage
- Source code changes for the feature
- Related test files
- Configuration changes
- Type definitions

### DON'T Stage
- Unrelated changes
- Debug code / console.log
- Personal config files
- Generated files (unless intentional)
- Secrets or credentials

## Reviewing Before Stage

```bash
# See what would be staged
git diff path/to/file.ts

# See current staged content
git diff --staged

# See file status
git status
```

## Output Format

```markdown
## Staged Changes

**Files staged:**
- `src/utils/auth.ts` - Login functionality
- `src/utils/auth.spec.ts` - Tests for login

**Files NOT staged:**
- `src/debug.ts` - Debug file (intentionally excluded)

**Next:** Create commit or review staged changes
```

## Tips

- Stage related changes together
- Don't stage work-in-progress
- Use `git add -p` for partial staging
- Review diff before staging

## Transition

After staging:
- `commit/create-commit` - Create the commit
- `commit/show-status` - Verify staging
- `review/self-review` - Review staged changes
