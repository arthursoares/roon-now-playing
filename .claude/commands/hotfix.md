---
description: Emergency bug fix with abbreviated validation for production issues
---

# Hotfix

Follow **[hotfix.prompt.md](../../.ai-assistant/workflows/hotfix.prompt.md)** for: $ARGUMENTS

## When to Use

- Production is broken
- Critical security vulnerability
- Data corruption or loss
- User-blocking bug with no workaround

**For non-urgent bugs, use `/debug` instead.**

## Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Known affected files |
| `--ticket=<id>` | Issue/ticket reference |
| `--severity=<level>` | `critical` / `high` |

**Examples:**
```
/hotfix users cannot login
/hotfix --ticket=PROD-123 session tokens expiring
/hotfix --files=src/auth/ payment failing
```

## Phases

1. **Triage** - Quick root cause identification → **confirm cause**
2. **Fix** - Minimal change only → **approve fix approach**
3. **Verify** - Scoped validation (typecheck + affected tests)
4. **Deploy** - Commit with [HOTFIX] label, create PR

This workflow prioritizes speed over thoroughness. Changes should be minimal.
