---
task: push-branch
chatmode: committer
tools: [bash, read]
---

# Task: Push Branch

> **Purpose:** Push local commits to remote repository
> **Chatmode:** Committer
> **When:** After committing, before PR

## Steps

1. **Check status** - Verify commits to push
2. **Verify remote** - Confirm correct remote
3. **Push** - Send commits to remote

## Commands

```bash
# Push current branch (first time)
git push -u origin HEAD

# Push to existing upstream
git push

# Check what would be pushed
git log origin/main..HEAD --oneline

# Check remote configuration
git remote -v
```

## Before Pushing

### Verify Commits
```bash
# See commits to push
git log origin/main..HEAD --oneline

# See last commit
git log -1
```

### Verify Branch
```bash
# Current branch
git branch --show-current

# Remote tracking
git branch -vv
```

## Safety Guidelines

### Safe Operations
- `git push` - Push to tracking branch
- `git push -u origin HEAD` - Set upstream and push

### Dangerous Operations (Avoid)
- `git push --force` - Never without explicit request
- `git push --force-with-lease` - Only with caution
- `git push origin main` - Direct to main (usually blocked)

## Handling Rejections

### "Updates were rejected"
```bash
# Fetch latest
git fetch origin

# Rebase on latest
git rebase origin/main

# Push again
git push
```

### "No upstream branch"
```bash
# Set upstream and push
git push -u origin HEAD
```

## Output Format

```markdown
## Push Complete

**Branch:** `feature/auth`
**Commits pushed:** 3
**Remote:** `origin/feature/auth`

**Commits:**
- `abc1234` feat: add login
- `def5678` feat: add logout
- `ghi9012` test: add auth tests

**Next:** Create PR or continue working
```

## Transition

After push:
- `commit/create-pr` - Create pull request
- Continue working on more features
