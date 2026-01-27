---
workflow: commit
priority: high
---

# Commit

> **Purpose:** Create a clean, well-documented commit
> **Chatmode:** Developer
> **Requires:** User confirmation before committing
> **Command:** `/commit [scope flags]`
> **Scope:** See [scope.md](../scope.md)

## Gate Enforcement

**CRITICAL:** Commits are irreversible actions. NEVER commit without explicit user approval.

**Valid approval responses:**
- `yes`, `y`, `commit`, `approved`, `lgtm`, `go ahead`

**Invalid (do NOT treat as approval):**
- Silence or no response
- Questions about the changes
- Requests to see the diff
- Partial acknowledgment ("I see", "okay", "looks fine")

**Rule:** If there is ANY ambiguity, ask: "Please confirm with 'yes' to commit these changes."

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Commit only specified files |
| `--uncommitted` | Commit all uncommitted changes (default) |
| `--staged` | Commit only already-staged files |

**Examples:**
```bash
/commit                           # All uncommitted changes
/commit --files=src/auth/         # Only auth directory
/commit --staged                  # Only staged files
```

## Workflow

### Step 0: Parse Scope

```bash
# Get current context
git branch --show-current
git status --porcelain
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
```

**Determine scope:**
- `--files=<paths>` → filter to specified paths
- `--staged` → only staged files
- `--uncommitted` or default → all uncommitted changes

### Step 1: Review Changes (Within Scope)

```bash
# What's changed (filtered by scope)
git status [scope-filter]

# Changes vs main branch
git diff $MAIN...HEAD -- [scope-paths]

# Uncommitted changes (within scope)
git diff -- [scope-paths]

# Staged changes (within scope)
git diff --staged -- [scope-paths]
```

**Show summary:**
```markdown
## Changes to Commit

**Scope:** `[scope description]`
**Branch:** `[current branch]`

**Modified:**
- `path/to/file.ts` - [brief description]

**Added:**
- `path/to/new.ts` - [purpose]

**Deleted:**
- `path/to/old.ts` - [reason]

**Stats:** X files changed, +Y insertions, -Z deletions

**Note:** [if scoped] Only showing changes within scope.
```

### Step 2: Validate (Optional but Recommended)

```bash
npm run typecheck
npm run lint
npm run test -- [affected]
```

### Step 3: Confirm with User

```markdown
---
**Ready to commit these changes?**

Suggested commit message:
\`\`\`
[type]: [description]

[optional body]
\`\`\`

Options:
- **yes** - Commit with this message
- **edit** - Modify the message
- **review** - Show full diff again
- **cancel** - Abort commit
```

**Wait for explicit confirmation.**

### Step 4: Commit (Within Scope)

Only after user confirms:

```bash
# Stage files within scope
git add [scope-paths]  # NOT -A unless scope is "all"

# Create commit
git commit -m "[message]"
```

**Scope handling:**
- `--files=<paths>` → `git add <paths>`
- `--staged` → skip add, commit staged only
- `--uncommitted` → `git add -A`

### Step 5: Report

```markdown
## Committed

**SHA:** `abc1234`
**Message:** [type]: [description]
**Files:** X files changed

---
**Next:** Push? Create PR? Continue working?
```

---

## Commit Message Format

```
[type]: [short description]

[optional longer description]

[optional footer: references, breaking changes]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `chore` | Maintenance, dependencies |
| `perf` | Performance improvement |

### Examples

```
feat: add user authentication

Implement JWT-based auth with login/register endpoints.
Protected routes now require valid token.
```

```
fix: handle special characters in password

URL encoding was mangling passwords with @, #, & symbols.
Now passwords are passed directly without encoding.

Fixes #123
```

```
refactor: extract validation logic

Move form validation to shared utility.
No behavior changes.
```

---

## Rules

- **Never commit without confirmation**
- **Never commit secrets** (.env, credentials, API keys)
- **Never force push** without explicit request
- **Always show what will be committed** before committing

---

**See Also:**
- [Create PR](./create-pr.prompt.md)
- [Validate](./validate.prompt.md)
