---
workflow: plan
priority: high
---

# Workflow: Plan

> **Purpose:** Create detailed implementation plan without writing code
> **Mode:** Read-only (no code changes)
> **Command:** `/plan [scope flags] <task description>`
> **Scope:** See [scope.md](../scope.md)

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Focus planning on specific files/directories |
| `--uncommitted` | Plan based on current uncommitted changes |
| `--project=<path>` | Project root for monorepos |

**Examples:**
```bash
/plan --files=src/auth/ add password validation
/plan --uncommitted what's the best way to finish this
/plan add caching to the API layer
```

---

## Workflow

**Do NOT write any code.** Planning only.

### Step 1: Parse Scope

```bash
# Get current context
git branch --show-current
git status --porcelain
```

**Display scope context:**

```markdown
## Plan Scope

| Scope | Value |
|-------|-------|
| Files | [from --files or "to be determined"] |
| Branch | [current branch] |

**Task:** [from user input]
```

### Step 2: Explore Relevant Code

1. Search for related files
2. Read key components
3. Understand existing patterns
4. Identify dependencies

### Step 3: Identify Approach

Consider:
- What changes are needed?
- Which files will be modified?
- What patterns should be followed?
- What edge cases exist?
- What could go wrong?

### Step 3.1: Complexity Check

**Assess the scale of changes:**
- > 5 files modified?
- Core architectural components affected?
- New external dependencies?
- Significant database schema changes?

**If YES to any:**
> **STOP AND CONSIDER:**
> This task may require architectural review.
> Suggest switching to **Architect Mode** (`/chatmode architect`) to design the solution first.

### Step 4: Create Plan

```markdown
## Implementation Plan

### Scope
| Scope | Value |
|-------|-------|
| Files | [paths] |
| Branch | [branch name] |
| Task | [task description] |

### Summary
[1-2 sentence overview]

### Files to Modify
| File | Change |
|------|--------|
| `path/to/file.ts` | [what changes] |

### Implementation Steps
1. [Specific action]
2. [Specific action]
3. [Specific action]

### Edge Cases
| Case | Handling |
|------|----------|
| [Edge case] | [How to handle] |

### Test Strategy
- [How to verify the changes]

### Potential Risks
- [What could go wrong]

---
**Approve this plan?** (yes / no / modify)
```

### Step 5: Wait for Approval

**⛔ Do NOT proceed to implementation without explicit approval.**

After approval, user can run `/implement` to execute the plan.

---

## Extended Thinking

For complex decisions, use extended thinking:

```
think hard about the best approach for [specific aspect]
```

Consider:
- Multiple approaches and trade-offs
- Existing patterns in the codebase
- Performance implications
- Maintainability

---

## Output Requirements

The plan must include:
- **Scope context** - Files, branch, task
- **Overview** - What this accomplishes
- **Files to modify** - With specific changes
- **Steps** - Ordered implementation steps
- **Edge cases** - And how to handle them
- **Test strategy** - How to verify
- **Risks** - What could go wrong

---

**See Also:**
- [Explore](./explore.prompt.md) - For understanding code first
- [Implement](./implement.prompt.md) - For executing the plan
