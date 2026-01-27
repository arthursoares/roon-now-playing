---
description: Prepare and publish a release with version bump, changelog, and tagging
---

# Release

Follow **[release.prompt.md](../../.ai-assistant/workflows/release.prompt.md)** for: $ARGUMENTS

## Actions

| Argument | Description |
|----------|-------------|
| `patch` | Bug fix release (1.0.0 → 1.0.1) |
| `minor` | Feature release (1.0.0 → 1.1.0) |
| `major` | Breaking change release (1.0.0 → 2.0.0) |
| `X.Y.Z` | Explicit version number |

## Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without committing or tagging |
| `--no-tag` | Skip git tag creation |
| `--prerelease=<id>` | Create prerelease (alpha, beta, rc) |

**Examples:**
```
/release patch
/release minor --dry-run
/release 2.0.0-beta.1
```

## Phases

1. **Prepare** - Check status, gather changes since last release
2. **Version** - Bump version, update changelog → **wait for approval**
3. **Validate** - Full CI pipeline (typecheck, lint, test, build)
4. **Tag** - Create commit and tag → **wait for confirmation**
5. **Notes** - Generate release notes, optional GitHub release

I will pause at each gate for your input.
