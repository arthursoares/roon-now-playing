---
task: show-status
chatmode: committer
tools: [bash, read]
---

# Task: Show Git Status

> **Purpose:** Display current state of working directory
> **Chatmode:** Committer
> **When:** Before staging or committing

## Steps

1. **Check status** - Show modified, staged, untracked files
2. **Show recent commits** - Context for changes
3. **Summarize** - Clear overview of current state

## Commands

```bash
# Current status
git status

# Short status
git status -s

# Show staged changes
git diff --staged

# Show unstaged changes
git diff

# Recent commits
git log --oneline -5

# Current branch
git branch --show-current
```

## Status Interpretation

### File States
| Symbol | Meaning |
|--------|---------|
| `M` | Modified |
| `A` | Added |
| `D` | Deleted |
| `??` | Untracked |
| `MM` | Modified in both staged and unstaged |

### Branch State
- `Your branch is ahead of 'origin/main' by N commits`
- `Your branch is up to date with 'origin/main'`
- `Your branch is behind 'origin/main' by N commits`

## Output Format

```markdown
## Git Status

**Branch:** `feature/name`
**Status:** Ahead of main by 3 commits

### Staged Changes
- `M` `src/utils/auth.ts`

### Unstaged Changes
- `M` `src/components/Login.tsx`

### Untracked
- `??` `src/utils/newFile.ts`

### Recent Commits
- `abc1234` feat: add login
- `def5678` fix: validation

### Summary
- 1 file staged
- 1 file modified
- 1 new file
```

## Transition

After showing status:
- `commit/stage-changes` - Stage files for commit
- `review/self-review` - Review changes before staging
- `implement/edit-file` - Continue working
