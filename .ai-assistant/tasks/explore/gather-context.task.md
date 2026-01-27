---
task: gather-context
chatmode: architect
tools: [read, glob, grep]
---

# Task: Gather Context

> **Purpose:** Understand requirements and explore relevant code before implementation
> **Chatmode:** Architect (read-only exploration)
> **Output:** Clear understanding of scope and affected areas

## Steps

1. **Clarify the request** - Ask questions to understand what the user wants
2. **Explore the codebase** - Find relevant files, patterns, dependencies
3. **Identify affected areas** - List files that will need changes
4. **Surface edge cases** - Find potential complications or unknowns

## Key Questions to Ask

- What is the expected behavior?
- What are the acceptance criteria?
- Are there existing patterns to follow?
- What files/components are involved?
- What are the potential edge cases?

## Useful Commands

```bash
# Find files by pattern
find . -name "*.ts" -path "*/components/*" | head -20

# Search for related code
grep -r "functionName" src/ --include="*.ts"

# View file structure
tree src/components -L 2

# Find imports of a module
grep -r "from './module'" src/

# Find usages of a function/type
grep -rn "MyFunction\|MyType" src/
```

## Tips

- Start broad, then narrow down
- Look at existing similar implementations
- Check test files for expected behavior
- Read related documentation in `.ai-assistant/`
- Don't assume - verify with user when unclear

## Output Format

```markdown
## Context Summary

**Request:** [What user wants]

**Affected Files:**
- `path/to/file.ts` - [why it's affected]

**Existing Patterns:**
- [Pattern found in codebase]

**Edge Cases:**
- [Potential complication]

**Questions:**
- [Anything unclear]
```

## Transition

After gathering context, proceed to:
- `plan/create-plan` - If implementation approach needs approval
- `implement/edit-file` - If scope is small and clear
