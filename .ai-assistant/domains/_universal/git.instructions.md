---
applyTo: "**/*"
priority: high
role: [developer, reviewer]
---

# Git Guidelines

> **Applies to:** All version control operations
> **Related:** [code-review.instructions.md](./code-review.instructions.md) | [ci-cd guidelines](../ci-cd/)

## Core Principles

1. **Atomic commits** - Each commit represents one logical change
2. **Clear history** - Commits tell a story of the project evolution
3. **Branch isolation** - Features developed in isolation, merged when complete
4. **Convention over configuration** - Consistent patterns reduce cognitive load

## Branch Strategy

### Branch Naming

```bash
# Feature branches
feature/add-user-authentication
feature/TICKET-123-payment-integration

# Bug fixes
fix/login-redirect-loop
fix/TICKET-456-null-pointer

# Hotfixes (production emergencies)
hotfix/security-patch-xss

# Chores (non-feature work)
chore/upgrade-dependencies
chore/refactor-api-client

# Experiments
experiment/new-caching-strategy
```

### Branch Lifecycle

```bash
# Create feature branch from {{DEFAULT_BRANCH}}
git checkout {{DEFAULT_BRANCH}}
git pull origin {{DEFAULT_BRANCH}}
git checkout -b feature/my-feature

# Keep branch updated (prefer rebase for clean history)
git fetch origin
git rebase origin/{{DEFAULT_BRANCH}}

# When complete, create PR (don't merge locally)
```

## Commit Messages

### Format: Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature for users |
| `fix` | Bug fix for users |
| `docs` | Documentation changes |
| `style` | Formatting, no code change |
| `refactor` | Code change, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding/fixing tests |
| `chore` | Maintenance, deps, config |
| `ci` | CI/CD changes |
| `revert` | Reverting previous commit |

### Examples

```bash
# Good - clear, atomic, explains why
feat(auth): add OAuth2 login with Google

Implements Google OAuth2 flow for user authentication.
Users can now sign in with their Google accounts.

Closes #123

# Good - bug fix with context
fix(cart): prevent duplicate items on rapid clicks

Added debounce to add-to-cart button to prevent
race condition when users click rapidly.

# Good - breaking change
feat(api)!: change user endpoint response format

BREAKING CHANGE: User endpoint now returns nested
address object instead of flat fields.

# Bad - vague, no context
fix: fixed bug

# Bad - multiple unrelated changes
feat: add login and fix styling and update deps
```

### Subject Line Rules

- Use imperative mood ("add" not "added" or "adds")
- No period at the end
- Max 50 characters (72 for body lines)
- Capitalize first letter
- Reference issues when applicable

## Workflow Patterns

### Feature Development

```bash
# 1. Start from updated {{DEFAULT_BRANCH}}
git checkout {{DEFAULT_BRANCH}} && git pull

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make atomic commits as you work
git add -p  # Stage hunks interactively
git commit -m "feat(scope): implement X"

# 4. Keep updated with {{DEFAULT_BRANCH}}
git fetch origin
git rebase origin/{{DEFAULT_BRANCH}}

# 5. Push and create PR
git push -u origin feature/my-feature
```

### Handling Conflicts

```bash
# During rebase
git rebase origin/{{DEFAULT_BRANCH}}

# If conflicts occur:
# 1. Resolve conflicts in files
# 2. Stage resolved files
git add <resolved-files>

# 3. Continue rebase
git rebase --continue

# If things go wrong, abort and retry
git rebase --abort
```

### Squashing Commits

```bash
# Before PR (squash WIP commits)
git rebase -i HEAD~3  # Interactive rebase last 3 commits

# In editor, change 'pick' to 'squash' or 's'
pick abc123 feat: add user model
squash def456 wip: more work
squash ghi789 fix: typo
```

## What NOT to Do

### Never Rewrite Public History

```bash
# NEVER force push to {{DEFAULT_BRANCH}}
git push --force origin {{DEFAULT_BRANCH}}  # DANGEROUS

# NEVER amend commits that are pushed and shared
git commit --amend  # Only for unpushed commits

# If you must force push a feature branch (after rebase)
git push --force-with-lease origin feature/my-branch
```

### Avoid Large Commits

```bash
# Bad - one massive commit
git add .
git commit -m "implement entire feature"

# Good - logical, atomic commits
git add src/models/user.ts
git commit -m "feat(models): add User model"

git add src/api/users.ts
git commit -m "feat(api): add user CRUD endpoints"

git add src/tests/users.spec.ts
git commit -m "test(api): add user endpoint tests"
```

### Don't Commit Sensitive Data

```bash
# Use .gitignore
.env
.env.local
*.key
*.pem
credentials.json
secrets/

# If accidentally committed, remove from history
# (requires force push - coordinate with team)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch secrets.json' \
  --prune-empty -- --all
```

## Git Configuration

### Recommended Settings

```bash
# Set identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Default branch name
git config --global init.defaultBranch main

# Auto-setup remote tracking
git config --global push.autoSetupRemote true

# Rebase by default on pull
git config --global pull.rebase true

# Better diff algorithm
git config --global diff.algorithm histogram

# Sign commits (recommended)
git config --global commit.gpgsign true
```

### Useful Aliases

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'
git config --global alias.lg "log --oneline --graph --decorate"
```

## Pull Request Workflow

### Before Creating PR

1. Rebase on latest {{DEFAULT_BRANCH}}
2. Run tests locally
3. Run linter/formatter
4. Self-review your changes
5. Ensure commits are atomic and well-described

### PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Added X
- Modified Y
- Removed Z

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases considered

## Screenshots (if UI changes)

## Related Issues
Closes #123
```

### Review Etiquette

**As Author:**
- Respond to all comments
- Don't resolve comments yourself (let reviewer resolve)
- Push fixes as new commits (easier to re-review)
- Squash before merge if requested

**As Reviewer:**
- Be constructive and specific
- Distinguish blocking vs. non-blocking feedback
- Approve when satisfied, don't block on nitpicks

## Common Operations

### Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1
```

### Discard Local Changes

```bash
# Single file
git checkout -- path/to/file

# All files
git checkout -- .

# Including untracked files
git clean -fd
```

### Stash Changes

```bash
# Stash current changes
git stash

# Stash with message
git stash push -m "work in progress on feature X"

# List stashes
git stash list

# Apply most recent stash
git stash pop

# Apply specific stash
git stash apply stash@{2}
```

### Cherry-pick

```bash
# Apply specific commit to current branch
git cherry-pick <commit-hash>

# Cherry-pick without committing
git cherry-pick -n <commit-hash>
```

## Known Gotchas

### Detached HEAD

If you see "detached HEAD", you're not on a branch:

```bash
# Create a branch from current state
git checkout -b my-branch

# Or return to a branch
git checkout {{DEFAULT_BRANCH}}
```

### Merge vs Rebase

- **Merge:** Preserves history, creates merge commits
- **Rebase:** Linear history, rewrites commits

Use rebase for feature branches, merge for integrating to {{DEFAULT_BRANCH}}.

### Line Endings

Configure for cross-platform teams:

```bash
# On Windows
git config --global core.autocrlf true

# On Mac/Linux
git config --global core.autocrlf input
```

### Large Files

Don't commit large binary files. Use Git LFS:

```bash
git lfs install
git lfs track "*.psd"
git add .gitattributes
```

---

**See Also:**
- [Code Review Guidelines](./code-review.instructions.md)
- [CI/CD Guidelines](../ci-cd/)
