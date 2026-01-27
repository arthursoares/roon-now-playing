---
description: Audit, update, and manage project dependencies safely
---

# Dependencies

Follow **[deps.prompt.md](../../.ai-assistant/workflows/deps.prompt.md)** for: $ARGUMENTS

## Actions

| Action | Description |
|--------|-------------|
| `audit` | Security audit and outdated check |
| `update` | Update dependencies (patch/minor) |
| `update --major` | Include major version updates |
| `update --security` | Security patches only |
| `check` | Quick outdated check |

## Flags

| Flag | Description |
|------|-------------|
| `--package=<name>` | Specific package to update |
| `--dev` | Include devDependencies |
| `--prod` | Production dependencies only |
| `--dry-run` | Preview without applying |

**Examples:**
```
/deps audit
/deps update
/deps update --security
/deps update --package=lodash
/deps update --major --dry-run
```

## Phases

1. **Audit** - Check vulnerabilities and outdated packages
2. **Plan** - Categorize by risk, create update plan → **wait for approval**
3. **Update** - Apply in batches by risk level
4. **Validate** - Full validation (typecheck, lint, test, build)
5. **Commit** - Commit updated dependencies → **wait for confirmation**

Updates are batched by risk: security → patches → minor → major.
