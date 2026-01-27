---
description: Run validation checks for current work (type checking, linting, tests, security)
---

# Validate

Follow **[validate.prompt.md](../../.ai-assistant/workflows/validate.prompt.md)** for: $ARGUMENTS

## Modes

| Mode | Description |
|------|-------------|
| (default) | Quick validation - scoped to changes |
| `--full` | Complete CI pipeline |
| `--fix` | Auto-fix format/lint issues |
| `--ci` | Mirror exact CI configuration |

## Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Validate specific files/directories |
| `--uncommitted` | Validate uncommitted changes (default) |
| `--staged` | Validate staged changes only |
| `--security` | Include npm audit |
| `--coverage` | Include test coverage report |

**Examples:**
```
/validate                           # Quick validation of changes
/validate --fix                     # Auto-fix format/lint issues
/validate --full                    # Complete CI pipeline
/validate --full --coverage         # Full validation with coverage
/validate --ci                      # Mirror exact CI checks
/validate --security                # Include security audit
```

## Validation Levels

**Quick (default):**
1. Format check
2. Type check
3. Lint
4. Scoped tests

**Full (`--full`):**
1. Format → Types → Lint
2. Security audit (if `--security`)
3. Full test suite
4. Coverage report (if `--coverage`)
5. Build
6. Bundle size (if configured)

**Fix (`--fix`):**
1. Auto-fix formatting
2. Auto-fix lint errors
3. Verify remaining issues
4. Run scoped tests

Stops at first failure and reports solutions.
