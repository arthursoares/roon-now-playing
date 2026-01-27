---
description: Debug a problem - find root cause and fix
---

# Debug

Follow **[debug.prompt.md](../../.ai-assistant/workflows/debug.prompt.md)** for: $ARGUMENTS

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Limit investigation to specific files |
| `--branch=<name>` | Compare against specific branch |

**Examples:**
```
/debug --files=src/api/client.ts network timeout errors
/debug --files=src/auth/ login fails with special chars
/debug users can't save profile
```

## Workflow

Describe the problem (or provide via natural language):
- What's happening vs what should happen?
- Steps to reproduce
- Any error messages?

I'll help you:
1. Parse scope and understand the problem
2. Investigate within scope
3. Locate the root cause
4. Implement a fix
5. Verify it works
