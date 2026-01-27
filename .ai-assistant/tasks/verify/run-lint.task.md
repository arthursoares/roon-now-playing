---
task: run-lint
chatmode: developer
tools: [bash, read]
---

# Task: Run Lint

> **Purpose:** Check code style and catch potential issues
> **Chatmode:** Developer
> **When:** After type check passes, before commit

## Steps

1. **Run linter** - Execute project's lint command
2. **Review warnings/errors** - Understand issues
3. **Fix or ignore** - Apply fixes or document exceptions
4. **Re-run** - Verify fixes

## Command

See `project/config.md` for project-specific command:

```bash
# Typical commands
{{LINT_COMMAND}}
{{PACKAGE_MANAGER}} run lint
```

## Auto-Fix

Most lint issues can be auto-fixed:

```bash
{{LINT_FIX_COMMAND}}
```

## Common Lint Issues

### Unused Variables
```typescript
// Warning: 'unused' is defined but never used
// Fix: Remove or prefix with underscore
const _unused = value; // if intentionally unused
```

### Import Order
```typescript
// Warning: imports not in correct order
// Fix: Usually auto-fixable with --fix
```

### Missing Dependencies in Effects
```typescript
// Warning: {{FRAMEWORK}} Hook useEffect has missing dependencies
// Fix: Add dependencies or disable rule with comment
useEffect(() => { ... }, [dependency]); // eslint-disable-line {{FRAMEWORK_HOOK_RULE}}
```

### Console Statements
```typescript
// Warning: Unexpected console statement
// Fix: Use project logger instead
import { logger } from '@{{PROJECT_NAME}}/utils';
logger.info('message');
```

## Tips

- Run with `--fix` first to auto-resolve simple issues
- Don't disable rules without good reason
- Document rule disables with comments
- Configure project rules in {{LINTER}} config, not inline

## Output Format

```markdown
**Ran:** Lint check

**Result:** Pass / X warnings, Y errors

**Issues:** (if any)
- `path/file.ts:42` - [rule]: [message]

**Auto-fixed:** [list of auto-fixed issues]

**Next:** [fix remaining / proceed]
```

## Transition

After linting:
- Pass → `test/run-tests` or `commit/stage-changes`
- Fixable issues → Run with `--fix`
- Complex issues → `implement/edit-file` to fix manually
