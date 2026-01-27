# Scope System

> **Purpose:** Standardized scope handling for workflows and commands
> **Usage:** All workflows should parse and inherit scope context

## Scope Flags

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--files=<paths>` | `-f` | Specific files or directories (comma-separated) | `--files=src/auth/,src/utils/` |
| `--uncommitted` | `-u` | Limit to staged/unstaged changes | `--uncommitted` |
| `--branch=<name>` | `-b` | Branch context (default: current) | `--branch=feature-auth` |
| `--project=<path>` | `-p` | Project root for monorepos | `--project=packages/api` |

## Usage Examples

```bash
# Implement feature in specific directory
/implement --files=src/auth/ add password validation

# Commit only uncommitted changes
/commit --uncommitted

# Debug specific file
/debug --files=src/api/client.ts network timeout errors

# Validate specific component
/validate --files=src/components/Button/

# Refactor across project in monorepo
/refactor --project=packages/web rename getUserData to fetchUser
```

## Scope Context Block

Workflows should establish and display scope context early:

```markdown
## Scope Context

| Scope | Value |
|-------|-------|
| Files | `src/auth/`, `src/utils/auth.ts` |
| Uncommitted | Yes (3 files) |
| Branch | `feature/password-validation` |
| Project | (root) |

**Task:** [natural language description from user]
```

## Scope Inference

When scope is not explicitly provided, infer from context:

### Step 1: Check Git Status

```bash
# Get current branch
git branch --show-current

# Get uncommitted files
git status --porcelain

# Get main branch
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
```

### Step 2: Apply Inference Rules

| Condition | Inferred Scope |
|-----------|----------------|
| Has uncommitted changes | Default to uncommitted files |
| On feature branch (not main/master) | Changes vs main branch |
| User mentions file/component | Extract paths from natural language |
| Ambiguous | Prompt user for clarification |

### Step 3: Confirm Scope

If scope was inferred (not explicit), confirm with user:

```markdown
## Scope Detected

Based on your request and current state:

| Scope | Value |
|-------|-------|
| Files | `src/auth/login.ts`, `src/auth/validate.ts` |
| Branch | `feature/auth-improvements` |

**Is this the correct scope?** (yes / adjust)
```

## Scope Inheritance

Scope flows through chained workflow phases:

```
Command Input → Parse Scope → Explore Phase → Plan Phase → Code Phase → Commit Phase
                    ↓              ↓              ↓             ↓            ↓
               [scope ctx]    [inherit]      [inherit]    [inherit]    [filter]
```

### Rules

1. **Initial scope** is parsed from command flags + natural language
2. **Each phase inherits** scope from previous phase
3. **Phases can narrow** scope (e.g., "only these 2 of 5 files need changes")
4. **Phases cannot expand** scope without user approval
5. **Final phase** (commit/PR) filters output to show only in-scope changes

### Passing Scope Between Phases

When transitioning between phases, include scope summary:

```markdown
---
**Scope carried forward:**
- Files: `src/auth/login.ts`, `src/auth/validate.ts`
- Branch: `feature/auth-improvements`
- Task: Add password validation for special characters
---
```

## Scope in Validation

When running validation (`/validate`), scope determines what to check:

| Scope | Validation Behavior |
|-------|---------------------|
| `--files=<paths>` | Type check all, tests scoped to paths |
| `--uncommitted` | Type check all, tests scoped to changed files |
| `--full` | Complete CI pipeline (all tests, build) |
| No scope | Smart scoping based on recent work |

## Scope in Commits

When committing (`/commit`), scope determines what to stage:

| Scope | Commit Behavior |
|-------|-----------------|
| `--files=<paths>` | Stage only specified files |
| `--uncommitted` | Stage all uncommitted (default) |
| `--staged` | Commit only already-staged files |
| No scope | Show all changes, ask what to include |

## Prompting for Scope

When scope cannot be inferred, prompt the user:

```markdown
> **ACTION REQUIRED:**
> I couldn't determine the scope for this task.
>
> Please specify:
> - **Files/directories** to work on, or
> - **--uncommitted** to use current changes, or
> - Describe the area/component in your request
>
> Example: `/implement --files=src/auth/ add validation`
```

## Natural Language Scope

Users can provide additional context via natural language after flags:

```bash
/implement --files=src/auth/ add password validation for special characters like @ and #
```

The natural language portion becomes the **Task** in scope context:
- **Files:** `src/auth/`
- **Task:** "add password validation for special characters like @ and #"

---

**See Also:**
- [Global Instructions](./.instructions.md)
- [Workflow: Implement](./workflows/implement.prompt.md)
- [Workflow: Commit](./workflows/commit.prompt.md)
