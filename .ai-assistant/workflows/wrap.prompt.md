---
workflow: wrap
priority: high
---

# Wrap

> **Purpose:** Systematically conclude a unit of work by ensuring test coverage, running validation, performing review, and committing when ready
> **Related:** [validate.prompt.md](./validate.prompt.md)

## Overview

The Wrap workflow is your end-of-session routine for wrapping up work cleanly. It ensures:

1. All changes are covered by tests
2. All validation checks pass
3. Code review catches any issues
4. Clean commit with proper message

Think of it as your checklist before calling it a day - no loose ends, no surprises tomorrow.

## Steps

### Phase 1: Assess Current State

Get a clear picture of what needs to be wrapped up:

```bash
# Get main branch name
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Current branch
git branch --show-current

# Uncommitted changes
git status --short

# Recent commits on branch (vs base)
git log --oneline $MAIN..HEAD
```

**Decision point:** If there are uncommitted changes, proceed with full workflow. If only commits exist, skip to Phase 4 (Review).

### Phase 2: Cover with Tests

Ensure changed code has test coverage.

**Quick checklist:**

1. **Identify changed files:**
   ```bash
   git diff --name-only $MAIN..HEAD
   git diff --name-only  # Uncommitted changes
   ```

2. **Check for missing tests:**
   - Each changed `.ts` file should have a corresponding `.spec.ts`
   - Each new component should have tests
   - New utilities should have unit tests

3. **Create missing tests:**
   - Include test plans in Gherkin format
   - Cover happy paths and edge cases

4. **Run tests to verify:**
   ```bash
   npm run test -- ChangedComponent
   ```

**Exit criteria:** All changed code has corresponding tests, all tests pass.

### Phase 3: Validate

Follow **[validate.prompt.md](./validate.prompt.md)**.

Run validation checks in order - stop and fix if any level fails:

1. **Type checking:**
   ```bash
   npm run typecheck
   ```

2. **Linting:**
   ```bash
   npm run lint
   ```

3. **Scoped tests:**
   ```bash
   npm run test -- "path/to/changed/"
   ```

**Exit criteria:** All validation checks pass (types, lint, tests).

### Phase 4: Review

Perform a self-review before committing:

1. **Get the diff:**
   ```bash
   git diff HEAD
   git diff --staged
   ```

2. **Review checklist:**
   - [ ] No `any` types
   - [ ] Proper TypeScript patterns
   - [ ] Tests have test plans
   - [ ] No security issues
   - [ ] No `console.log` statements

3. **Note any issues by severity:**
   - Critical - must fix before commit
   - Warning - should fix, document if deferred
   - Suggestion - nice to have

**Exit criteria:** No critical issues remain. Warnings documented if deferred.

### Phase 5: Docs (Optional)

Before committing, consider documenting your work:

```markdown
## Documentation (Optional)

**Session work:** [brief summary]

**Consider documenting:**

| Type | When Relevant | Action |
|------|---------------|--------|
| AI context | Patterns learned, gotchas discovered | Update `.ai-project/` |
| User docs | User-facing changes | Update `docs/` |
| README | Getting started changes | Update `README.md` |

**What would you like to document?**
- `ai` - Update AI assistant context
- `user` - Add/update user documentation
- `readme` - Update README
- `skip` - No documentation needed
```

**⏸️ Wait for user response. If `skip`, proceed to commit.**

See [docs/update-docs.task.md](../tasks/docs/update-docs.task.md) for templates.

### Phase 6: Commit

**Requires explicit user confirmation.**

1. **Stage changes:**
   ```bash
   git add -A
   # Or selectively: git add <files>
   ```

2. **Review staged changes:**
   ```bash
   git diff --staged --stat
   ```

3. **Show commit preview and ask:**
   ```markdown
   Ready to commit with message:
   \`\`\`
   <type>: <concise description>
   \`\`\`

   **Confirm commit?** (yes / edit message / cancel)
   ```

4. **Only after confirmation:**
   ```bash
   git commit -m "<type>: <concise description>"
   ```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `test:` - Adding/updating tests
- `docs:` - Documentation
- `style:` - Formatting, no code change
- `chore:` - Maintenance tasks

### Phase 7: Final Verification (Optional)

If preparing to push:

```bash
# Verify commit
git log -1 --stat

# Check branch is ahead of remote
git status

# Optional: Full CI validation
npm run lint && npm run test && npm run build
```

## Quick Mode

For smaller changes, use the abbreviated flow:

```bash
# 1. Type check + lint
npm run typecheck && npm run lint

# 2. Run affected tests
npm run test -- ChangedComponent

# 3. Commit if all green
git add -A && git commit -m "type: description"
```

## Rules

### Prohibited

- **Do not commit with failing tests** - fix first
- **Do not skip validation** - run at least type check + lint
- **Do not commit `any` types** - fix or document as todo
- **Do not force push** without explicit request
- **Do not commit secrets** (.env, credentials)

### Required

- **Run validation before commit** - minimum: type check + lint
- **Address critical issues** - no exceptions
- **Write meaningful commit message** - describe what and why
- **Verify tests pass** for changed code

### Recommended

- **Add tests for new code**
- **Self-review changes** before committing
- **Use conventional commit format**

## Output Format

Report the workflow results:

```markdown
## Wrap Summary

### Work Assessed
- **Branch:** feature/my-feature
- **Files changed:** 5
- **Commits on branch:** 3

### Test Coverage
- utility.spec.ts - created, 6 tests passing
- types.ts - skipped (type definitions)

### Validation
- Type checking - passed
- Linting - passed
- Scoped tests - 10/10 passing

### Review
- No critical issues
- 1 warning: Consider extracting repeated logic (deferred)
- Code quality good

### Commit
- Committed: `feat: add data export feature`
- SHA: abc1234

---
Wrap complete! Ready to push or call it a day.
```

If blocked:

```markdown
## Wrap - Blocked

### Blocker
**Validation failed:** Type errors in Component.ts

### Errors
1. Property 'value' does not exist on type 'never' (line 45)
2. Missing required prop 'id' (line 78)

### Action Required
Fix type errors before committing. Run:
\`\`\`bash
npm run typecheck
\`\`\`

---
Fix issues and run `/wrap` again.
```

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         /wrap                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Assess  │───▶│  Cover  │───▶│Validate │───▶│ Review  │  │
│  │  State  │    │  Tests  │    │         │    │         │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       │              ▼              ▼              ▼        │
│       │         Create if      Fix errors    Fix critical  │
│       │          missing        if any        issues       │
│       │                                                     │
│       │                                           │        │
│       │                                           ▼        │
│       │                                    ┌─────────┐     │
│       │                                    │  Docs   │     │
│       │                                    │(optional│     │
│       │                                    └─────────┘     │
│       │                                           │        │
│       │                                           ▼        │
│       │                                    ┌─────────┐     │
│       └─────────(no changes)──────────────▶│ Commit  │     │
│                                            └─────────┘     │
│                                                  │         │
│                                                  ▼         │
│                                               Done!        │
└─────────────────────────────────────────────────────────────┘
```

## References

- [Validate](./validate.prompt.md)
- [Testing Guidelines](../domains/testing.instructions.md)
- [Tasks: docs/](../tasks/docs/)
