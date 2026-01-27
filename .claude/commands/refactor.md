---
description: Systematic codebase refactoring with planning, pattern detection, and parallel execution
---

# Refactor

Follow **[refactor.prompt.md](../../.ai-assistant/workflows/refactor.prompt.md)** for: $ARGUMENTS

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Limit refactor to specific files/directories |
| `--project=<path>` | Project root for monorepos |

**Examples:**
```
/refactor --files=src/components/ rename getUserData to fetchUser
/refactor --files=src/api/ migrate from axios to fetch
/refactor update all Button imports to use new path
```

## Workflow

1. Parse scope and gather context
2. Pattern analysis and edge case identification
3. Create plan with full scope documentation
4. **Wait for your approval**
5. Execute with progress tracking
6. Validate and **confirm before commit**
