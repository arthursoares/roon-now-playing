---
description: Review changes and create a commit (with confirmation)
---

# Commit

Follow **[commit.prompt.md](../../.ai-assistant/workflows/commit.prompt.md)** for: $ARGUMENTS

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Commit only specified files |
| `--uncommitted` | Commit all uncommitted changes (default) |
| `--staged` | Commit only already-staged files |

**Examples:**
```
/commit                      # All uncommitted changes
/commit --files=src/auth/    # Only auth directory
/commit --staged             # Only staged files
```

## Steps

1. Parse scope from flags
2. Review changes (within scope)
3. Show summary of what will be committed
4. Suggest commit message
5. **Wait for your confirmation**
6. Create commit (only scoped files)

I will NOT commit without your explicit approval.
