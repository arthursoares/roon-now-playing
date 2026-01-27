---
task: run-checks
chatmode: developer
tools: [bash, read]
---

# Task: Run All Checks

> **Purpose:** Complete validation before commit
> **Chatmode:** Developer
> **When:** After implementation, before commit

## Check Order

Run checks in this order, stopping at first failure:

1. **Type Check** - Catch type errors
2. **Lint** - Catch style/quality issues
3. **Tests** - Verify behavior (scoped to changes)

## Commands

See `project/config.md` for project-specific commands.

```bash
# Example sequence
npm run typecheck && npm run lint && npm run test -- --scope
```

## Quick Mode (for small changes)

```bash
# Type check + lint only
npm run typecheck && npm run lint
```

## Full Mode (before PR)

```bash
# All checks including full test suite
npm run typecheck && npm run lint && npm run test
```

## Failure Strategy

### On Type Check Failure
```
Stop → Fix types → Re-run from start
```

### On Lint Failure
```
Try auto-fix → If still fails, fix manually → Re-run from lint
```

### On Test Failure
```
Stop → Debug test → Fix → Re-run tests only
```

## Tips

- Run checks frequently during development
- Fix issues immediately, don't accumulate
- Use pre-commit hooks to enforce checks
- Scope tests to changed code for speed

## Output Format

```markdown
**Validation Results:**

| Check | Status | Details |
|-------|--------|---------|
| Type Check | ✓ Pass | - |
| Lint | ✓ Pass | 2 auto-fixed |
| Tests | ✓ Pass | 12 passed |

**Next:** Ready to commit
```

Or on failure:

```markdown
**Validation Failed:**

| Check | Status | Details |
|-------|--------|---------|
| Type Check | ✓ Pass | - |
| Lint | ✗ Fail | 3 errors |

**Errors:**
- `path/file.ts:42` - [error]

**Next:** Fix lint errors, then re-run
```

## Transition

After validation:
- All pass → `commit/stage-changes`
- Type errors → `implement/edit-file`
- Lint errors → `implement/edit-file` or auto-fix
- Test failures → `test/debug-test`
