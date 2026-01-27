---
workflow: explore
priority: high
---

# Workflow: Explore

> **Purpose:** Understand code without making changes
> **Mode:** Read-only
> **Command:** `/explore [scope flags] <question>`
> **Scope:** See [scope.md](../scope.md)

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Focus exploration on specific files/directories |
| `--project=<path>` | Project root for monorepos |

**Examples:**
```bash
/explore --files=src/auth/ how does login work
/explore --files=src/api/ what patterns are used
/explore how does the state management work
```

---

## Workflow

**Read-only mode** - Do NOT make any changes.

### Step 1: Parse Scope

```bash
# Get current context
git branch --show-current
```

If `--files` provided, focus exploration on those paths.

### Step 2: Search for Relevant Files

Based on the question, search for relevant files:

```bash
# Search for keywords
grep -rn "keyword" src/

# Find files by pattern
find . -name "*.ts" -path "*/auth/*"
```

### Step 3: Read and Analyze

1. Read key files identified
2. Trace imports and dependencies
3. Understand data flow
4. Note patterns and conventions

### Step 4: Summarize Findings

```markdown
## Exploration: [Question]

### Key Files
| File | Purpose |
|------|---------|
| `path/to/file.ts` | [what it does] |

### How It Works
[Explanation of the code flow]

### Patterns Found
- [Pattern 1]
- [Pattern 2]

### Dependencies
- [What this code depends on]
- [What depends on this code]

### Considerations
- [Things to be aware of]
- [Potential issues]
```

---

## Output Requirements

- **Key files involved** - List with purpose
- **How the code works** - Clear explanation
- **Patterns to follow** - Conventions found
- **Considerations** - Things to be aware of

---

**See Also:**
- [Plan](./plan.prompt.md) - For creating implementation plans
- [Implement](./implement.prompt.md) - For making changes
