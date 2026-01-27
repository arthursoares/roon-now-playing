---
task: create-pr
chatmode: releaser
tools: [bash, read]
---

# Task: Create Pull Request

> **Purpose:** Create a well-documented pull request
> **Chatmode:** Releaser
> **When:** After pushing branch, ready for review

## Steps

1. **Verify branch** - Ensure all commits pushed
2. **Run checks** - Validate before PR
3. **Create PR** - With description and test plan
4. **Report** - Provide PR URL

## Pre-PR Checklist

- [ ] All commits pushed
- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Branch is up to date with main

## Commands

```bash
# Verify push status
git status

# Create PR
gh pr create --title "Title" --body "$(cat <<'EOF'
## Summary
- Change 1
- Change 2

## Test Plan
- [ ] Test step 1
- [ ] Test step 2
EOF
)"

# Create with reviewers
gh pr create --title "Title" --reviewer username

# Create as draft
gh pr create --draft --title "WIP: Title"
```

## PR Template

```markdown
## Summary
[1-3 bullet points describing the changes]

## Changes
- [Specific change with file reference]
- [Specific change with file reference]

## Test Plan
- [ ] [How to verify change 1]
- [ ] [How to verify change 2]

## Screenshots
[If UI changes, include before/after]

## Related Issues
Closes #[issue number]

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

## Writing Good Descriptions

### Summary
- Be concise but complete
- Focus on the "what" and "why"
- Reference related issues

### Test Plan
- Specific steps to verify
- Include edge cases tested
- Note any manual testing needed

## Output Format

```markdown
## Pull Request Created

**Title:** feat: add user authentication
**URL:** https://github.com/org/repo/pull/123
**Branch:** `feature/auth` → `main`

### Summary
- Added login/logout functionality
- Implemented session management
- Added comprehensive tests

### Status
- [ ] CI checks running
- [ ] Awaiting review

### Next Steps
- Wait for CI
- Request reviewers
- Address feedback
```

## Transition

After PR creation:
- Wait for CI checks
- `review/review-pr` - Self-review if needed
- Address reviewer feedback
