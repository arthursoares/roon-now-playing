---
workflow: create-pr
priority: high
source: Anthropic Official Best Practices
---

# Create Pull Request

> **Purpose:** Create a well-documented PR with proper description and test plan
> **Chatmode:** Developer

## Workflow Steps

### Step 1: Verify Changes

```bash
# Get main branch name
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Check what will be in the PR
git status
git diff $MAIN...HEAD --stat

# Review commits
git log $MAIN..HEAD --oneline
```

### Step 2: Ensure Quality

Before creating PR:
- [ ] All tests pass
- [ ] No type errors
- [ ] Linting passes
- [ ] Changes are committed

```bash
npm run typecheck
npm run lint
npm run test
```

### Step 3: Push Branch

```bash
git push -u origin HEAD
```

### Step 4: Create PR

```bash
gh pr create --title "[Type]: Brief description" --body "$(cat <<'EOF'
## Summary

[1-3 bullet points describing what this PR does]

## Changes

- [Specific change 1]
- [Specific change 2]

## Test Plan

- [ ] [How to test change 1]
- [ ] [How to test change 2]

## Screenshots (if applicable)

[Add screenshots for UI changes]
EOF
)"
```

## PR Title Conventions

```
feat: add user authentication
fix: resolve login issue with special characters
refactor: extract validation logic
docs: update API documentation
test: add tests for auth module
chore: update dependencies
```

## Slash Command Integration

Provider-specific slash commands should reference this workflow. The command should:

1. **Check branch status**
2. **Run validation**
3. **Analyze changes**
4. **Push and create PR**
5. **Report PR URL**

See provider-specific command files (e.g., `.claude/commands/pr.md`) for implementation.

## Example PR Body

```markdown
## Summary

- Add JWT-based authentication to API endpoints
- Implement login and registration endpoints
- Protect existing routes with auth middleware

## Changes

- `src/middleware/auth.ts` - New auth middleware
- `src/routes/auth.ts` - Login/register endpoints
- `src/models/User.ts` - User model with password hashing
- `src/routes/*.ts` - Added auth middleware to routes

## Test Plan

- [ ] Register new user with valid credentials
- [ ] Login with correct credentials returns token
- [ ] Login with wrong password returns 401
- [ ] Protected routes reject requests without token
- [ ] Protected routes accept requests with valid token

## Breaking Changes

None - new endpoints only, existing functionality unchanged.
```

---

**See Also:**
- [Debug](./debug.prompt.md)
- [Happy Hour](./happy-hour.prompt.md)
