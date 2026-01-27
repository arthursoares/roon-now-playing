---
description: Safely rollback changes using git revert
---

# Revert

Follow **[revert.prompt.md](../../.ai-assistant/workflows/revert.prompt.md)** for: $ARGUMENTS

## Target Options

| Target | Description |
|--------|-------------|
| (empty) | Revert last commit |
| `HEAD~N` | Revert last N commits |
| `<sha>` | Revert specific commit |
| `--pr=<number>` | Revert all commits from a PR |

## Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without applying |
| `--no-commit` | Stage reverts without committing |
| `--reason=<text>` | Document reason for revert |

**Examples:**
```
/revert
/revert HEAD~3
/revert abc123 --reason="broke production"
/revert --pr=456
/revert --dry-run abc123
```

## Phases

1. **Identify** - Show commits and changes to revert → **confirm target**
2. **Assess** - Check for dependent commits, conflict risk → **approve plan**
3. **Revert** - Apply revert, resolve any conflicts
4. **Validate** - Typecheck, lint, tests
5. **Commit** - Create revert commit → **wait for confirmation**

Reverts preserve history. Original commits remain visible in git log.
