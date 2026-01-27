---
description: Create a pull request for current branch
---

# Create PR

Follow **[create-pr.prompt.md](../../.ai-assistant/workflows/create-pr.prompt.md)** for: $ARGUMENTS

## Scope Flags

| Flag | Description |
|------|-------------|
| `--branch=<name>` | Create PR for specific branch (default: current) |
| `--base=<name>` | Target base branch (default: main) |

**Examples:**
```
/pr                              # Current branch → main
/pr --base=develop               # Current branch → develop
/pr --branch=feature/auth        # Specific branch
```

## Workflow

1. Check branch status and commits
2. Run validation (types, lint, tests)
3. Analyze what was changed and why
4. Push branch to remote
5. Create PR with summary, changes, and test plan
6. Report PR URL
