---
workflow: review-branch
priority: high
---

# Review Current Branch

> **Purpose:** Perform a comprehensive code review of the current branch against the base branch
> **Prerequisites:** Branch has changes to review (committed or staged)

## Steps

### 1. Gather Branch Context

Collect information about the current branch and changes:

```bash
# Get current branch name
git branch --show-current

# Get main branch from GitHub
MAIN_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')

# Check for open PR on GitHub
gh pr view --json number,title,body,baseRefName,url 2>/dev/null
```

### 2. Get the Diff

If a PR exists, use the PR diff. Otherwise, diff against the base branch:

```bash
# If PR exists
gh pr diff

# If no PR, diff against base branch
git diff $MAIN_BRANCH...HEAD --stat
git diff $MAIN_BRANCH...HEAD
```

### 3. Identify Changed Files

List all files that were modified:

```bash
# Get list of changed files
git diff $MAIN_BRANCH...HEAD --name-only

# Categorize changes by file type
# - .ts/.tsx files → TypeScript review
# - .spec.ts files → Test review
# - Config files → Configuration review
```

### 4. Read and Review Each Changed File

For each changed file:

1. Read the full file to understand context
2. Apply relevant domain guidelines from `.ai-assistant/domains/`
3. Check against the review checklist below
4. Note any issues by severity level

### 5. Run Linting on Changed Files

```bash
# Get changed files and run eslint (if applicable)
npm run lint
```

For any warnings found:
1. **List each warning** with file location and rule name
2. **Propose a fix** for each warning
3. **Include in review report** under Warnings section with proposed fix

### 6. Check for Common Issues

#### Code Quality
- [ ] No `any` types (TypeScript)
- [ ] Proper type usage (`satisfies` vs `as`)
- [ ] Correct import organization
- [ ] Named exports only (no default)
- [ ] No `var` declarations
- [ ] No lint warnings (or propose fixes)

#### Testing
- [ ] Test coverage for new code
- [ ] Meaningful test descriptions
- [ ] Proper async handling

#### Security
- [ ] No XSS vulnerabilities
- [ ] Input validation present
- [ ] No sensitive data exposed
- [ ] No hardcoded secrets

#### Performance
- [ ] No obvious performance bottlenecks (loops, re-renders)
- [ ] Efficient data fetching
- [ ] Bundle size impact considered

#### General
- [ ] Architecture aligns with system design
- [ ] No `console.log` statements in production code
- [ ] Error handling present
- [ ] No dead code or unused imports

### 7. Generate Review Report

Format the review using this template:

```markdown
## Code Review: [Branch Name]

### PR Information
- **PR:** #[number] - [title] (if exists)
- **Branch:** [current] → [base]
- **Files Changed:** [count]

### Summary
[Brief overview of what the changes accomplish]

### Critical Issues 🔴
[Must fix before merge]

1. [Issue description]
   - **Location:** file.ts:line
   - **Problem:** [What's wrong]
   - **Fix:** [How to fix]

### Warnings 🟡
[Should fix, but not blocking]

1. [Issue description]
   - **Location:** file.ts:line
   - **Concern:** [What could be better]
   - **Suggestion:** [Recommended approach]

### Suggestions 🔵
[Nice to have improvements]

1. [Improvement idea]
   - **Location:** file.ts:line
   - **Current:** [Current implementation]
   - **Alternative:** [Suggested approach]

### Positive Notes ✅
- [What was done well]
- [Good patterns used]
- [Effective solutions]

### Files Reviewed
| File | Status | Notes |
|------|--------|-------|
| path/to/file.ts | ✅/🟡/🔴 | Brief note |

### Conclusion
[Overall assessment]

---
**Recommendation:** [Approve / Request Changes / Needs Discussion]
```

## Rules

### Prohibited

- **Do not modify any files** - suggestions only
- **Do not run tests** - that's validation, not review
- **Do not make commits** - read-only review
- **Do not implement fixes** - just identify issues

### Required

- **Read all changed files** before providing feedback
- **Apply domain guidelines** for each file type
- **Use severity levels** (🔴 🟡 🔵) appropriately
- **Provide actionable feedback** with specific locations
- **Acknowledge good patterns** - not just problems

## Severity Levels

### 🔴 Critical (Must Fix)

- Security vulnerabilities
- Breaking changes without tests
- Use of `any` type
- Missing error handling
- Accessibility violations

### 🟡 Warning (Should Fix)

- Code style violations
- Missing test coverage
- Suboptimal patterns
- Performance concerns

### 🔵 Suggestion (Nice to Have)

- Refactoring opportunities
- Alternative implementations
- Documentation improvements

## Example Execution

```
1. User: "/review"

2. Check for PR:
   gh pr view → PR #123 "Add data export feature"
   Base: main

3. Get diff:
   gh pr diff
   → 5 files changed

4. Review files:
   - src/utils/export.ts
     → No `any` types ✅
     → Missing error handling for file write 🔴

   - src/utils/export.spec.ts
     → Has tests ✅
     → Missing edge case test for empty data 🟡

5. Run lint on changed files:
   npm run lint
   → 1 warning found
   → Propose fix

6. Generate report with findings

7. Recommendation: Request Changes (critical issue found)
```

## References

- [TypeScript Guidelines](../domains/typescript.instructions.md)
- [Testing Guidelines](../domains/testing.instructions.md)
