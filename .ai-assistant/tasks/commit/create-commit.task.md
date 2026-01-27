---
task: create-commit
chatmode: committer
tools: [bash, read]
gate: confirmation-required
---

# Task: Create Commit

> **Purpose:** Create a git commit with meaningful message
> **Chatmode:** Committer
> **Gate:** Requires explicit user confirmation

## Steps

1. **Verify staging** - Confirm correct files are staged
2. **Draft message** - Write meaningful commit message
3. **Get confirmation** - Wait for user approval
4. **Commit** - Only after explicit "yes"

## Confirmation Gate

**CRITICAL:** Never commit without explicit user approval.

```markdown
## Ready to Commit

**Staged files:**
- `src/auth.ts`
- `src/auth.spec.ts`

**Commit message:**
```
feat: add user authentication

Implements login/logout with session management.
```

**Commit these changes?** (yes / no)
```

Wait for: "yes", "commit", "ok", "proceed"

## Commit Message Format

```
<type>(<scope>): <short summary>

<body: explain what and why>

<footer: breaking changes, issue refs>
```

### Types
| Type | Use When |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring |
| `test` | Adding/updating tests |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `chore` | Maintenance, deps |

### Good Messages
```
feat: add password reset functionality

Implements email-based password reset flow with token validation.
Tokens expire after 24 hours.

Closes #123
```

### Bad Messages
```
fix stuff
update code
wip
```

## Commands

```bash
# Commit with message
git commit -m "$(cat <<'EOF'
feat: add feature

Description here.
EOF
)"

# Commit with editor
git commit

# Amend last commit (use carefully)
git commit --amend
```

## Safety Rules

1. **Always show changes before asking to commit**
2. **Wait for explicit confirmation**
3. **Never amend commits already pushed**
4. **Never amend others' commits**

## Output Format

After commit:

```markdown
## Commit Created

**SHA:** `abc1234`
**Message:** feat: add user authentication

**Files:**
- `src/auth.ts`
- `src/auth.spec.ts`

**Next:** Push to remote or continue working
```

## Transition

After commit:
- `commit/push-branch` - Push to remote
- Continue working on next task
- `commit/create-pr` - If ready for PR
