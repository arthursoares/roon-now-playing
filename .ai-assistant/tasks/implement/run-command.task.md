---
task: run-command
chatmode: developer
tools: [bash]
---

# Task: Run Command

> **Purpose:** Execute shell commands for development tasks
> **Chatmode:** Developer (full access)
> **Caution:** Verify commands before running

## Common Development Commands

### Build & Run
```bash
# Development server
{{DEV_COMMAND}}

# Production build
{{BUILD_COMMAND}}

# Preview production build
{{PREVIEW_COMMAND}}
```

### Quality Checks
```bash
# Type checking
{{TYPECHECK_COMMAND}}

# Linting
{{LINT_COMMAND}}

# Formatting
{{FORMAT_COMMAND}}
```

### Testing
```bash
# Run all tests
{{TEST_COMMAND}}

# Run specific test
{{TEST_COMMAND}} {{TEST_SCOPE_FLAG}}

# Run tests in watch mode
{{TEST_WATCH_COMMAND}}
```

### Dependencies
```bash
# Install dependencies
{{INSTALL_COMMAND}}

# Add new dependency
{{ADD_DEP_COMMAND}}

# Add dev dependency
{{ADD_DEV_DEP_COMMAND}}
```

## Safety Guidelines

### Safe to Run
- Build commands
- Type checking
- Linting
- Tests
- Formatting

### Require Confirmation
- Install commands (changes package-lock)
- Database migrations
- Deployment scripts
- Git operations

### Never Run
- Commands with production credentials
- Force push to main/master
- Commands that delete data

## Tips

- Run type check after code changes
- Run scoped tests, not full suite
- Check command output for errors
- Use `--dry-run` flags when available

## Error Handling

If command fails:

```markdown
**Command Failed:** `[command]`

**Error:** [error message]

**Likely Cause:** [explanation]

**Fix:** [what to do]
```

## Output Format

After running:

```markdown
**Ran:** `[command]`

**Result:** Success / Failed

**Output:** (if relevant)
[relevant output lines]

**Next:** [what to do based on result]
```

## Transition

After running commands:
- If type check fails → `implement/edit-file` to fix
- If lint fails → `implement/edit-file` to fix
- If tests fail → `test/debug-test` to investigate
